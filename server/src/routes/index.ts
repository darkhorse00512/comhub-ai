import { Router } from 'express';
import authRoutes from './auth.routes';
import callRoutes from './call.routes';
import twilioRoutes from './twilio.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/calls', callRoutes);
router.use('/twilio', twilioRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Telephony Backend is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
