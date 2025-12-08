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
<<<<<<< HEAD
router.post('/public/returns/:storeUrl/upload', upload.array('photos', 5), createPublicReturn); // Alternative route
=======
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
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

