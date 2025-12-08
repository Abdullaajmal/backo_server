import express from 'express';
import { getProducts, syncProducts } from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getProducts);

router.post('/sync', protect, syncProducts);

export default router;

