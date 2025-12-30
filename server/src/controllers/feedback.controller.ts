import { Request, Response } from 'express';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class FeedbackController {
  private supabase = getSupabaseClient();

  // Get all feedback for the authenticated user
  getFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { data: feedback, error } = await this.supabase
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch feedback:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
        return;
      }

      res.status(200).json({ success: true, data: feedback });
    } catch (error) {
      logger.error('Error in getFeedback:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Submit new feedback
  submitFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { type, subject, message, email } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Validate required fields
      if (!type || !subject || !message) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: type, subject, message',
        });
        return;
      }

      // Validate feedback type
      const validTypes = ['feature', 'bug', 'improvement', 'question'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid feedback type. Must be one of: feature, bug, improvement, question',
        });
        return;
      }

      // Insert feedback into database
      const { data: newFeedback, error: insertError } = await this.supabase
        .from('feedback')
        .insert({
          user_id: userId,
          type,
          subject: subject.trim(),
          message: message.trim(),
          email: email?.trim() || null,
          status: 'new',
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to submit feedback:', insertError);
        res.status(500).json({ success: false, error: 'Failed to submit feedback' });
        return;
      }

      logger.info('Feedback submitted successfully', {
        feedbackId: newFeedback.id,
        userId,
        type,
      });

      res.status(201).json({
        success: true,
        data: newFeedback,
        message: 'Thank you for your feedback! We\'ll review it shortly.',
      });
    } catch (error) {
      logger.error('Error in submitFeedback:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default new FeedbackController();
