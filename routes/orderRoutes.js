import express from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  syncShopifyOrders,
  syncOrderFromPlugin,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getOrders)
  .post(protect, createOrder);

router.post('/sync', protect, syncShopifyOrders);
router.post('/sync-from-plugin', syncOrderFromPlugin); // Public route for plugin

router.route('/:id')
  .get(protect, getOrder)
  .put(protect, updateOrder)
  .delete(protect, deleteOrder);

export default router;

