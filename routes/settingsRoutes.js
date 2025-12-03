import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';
import upload from '../config/multerSettings.js';

const router = express.Router();

router
  .route('/')
  .get(protect, getSettings)
  .put(protect, upload.single('storeLogo'), updateSettings);

export default router;

