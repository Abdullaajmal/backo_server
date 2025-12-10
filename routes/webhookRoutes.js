import express from 'express';
import { wooCommerceWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Unified webhook endpoint for WooCommerce
// Secret key is in the URL path for easy configuration in WordPress plugin
router.post('/woocommerce/:secretKey', wooCommerceWebhook);

export default router;

