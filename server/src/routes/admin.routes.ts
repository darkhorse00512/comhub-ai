import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import adminMiddleware from '../middleware/admin.middleware';
import adminController from '../controllers/admin.controller';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.put('/users/:userId/toggle-admin', adminController.toggleAdmin);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/agents', adminController.getAgents);
router.delete('/agents/:agentId', adminController.deleteAgent);

router.get('/calls', adminController.getCalls);

router.get('/phone-numbers', adminController.getPhoneNumbers);

router.get('/feedback', adminController.getAllFeedback);
router.put('/feedback/:feedbackId/status', adminController.updateFeedbackStatus);

router.get('/voice-settings', adminController.getVoiceSettings);
router.put('/voice-settings', adminController.updateVoiceSettings);
router.get('/voice-settings/voices', adminController.fetchElevenLabsVoices);

export default router;
