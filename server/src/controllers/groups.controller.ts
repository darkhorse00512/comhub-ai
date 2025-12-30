import { Request, Response } from 'express';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import crypto from 'crypto';

class GroupsController {
  private supabase = getSupabaseClient();

  // Generate a random SIP password
  private generateSipPassword(): string {
    return `sip_${crypto.randomBytes(16).toString('hex')}`;
  }

  // Get all groups for the authenticated user
  getGroups = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { data: groups, error } = await this.supabase
        .from('groups')
        .select(`
          *,
          phone_numbers:phone_numbers(count),
          call_sessions:call_sessions(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch groups:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch groups' });
        return;
      }

      // Format the response to include phone_count and agent_count
      const formattedGroups = groups?.map((group: any) => ({
        ...group,
        phone_count: group.phone_numbers?.[0]?.count || 0,
        agent_count: 0, // This will be implemented when we add agent management
      })) || [];

      res.status(200).json({ success: true, data: formattedGroups });
    } catch (error) {
      logger.error('Error in getGroups:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Get a single group
  getGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { data: group, error } = await this.supabase
        .from('groups')
        .select(`
          *,
          phone_numbers(*)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !group) {
        res.status(404).json({ success: false, error: 'Group not found' });
        return;
      }

      res.status(200).json({ success: true, data: group });
    } catch (error) {
      logger.error('Error in getGroup:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Create a new group
  createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { name, description } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, error: 'Group name is required' });
        return;
      }

      // Generate SIP password
      const sipPassword = this.generateSipPassword();

      // Insert group into database
      const { data: newGroup, error: insertError } = await this.supabase
        .from('groups')
        .insert({
          user_id: userId,
          name: name.trim(),
          description: description?.trim() || null,
          sip_password: sipPassword,
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to create group:', insertError);
        res.status(500).json({ success: false, error: 'Failed to create group' });
        return;
      }

      logger.info('Group created successfully', {
        groupId: newGroup.id,
        userId,
        name,
      });

      res.status(201).json({
        success: true,
        data: newGroup,
        message: 'Group created successfully',
      });
    } catch (error) {
      logger.error('Error in createGroup:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Update a group
  updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { name, description } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const { data: group } = await this.supabase
        .from('groups')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!group) {
        res.status(404).json({ success: false, error: 'Group not found' });
        return;
      }

      // Update group
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

  // Delete a group
  deleteGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const { data: group } = await this.supabase
        .from('groups')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!group) {
        res.status(404).json({ success: false, error: 'Group not found' });
        return;
      }

      // Delete group (phone numbers will have group_id set to NULL due to ON DELETE SET NULL)
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
