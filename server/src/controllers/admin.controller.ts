import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class AdminController {
  private supabase = getSupabaseClient();

  getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const [usersResult, agentsResult, callsResult, activeCallsResult] = await Promise.all([
        this.supabase.from('users').select('id', { count: 'exact', head: true }),
        this.supabase.from('agents').select('id', { count: 'exact', head: true }),
        this.supabase.from('call_sessions').select('id', { count: 'exact', head: true }),
        this.supabase.from('call_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalUsers: usersResult.count || 0,
          totalAgents: agentsResult.count || 0,
          totalCalls: callsResult.count || 0,
          activeCalls: activeCallsResult.count || 0,
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
}

export default new AdminController();
