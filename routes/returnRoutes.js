import express from 'express';
import {
  getReturns,
  getReturn,
  createReturn,
  updateReturn,
  deleteReturn,
} from '../controllers/returnController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getReturns)
  .post(protect, createReturn);

router.route('/:id')
  .get(protect, getReturn)
  .put(protect, updateReturn)
  .delete(protect, deleteReturn);

export default router;

