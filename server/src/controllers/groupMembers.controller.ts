import { Response } from 'express';
import { GroupAuthRequest } from '../middleware/groupRole.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

class GroupMembersController {
  private supabase = getSupabaseClient();

  getGroupMembers = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id: groupId } = req.params;

      const { data: members, error } = await this.supabase
        .from('group_members')
        .select('id, role, created_at, user_id, invited_by')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch group members:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
        return;
      }

      // Get user details for all members and inviters
      const userIds = [
        ...new Set([
          ...(members || []).map((m: any) => m.user_id),
          ...(members || []).map((m: any) => m.invited_by).filter(Boolean),
        ]),
      ];

      let userMap: Record<string, { email: string; name?: string }> = {};
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from('users')
          .select('id, email, name')
          .in('id', userIds);
        if (users) {
          for (const u of users) {
            userMap[u.id] = { email: u.email, name: u.name };
          }
        }
      }

      const enriched = (members || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        email: userMap[m.user_id]?.email || 'Unknown',
        name: userMap[m.user_id]?.name || null,
        role: m.role,
        invited_by: m.invited_by ? userMap[m.invited_by]?.email || null : null,
        created_at: m.created_at,
      }));

      res.status(200).json({ success: true, data: enriched });
    } catch (error) {
      logger.error('Error in getGroupMembers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  addGroupMember = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id: groupId } = req.params;
      const { userEmail, role } = req.body;
      const callerRole = req.groupMembership?.role;
      const callerId = req.user?.id;

      if (!userEmail || !role) {
        res.status(400).json({ error: 'Email and role are required' });
        return;
      }

      const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      // Only superadmin can assign superadmin role
      if (role === 'superadmin' && callerRole !== 'superadmin') {
        res.status(403).json({ error: 'Only superadmins can assign superadmin role' });
        return;
      }

      // Lookup user by email
      const { data: targetUser } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('email', userEmail.toLowerCase().trim())
        .single();

      if (!targetUser) {
        res.status(404).json({ error: 'User not found. They must have an account first.' });
        return;
      }

      // Insert membership
      const { data: member, error } = await this.supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: targetUser.id,
          role,
          invited_by: callerId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          res.status(409).json({ error: 'User is already a member of this group' });
          return;
        }
        logger.error('Failed to add group member:', error);
        res.status(500).json({ error: 'Failed to add member' });
        return;
      }

      logger.info('Group member added', { groupId, userId: targetUser.id, role, by: callerId });

      res.status(201).json({
        success: true,
        data: {
          ...member,
          email: targetUser.email,
        },
      });
    } catch (error) {
      logger.error('Error in addGroupMember:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  updateMemberRole = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id: groupId, userId: targetUserId } = req.params;
      const { role: newRole } = req.body;
      const callerRole = req.groupMembership?.role;
      const callerId = req.user?.id;

      if (!newRole) {
        res.status(400).json({ error: 'Role is required' });
        return;
      }

      const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
      if (!validRoles.includes(newRole)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      // Can't change own role
      if (targetUserId === callerId) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }

      // Get target's current role
      const { data: targetMembership } = await this.supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)
        .single();

      if (!targetMembership) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // Only superadmin can touch superadmin members
      if (
        (targetMembership.role === 'superadmin' || newRole === 'superadmin') &&
        callerRole !== 'superadmin'
      ) {
        res.status(403).json({ error: 'Only superadmins can manage superadmin members' });
        return;
      }

      const { error } = await this.supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) {
        logger.error('Failed to update member role:', error);
        res.status(500).json({ error: 'Failed to update role' });
        return;
      }

      logger.info('Group member role updated', {
        groupId,
        targetUserId,
        newRole,
        by: callerId,
      });

      res.status(200).json({ success: true, data: { userId: targetUserId, role: newRole } });
    } catch (error) {
      logger.error('Error in updateMemberRole:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  removeGroupMember = async (req: GroupAuthRequest, res: Response): Promise<void> => {
    try {
      const { id: groupId, userId: targetUserId } = req.params;
      const callerRole = req.groupMembership?.role;
      const callerId = req.user?.id;
      const isSelfRemoval = targetUserId === callerId;

      // Get target's role
      const { data: targetMembership } = await this.supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)
        .single();

      if (!targetMembership) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // Non-self removal requires admin+ role
      if (!isSelfRemoval) {
        const ROLE_RANK: Record<string, number> = {
          superadmin: 4,
          admin: 3,
          editor: 2,
          viewer: 1,
        };
        if ((ROLE_RANK[callerRole || ''] || 0) < ROLE_RANK['admin']) {
          res.status(403).json({ error: 'Admin role or higher required to remove members' });
          return;
        }

        // Non-superadmin can't remove superadmin
        if (targetMembership.role === 'superadmin' && callerRole !== 'superadmin') {
          res.status(403).json({ error: 'Cannot remove a superadmin member' });
          return;
        }
      }

      // Prevent removing the last superadmin
      if (targetMembership.role === 'superadmin') {
        const { count } = await this.supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('role', 'superadmin');

        if ((count || 0) <= 1) {
          res.status(400).json({ error: 'Cannot remove the last superadmin from a group' });
          return;
        }
      }

      const { error } = await this.supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) {
        logger.error('Failed to remove group member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
        return;
      }

      logger.info('Group member removed', { groupId, targetUserId, by: callerId, selfRemoval: isSelfRemoval });

      res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Error in removeGroupMember:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export default new GroupMembersController();
