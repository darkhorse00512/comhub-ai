import { Request, Response } from 'express';
import twilioSIPService from '../twilio/sip.service';
import logger from '../utils/logger';

export class TwilioController {
  async handleVoiceWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, From, To, CallStatus } = req.body;

      logger.info('Twilio voice webhook received', {
        callSid: CallSid,
        from: From,
        to: To,
        status: CallStatus,
      });

      const twiml = twilioSIPService.generateTwiML('say', {
        text: 'Hello, you have reached the AI telephony system. Please wait while we connect you.',
      });

      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      logger.error('Failed to handle voice webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  async handleStatusCallback(req: Request, res: Response): Promise<void> {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;

      logger.info('Twilio status callback received', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
      });

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Failed to handle status callback:', error);
      res.status(500).send('Internal Server Error');
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
