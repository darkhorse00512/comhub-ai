import { Request, Response } from 'express';
import bulkCallingService from '../services/bulk-calling.service';
import socketService from '../sockets';
import logger from '../utils/logger';

export class BulkCallController {
  // Create a new bulk call job
  async createBulkJob(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { phoneNumbers } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        res.status(400).json({ error: 'Phone numbers array is required' });
        return;
      }

      // Validate phone numbers format
      const validNumbers = phoneNumbers.filter((num: string) => {
        const cleaned = num.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 15;
      });

      if (validNumbers.length === 0) {
        res.status(400).json({ error: 'No valid phone numbers provided' });
        return;
      }

      // Format numbers to E.164
      const formattedNumbers = validNumbers.map((num: string) => {
        const cleaned = num.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return `+${cleaned}`;
        }
        if (cleaned.length === 10) {
          return `+1${cleaned}`;
        }
        if (!cleaned.startsWith('+')) {
          return `+${cleaned}`;
        }
        return cleaned;
      });

      const job = await bulkCallingService.createBulkCallJob(userId, formattedNumbers);

      logger.info('Bulk call job created', {
        jobId: job.id,
        userId,
        totalNumbers: formattedNumbers.length,
      });

      res.status(201).json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          totalCalls: job.totalCalls,
          completedCalls: job.completedCalls,
          failedCalls: job.failedCalls,
          createdAt: job.createdAt,
        },
      });
    } catch (error) {
      logger.error('Failed to create bulk call job:', error);
      res.status(500).json({
        error: 'Failed to create bulk call job',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Start a bulk call job
  async startBulkJob(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { jobId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const job = bulkCallingService.getBulkCallJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Bulk call job not found' });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await bulkCallingService.startBulkCallJob(jobId);

      // Emit status update via socket
      socketService.emitToUser(userId, 'bulk-call:started', {
        jobId,
        status: 'in_progress',
      });

      logger.info('Bulk call job started', { jobId, userId });

      res.status(200).json({
        success: true,
        message: 'Bulk call job started',
      });
    } catch (error) {
      logger.error('Failed to start bulk call job:', error);
      res.status(500).json({
        error: 'Failed to start bulk call job',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Cancel a bulk call job
  async cancelBulkJob(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { jobId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const job = bulkCallingService.getBulkCallJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Bulk call job not found' });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await bulkCallingService.cancelBulkCallJob(jobId);

      // Emit status update via socket
      socketService.emitToUser(userId, 'bulk-call:cancelled', { jobId });

      logger.info('Bulk call job cancelled', { jobId, userId });

      res.status(200).json({
        success: true,
        message: 'Bulk call job cancelled',
      });
    } catch (error) {
      logger.error('Failed to cancel bulk call job:', error);
      res.status(500).json({
        error: 'Failed to cancel bulk call job',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Get bulk call job status
  async getBulkJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { jobId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const job = bulkCallingService.getBulkCallJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Bulk call job not found' });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.status(200).json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          totalCalls: job.totalCalls,
          completedCalls: job.completedCalls,
          failedCalls: job.failedCalls,
          activeCalls: job.activeCalls,
          results: job.results.map((r) => ({
            phoneNumber: r.phoneNumber,
            status: r.status,
            duration: r.duration,
            error: r.error,
            callSessionId: r.callSessionId,
          })),
          startedAt: job.startedAt,
          endedAt: job.endedAt,
          createdAt: job.createdAt,
        },
      });
    } catch (error) {
      logger.error('Failed to get bulk job status:', error);
      res.status(500).json({
        error: 'Failed to get bulk job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Get all user's bulk jobs
  async getUserBulkJobs(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const jobs = bulkCallingService.getUserJobs(userId);

      res.status(200).json({
        success: true,
        jobs: jobs.map((job) => ({
          id: job.id,
          status: job.status,
          totalCalls: job.totalCalls,
          completedCalls: job.completedCalls,
          failedCalls: job.failedCalls,
          startedAt: job.startedAt,
          endedAt: job.endedAt,
          createdAt: job.createdAt,
        })),
      });
    } catch (error) {
      logger.error('Failed to get user bulk jobs:', error);
      res.status(500).json({
        error: 'Failed to get bulk jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const bulkCallController = new BulkCallController();
export default bulkCallController;
