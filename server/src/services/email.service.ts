import { Resend } from 'resend';
import config from '../config';
import logger from '../utils/logger';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!config.resend.apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(config.resend.apiKey);
  }
  return resend;
}

export class EmailService {
  async sendOTP(email: string, code: string, type: 'signup' | 'reset'): Promise<boolean> {
    const subject = type === 'signup'
      ? 'Verify your ComhubAI account'
      : 'Reset your ComhubAI password';

    const heading = type === 'signup'
      ? 'Welcome to ComhubAI!'
      : 'Password Reset Request';

    const description = type === 'signup'
      ? 'Use the verification code below to complete your signup:'
      : 'Use the code below to reset your password:';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr><td align="center">
      <table width="460" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid #1e1e2e;padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="font-size:24px;font-weight:700;color:#ffffff;">${heading}</div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="font-size:15px;color:#a1a1aa;line-height:1.5;">${description}</div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:12px;padding:16px 32px;letter-spacing:12px;font-size:32px;font-weight:700;color:#ffffff;font-family:monospace;">
            ${code}
          </div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:16px;">
          <div style="font-size:13px;color:#71717a;">This code expires in 5 minutes.</div>
        </td></tr>
        <tr><td align="center">
          <div style="font-size:12px;color:#52525b;">If you didn't request this, you can safely ignore this email.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const { error } = await getResend().emails.send({
        from: `ComhubAI <${config.resend.fromEmail}>`,
        to: [email],
        subject,
        html,
      });

      if (error) {
        logger.error('Failed to send OTP email:', error);
        return false;
      }

      logger.info(`OTP email sent to ${email} (type: ${type})`);
      return true;
    } catch (err) {
      logger.error('Email service error:', err);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
