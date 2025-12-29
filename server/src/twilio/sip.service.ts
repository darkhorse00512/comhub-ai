import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';

class TwilioSIPService {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (config.twilio.accountSid && config.twilio.authToken) {
      this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
      logger.info('Twilio client initialized');
    } else {
      logger.warn('Twilio credentials not configured');
    }
  }

  async makeCall(to: string, from?: string): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      // Use outbound-voice webhook which starts AI conversation when call is answered
      const call = await this.client.calls.create({
        to,
        from: from || config.twilio.phoneNumber,
        url: `${config.server.apiBaseUrl}/api/twilio/outbound-voice`,
        statusCallback: `${config.server.apiBaseUrl}/api/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        machineDetection: 'Enable', // Detect voicemail
        machineDetectionTimeout: 5,
      });

      logger.info('Twilio outbound call created', {
        callSid: call.sid,
        to,
        from: from || config.twilio.phoneNumber,
      });

      return call;
    } catch (error) {
      logger.error('Failed to create Twilio call:', error);
      throw error;
    }
  }

  async endCall(callSid: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      await this.client.calls(callSid).update({ status: 'completed' });
      logger.info('Twilio call ended', { callSid });
    } catch (error) {
      logger.error('Failed to end Twilio call:', error);
      throw error;
    }
  }

  async getCallStatus(callSid: string): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      logger.debug('Twilio call status retrieved', {
        callSid,
        status: call.status,
      });
      return call;
    } catch (error) {
      logger.error('Failed to get Twilio call status:', error);
      throw error;
    }
  }

  generateTwiML(action: 'dial' | 'say' | 'play', params: any): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    switch (action) {
      case 'dial':
        response.dial({
          callerId: params.callerId || config.twilio.phoneNumber,
        }, params.number);
        break;

      case 'say':
        response.say({
          voice: params.voice || 'Polly.Joanna',
        }, params.text);
        break;

      case 'play':
        response.play(params.url);
        break;

      default:
        throw new Error(`Unknown TwiML action: ${action}`);
    }

    return response.toString();
  }

  async forwardToSIP(
    fromNumber: string,
    toSipUri: string,
    customHeaders?: Record<string, string>
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const call = await this.client.calls.create({
        from: fromNumber,
        to: toSipUri,
        url: `${config.server.apiBaseUrl}/api/twilio/sip-forward`,
        statusCallback: `${config.server.apiBaseUrl}/api/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        sipAuthUsername: customHeaders?.username,
        sipAuthPassword: customHeaders?.password,
      });

      logger.info('Call forwarded to SIP', {
        callSid: call.sid,
        toSipUri,
      });

      return call;
    } catch (error) {
      logger.error('Failed to forward call to SIP:', error);
      throw error;
    }
  }

  async bridgeCallToAsterisk(
    twilioCallSid: string,
    asteriskSipUri: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      await this.client.calls(twilioCallSid).update({
        url: `${config.server.apiBaseUrl}/api/twilio/bridge?sipUri=${encodeURIComponent(asteriskSipUri)}`,
      });

      logger.info('Twilio call bridged to Asterisk', {
        twilioCallSid,
        asteriskSipUri,
      });
    } catch (error) {
      logger.error('Failed to bridge Twilio call to Asterisk:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }
}

export const twilioSIPService = new TwilioSIPService();
export default twilioSIPService;
