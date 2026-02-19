import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import adminMiddleware from '../middleware/admin.middleware';
import adminController from '../controllers/admin.controller';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.put('/users/:userId/toggle-admin', adminController.toggleAdmin);
router.delete('/users/:userId', adminController.deleteUser);

export default router;
