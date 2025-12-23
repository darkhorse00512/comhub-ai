import { Request, Response, NextFunction } from 'express';
import AuthUtils from '../utils/auth';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = AuthUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'No authentication token provided' });
      return;
    }

    const decoded = AuthUtils.verifyToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    logger.debug('Request authenticated', { userId: decoded.userId });

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Invalid token',
    });
  }
};

export default authMiddleware;
