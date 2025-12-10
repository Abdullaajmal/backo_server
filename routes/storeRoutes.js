import express from 'express';
import {
  setupStore,
  getStore,
  updateStore,
  updateReturnPolicy,
  updateBranding,
  getStoreByUrl,
  connectShopify,
  getShopifyStatus,
  disconnectShopify,
  connectWooCommerce,
  connectWooCommercePortal,
  getWooCommerceStatus,
  disconnectWooCommerce,
  verifyWooCommercePlugin,
} from '../controllers/storeController.js';
import { protect } from '../middleware/auth.js';
import upload from '../config/multer.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/public/store/:storeUrl', getStoreByUrl);

// Protected routes (authentication required)
router
  .route('/')
  .get(protect, getStore)
  .put(protect, upload.single('storeLogo'), updateStore);

router.post('/setup', protect, upload.single('storeLogo'), setupStore);
router.put('/return-policy', protect, updateReturnPolicy);
router.put('/branding', protect, updateBranding);

// Shopify routes
router.post('/shopify/connect', protect, connectShopify);
router.get('/shopify/status', protect, getShopifyStatus);
router.post('/shopify/disconnect', protect, disconnectShopify);

// WooCommerce routes
router.post('/woocommerce/connect', protect, connectWooCommerce);
router.post('/woocommerce/connect-portal', protect, connectWooCommercePortal);
router.get('/woocommerce/status', protect, getWooCommerceStatus);
router.post('/woocommerce/disconnect', protect, disconnectWooCommerce);
router.post('/woocommerce/verify', verifyWooCommercePlugin); // Public route for plugin verification

export default router;

