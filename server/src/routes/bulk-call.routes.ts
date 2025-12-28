import { Router } from 'express';
import bulkCallController from '../controllers/bulk-call.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All bulk call routes require authentication
router.use(authMiddleware);

// Create a new bulk call job
router.post('/jobs', bulkCallController.createBulkJob);

// Get all user's bulk call jobs
router.get('/jobs', bulkCallController.getUserBulkJobs);

// Get specific job status
router.get('/jobs/:jobId', bulkCallController.getBulkJobStatus);

// Start a bulk call job
router.post('/jobs/:jobId/start', bulkCallController.startBulkJob);

// Cancel a bulk call job
router.post('/jobs/:jobId/cancel', bulkCallController.cancelBulkJob);

export default router;
