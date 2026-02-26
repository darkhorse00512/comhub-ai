import logger from '../utils/logger';

interface OTPRecord {
  code: string;
  email: string;
  type: 'signup' | 'reset';
  password?: string; // stored temporarily for signup flow
  expiresAt: number;
  attempts: number;
}

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_SENDS = 3;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

class OTPService {
  private store = new Map<string, OTPRecord>();
  private rateLimits = new Map<string, RateLimitRecord>();

  constructor() {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  private makeKey(email: string, type: string): string {
    return `${type}:${email.toLowerCase()}`;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  canSendOTP(email: string): boolean {
    const key = email.toLowerCase();
    const record = this.rateLimits.get(key);
    const now = Date.now();

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      return true;
    }

    return record.count < RATE_LIMIT_MAX_SENDS;
  }

  private trackSend(email: string): void {
    const key = email.toLowerCase();
    const now = Date.now();
    const record = this.rateLimits.get(key);

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
    } else {
      record.count++;
    }
  }

  generateOTP(email: string, type: 'signup' | 'reset', password?: string): string {
    const key = this.makeKey(email, type);
    const code = this.generateCode();

    this.store.set(key, {
      code,
      email: email.toLowerCase(),
      type,
      password,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    this.trackSend(email);

    logger.info(`OTP generated for ${email} (type: ${type})`);
    return code;
  }

  verifyOTP(email: string, code: string, type: 'signup' | 'reset'): { valid: boolean; password?: string; error?: string } {
    const key = this.makeKey(email, type);
    const record = this.store.get(key);

    if (!record) {
      return { valid: false, error: 'No verification code found. Please request a new one.' };
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      this.store.delete(key);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }

    record.attempts++;

    if (record.code !== code) {
      return { valid: false, error: `Invalid code. ${MAX_ATTEMPTS - record.attempts} attempts remaining.` };
    }

    // Valid — consume the OTP
    const password = record.password;
    this.store.delete(key);
    return { valid: true, password };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store) {
      if (now > record.expiresAt) {
        this.store.delete(key);
      }
    }
    for (const [key, record] of this.rateLimits) {
      if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        this.rateLimits.delete(key);
      }
    }
  }
}

export const otpService = new OTPService();
export default otpService;
