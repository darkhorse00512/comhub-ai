import { Router } from 'express';
import authController from '../controllers/auth.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// Supabase-based auth doesn't need password validation
router.post('/register', authController.register);

router.post('/login', authController.login);

router.get('/verify', authController.verifyToken);

router.get('/profile', authMiddleware, authController.getProfile);

export default router;
