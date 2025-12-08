import express from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
<<<<<<< HEAD
  syncShopifyOrders,
=======
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getOrders)
  .post(protect, createOrder);

<<<<<<< HEAD
router.post('/sync', protect, syncShopifyOrders);

=======
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
router.route('/:id')
  .get(protect, getOrder)
  .put(protect, updateOrder)
  .delete(protect, deleteOrder);

export default router;

