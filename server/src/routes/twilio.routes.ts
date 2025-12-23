import { Router } from 'express';
import twilioController from '../controllers/twilio.controller';
import authMiddleware from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();

router.post('/voice', twilioController.handleVoiceWebhook);

router.post('/status', twilioController.handleStatusCallback);

router.post('/sip-forward', twilioController.handleSIPForward);

router.post('/bridge', twilioController.handleBridge);

router.post(
  '/call',
  authMiddleware,
  validate(schemas.twilioOutboundCall),
  twilioController.makeOutboundCall
);

router.post('/call/:callSid/end', authMiddleware, twilioController.endCall);

export default router;
