import express from 'express';
import {
  getReturns,
  getReturn,
  createReturn,
  updateReturn,
  deleteReturn,
  createPublicReturn,
  getPublicReturn,
  findOrder,
} from '../controllers/returnController.js';
import { protect } from '../middleware/auth.js';
import upload from '../config/multer.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/public/orders/find', findOrder);
router.post('/public/returns/:storeUrl', upload.array('photos', 5), createPublicReturn);
router.get('/public/returns/:storeUrl/:returnId', getPublicReturn);

// Protected routes (authentication required)
router.route('/')
  .get(protect, getReturns)
  .post(protect, createReturn);

router.route('/:id')
  .get(protect, getReturn)
  .put(protect, updateReturn)
  .delete(protect, deleteReturn);

export default router;

