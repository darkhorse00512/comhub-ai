import { Router } from 'express';
import groupsController from '../controllers/groups.controller';
import groupMembersController from '../controllers/groupMembers.controller';
import authMiddleware from '../middleware/auth.middleware';
import { requireGroupRole } from '../middleware/groupRole.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Group CRUD (no create — moved to admin routes)
router.get('/', groupsController.getGroups);
router.get('/:id', requireGroupRole('viewer'), groupsController.getGroup);
router.put('/:id', requireGroupRole('admin'), groupsController.updateGroup);
router.delete('/:id', requireGroupRole('superadmin'), groupsController.deleteGroup);

// Member management routes
router.get('/:id/members', requireGroupRole('viewer'), groupMembersController.getGroupMembers);
router.post('/:id/members', requireGroupRole('admin'), groupMembersController.addGroupMember);
router.put('/:id/members/:userId', requireGroupRole('admin'), groupMembersController.updateMemberRole);
router.delete('/:id/members/:userId', requireGroupRole('viewer'), groupMembersController.removeGroupMember);

export default router;
