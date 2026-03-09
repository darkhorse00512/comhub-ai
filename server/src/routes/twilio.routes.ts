import { Router } from 'express';
import twilioController from '../controllers/twilio.controller';
import authMiddleware from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();

// Twilio Webhooks (no auth - called by Twilio)
router.post('/voice', twilioController.handleVoiceWebhook);
router.post('/outbound-voice', twilioController.handleOutboundVoice);
router.post('/handle-recording', twilioController.handleRecording);
router.post('/handle-speech', twilioController.handleSpeech);
router.post('/status', twilioController.handleStatusCallback);
router.post('/bulk-status', twilioController.handleBulkStatusCallback);
router.post('/sip-forward', twilioController.handleSIPForward);
router.post('/bridge', twilioController.handleBridge);

// API Endpoints (require auth)
router.post(
  '/call',
  authMiddleware,
  validate(schemas.twilioOutboundCall),
  twilioController.makeOutboundCall
);

router.post('/call/:callSid/end', authMiddleware, twilioController.endCall);

export default router;
