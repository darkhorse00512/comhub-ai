import { Request, Response } from 'express';
import voiceConversationService from '../services/voice-conversation.service';
import bulkCallingService from '../services/bulk-calling.service';
import twilioSIPService from '../twilio/sip.service';
import logger from '../utils/logger';

export class TwilioController {
  // Handle incoming calls to Twilio number - Main entry point for inbound calls
  async handleVoiceWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, From, To, CallStatus } = req.body;

      logger.info('Inbound call received', {
        callSid: CallSid,
        from: From,
        to: To,
        status: CallStatus,
      });

      // Start AI conversation with greeting
      const twiml = await voiceConversationService.startInboundConversation(
        CallSid,
        From,
        To
      );

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle inbound voice:', error);
      res.type('text/xml');
      res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Sorry, we are experiencing technical difficulties. Please try again later.</Say>
          <Hangup/>
        </Response>
      `);
    }
  }

  // Handle outbound call pickup (for bulk calling)
  async handleOutboundVoice(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, To, CallStatus, AnsweredBy } = req.body;
      const { jobId } = req.query;

      logger.info('Outbound call answered', {
        callSid: CallSid,
        to: To,
        status: CallStatus,
        answeredBy: AnsweredBy,
        jobId,
      });

      // Check if it's a machine (voicemail)
      if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep') {
        logger.info('Call answered by machine, hanging up', { callSid: CallSid });
        res.type('text/xml');
        res.send(`
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Hangup/>
          </Response>
        `);
        return;
      }

      // Get user ID from the job
      const job = jobId ? bulkCallingService.getBulkCallJob(jobId as string) : null;
      const userId = job?.userId || 'system';

      // Start AI conversation
      const twiml = await voiceConversationService.startOutboundConversation(
        CallSid,
        To,
        userId
      );

      // Update bulk calling service with session ID
      const conversation = voiceConversationService.getConversation(CallSid);
      if (conversation && jobId) {
        bulkCallingService.setCallSessionId(CallSid, conversation.callSessionId);
      }

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle outbound voice:', error);
      res.type('text/xml');
      res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Sorry, something went wrong. Goodbye.</Say>
          <Hangup/>
        </Response>
      `);
    }
  }

  // Handle recording completion - process user speech and respond
  async handleRecording(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

      logger.info('Recording received', {
        callSid: CallSid,
        recordingSid: RecordingSid,
        duration: RecordingDuration,
      });

      // Process the recording and generate AI response
      const twiml = await voiceConversationService.processRecording(
        CallSid,
        RecordingUrl,
        RecordingSid
      );

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle recording:', error);
      res.type('text/xml');
      res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Sorry, I had trouble understanding. Let me try again.</Say>
          <Record action="/api/twilio/handle-recording" method="POST" maxLength="30" timeout="2" playBeep="false" trim="trim-silence"/>
          <Say voice="alice">Thank you for calling. Goodbye.</Say>
          <Hangup/>
        </Response>
      `);
    }
  }

  // Handle call status updates
  async handleStatusCallback(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;

      logger.info('Call status callback', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
      });

      // Handle call completion
      if (CallStatus === 'completed' || CallStatus === 'failed' ||
          CallStatus === 'busy' || CallStatus === 'no-answer' ||
          CallStatus === 'canceled') {
        await voiceConversationService.endConversation(CallSid);
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Failed to handle status callback:', error);
      res.status(500).send('Error');
    }
  }

  // Handle bulk calling status updates
  async handleBulkStatusCallback(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;
      const { jobId, phoneNumber } = req.query;

      logger.info('Bulk call status callback', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
        jobId,
        phoneNumber,
      });

      if (jobId && phoneNumber) {
        await bulkCallingService.handleCallStatusUpdate(
          jobId as string,
          decodeURIComponent(phoneNumber as string),
          CallSid,
          CallStatus,
          CallDuration ? parseInt(CallDuration) : undefined
        );
      }

      // Also handle conversation end
      if (CallStatus === 'completed' || CallStatus === 'failed' ||
          CallStatus === 'busy' || CallStatus === 'no-answer' ||
          CallStatus === 'canceled') {
        await voiceConversationService.endConversation(CallSid);
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Failed to handle bulk status callback:', error);
      res.status(500).send('Error');
    }
  }

  async handleSIPForward(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, From } = req.body;
      const { sipUri } = req.query;

      logger.info('Twilio SIP forward webhook received', {
        callSid: CallSid,
        from: From,
        sipUri,
      });

      const twiml = twilioSIPService.generateTwiML('dial', {
        number: sipUri,
        callerId: From,
      });

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle SIP forward:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  async handleBridge(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, From } = req.body;
      const { sipUri } = req.query;

      logger.info('Twilio bridge webhook received', {
        callSid: CallSid,
        from: From,
        sipUri,
      });

      const twiml = twilioSIPService.generateTwiML('dial', {
        number: sipUri,
        callerId: From,
      });

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle bridge:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  async makeOutboundCall(req: Request, res: Response): Promise<void> {
    try {
      const { to, from } = req.body;

      if (!to) {
        res.status(400).json({ error: 'Destination number is required' });
        return;
      }

      const call = await twilioSIPService.makeCall(to, from);

      logger.info('Outbound Twilio call initiated', {
        callSid: call.sid,
        to,
        from,
      });

      res.status(200).json({
        success: true,
        callSid: call.sid,
        status: call.status,
      });
    } catch (error) {
      logger.error('Failed to make outbound call:', error);
      res.status(500).json({
        error: 'Failed to make outbound call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async endCall(req: Request, res: Response): Promise<void> {
    try {
      const { callSid } = req.params;

      if (!callSid) {
        res.status(400).json({ error: 'Call SID is required' });
        return;
      }

      await twilioSIPService.endCall(callSid);

      logger.info('Twilio call ended', { callSid });

      res.status(200).json({
        success: true,
        message: 'Call ended successfully',
      });
    } catch (error) {
      logger.error('Failed to end Twilio call:', error);
      res.status(500).json({
        error: 'Failed to end call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const twilioController = new TwilioController();
export default twilioController;
