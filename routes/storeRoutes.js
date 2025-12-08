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
} from '../controllers/storeController.js';
import { protect } from '../middleware/auth.js';
import upload from '../config/multer.js';

const router = express.Router();

// Public routes (no authentication required)
// Handle store URL - match anything after /public/store/ using wildcard
// Express wildcard (*) needs to be handled carefully
router.get('/public/store/*', (req, res, next) => {
  // Extract everything after /public/store/ from the path
  // req.path will be '/public/store/merchant-9706.myshopify.com'
  // or '/api/store/public/store/merchant-9706.myshopify.com' depending on how it's mounted
  let storeUrl = null;
  
  // Try to extract from path
  const pathMatch = req.path.match(/\/public\/store\/(.+)$/);
  if (pathMatch) {
    storeUrl = pathMatch[1];
  }
  
  // If not found, try from originalUrl
  if (!storeUrl) {
    const urlMatch = req.originalUrl.match(/\/public\/store\/(.+)$/);
    if (urlMatch) {
      storeUrl = urlMatch[1];
    }
  }
  
  if (storeUrl) {
    req.storeUrlParam = storeUrl;
    console.log('📥 Extracted store URL from path:', storeUrl);
  }
  
  next();
}, getStoreByUrl);

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

export default router;

