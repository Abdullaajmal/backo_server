import express from 'express';
import { wooCommerceWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Unified webhook endpoint for WooCommerce
// Secret key is in the URL path for easy configuration in WordPress plugin
router.post('/woocommerce/:secretKey', wooCommerceWebhook);

// Handle GET requests (for testing/verification)
router.get('/woocommerce/:secretKey', (req, res) => {
  const { secretKey } = req.params;
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
    method: 'POST',
    endpoint: `/api/webhook/woocommerce/${secretKey}`,
    instructions: 'This endpoint accepts POST requests only. Send your data with type: "order", "product", or "customer"',
    example: {
      type: 'order',
      data: {
        order_id: 123,
        order_number: '#1234',
        // ... order data
      }
    }
  });
});

export default router;

