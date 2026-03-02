import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.middleware';
import adminMiddleware from '../middleware/admin.middleware';
import adminController from '../controllers/admin.controller';

const router = Router();

const voiceModelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a'];
    if (imageTypes.includes(file.mimetype) || audioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image (JPEG, PNG, WebP, GIF) and audio (MP3, WAV, M4A) files are allowed'));
    }
  },
});

const voiceModelFields = voiceModelUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'preview_audio', maxCount: 1 },
]);

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

router.get('/voice-models', adminController.getVoiceModels);
router.post('/voice-models', voiceModelFields, adminController.createVoiceModel);
router.put('/voice-models/:modelId', voiceModelFields, adminController.updateVoiceModel);
router.delete('/voice-models/:modelId', adminController.deleteVoiceModel);

router.get('/groups', adminController.getGroups);
router.post('/groups', adminController.createGroup);
router.delete('/groups/:groupId', adminController.deleteGroup);

export default router;
