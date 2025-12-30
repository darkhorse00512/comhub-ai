import { Router } from 'express';
import settingsController from '../controllers/settings.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get user settings
router.get('/', settingsController.getSettings);

// Update user settings
router.put('/', settingsController.updateSettings);

// Get usage statistics
router.get('/usage', settingsController.getUsageStatistics);

export default router;
