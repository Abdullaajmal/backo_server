import express from 'express';
import {
  getCustomers,
  getCustomer,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getCustomers);
router.get('/:email', protect, getCustomer);

export default router;

