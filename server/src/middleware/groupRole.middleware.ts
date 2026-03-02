import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import getSupabaseClient from '../config/supabase';

export type GroupRole = 'superadmin' | 'admin' | 'editor' | 'viewer';

const ROLE_RANK: Record<GroupRole, number> = {
  superadmin: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export interface GroupAuthRequest extends AuthRequest {
  groupMembership?: {
    groupId: string;
    role: GroupRole;
  };
}

export const requireGroupRole = (minimumRole: GroupRole) => {
  return async (req: GroupAuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const groupId = req.params.id || req.params.groupId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!groupId) {
        res.status(400).json({ error: 'Group ID is required' });
        return;
      }

      // Platform admins bypass group role checks
      if (req.user?.is_admin) {
        req.groupMembership = { groupId, role: 'superadmin' };
        return next();
      }

      const supabase = getSupabaseClient();
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }

      const userRank = ROLE_RANK[membership.role as GroupRole];
      const requiredRank = ROLE_RANK[minimumRole];

      if (userRank < requiredRank) {
        res.status(403).json({
          error: `Requires ${minimumRole} role or higher`,
          yourRole: membership.role,
        });
        return;
      }

      req.groupMembership = { groupId, role: membership.role as GroupRole };
      next();
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify group permissions' });
    }
  };
};

export default requireGroupRole;
