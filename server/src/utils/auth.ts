import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config';
import logger from './logger';

export interface JWTPayload {
  userId: string;
  email: string;
  is_admin?: boolean;
  iat?: number;
  exp?: number;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      // Use type assertion for expiresIn to work with jsonwebtoken's StringValue type
      const token = jwt.sign(
        payload,
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
      );

      logger.debug('JWT token generated', { userId: payload.userId });

      return token;
    } catch (error) {
      logger.error('Failed to generate JWT token:', error);
      throw new Error('Token generation failed');
    }
  }

  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      logger.debug('JWT token verified', { userId: decoded.userId });

      return decoded;
    } catch (error) {
      logger.error('Failed to verify JWT token:', error);
      throw new Error('Invalid or expired token');
    }
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}

export default AuthUtils;
