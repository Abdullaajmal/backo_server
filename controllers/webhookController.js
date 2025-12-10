import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

// Helper function to verify secret key and get user
const verifySecretKey = async (secretKey) => {
  if (!secretKey) {
    return null;
  }
  
  const user = await User.findOne({ 
    'wooCommerce.secretKey': secretKey,
    'wooCommerce.isConnected': true 
  }).select('+wooCommerce.secretKey');
  
  return user;
};

// @desc    Unified webhook endpoint for WooCommerce - handles orders, products, and customers
// @route   POST /api/webhook/woocommerce/:secretKey
// @access  Public (authenticated via secret key in URL)
export const wooCommerceWebhook = async (req, res) => {
  try {
    const { secretKey } = req.params;
    const { type, data } = req.body; // type: 'order', 'product', 'customer'

    if (!secretKey) {
      return res.status(401).json({
        success: false,
        message: 'Secret key is required in URL',
      });
    }

    // Verify secret key and get user
    const user = await verifySecretKey(secretKey);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    // Handle different types of data
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        message: 'Type and data are required. Type should be: order, product, or customer',
      });
    }

    let result = null;

    switch (type.toLowerCase()) {
      case 'order':
        result = await handleOrderWebhook(user, data);
        break;
      
      case 'product':
        result = await handleProductWebhook(user, data);
        break;
      
      case 'customer':
        result = await handleCustomerWebhook(user, data);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: `Invalid type: ${type}. Type must be: order, product, or customer`,
        });
    }

    res.json({
      success: true,
      message: `${type} synced successfully`,
      data: result,
    });
  } catch (error) {
    console.error('Error in WooCommerce webhook:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Handle order webhook
const handleOrderWebhook = async (user, orderData) => {
  const { 
    order_id, 
    order_number, 
    status, 
    total, 
    currency, 
    payment_method,
    customer, 
    billing_address,
    shipping_address,
    items, 
    date_created,
    date_modified 
  } = orderData;

  if (!order_id && !order_number) {
    throw new Error('Order ID or Order Number is required');
  }

  // Convert plugin order data to our format
  const orderPayload = {
    userId: user._id,
    wooCommerceOrderId: order_id?.toString() || order_number?.toString(),
    orderNumber: order_number?.toString() || order_id?.toString() || '',
    customer: {
      name: customer?.name || (customer?.first_name && customer?.last_name 
        ? `${customer.first_name} ${customer.last_name}`.trim() 
        : 'Guest'),
      email: customer?.email || '',
      phone: customer?.phone || '',
    },
    items: (items || []).map(item => ({
      productName: item.name || 'Product',
      quantity: item.quantity || 1,
      price: parseFloat(item.price || item.subtotal || 0),
      wooCommerceProductId: item.product_id?.toString() || item.variation_id?.toString(),
      sku: item.sku || '',
    })),
    amount: parseFloat(total || 0),
    paymentMethod: payment_method ? (payment_method.toLowerCase().includes('cod') ? 'COD' : 'Prepaid') : 'Prepaid',
    status: status === 'completed' ? 'Delivered' : 
            status === 'processing' ? 'Processing' : 
            status === 'cancelled' ? 'Cancelled' : 
            status === 'pending' ? 'Pending' : 'Processing',
    placedDate: date_created ? new Date(date_created) : new Date(),
    shippingAddress: shipping_address ? {
      street: `${shipping_address.address_1 || ''} ${shipping_address.address_2 || ''}`.trim(),
      city: shipping_address.city || '',
      state: shipping_address.state || '',
      zipCode: shipping_address.postcode || '',
      country: shipping_address.country || '',
    } : billing_address ? {
      street: `${billing_address.address_1 || ''} ${billing_address.address_2 || ''}`.trim(),
      city: billing_address.city || '',
      state: billing_address.state || '',
      zipCode: billing_address.postcode || '',
      country: billing_address.country || '',
    } : {},
    notes: `Synced from WooCommerce webhook. Order ID: ${order_id || order_number}`,
  };

  // Check if order already exists
  const existingOrder = await Order.findOne({
    userId: user._id,
    $or: [
      { wooCommerceOrderId: orderPayload.wooCommerceOrderId },
      { orderNumber: orderPayload.orderNumber }
    ]
  });

  let action = 'created';
  if (existingOrder) {
    // Update existing order
    await Order.findByIdAndUpdate(existingOrder._id, orderPayload, { new: true });
    action = 'updated';
    console.log(`📦 Order updated via webhook: ${orderPayload.orderNumber} (ID: ${orderPayload.wooCommerceOrderId})`);
  } else {
    // Create new order
    await Order.create(orderPayload);
    console.log(`📦 Order synced via webhook: ${orderPayload.orderNumber} (ID: ${orderPayload.wooCommerceOrderId})`);
  }

  return {
    orderId: orderPayload.wooCommerceOrderId,
    orderNumber: orderPayload.orderNumber,
    action: action,
  };
};

// Handle product webhook
const handleProductWebhook = async (user, productData) => {
  const { product_id, name, sku, price, stock_quantity, status, description, images, categories, tags } = productData;

  if (!product_id) {
    throw new Error('Product ID is required');
  }

  // Store product in database
  const productPayload = {
    userId: user._id,
    wooCommerceProductId: product_id.toString(),
    productId: product_id.toString(),
    name: name || 'Untitled Product',
    sku: sku || '',
    price: parseFloat(price || 0),
    stockQuantity: parseInt(stock_quantity || 0),
    status: status || 'publish',
    description: description || '',
    images: images || [],
    categories: categories || [],
    tags: tags || [],
    lastSyncedAt: new Date(),
  };

  // Check if product already exists
  const existingProduct = await Product.findOne({
    userId: user._id,
    $or: [
      { wooCommerceProductId: product_id.toString() },
      { productId: product_id.toString() }
    ]
  });

  let action = 'created';
  if (existingProduct) {
    // Update existing product
    await Product.findByIdAndUpdate(existingProduct._id, productPayload, { new: true });
    action = 'updated';
    console.log(`📦 Product updated via webhook: ${name} (ID: ${product_id})`);
  } else {
    // Create new product
    await Product.create(productPayload);
    console.log(`📦 Product synced via webhook: ${name} (ID: ${product_id})`);
  }

  return {
    productId: product_id,
    name: name,
    action: action,
  };
};

// Handle customer webhook (customers are extracted from orders, but we can also sync customer data directly)
const handleCustomerWebhook = async (user, customerData) => {
  // For now, customers are mainly extracted from orders
  // But we can store customer data if needed
  const { customer_id, email, first_name, last_name, phone, billing, shipping } = customerData;

  if (!customer_id && !email) {
    throw new Error('Customer ID or Email is required');
  }

  // Customer data is typically stored in orders
  // But we can log it here for future use
  console.log(`👤 Customer data received via webhook: ${email || customer_id}`);

  return {
    customerId: customer_id,
    email: email,
    action: 'received',
    note: 'Customer data received. Customers are extracted from orders.',
  };
};

