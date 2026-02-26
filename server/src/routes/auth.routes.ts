import { Router } from 'express';
import authController from '../controllers/auth.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// Supabase-based auth doesn't need password validation
router.post('/register', authController.register);

router.post('/login', authController.login);

router.get('/verify', authController.verifyToken);

router.get('/profile', authMiddleware, authController.getProfile);

router.delete('/account', authMiddleware, authController.deleteAccount);

// OTP-based signup flow
router.post('/signup/send-otp', authController.sendSignupOTP);
router.post('/signup/verify-otp', authController.verifySignupOTP);

// OTP-based password reset flow
router.post('/reset/send-otp', authController.sendResetOTP);
router.post('/reset/verify-otp', authController.verifyResetOTP);

export default router;
