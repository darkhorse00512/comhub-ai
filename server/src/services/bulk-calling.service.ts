import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';
import getSupabaseClient from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { socketService } from '../sockets';

export interface BulkCallJob {
  id: string;
  userId: string;
  phoneNumbers: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  activeCalls: number;
  results: CallResult[];
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface CallResult {
  phoneNumber: string;
  callSid: string | null;
  callSessionId: string | null;
  status: 'pending' | 'calling' | 'answered' | 'completed' | 'failed' | 'no_answer' | 'busy';
  duration: number;
  error?: string;
  startedAt: Date | null;
  endedAt: Date | null;
}

class BulkCallingService {
  private client: twilio.Twilio | null = null;
  private activeJobs: Map<string, BulkCallJob> = new Map();
  private concurrentCallLimit = 3; // Max concurrent calls

  constructor() {
    if (config.twilio.accountSid && config.twilio.authToken) {
      this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    } else {
      logger.warn('Twilio credentials not configured for bulk calling');
    }
  }

  async createBulkCallJob(
    userId: string,
    phoneNumbers: string[]
  ): Promise<BulkCallJob> {
    const jobId = uuidv4();

    const job: BulkCallJob = {
      id: jobId,
      userId,
      phoneNumbers,
      status: 'pending',
      totalCalls: phoneNumbers.length,
      completedCalls: 0,
      failedCalls: 0,
      activeCalls: 0,
      results: phoneNumbers.map((number) => ({
        phoneNumber: number,
        callSid: null,
        callSessionId: null,
        status: 'pending',
        duration: 0,
        startedAt: null,
        endedAt: null,
      })),
      startedAt: null,
      endedAt: null,
      createdAt: new Date(),
    };

    this.activeJobs.set(jobId, job);

    logger.info('Bulk call job created', {
      jobId,
      userId,
      totalCalls: phoneNumbers.length,
    });

    return job;
  }

  async startBulkCallJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error('Bulk call job not found');
    }

    if (job.status !== 'pending') {
      throw new Error(`Cannot start job with status: ${job.status}`);
    }

    job.status = 'in_progress';
    job.startedAt = new Date();

    logger.info('Starting bulk call job', { jobId });

    // Emit job started event
    this.emitJobUpdate(jobId);

    // Start making calls
    this.processNextCalls(jobId);
  }

  private async processNextCalls(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'cancelled' || job.status === 'completed') {
      return;
    }

    // Find pending calls
    const pendingResults = job.results.filter((r) => r.status === 'pending');

    // Calculate how many more calls we can make
    const availableSlots = this.concurrentCallLimit - job.activeCalls;

    if (availableSlots <= 0 || pendingResults.length === 0) {
      return;
    }

    // Start calls up to the limit
    const callsToMake = pendingResults.slice(0, availableSlots);

    for (const result of callsToMake) {
      this.makeCall(jobId, result);
    }
  }

  private async makeCall(jobId: string, result: CallResult): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'cancelled' || !this.client) {
      return;
    }

    try {
      result.status = 'calling';
      result.startedAt = new Date();
      job.activeCalls++;

      logger.info('Making outbound call', {
        jobId,
        phoneNumber: result.phoneNumber,
      });

      // Make the call via Twilio
      const call = await this.client.calls.create({
        to: result.phoneNumber,
        from: config.twilio.phoneNumber,
        url: `${config.server.apiBaseUrl}/api/twilio/outbound-voice?jobId=${jobId}`,
        statusCallback: `${config.server.apiBaseUrl}/api/twilio/bulk-status?jobId=${jobId}&phoneNumber=${encodeURIComponent(result.phoneNumber)}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 30,
      });

      result.callSid = call.sid;

      logger.info('Call initiated', {
        jobId,
        phoneNumber: result.phoneNumber,
        callSid: call.sid,
      });

      // Emit call started event
      this.emitJobUpdate(jobId);
    } catch (error) {
      logger.error('Failed to make call:', {
        jobId,
        phoneNumber: result.phoneNumber,
        error,
      });

      result.status = 'failed';
      result.endedAt = new Date();
      result.error = error instanceof Error ? error.message : 'Unknown error';
      job.failedCalls++;
      job.activeCalls--;

      // Emit call failed event
      this.emitJobUpdate(jobId);

      this.checkJobCompletion(jobId);
      this.processNextCalls(jobId);
    }
  }

  async handleCallStatusUpdate(
    jobId: string,
    phoneNumber: string,
    callSid: string,
    status: string,
    duration?: number
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const result = job.results.find(
      (r) => r.phoneNumber === phoneNumber || r.callSid === callSid
    );
    if (!result) return;

    result.callSid = callSid;

    logger.info('Call status update', {
      jobId,
      phoneNumber,
      callSid,
      status,
    });

    switch (status) {
      case 'answered':
        result.status = 'answered';
        break;

      case 'completed':
        result.status = 'completed';
        result.endedAt = new Date();
        result.duration = duration || 0;
        job.completedCalls++;
        job.activeCalls--;
        this.processNextCalls(jobId);
        break;

      case 'busy':
        result.status = 'busy';
        result.endedAt = new Date();
        job.failedCalls++;
        job.activeCalls--;
        this.processNextCalls(jobId);
        break;

      case 'no-answer':
        result.status = 'no_answer';
        result.endedAt = new Date();
        job.failedCalls++;
        job.activeCalls--;
        this.processNextCalls(jobId);
        break;

      case 'failed':
      case 'canceled':
        result.status = 'failed';
        result.endedAt = new Date();
        job.failedCalls++;
        job.activeCalls--;
        this.processNextCalls(jobId);
        break;
    }

    // Emit status update to subscribers
    this.emitJobUpdate(jobId);

    this.checkJobCompletion(jobId);
  }

  private checkJobCompletion(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const pendingOrActive = job.results.filter(
      (r) => r.status === 'pending' || r.status === 'calling' || r.status === 'answered'
    );

    if (pendingOrActive.length === 0) {
      job.status = 'completed';
      job.endedAt = new Date();

      logger.info('Bulk call job completed', {
        jobId,
        totalCalls: job.totalCalls,
        completedCalls: job.completedCalls,
        failedCalls: job.failedCalls,
      });

      // Emit job completed event
      this.emitJobUpdate(jobId);
    }
  }

  async cancelBulkCallJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error('Bulk call job not found');
    }

    job.status = 'cancelled';
    job.endedAt = new Date();

    // Try to hang up any active calls
    if (this.client) {
      for (const result of job.results) {
        if (result.callSid && (result.status === 'calling' || result.status === 'answered')) {
          try {
            await this.client.calls(result.callSid).update({ status: 'completed' });
          } catch (error) {
            logger.error('Failed to hangup call during cancellation:', error);
          }
        }
      }
    }

    logger.info('Bulk call job cancelled', { jobId });

    // Emit job cancelled event
    this.emitJobUpdate(jobId);
  }

  getBulkCallJob(jobId: string): BulkCallJob | undefined {
    return this.activeJobs.get(jobId);
  }

  getUserJobs(userId: string): BulkCallJob[] {
    const jobs: BulkCallJob[] = [];
    for (const job of this.activeJobs.values()) {
      if (job.userId === userId) {
        jobs.push(job);
      }
    }
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  setCallSessionId(callSid: string, callSessionId: string): void {
    for (const job of this.activeJobs.values()) {
      const result = job.results.find((r) => r.callSid === callSid);
      if (result) {
        result.callSessionId = callSessionId;
        break;
      }
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private emitJobUpdate(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Emit to all clients subscribed to this job
    socketService.emitToBulkJob(jobId, 'bulk-call:update', {
      job: {
        id: job.id,
        status: job.status,
        totalCalls: job.totalCalls,
        completedCalls: job.completedCalls,
        failedCalls: job.failedCalls,
        activeCalls: job.activeCalls,
        results: job.results,
        startedAt: job.startedAt,
        endedAt: job.endedAt,
      },
    });
  }
}

export const bulkCallingService = new BulkCallingService();
export default bulkCallingService;
