import { Router } from 'express';
import callController from '../controllers/call.controller';
import authMiddleware from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/initiate', validate(schemas.initiateCall), callController.initiateCall);

router.post('/:callSessionId/end', callController.endCall);

router.get('/history', callController.getCallHistory);

router.get('/:callSessionId', callController.getActiveCall);

router.get('/:callSessionId/messages', callController.getCallMessages);

router.post(
  '/:callSessionId/messages',
  validate(schemas.sendMessage),
  callController.sendMessage
);

export default router;
