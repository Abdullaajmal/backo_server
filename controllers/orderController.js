import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { fetchWooCommerceOrders, convertWooCommerceOrder } from '../services/woocommerceService.js';
import { fetchShopifyOrders, convertShopifyOrder } from '../services/shopifyService.js';

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

// @desc    Get all orders from Shopify or WooCommerce (API + Database)
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with integration credentials (including Shopify and WooCommerce)
    const user = await User.findById(userId).select('+shopify.accessToken +wooCommerce.consumerKey +wooCommerce.consumerSecret +wooCommerce.secretKey');
    
    // Check if Shopify is connected (priority)
    const isShopifyConnected = user?.shopify?.isConnected && 
                               user.shopify.shopDomain && 
                               user.shopify.accessToken;
    
    // Check if WooCommerce is connected
    const isWooCommerceConnected = user?.wooCommerce?.isConnected && 
                                   user.wooCommerce.storeUrl &&
                                   ((user.wooCommerce.consumerKey && user.wooCommerce.consumerSecret) || 
                                    user.wooCommerce.secretKey);
    
    // Try Shopify first if connected
    if (isShopifyConnected) {
      return await getShopifyOrders(req, res, user);
    }
    
    // Otherwise try WooCommerce if connected
    if (isWooCommerceConnected) {
      return await getWooCommerceOrders(req, res, user);
    }
    
    // No store connected
    return res.json({
      success: true,
      data: [],
      message: 'No store connected. Please connect your Shopify or WooCommerce store first.',
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
    });
  }
};

// Helper function to get Shopify orders (from API + Database)
const getShopifyOrders = async (req, res, user) => {
  try {
    let apiOrders = [];
    let dbOrders = [];
    
    // Fetch from Shopify API
    try {
      console.log(`🔄 Fetching orders from Shopify API (${user.shopify.shopDomain})...`);
      const shopifyOrders = await fetchShopifyOrders(
        user.shopify.shopDomain,
        user.shopify.accessToken
      );
      console.log(`✅ Fetched ${shopifyOrders.length} orders from Shopify API`);
      
      // Format API orders AND save to database
      apiOrders = [];
      for (const shopifyOrder of shopifyOrders) {
        const converted = convertShopifyOrder(shopifyOrder);
        
        // Save to database (only real Shopify orders)
        try {
          const orderData = {
            shopifyOrderId: converted.shopifyOrderId,
            orderNumber: converted.orderNumber,
            userId: user._id,
            customer: converted.customer,
            items: converted.items,
            amount: converted.amount,
            paymentMethod: converted.paymentMethod,
            status: converted.status,
            placedDate: converted.placedDate,
            deliveredDate: converted.deliveredDate,
            shippingAddress: converted.shippingAddress,
            notes: converted.notes || `Synced from Shopify API. Order ID: ${converted.shopifyOrderId}`,
          };
          
          // Check if order already exists
          const existingOrder = await Order.findOne({
            $or: [
              { shopifyOrderId: converted.shopifyOrderId },
              { orderNumber: converted.orderNumber },
            ],
            userId: user._id,
          });
          
          if (existingOrder) {
            // Update existing order
            await Order.findByIdAndUpdate(existingOrder._id, orderData, { new: true });
            console.log(`  ✅ Updated order in DB: ${converted.orderNumber} (Shopify ID: ${converted.shopifyOrderId})`);
          } else {
            // Create new order
            await Order.create(orderData);
            console.log(`  ✅ Saved new order to DB: ${converted.orderNumber} (Shopify ID: ${converted.shopifyOrderId})`);
          }
        } catch (dbError) {
          console.error(`  ⚠️ Error saving order ${converted.orderNumber} to DB:`, dbError.message);
        }
        
        // Format for response
        apiOrders.push({
          _id: shopifyOrder.id?.toString() || shopifyOrder.id,
          orderNumber: converted.orderNumber,
          customer: converted.customer,
          placedDate: converted.placedDate ? new Date(converted.placedDate).toISOString().split('T')[0] : null,
          date: converted.placedDate ? new Date(converted.placedDate).toISOString().split('T')[0] : null,
          deliveredDate: converted.deliveredDate ? new Date(converted.deliveredDate).toISOString().split('T')[0] : null,
          amount: converted.amount,
          status: converted.status,
          paymentMethod: converted.paymentMethod,
          items: converted.items,
          shippingAddress: converted.shippingAddress,
          notes: converted.notes,
          source: 'api',
        });
      }
    } catch (apiError) {
      console.error('⚠️ Error fetching from Shopify API:', apiError.message);
    }
    
    // Fetch from Database (ONLY synced orders with shopifyOrderId - NO fake orders)
    try {
      console.log(`🔄 Fetching synced orders from Database (userId: ${user._id})...`);
      const dbOrdersData = await Order.find({ 
        userId: user._id,
        shopifyOrderId: { $exists: true, $ne: null, $ne: '' } // Only orders with Shopify ID
      });
      console.log(`✅ Fetched ${dbOrdersData.length} synced orders from Database`);
      
      // Format DB orders
      dbOrders = dbOrdersData.map(order => ({
        _id: order._id.toString(),
        orderNumber: order.orderNumber || order.shopifyOrderId || '',
        customer: {
          name: order.customer?.name || 'Guest',
          email: order.customer?.email || '',
          phone: order.customer?.phone || '',
        },
        placedDate: order.placedDate ? new Date(order.placedDate).toISOString().split('T')[0] : null,
        date: order.placedDate ? new Date(order.placedDate).toISOString().split('T')[0] : null,
        deliveredDate: order.deliveredDate ? new Date(order.deliveredDate).toISOString().split('T')[0] : null,
        amount: order.amount || 0,
        status: order.status || 'Pending',
        paymentMethod: order.paymentMethod || 'Prepaid',
        items: order.items || [],
        shippingAddress: order.shippingAddress || {},
        notes: order.notes || '',
        source: 'database',
      }));
    } catch (dbError) {
      console.error('⚠️ Error fetching from Database:', dbError.message);
    }
    
    // Merge orders - API orders take priority, then add unique DB orders
    const orderMap = new Map();
    
    // Add API orders first
    apiOrders.forEach(order => {
      const key = order.orderNumber || order._id;
      orderMap.set(key, order);
    });
    
    // Add DB orders that don't exist in API
    dbOrders.forEach(order => {
      const key = order.orderNumber || order._id;
      if (!orderMap.has(key)) {
        orderMap.set(key, order);
      }
    });
    
    const allOrders = Array.from(orderMap.values());
    
    // Sort by placed date (newest first)
    allOrders.sort((a, b) => {
      const dateA = new Date(a.placedDate || 0);
      const dateB = new Date(b.placedDate || 0);
      return dateB - dateA;
    });

    console.log(`✅ Total orders: ${allOrders.length} (${apiOrders.length} from Shopify API, ${dbOrders.length} from DB)`);

    res.json({
      success: true,
      data: allOrders,
      message: `Fetched ${allOrders.length} orders`,
      source: 'shopify_api_and_db',
      stats: {
        fromApi: apiOrders.length,
        fromDb: dbOrders.length,
        total: allOrders.length,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching orders from Shopify:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders from Shopify',
    });
  }
};

// Helper function to get WooCommerce orders
const getWooCommerceOrders = async (req, res, user) => {
  try {
    let apiOrders = [];
    let dbOrders = [];
    
    // Always fetch directly from WooCommerce API - Consumer Key/Secret required
    if (user.wooCommerce.consumerKey && user.wooCommerce.consumerSecret) {
      try {
        // Fetch orders directly from WooCommerce API (real-time)
        console.log(`🔄 Fetching orders from WooCommerce API: ${user.wooCommerce.storeUrl}`);
        const wcOrders = await fetchWooCommerceOrders(
          user.wooCommerce.storeUrl,
          user.wooCommerce.consumerKey,
          user.wooCommerce.consumerSecret
        );
        console.log(`✅ Fetched ${wcOrders.length} orders from WooCommerce API`);
        
        // Format API orders AND save to database
        apiOrders = [];
        for (const wcOrder of wcOrders) {
          const converted = convertWooCommerceOrder(wcOrder);
          
          // Save to database (only real WooCommerce orders)
          try {
            const orderData = {
              wooCommerceOrderId: converted.wooCommerceOrderId,
              orderNumber: converted.orderNumber,
              userId: user._id,
              customer: converted.customer,
              items: converted.items,
              amount: converted.amount,
              paymentMethod: converted.paymentMethod,
              status: converted.status,
              placedDate: converted.placedDate,
              deliveredDate: converted.deliveredDate,
              shippingAddress: converted.shippingAddress,
              notes: converted.notes || `Synced from WooCommerce API. Order ID: ${converted.wooCommerceOrderId}`,
            };
            
            // Check if order already exists
            const existingOrder = await Order.findOne({
              $or: [
                { wooCommerceOrderId: converted.wooCommerceOrderId },
                { orderNumber: converted.orderNumber },
              ],
              userId: user._id,
            });
            
            if (existingOrder) {
              // Update existing order
              await Order.findByIdAndUpdate(existingOrder._id, orderData, { new: true });
              console.log(`  ✅ Updated order in DB: ${converted.orderNumber} (WooCommerce ID: ${converted.wooCommerceOrderId})`);
            } else {
              // Create new order
              await Order.create(orderData);
              console.log(`  ✅ Saved new order to DB: ${converted.orderNumber} (WooCommerce ID: ${converted.wooCommerceOrderId})`);
            }
          } catch (dbError) {
            console.error(`  ⚠️ Error saving order ${converted.orderNumber} to DB:`, dbError.message);
          }
          
          // Format for response
          apiOrders.push({
            _id: wcOrder.id?.toString() || wcOrder.id,
            orderNumber: converted.orderNumber,
            customer: {
              ...converted.customer,
              name: converted.customer.name,
              email: converted.customer.email,
              phone: converted.customer.phone,
              firstName: wcOrder.billing?.first_name || '',
              lastName: wcOrder.billing?.last_name || '',
            },
            placedDate: converted.placedDate ? new Date(converted.placedDate).toISOString().split('T')[0] : null,
            date: converted.placedDate ? new Date(converted.placedDate).toISOString().split('T')[0] : null,
            deliveredDate: converted.deliveredDate ? new Date(converted.deliveredDate).toISOString().split('T')[0] : null,
            amount: converted.amount,
            status: converted.status,
            paymentMethod: converted.paymentMethod,
            items: converted.items,
            shippingAddress: converted.shippingAddress,
            notes: converted.notes,
            source: 'api',
          });
        }
      } catch (apiError) {
        console.error('⚠️ Error fetching from WooCommerce API:', apiError.message);
      }
    }
    
    // Fetch from Database (ONLY webhook synced orders with wooCommerceOrderId - NO fake orders)
    try {
      console.log(`🔄 Fetching webhook-synced orders from Database (userId: ${user._id})...`);
      // Only fetch orders that have wooCommerceOrderId (synced from webhook) - exclude fake/seeded orders
      const dbOrdersData = await Order.find({ 
        userId: user._id,
        wooCommerceOrderId: { $exists: true, $ne: null, $ne: '' } // Only orders with WooCommerce ID
      });
      console.log(`✅ Fetched ${dbOrdersData.length} webhook-synced orders from Database`);
      
      // Format DB orders (only real WooCommerce orders from webhook)
      dbOrders = dbOrdersData.map(order => ({
        _id: order._id.toString(),
        orderNumber: order.orderNumber || order.wooCommerceOrderId || '',
        customer: {
          name: order.customer?.name || 'Guest',
          email: order.customer?.email || '',
          phone: order.customer?.phone || '',
        },
        placedDate: order.placedDate ? new Date(order.placedDate).toISOString().split('T')[0] : null,
        date: order.placedDate ? new Date(order.placedDate).toISOString().split('T')[0] : null,
        deliveredDate: order.deliveredDate ? new Date(order.deliveredDate).toISOString().split('T')[0] : null,
        amount: order.amount || 0,
        status: order.status || 'Pending',
        paymentMethod: order.paymentMethod || 'Prepaid',
        items: order.items || [],
        shippingAddress: order.shippingAddress || {},
        notes: order.notes || '',
        source: 'database',
      }));
    } catch (dbError) {
      console.error('⚠️ Error fetching from Database:', dbError.message);
    }
    
    // Merge orders - API orders take priority, then add unique webhook-synced DB orders
    const orderMap = new Map();
    
    // Add API orders first (real-time from WooCommerce)
    apiOrders.forEach(order => {
      const key = order.orderNumber || order._id;
      orderMap.set(key, order);
    });
    
    // Add DB orders that don't exist in API (only webhook-synced orders with wooCommerceOrderId)
    dbOrders.forEach(order => {
      const key = order.orderNumber || order._id;
      if (!orderMap.has(key)) {
        orderMap.set(key, order);
      }
    });
    
    const allOrders = Array.from(orderMap.values());
    
    // Sort by placed date (newest first)
    allOrders.sort((a, b) => {
      const dateA = new Date(a.placedDate || 0);
      const dateB = new Date(b.placedDate || 0);
      return dateB - dateA;
    });

    console.log(`✅ Total orders: ${allOrders.length} (${apiOrders.length} from WooCommerce API, ${dbOrders.length} from webhook-synced DB)`);

    res.json({
      success: true,
      data: allOrders,
      message: `Fetched ${allOrders.length} orders`,
      source: 'woocommerce_api_and_db',
      stats: {
        fromApi: apiOrders.length,
        fromDb: dbOrders.length,
        total: allOrders.length,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching orders from WooCommerce:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders from WooCommerce',
    });
  }
};

// @desc    Sync orders from WooCommerce
// @route   POST /api/orders/sync
// @access  Private
export const syncOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with integration credentials (including secret key for portal method)
    const user = await User.findById(userId).select('+wooCommerce.consumerKey +wooCommerce.consumerSecret +wooCommerce.secretKey');
    
    // Check if WooCommerce is connected
    // Support both methods: API (consumerKey/Secret) or Portal (secretKey)
    const isWooCommerceConnected = user?.wooCommerce?.isConnected && 
                                   user.wooCommerce.storeUrl &&
                                   ((user.wooCommerce.consumerKey && user.wooCommerce.consumerSecret) || 
                                    user.wooCommerce.secretKey);
    
    if (!isWooCommerceConnected) {
      return res.status(400).json({
        success: false,
        message: 'No WooCommerce store connected. Please connect your WooCommerce store first.',
      });
    }
    
    // Sync from WooCommerce
    return await syncWooCommerceOrders(req, res, user);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Helper function to sync WooCommerce orders
const syncWooCommerceOrders = async (req, res, user) => {
  try {
    // Check if using portal method (secretKey) or API method (consumerKey/Secret)
    if (user.wooCommerce.secretKey && !user.wooCommerce.consumerKey) {
      // Portal method - orders come from plugin, not directly from WooCommerce API
      return res.json({
        success: true,
        message: 'WooCommerce connected via portal method. Orders will sync automatically from your WordPress plugin when they are created or updated.',
        data: {
          totalWooCommerceOrders: 0,
          synced: 0,
          updated: 0,
          errors: 0,
        },
      });
    }
    
    // API method - fetch orders directly from WooCommerce
    if (!user.wooCommerce.consumerKey || !user.wooCommerce.consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'WooCommerce API credentials not found. Please connect using Consumer Key and Secret to sync orders directly from WordPress.',
      });
    }
    
    // Fetch orders from WooCommerce
    console.log(`🔄 Fetching orders from WooCommerce (${user.wooCommerce.storeUrl})...`);
    const wcOrders = await fetchWooCommerceOrders(
      user.wooCommerce.storeUrl,
      user.wooCommerce.consumerKey,
      user.wooCommerce.consumerSecret
    );
    console.log(`📦 Fetched ${wcOrders.length} orders from WooCommerce`);
    
    if (wcOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No orders found in WooCommerce store',
        data: {
          totalWooCommerceOrders: 0,
          synced: 0,
          updated: 0,
          errors: 0,
        },
      });
    }
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Sync each order to database
    for (const wcOrder of wcOrders) {
      try {
        const convertedOrder = convertWooCommerceOrder(wcOrder);
        console.log(`  - Processing order: ${convertedOrder.orderNumber} (WooCommerce ID: ${wcOrder.id})`);
        
        // Check if order already exists
        const existingOrder = await Order.findOne({
          $or: [
            { wooCommerceOrderId: convertedOrder.wooCommerceOrderId },
            { orderNumber: convertedOrder.orderNumber },
          ],
          userId: req.user._id,
        });

        if (existingOrder) {
          // Update existing order
          await Order.findByIdAndUpdate(existingOrder._id, {
            ...convertedOrder,
            userId: req.user._id,
          }, { new: true });
          console.log(`    ✅ Updated existing order: ${convertedOrder.orderNumber}`);
          updatedCount++;
        } else {
          // Create new order
          await Order.create({
            ...convertedOrder,
            userId: req.user._id,
          });
          console.log(`    ✅ Created new order: ${convertedOrder.orderNumber}`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`    ❌ Error syncing order ${wcOrder.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`📊 Sync Summary: ${syncedCount} new, ${updatedCount} updated, ${errorCount} errors`);

    res.json({
      success: true,
      message: 'Orders synced successfully',
      data: {
        totalWooCommerceOrders: wcOrders.length,
        synced: syncedCount,
        updated: updatedCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;

    // Check if orderId is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId) && 
                            String(new mongoose.Types.ObjectId(orderId)) === orderId;

    let order;
    
    if (isValidObjectId) {
      // If it's a valid ObjectId, search by _id
      order = await Order.findOne({ _id: orderId, userId });
    } else {
      // If it's not a valid ObjectId, search by orderNumber, shopifyOrderId, or wooCommerceOrderId
      order = await Order.findOne({
        userId,
        $or: [
          { orderNumber: orderId },
          { shopifyOrderId: orderId },
          { wooCommerceOrderId: orderId },
        ],
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      customer,
      items,
      amount,
      paymentMethod,
      shippingAddress,
      notes,
    } = req.body;

    // Generate order number
    const orderCount = await Order.countDocuments({ userId });
    const orderNumber = `ORD-${1000 + orderCount + 1}`;

    const order = await Order.create({
      orderNumber,
      userId,
      customer,
      items,
      amount,
      paymentMethod,
      shippingAddress,
      notes,
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;
    const updateData = req.body;

    // If status is Delivered, set deliveredDate
    if (updateData.status === 'Delivered' && !updateData.deliveredDate) {
      updateData.deliveredDate = new Date();
    }

    // Check if orderId is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId) && 
                            String(new mongoose.Types.ObjectId(orderId)) === orderId;

    let order;
    
    if (isValidObjectId) {
      // If it's a valid ObjectId, search by _id
      order = await Order.findOneAndUpdate(
        { _id: orderId, userId },
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      // If it's not a valid ObjectId, search by orderNumber, shopifyOrderId, or wooCommerceOrderId
      order = await Order.findOneAndUpdate(
        {
          userId,
          $or: [
            { orderNumber: orderId },
            { shopifyOrderId: orderId },
            { wooCommerceOrderId: orderId },
          ],
        },
        updateData,
        { new: true, runValidators: true }
      );
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;

    // Check if orderId is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId) && 
                            String(new mongoose.Types.ObjectId(orderId)) === orderId;

    let order;
    
    if (isValidObjectId) {
      // If it's a valid ObjectId, search by _id
      order = await Order.findOneAndDelete({ _id: orderId, userId });
    } else {
      // If it's not a valid ObjectId, search by orderNumber, shopifyOrderId, or wooCommerceOrderId
      order = await Order.findOneAndDelete({
        userId,
        $or: [
          { orderNumber: orderId },
          { shopifyOrderId: orderId },
          { wooCommerceOrderId: orderId },
        ],
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Sync order from WooCommerce plugin
// @route   POST /api/orders/sync-from-plugin
// @access  Public (with secret key)
export const syncOrderFromPlugin = async (req, res) => {
  try {
    const secretKey = req.headers['x-backo-secret-key'] || req.body.secretKey;
    
    if (!secretKey) {
      return res.status(401).json({
        success: false,
        message: 'Secret key is required',
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
    } = req.body;

    if (!order_id && !order_number) {
      return res.status(400).json({
        success: false,
        message: 'Order ID or Order Number is required',
      });
    }

    // Convert plugin order data to our format with full details
    const orderData = {
      wooCommerceOrderId: order_id?.toString() || order_number?.toString(),
      orderNumber: order_number?.toString() || order_id?.toString() || '',
      customer: {
        name: customer?.name || customer?.first_name && customer?.last_name 
          ? `${customer.first_name} ${customer.last_name}`.trim() 
          : 'Guest',
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
      notes: `Synced from WooCommerce. Order ID: ${order_id || order_number}`,
      userId: user._id,
    };

    // Check if order already exists
    const existingOrder = await Order.findOne({
      $or: [
        { wooCommerceOrderId: orderData.wooCommerceOrderId },
        { orderNumber: orderData.orderNumber }
      ],
      userId: user._id,
    });

    if (existingOrder) {
      // Update existing order
      await Order.findByIdAndUpdate(existingOrder._id, orderData, { new: true });
      return res.json({
        success: true,
        message: 'Order updated successfully',
        data: { orderId: existingOrder._id, action: 'updated' },
      });
    } else {
      // Create new order
      const newOrder = await Order.create(orderData);
      return res.json({
        success: true,
        message: 'Order synced successfully',
        data: { orderId: newOrder._id, action: 'created' },
      });
    }
  } catch (error) {
    console.error('Error syncing order from plugin:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

