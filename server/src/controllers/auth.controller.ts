import { Request, Response } from 'express';
import getSupabaseClient from '../config/supabase';
import AuthUtils from '../utils/auth';
import logger from '../utils/logger';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ email })
        .select()
        .single();

      if (error) throw error;

      const token = AuthUtils.generateToken({
        userId: newUser.id,
        email: newUser.email,
      });

      logger.info('User registered successfully', { userId: newUser.id, email });

      res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.created_at,
        },
        token,
      });
    } catch (error) {
      logger.error('Registration failed:', error);
      res.status(500).json({
        error: 'Registration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = AuthUtils.generateToken({
        userId: user.id,
        email: user.email,
      });

      logger.info('User logged in successfully', { userId: user.id, email });

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
        token,
      });
    } catch (error) {
      logger.error('Login failed:', error);
      res.status(500).json({
        error: 'Login failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = AuthUtils.extractTokenFromHeader(req.headers.authorization);

      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const decoded = AuthUtils.verifyToken(token);

      res.status(200).json({
        success: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
        },
      });
    } catch (error) {
      logger.error('Token verification failed:', error);
      res.status(401).json({
        error: 'Invalid token',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      logger.error('Failed to get profile:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const authController = new AuthController();
export default authController;
