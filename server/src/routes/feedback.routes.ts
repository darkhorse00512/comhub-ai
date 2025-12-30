import { Router } from 'express';
import feedbackController from '../controllers/feedback.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all feedback for the authenticated user
router.get('/', feedbackController.getFeedback);

// Submit new feedback
router.post('/', feedbackController.submitFeedback);

export default router;
