import { Router } from 'express';
import phoneNumbersController from '../controllers/phone-numbers.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all phone numbers for the authenticated user
router.get('/', phoneNumbersController.getPhoneNumbers);

// Get a single phone number
router.get('/:id', phoneNumbersController.getPhoneNumber);

// Import an existing Twilio phone number
router.post('/import', phoneNumbersController.importPhoneNumber);

// Purchase a new Twilio phone number (future feature)
router.post('/purchase', phoneNumbersController.purchasePhoneNumber);

// Update phone number settings
router.put('/:id', phoneNumbersController.updatePhoneNumber);

// Delete a phone number
router.delete('/:id', phoneNumbersController.deletePhoneNumber);

export default router;
