import { Router } from 'express';
import authController from '../controllers/auth.controller';
import authMiddleware from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';

const router = Router();

router.post('/register', validate(schemas.register), authController.register);

router.post('/login', validate(schemas.login), authController.login);

router.get('/verify', authController.verifyToken);

router.get('/profile', authMiddleware, authController.getProfile);

export default router;
