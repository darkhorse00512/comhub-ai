import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.middleware';
import adminMiddleware from '../middleware/admin.middleware';
import adminController from '../controllers/admin.controller';

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

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

router.get('/voice-models', adminController.getVoiceModels);
router.post('/voice-models', imageUpload.single('image'), adminController.createVoiceModel);
router.put('/voice-models/:modelId', imageUpload.single('image'), adminController.updateVoiceModel);
router.delete('/voice-models/:modelId', adminController.deleteVoiceModel);

export default router;
