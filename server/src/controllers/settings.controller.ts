import { Request, Response } from 'express';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class SettingsController {
  private supabase = getSupabaseClient();

  // Get user settings
  getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Get or create settings
      let { data: settings, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      // If settings don't exist, create default settings
      if (error || !settings) {
        const { data: newSettings, error: createError } = await this.supabase
          .from('user_settings')
          .insert({
            user_id: userId,
          })
          .select()
          .single();

        if (createError) {
          logger.error('Failed to create default settings:', createError);
          res.status(500).json({ success: false, error: 'Failed to create settings' });
          return;
        }

        settings = newSettings;
      }

      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      logger.error('Error in getSettings:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Update user settings
  updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const {
        email_notifications,
        call_alerts,
        weekly_report,
        marketing_emails,
        ai_voice_model,
        ai_language,
        ai_greeting,
        ai_max_call_duration,
        ai_silence_timeout,
      } = req.body;

      // Build update object with only provided fields
      const updateData: any = {};
      if (email_notifications !== undefined) updateData.email_notifications = email_notifications;
      if (call_alerts !== undefined) updateData.call_alerts = call_alerts;
      if (weekly_report !== undefined) updateData.weekly_report = weekly_report;
      if (marketing_emails !== undefined) updateData.marketing_emails = marketing_emails;
      if (ai_voice_model !== undefined) updateData.ai_voice_model = ai_voice_model;
      if (ai_language !== undefined) updateData.ai_language = ai_language;
      if (ai_greeting !== undefined) updateData.ai_greeting = ai_greeting;
      if (ai_max_call_duration !== undefined) updateData.ai_max_call_duration = ai_max_call_duration;
      if (ai_silence_timeout !== undefined) updateData.ai_silence_timeout = ai_silence_timeout;

      // Try to update existing settings
      const { data: updated, error } = await this.supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      // If no existing settings, create new ones
      if (error && error.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await this.supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            ...updateData,
          })
          .select()
          .single();

        if (createError) {
          logger.error('Failed to create settings:', createError);
          res.status(500).json({ success: false, error: 'Failed to save settings' });
          return;
        }

        res.status(200).json({
          success: true,
          data: newSettings,
          message: 'Settings saved successfully',
        });
        return;
      }

      if (error) {
        logger.error('Failed to update settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
        return;
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      logger.error('Error in updateSettings:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Get usage statistics
  getUsageStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { days = 30 } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Get statistics for the last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const { data: stats, error } = await this.supabase
        .from('usage_statistics')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        logger.error('Failed to fetch usage statistics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch usage statistics' });
        return;
      }

      // Calculate totals
      const totals = stats?.reduce(
        (acc, day) => ({
          total_calls: acc.total_calls + (day.total_calls || 0),
          inbound_calls: acc.inbound_calls + (day.inbound_calls || 0),
          outbound_calls: acc.outbound_calls + (day.outbound_calls || 0),
          total_minutes: acc.total_minutes + (day.total_minutes || 0),
          successful_calls: acc.successful_calls + (day.successful_calls || 0),
          failed_calls: acc.failed_calls + (day.failed_calls || 0),
        }),
        {
          total_calls: 0,
          inbound_calls: 0,
          outbound_calls: 0,
          total_minutes: 0,
          successful_calls: 0,
          failed_calls: 0,
        }
      );

      res.status(200).json({
        success: true,
        data: {
          daily: stats || [],
          totals,
          avg_call_duration:
            totals.total_calls > 0
              ? Math.round((totals.total_minutes / totals.total_calls) * 60)
              : 0,
          success_rate:
            totals.total_calls > 0
              ? Math.round((totals.successful_calls / totals.total_calls) * 100)
              : 0,
        },
      });
    } catch (error) {
      logger.error('Error in getUsageStatistics:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default new SettingsController();
