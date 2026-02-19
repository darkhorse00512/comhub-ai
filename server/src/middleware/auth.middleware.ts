import { Request, Response, NextFunction } from 'express';
import AuthUtils from '../utils/auth';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    is_admin: boolean;
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
      id: decoded.userId,        // For controllers that use req.user.id
      userId: decoded.userId,     // For controllers that use req.user.userId
      email: decoded.email,
      is_admin: decoded.is_admin || false,
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
