import { Router } from 'express';
import agentsController from '../controllers/agents.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all agents for the authenticated user
router.get('/', agentsController.getAgents);

// Get a single agent
router.get('/:id', agentsController.getAgent);

// Create a new agent
router.post('/', agentsController.createAgent);

// Update an existing agent
router.put('/:id', agentsController.updateAgent);

// Delete an agent
router.delete('/:id', agentsController.deleteAgent);

// Clone an agent
router.post('/:id/clone', agentsController.cloneAgent);

export default router;
