import { Router } from 'express';
import multer from 'multer';
import agentsController from '../controllers/agents.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/wave'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|m4a|wav)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3, M4A, and WAV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

// Get all agents for the authenticated user
router.get('/', agentsController.getAgents);

// Get active voice models for voice library (must be before /:id)
router.get('/voice-models', agentsController.getPublicVoiceModels);

// Get a single agent
router.get('/:id', agentsController.getAgent);

// Create a new agent
router.post('/', agentsController.createAgent);

// Update an existing agent
router.put('/:id', agentsController.updateAgent);

// Delete an agent
router.delete('/:id', agentsController.deleteAgent);

// Upload audio for play audio nodes
router.post('/:id/upload-audio', upload.single('audio'), agentsController.uploadAudio);

// Clone an agent
router.post('/:id/clone', agentsController.cloneAgent);

// Test chat with an agent
router.post('/:id/test-chat', agentsController.testChat);

// Generate workflow using AI
router.post('/:id/generate-workflow', agentsController.generateWorkflow);

// Translate workflow to another language using AI
router.post('/:id/translate-workflow', agentsController.translateWorkflow);

// Agent version history
router.get('/:id/versions', agentsController.getAgentVersions);

// Restore agent to a specific version
router.post('/:id/versions/:versionId/restore', agentsController.restoreAgentVersion);

// Generate TTS audio using agent's configured voice
router.post('/:id/generate-tts', agentsController.generateTTS);

// Workflow-based test calls
router.post('/:id/workflow-call/start', agentsController.startWorkflowCall);
router.post('/:id/workflow-call/:sessionId/message', agentsController.sendWorkflowMessage);
router.post('/:id/workflow-call/:sessionId/end', agentsController.endWorkflowCall);

export default router;
