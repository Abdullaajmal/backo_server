import express from 'express';
import { getProducts, syncProducts, syncProductFromPlugin } from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getProducts);

router.post('/sync', protect, syncProducts);
router.post('/sync-from-plugin', syncProductFromPlugin); // Public route for plugin

export default router;

