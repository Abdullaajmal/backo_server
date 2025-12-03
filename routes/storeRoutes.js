import express from 'express';
import {
  setupStore,
  getStore,
  updateStore,
  updateReturnPolicy,
  updateBranding,
} from '../controllers/storeController.js';
import { protect } from '../middleware/auth.js';
import upload from '../config/multer.js';

const router = express.Router();

router
  .route('/')
  .get(protect, getStore)
  .put(protect, upload.single('storeLogo'), updateStore);

router.post('/setup', protect, upload.single('storeLogo'), setupStore);
router.put('/return-policy', protect, updateReturnPolicy);
router.put('/branding', protect, updateBranding);

export default router;

