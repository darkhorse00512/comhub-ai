import { Router } from 'express';
import groupsController from '../controllers/groups.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all groups for the authenticated user
router.get('/', groupsController.getGroups);

// Get a single group
router.get('/:id', groupsController.getGroup);

// Create a new group
router.post('/', groupsController.createGroup);

// Update a group
router.put('/:id', groupsController.updateGroup);

// Delete a group
router.delete('/:id', groupsController.deleteGroup);

export default router;
