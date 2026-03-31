import http from 'http';
import WebSocket from 'ws';
import app from './app';
import config, { validateConfig } from './config';
import logger from './utils/logger';
import socketService from './sockets';
import ariClientInstance from './ari/client';
import getSupabaseClient from './config/supabase';

async function startServer(): Promise<void> {
  try {
    logger.info('Starting AI Telephony Backend...');

    validateConfig();
    logger.info('Configuration validated successfully');

    getSupabaseClient();
    logger.info('Supabase client initialized');

    const server = http.createServer(app);

    socketService.initialize(server);
    logger.info('Socket.IO initialized');

    // Try to connect to ARI, but don't block server startup
    (async () => {
      try {
        await ariClientInstance.connect();
        await ariClientInstance.startApplication();
        logger.info('Asterisk ARI client connected and application started');
      } catch (error) {
        logger.error('Failed to connect to Asterisk ARI:', error);
        logger.warn('Server will continue without ARI integration');
      }
    })();

    // --- STT Realtime WebSocket Proxy ---
    // Proxies client audio to ElevenLabs Realtime STT via WebSocket.
    // Client can't set custom headers, so server connects with xi-api-key header.
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      if (!url.pathname.startsWith('/stt-realtime')) return;

      const apiKey = url.searchParams.get('apiKey') || config.elevenlabs.apiKey;
      const lang = url.searchParams.get('language_code') || 'en';

      if (!apiKey) {
        socket.destroy();
        return;
      }

      // Connect to ElevenLabs with API key header
      // Fast VAD settings — minimum allowed values
      const elParams = new URLSearchParams({
        model_id: 'scribe_v2_realtime',
        audio_format: 'pcm_16000',
        commit_strategy: 'vad',
        language_code: lang,
        vad_silence_threshold_secs: '0.3',  // 300ms silence = speech ended (min allowed)
        min_silence_duration_ms: '100',
        min_speech_duration_ms: '50',
      });
      const elUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${elParams}`;
      const elWs = new WebSocket(elUrl, { headers: { 'xi-api-key': apiKey } });

      // Create a WebSocket server for this single connection
      const wss = new WebSocket.Server({ noServer: true });
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        let elReady = false;

        elWs.on('open', () => {
          elReady = true;
          logger.info('STT proxy: connected to ElevenLabs');
        });

        elWs.on('message', (data) => {
          // Forward ElevenLabs messages to client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString());
          }
        });

        elWs.on('close', (code, reason) => {
          logger.info('STT proxy: ElevenLabs closed', { code, reason: reason.toString() });
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
        });

        elWs.on('error', (err) => {
          logger.error('STT proxy: ElevenLabs error', { error: err.message });
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
        });

        clientWs.on('message', (data) => {
          // Forward client audio to ElevenLabs
          if (elReady && elWs.readyState === WebSocket.OPEN) {
            elWs.send(data.toString());
          }
        });

        clientWs.on('close', () => {
          if (elWs.readyState === WebSocket.OPEN) elWs.close();
        });
      });
    });

    server.listen(config.server.port, () => {
      logger.info(`Server is running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`API Base URL: ${config.server.apiBaseUrl}`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await ariClientInstance.disconnect();
          logger.info('ARI client disconnected');
        } catch (error) {
          logger.error('Error disconnecting ARI client:', error);
        }

        logger.info('Shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise,
      });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
