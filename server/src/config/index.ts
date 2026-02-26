import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  server: {
    port: number;
    env: string;
    apiBaseUrl: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
  };
  asterisk: {
    ariUrl: string;
    ariUsername: string;
    ariPassword: string;
    appName: string;
  };
  openai: {
    apiKey: string;
    model: string;
    ttsModel: string;
    ttsVoice: string;
    whisperModel: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    sipDomain: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  security: {
    corsOrigin: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  resend: {
    apiKey: string;
    fromEmail: string;
  };
  logging: {
    level: string;
    filePath: string;
  };
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  asterisk: {
    ariUrl: process.env.ASTERISK_ARI_URL || 'http://localhost:8088',
    ariUsername: process.env.ASTERISK_ARI_USERNAME || 'ariuser',
    ariPassword: process.env.ASTERISK_ARI_PASSWORD || 'aripassword',
    appName: process.env.ASTERISK_ARI_APP_NAME || 'ai-telephony',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    ttsModel: process.env.OPENAI_TTS_MODEL || 'tts-1',
    ttsVoice: process.env.OPENAI_TTS_VOICE || 'alloy',
    whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    sipDomain: process.env.TWILIO_SIP_DOMAIN || '',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'auth@comhubai.com',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/app.log'),
  },
};

export function validateConfig(): void {
  const requiredFields = [
    { key: 'SUPABASE_URL', value: config.supabase.url },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: config.supabase.serviceRoleKey },
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey },
    { key: 'JWT_SECRET', value: config.jwt.secret },
  ];

  const missing = requiredFields.filter((field) => !field.value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map((f) => f.key).join(', ')}`
    );
  }

  if (config.jwt.secret === 'change-this-secret-key' && config.server.env === 'production') {
    throw new Error('JWT_SECRET must be changed in production environment');
  }
}

export default config;
