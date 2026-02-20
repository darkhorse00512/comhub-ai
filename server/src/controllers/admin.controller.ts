import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class AdminController {
  private supabase = getSupabaseClient();

  getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const [usersResult, agentsResult, callsResult, activeCallsResult, phonesResult, feedbackResult] = await Promise.all([
        this.supabase.from('users').select('id', { count: 'exact', head: true }),
        this.supabase.from('agents').select('id', { count: 'exact', head: true }),
        this.supabase.from('call_sessions').select('id', { count: 'exact', head: true }),
        this.supabase.from('call_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        this.supabase.from('phone_numbers').select('id', { count: 'exact', head: true }),
        this.supabase.from('feedback').select('id', { count: 'exact', head: true }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalUsers: usersResult.count || 0,
          totalAgents: agentsResult.count || 0,
          totalCalls: callsResult.count || 0,
          activeCalls: activeCallsResult.count || 0,
          totalPhoneNumbers: phonesResult.count || 0,
          totalFeedback: feedbackResult.count || 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get admin stats:', error);
      res.status(500).json({ error: 'Failed to get dashboard statistics' });
    }
  };

  getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const offset = (page - 1) * limit;

      // Get users with pagination
      let query = this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data: users, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
        return;
      }

      // Get agent counts and call counts for these users
      const userIds = (users || []).map((u: any) => u.id);

      let agentCounts: Record<string, number> = {};
      let callCounts: Record<string, number> = {};

      if (userIds.length > 0) {
        // Get agent counts per user
        const { data: agents } = await this.supabase
          .from('agents')
          .select('user_id')
          .in('user_id', userIds);

        if (agents) {
          for (const a of agents) {
            agentCounts[a.user_id] = (agentCounts[a.user_id] || 0) + 1;
          }
        }

        // Get call counts per user
        const { data: calls } = await this.supabase
          .from('call_sessions')
          .select('user_id')
          .in('user_id', userIds);

        if (calls) {
          for (const c of calls) {
            callCounts[c.user_id] = (callCounts[c.user_id] || 0) + 1;
          }
        }
      }

      const enrichedUsers = (users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        is_admin: u.is_admin || false,
        agentCount: agentCounts[u.id] || 0,
        callCount: callCounts[u.id] || 0,
      }));

      res.status(200).json({
        success: true,
        data: {
          users: enrichedUsers,
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  };

  toggleAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (userId === currentUserId) {
        res.status(400).json({ error: 'Cannot change your own admin status' });
        return;
      }

      // Get current admin status
      const { data: user, error: fetchError } = await this.supabase
        .from('users')
        .select('id, is_admin')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const newAdminStatus = !user.is_admin;

      const { error: updateError } = await this.supabase
        .from('users')
        .update({ is_admin: newAdminStatus })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to toggle admin:', updateError);
        res.status(500).json({ error: 'Failed to update admin status' });
        return;
      }

      logger.info('Admin status toggled', { targetUserId: userId, is_admin: newAdminStatus, by: currentUserId });

      res.status(200).json({
        success: true,
        data: { userId, is_admin: newAdminStatus },
      });
    } catch (error) {
      logger.error('Failed to toggle admin:', error);
      res.status(500).json({ error: 'Failed to toggle admin status' });
    }
  };

  // ===== AGENTS =====
  getAgents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const offset = (page - 1) * limit;

      const { data: agents, error, count } = await this.supabase
        .from('agents')
        .select('id, name, description, user_id, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
        return;
      }

      // Get owner emails
      const userIds = [...new Set((agents || []).map((a: any) => a.user_id))];
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        if (users) {
          for (const u of users) {
            userEmails[u.id] = u.email;
          }
        }
      }

      let enriched = (agents || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        ownerEmail: userEmails[a.user_id] || 'Unknown',
        userId: a.user_id,
        createdAt: a.created_at,
      }));

      // Client-side search (by name or owner email)
      if (search) {
        const s = search.toLowerCase();
        enriched = enriched.filter(
          (a: any) => a.name?.toLowerCase().includes(s) || a.ownerEmail?.toLowerCase().includes(s)
        );
      }

      res.status(200).json({
        success: true,
        data: {
          agents: enriched,
          total: search ? enriched.length : (count || 0),
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  };

  deleteAgent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { agentId } = req.params;

      const { data: agent, error: fetchError } = await this.supabase
        .from('agents')
        .select('id, name')
        .eq('id', agentId)
        .single();

      if (fetchError || !agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      await this.supabase.from('agent_versions').delete().eq('agent_id', agentId);
      await this.supabase.from('agents').delete().eq('id', agentId);

      logger.info('Agent deleted by admin', { agentId, agentName: agent.name, by: req.user?.id });

      res.status(200).json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete agent:', error);
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  };

  // ===== CALLS =====
  getCalls = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const direction = req.query.direction as string;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('call_sessions')
        .select('id, user_id, status, direction, started_at, ended_at, caller_number, callee_number, duration, agent_id', { count: 'exact' })
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (direction && direction !== 'all') {
        query = query.eq('direction', direction);
      }

      const { data: calls, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch calls:', error);
        res.status(500).json({ error: 'Failed to fetch calls' });
        return;
      }

      // Get user emails
      const userIds = [...new Set((calls || []).map((c: any) => c.user_id).filter(Boolean))];
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        if (users) {
          for (const u of users) {
            userEmails[u.id] = u.email;
          }
        }
      }

      const enriched = (calls || []).map((c: any) => ({
        id: c.id,
        userEmail: userEmails[c.user_id] || 'Unknown',
        status: c.status,
        direction: c.direction,
        startedAt: c.started_at,
        endedAt: c.ended_at,
        callerNumber: c.caller_number,
        calleeNumber: c.callee_number,
        duration: c.duration,
        agentId: c.agent_id,
      }));

      res.status(200).json({
        success: true,
        data: {
          calls: enriched,
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get calls:', error);
      res.status(500).json({ error: 'Failed to fetch calls' });
    }
  };

  // ===== PHONE NUMBERS =====
  getPhoneNumbers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const { data: phones, error, count } = await this.supabase
        .from('phone_numbers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch phone numbers:', error);
        res.status(500).json({ error: 'Failed to fetch phone numbers' });
        return;
      }

      // Get user emails
      const userIds = [...new Set((phones || []).map((p: any) => p.user_id).filter(Boolean))];
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        if (users) {
          for (const u of users) {
            userEmails[u.id] = u.email;
          }
        }
      }

      const enriched = (phones || []).map((p: any) => ({
        id: p.id,
        phoneNumber: p.phone_number,
        country: p.country,
        type: p.type,
        status: p.status,
        ownerEmail: userEmails[p.user_id] || 'Unknown',
        createdAt: p.created_at,
      }));

      res.status(200).json({
        success: true,
        data: {
          phoneNumbers: enriched,
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get phone numbers:', error);
      res.status(500).json({ error: 'Failed to fetch phone numbers' });
    }
  };

  // ===== FEEDBACK =====
  getAllFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: feedback, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
        return;
      }

      // Get user emails
      const userIds = [...new Set((feedback || []).map((f: any) => f.user_id).filter(Boolean))];
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        if (users) {
          for (const u of users) {
            userEmails[u.id] = u.email;
          }
        }
      }

      const enriched = (feedback || []).map((f: any) => ({
        id: f.id,
        userEmail: userEmails[f.user_id] || f.email || 'Unknown',
        type: f.type,
        subject: f.subject,
        message: f.message,
        status: f.status,
        createdAt: f.created_at,
      }));

      res.status(200).json({
        success: true,
        data: {
          feedback: enriched,
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  };

  updateFeedbackStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { feedbackId } = req.params;
      const { status } = req.body;

      if (!['new', 'reviewed', 'resolved'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be: new, reviewed, or resolved' });
        return;
      }

      const { error } = await this.supabase
        .from('feedback')
        .update({ status })
        .eq('id', feedbackId);

      if (error) {
        logger.error('Failed to update feedback status:', error);
        res.status(500).json({ error: 'Failed to update feedback status' });
        return;
      }

      logger.info('Feedback status updated by admin', { feedbackId, status, by: req.user?.id });

      res.status(200).json({ success: true, data: { feedbackId, status } });
    } catch (error) {
      logger.error('Failed to update feedback status:', error);
      res.status(500).json({ error: 'Failed to update feedback status' });
    }
  };

  deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (userId === currentUserId) {
        res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
        return;
      }

      // Verify user exists
      const { data: user, error: fetchError } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Cascade delete all user data
      await this.supabase.from('feedback').delete().eq('user_id', userId);
      await this.supabase.from('usage_statistics').delete().eq('user_id', userId);
      await this.supabase.from('bulk_call_jobs').delete().eq('user_id', userId);
      await this.supabase.from('phone_numbers').delete().eq('user_id', userId);
      await this.supabase.from('groups').delete().eq('user_id', userId);
      await this.supabase.from('agent_versions').delete().eq('agent_id', userId);
      await this.supabase.from('user_settings').delete().eq('user_id', userId);
      await this.supabase.from('call_sessions').delete().eq('user_id', userId);
      await this.supabase.from('agents').delete().eq('user_id', userId);
      await this.supabase.from('users').delete().eq('id', userId);

      // Try to delete from Supabase Auth
      try {
        await this.supabase.auth.admin.deleteUser(userId);
      } catch (authErr) {
        logger.warn('Supabase Auth admin deletion not available:', authErr);
      }

      logger.info('User deleted by admin', { deletedUserId: userId, deletedEmail: user.email, by: currentUserId });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  };
  // ===== ELEVENLABS VOICE SETTINGS =====
  getVoiceSettings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await this.supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'elevenlabs')
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch voice settings:', error);
        res.status(500).json({ error: 'Failed to fetch voice settings' });
        return;
      }

      const settings = data?.value || {
        apiKey: '',
        defaultVoiceId: '',
        defaultModel: 'eleven_multilingual_v2',
      };

      // Mask the API key for display
      const maskedSettings = {
        ...settings,
        apiKey: settings.apiKey ? `${settings.apiKey.substring(0, 8)}...${settings.apiKey.slice(-4)}` : '',
        hasApiKey: !!settings.apiKey,
      };

      res.status(200).json({ success: true, data: maskedSettings });
    } catch (error) {
      logger.error('Failed to get voice settings:', error);
      res.status(500).json({ error: 'Failed to fetch voice settings' });
    }
  };

  updateVoiceSettings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { apiKey, defaultVoiceId, defaultModel } = req.body;

      // Get existing settings
      const { data: existing } = await this.supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'elevenlabs')
        .single();

      const currentSettings = existing?.value || {};

      const updatedSettings = {
        ...currentSettings,
        // Only update apiKey if a new one is provided (not masked)
        apiKey: apiKey && !apiKey.includes('...') ? apiKey : currentSettings.apiKey || '',
        defaultVoiceId: defaultVoiceId ?? currentSettings.defaultVoiceId ?? '',
        defaultModel: defaultModel ?? currentSettings.defaultModel ?? 'eleven_multilingual_v2',
      };

      const { error } = await this.supabase
        .from('platform_settings')
        .upsert(
          { key: 'elevenlabs', value: updatedSettings, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        logger.error('Failed to update voice settings:', error);
        res.status(500).json({ error: 'Failed to update voice settings' });
        return;
      }

      logger.info('ElevenLabs voice settings updated by admin', { by: req.user?.id });

      res.status(200).json({
        success: true,
        data: {
          ...updatedSettings,
          apiKey: updatedSettings.apiKey ? `${updatedSettings.apiKey.substring(0, 8)}...${updatedSettings.apiKey.slice(-4)}` : '',
          hasApiKey: !!updatedSettings.apiKey,
        },
      });
    } catch (error) {
      logger.error('Failed to update voice settings:', error);
      res.status(500).json({ error: 'Failed to update voice settings' });
    }
  };

  fetchElevenLabsVoices = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Get the stored API key
      const { data: settings } = await this.supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'elevenlabs')
        .single();

      const apiKey = settings?.value?.apiKey;
      if (!apiKey) {
        res.status(400).json({ error: 'ElevenLabs API key not configured. Save your API key first.' });
        return;
      }

      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('ElevenLabs API error:', { status: response.status, body: errorText });
        res.status(response.status === 401 ? 401 : 502).json({
          error: response.status === 401
            ? 'Invalid ElevenLabs API key. Please check your API key.'
            : 'Failed to fetch voices from ElevenLabs',
        });
        return;
      }

      const data: any = await response.json();
      const voices = (data.voices || []).map((v: any) => ({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category,
        previewUrl: v.preview_url,
        labels: v.labels || {},
      }));

      res.status(200).json({ success: true, data: { voices } });
    } catch (error) {
      logger.error('Failed to fetch ElevenLabs voices:', error);
      res.status(500).json({ error: 'Failed to fetch voices from ElevenLabs' });
    }
  };
}

export default new AdminController();
