import ariClient from 'ari-client';
import config from '../config';
import logger from '../utils/logger';
import EventEmitter from 'events';

export interface ARIChannel {
  id: string;
  name: string;
  state: string;
  caller: {
    name: string;
    number: string;
  };
  connected: {
    name: string;
    number: string;
  };
  accountcode: string;
  dialplan: {
    context: string;
    exten: string;
    priority: number;
  };
  creationtime: string;
}

export interface ARIBridge {
  id: string;
  technology: string;
  bridge_type: string;
  name: string;
  creator: string;
  channels: string[];
}

class ARIClient extends EventEmitter {
  private client: any = null;
  private isConnected: boolean = false;
  private reconnectInterval: NodeJS.Timeout | null = null;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to Asterisk ARI...', {
        url: config.asterisk.ariUrl,
        app: config.asterisk.appName,
      });

      this.client = await ariClient.connect(
        config.asterisk.ariUrl,
        config.asterisk.ariUsername,
        config.asterisk.ariPassword
      );

      this.isConnected = true;
      logger.info('Successfully connected to Asterisk ARI');

      this.setupEventHandlers();
      this.emit('connected');
    } catch (error) {
      logger.error('Failed to connect to Asterisk ARI:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('StasisStart', (event: any, channel: ARIChannel) => {
      logger.info('StasisStart event received', {
        channelId: channel.id,
        callerNumber: channel.caller.number,
      });
      this.emit('stasisStart', event, channel);
    });

    this.client.on('StasisEnd', (event: any, channel: ARIChannel) => {
      logger.info('StasisEnd event received', { channelId: channel.id });
      this.emit('stasisEnd', event, channel);
    });

    this.client.on('ChannelStateChange', (event: any, channel: ARIChannel) => {
      logger.debug('Channel state changed', {
        channelId: channel.id,
        state: channel.state,
      });
      this.emit('channelStateChange', event, channel);
    });

    this.client.on('ChannelDtmfReceived', (event: any, channel: ARIChannel) => {
      logger.debug('DTMF received', {
        channelId: channel.id,
        digit: event.digit,
      });
      this.emit('channelDtmf', event, channel);
    });

    this.client.on('ChannelHangupRequest', (event: any, channel: ARIChannel) => {
      logger.info('Channel hangup requested', { channelId: channel.id });
      this.emit('channelHangupRequest', event, channel);
    });

    this.client.on('ChannelDestroyed', (event: any, channel: ARIChannel) => {
      logger.info('Channel destroyed', {
        channelId: channel.id,
        cause: event.cause,
      });
      this.emit('channelDestroyed', event, channel);
    });

    this.client.on('error', (error: Error) => {
      logger.error('ARI client error:', error);
      this.emit('error', error);
    });

    this.client.on('WebSocketReconnecting', () => {
      logger.warn('ARI WebSocket reconnecting...');
      this.isConnected = false;
    });

    this.client.on('WebSocketConnected', () => {
      logger.info('ARI WebSocket reconnected');
      this.isConnected = true;
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      try {
        logger.info('Attempting to reconnect to ARI...');
        await this.connect();
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
      }
    }, 5000);
  }

  async startApplication(): Promise<void> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      await this.client.start(config.asterisk.appName);
      logger.info(`ARI application started: ${config.asterisk.appName}`);
    } catch (error) {
      logger.error('Failed to start ARI application:', error);
      throw error;
    }
  }

  async originateCall(endpoint: string, callerId?: string): Promise<ARIChannel> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const channel = await this.client.channels.originate({
        endpoint,
        app: config.asterisk.appName,
        callerId: callerId || 'AI Assistant',
      });

      logger.info('Call originated successfully', {
        channelId: channel.id,
        endpoint,
      });

      return channel;
    } catch (error) {
      logger.error('Failed to originate call:', error);
      throw error;
    }
  }

  async answerChannel(channelId: string): Promise<void> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const channel = this.client.Channel();
      await channel.answer({ channelId });
      logger.info('Channel answered', { channelId });
    } catch (error) {
      logger.error('Failed to answer channel:', error);
      throw error;
    }
  }

  async hangupChannel(channelId: string): Promise<void> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const channel = this.client.Channel();
      await channel.hangup({ channelId });
      logger.info('Channel hung up', { channelId });
    } catch (error) {
      logger.error('Failed to hangup channel:', error);
      throw error;
    }
  }

  async createBridge(type: string = 'mixing'): Promise<ARIBridge> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const bridge = await this.client.bridges.create({ type });
      logger.info('Bridge created', { bridgeId: bridge.id, type });
      return bridge;
    } catch (error) {
      logger.error('Failed to create bridge:', error);
      throw error;
    }
  }

  async addChannelToBridge(bridgeId: string, channelId: string): Promise<void> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const bridge = this.client.Bridge();
      await bridge.addChannel({ bridgeId, channel: channelId });
      logger.info('Channel added to bridge', { bridgeId, channelId });
    } catch (error) {
      logger.error('Failed to add channel to bridge:', error);
      throw error;
    }
  }

  async playToChannel(channelId: string, media: string): Promise<any> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const channel = this.client.Channel();
      const playback = await channel.play({ channelId, media });
      logger.info('Playing media to channel', { channelId, media });
      return playback;
    } catch (error) {
      logger.error('Failed to play media to channel:', error);
      throw error;
    }
  }

  async recordChannel(
    channelId: string,
    name: string,
    format: string = 'wav'
  ): Promise<any> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const channel = this.client.Channel();
      const recording = await channel.record({
        channelId,
        name,
        format,
        maxDurationSeconds: 3600,
        maxSilenceSeconds: 5,
      });
      logger.info('Recording started', { channelId, name, format });
      return recording;
    } catch (error) {
      logger.error('Failed to start recording:', error);
      throw error;
    }
  }

  async startExternalMedia(channelId: string, options: any): Promise<any> {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }

    try {
      const result = await this.client.channels.externalMedia({
        channelId,
        app: config.asterisk.appName,
        ...options,
      });
      logger.info('External media started', { channelId });
      return result;
    } catch (error) {
      logger.error('Failed to start external media:', error);
      throw error;
    }
  }

  getChannel(channelId: string): any {
    if (!this.client) {
      throw new Error('ARI client not connected');
    }
    return this.client.Channel(channelId);
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.client) {
      this.isConnected = false;
      this.client = null;
      logger.info('ARI client disconnected');
    }
  }
}

export const ariClientInstance = new ARIClient();
export default ariClientInstance;
