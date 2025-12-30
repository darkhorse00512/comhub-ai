import { Router } from 'express';
import authRoutes from './auth.routes';
import callRoutes from './call.routes';
import twilioRoutes from './twilio.routes';
import bulkCallRoutes from './bulk-call.routes';
import config from '../config';

const router = Router();

router.use('/auth', authRoutes);
router.use('/calls', callRoutes);
router.use('/twilio', twilioRoutes);
router.use('/bulk-calls', bulkCallRoutes);

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Telephony Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Configuration check endpoint
router.get('/config-check', (_req, res) => {
  const apiBaseUrl = config.server.apiBaseUrl;
  const isHttps = apiBaseUrl.startsWith('https://');
  const twilioConfigured = !!(config.twilio.accountSid && config.twilio.authToken);
  const openaiConfigured = !!config.openai.apiKey;
  const supabaseConfigured = !!(config.supabase.url && config.supabase.serviceRoleKey);

  res.status(200).json({
    success: true,
    config: {
      apiBaseUrl,
      isHttps,
      twilioWebhookUrl: `${apiBaseUrl}/api/twilio/voice`,
      warnings: [
        ...(!isHttps ? ['API_BASE_URL uses HTTP - Twilio requires HTTPS for webhooks!'] : []),
        ...(!twilioConfigured ? ['Twilio credentials not configured'] : []),
        ...(!openaiConfigured ? ['OpenAI API key not configured'] : []),
        ...(!supabaseConfigured ? ['Supabase not configured'] : []),
      ],
      status: {
        twilio: twilioConfigured ? 'OK' : 'MISSING',
        openai: openaiConfigured ? 'OK' : 'MISSING',
        supabase: supabaseConfigured ? 'OK' : 'MISSING',
        https: isHttps ? 'OK' : 'WARNING - Twilio requires HTTPS',
      },
    },
  });
});

export default router;
