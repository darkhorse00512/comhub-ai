import http from 'http';
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

    try {
      await ariClientInstance.connect();
      await ariClientInstance.startApplication();
      logger.info('Asterisk ARI client connected and application started');
    } catch (error) {
      logger.error('Failed to connect to Asterisk ARI:', error);
      logger.warn('Server will continue without ARI integration');
    }

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
