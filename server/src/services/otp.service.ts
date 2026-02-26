import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';

const MAX_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 5;
const RATE_LIMIT_COOLDOWN_SECONDS = 60;

class OTPService {
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async canSendOTP(email: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const cooldownStart = new Date(Date.now() - RATE_LIMIT_COOLDOWN_SECONDS * 1000).toISOString();

    const { data } = await supabase
      .from('otp_codes')
      .select('id')
      .eq('email', email.toLowerCase())
      .gt('created_at', cooldownStart)
      .limit(1);

    return !data || data.length === 0;
  }

  async generateOTP(email: string, type: 'signup' | 'reset'): Promise<string> {
    const supabase = getSupabaseClient();
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    const normalizedEmail = email.toLowerCase();

    // Delete any existing OTPs for this email+type
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', normalizedEmail)
      .eq('type', type);

    // Insert new OTP
    const { error } = await supabase
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code,
        type,
        attempts: 0,
        expires_at: expiresAt,
      });

    if (error) {
      logger.error('Failed to store OTP:', error);
      throw new Error('Failed to generate verification code');
    }

    logger.info(`OTP generated for ${email} (type: ${type})`);
    return code;
  }

  async verifyOTP(email: string, code: string, type: 'signup' | 'reset'): Promise<{ valid: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    const normalizedEmail = email.toLowerCase();

    // Find the latest OTP for this email+type
    const { data: otp, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('type', type)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !otp) {
      return { valid: false, error: 'No verification code found. Please request a new one.' };
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await supabase.from('otp_codes').delete().eq('id', otp.id);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }

    if (otp.code !== code) {
      // Increment attempts
      await supabase
        .from('otp_codes')
        .update({ attempts: otp.attempts + 1 })
        .eq('id', otp.id);

      const remaining = MAX_ATTEMPTS - otp.attempts - 1;
      return { valid: false, error: `Invalid code. ${remaining} attempts remaining.` };
    }

    // Valid — consume the OTP
    await supabase.from('otp_codes').delete().eq('id', otp.id);
    return { valid: true };
  }
}

export const otpService = new OTPService();
export default otpService;
