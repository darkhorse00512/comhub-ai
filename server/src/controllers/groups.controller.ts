import { Request, Response } from 'express';
import { GroupAuthRequest } from '../middleware/groupRole.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class GroupsController {
  private supabase = getSupabaseClient();

  // Get all groups the user is a member of
  getGroups = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Query groups via membership
      const { data: memberships, error } = await this.supabase
        .from('group_members')
        .select(`
          role,
          group:groups(
            id,
            name,
            description,
            sip_password,
            created_at,
            updated_at,
            phone_numbers:phone_numbers(count)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch groups:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch groups' });
        return;
      }

      const formattedGroups = (memberships || [])
        .filter((m: any) => m.group) // filter out any null groups
        .map((m: any) => ({
          ...m.group,
          phone_count: m.group.phone_numbers?.[0]?.count || 0,
          user_role: m.role,
        }));

      res.status(200).json({ success: true, data: formattedGroups });
    } catch (error) {
      logger.error('Error in getGroups:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Get a single group (requires viewer+ via middleware)
  getGroup = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const { data: group, error } = await this.supabase
        .from('groups')
        .select('*, phone_numbers(*)')
        .eq('id', id)
        .single();

      if (error || !group) {
        res.status(404).json({ success: false, error: 'Group not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          ...group,
          user_role: req.groupMembership?.role,
        },
      });
    } catch (error) {
      logger.error('Error in getGroup:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Update a group (requires admin+ via middleware)
  updateGroup = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updateData: any = {};
      if (name !== undefined && name.trim()) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;

      const { data: updated, error } = await this.supabase
        .from('groups')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update group:', error);
        res.status(500).json({ success: false, error: 'Failed to update group' });
        return;
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Group updated successfully',
      });
    } catch (error) {
      logger.error('Error in updateGroup:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Delete a group (requires superadmin via middleware)
  deleteGroup = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const { error } = await this.supabase
        .from('groups')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete group:', error);
        res.status(500).json({ success: false, error: 'Failed to delete group' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Group deleted successfully',
      });
    } catch (error) {
      logger.error('Error in deleteGroup:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default new GroupsController();
