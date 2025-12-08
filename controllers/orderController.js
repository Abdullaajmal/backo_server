import Order from '../models/Order.js';
import User from '../models/User.js';
import { fetchShopifyOrders, convertShopifyOrder, fetchShopifyCustomerById } from '../services/shopifyService.js';

// @desc    Get all orders (Dynamically from Shopify, not from DB)
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with Shopify credentials
    const user = await User.findById(userId).select('+shopify.accessToken');
    
    // Check if Shopify is connected
    if (!user?.shopify?.isConnected || !user.shopify.accessToken || !user.shopify.shopDomain) {
      return res.json({
        success: true,
        data: [],
        message: 'Shopify store not connected. Please connect your Shopify store first.',
      });
    }

    // Fetch orders directly from Shopify (real-time) using access token and store URL
    console.log(`🔄 Fetching orders from Shopify: ${user.shopify.shopDomain}`);
    const shopifyOrders = await fetchShopifyOrders(user.shopify.shopDomain, user.shopify.accessToken);
    console.log(`✅ Fetched ${shopifyOrders.length} orders from Shopify`);
    
    // Enrich orders with customer details from Customer API
    const customerCache = new Map();
    
    for (const order of shopifyOrders) {
      // If order has customer ID, always fetch from Customer API for complete data
      if (order.customer?.id) {
        const customerId = order.customer.id.toString();
        
        // Fetch customer details if not in cache
        if (!customerCache.has(customerId)) {
          try {
            console.log(`📧 Fetching customer details for ID: ${customerId} (Order: ${order.name})`);
            const customerDetails = await fetchShopifyCustomerById(
              user.shopify.shopDomain,
              user.shopify.accessToken,
              customerId
            );
            if (customerDetails) {
              customerCache.set(customerId, customerDetails);
              console.log(`✅ Fetched customer: ${customerDetails.first_name} ${customerDetails.last_name} (${customerDetails.email})`);
            }
          } catch (error) {
            console.error(`❌ Failed to fetch customer ${customerId}:`, error.message);
          }
        }
        
        // Enrich order with cached customer data (prioritize Customer API data, but keep original if available)
        const cachedCustomer = customerCache.get(customerId);
        if (cachedCustomer) {
          // Merge customer data - Use Customer API data, but preserve original order data if it exists
          order.customer = {
            ...order.customer, // Keep all original fields
            id: order.customer.id,
            // Use Customer API data, but if order already has name, prefer order data (more recent)
            first_name: order.customer?.first_name || cachedCustomer.first_name || '',
            last_name: order.customer?.last_name || cachedCustomer.last_name || '',
            email: cachedCustomer.email || order.customer?.email || order.email || '',
            phone: cachedCustomer.phone || order.customer?.phone || order.phone || '',
          };
          
          // Also set order-level email if missing
          if (!order.email && order.customer.email) {
            order.email = order.customer.email;
          }
        } else {
          // If Customer API fetch failed, ensure we have name from order data
          if (!order.customer.first_name && order.shipping_address?.first_name) {
            order.customer.first_name = order.shipping_address.first_name;
          }
          if (!order.customer.last_name && order.shipping_address?.last_name) {
            order.customer.last_name = order.shipping_address.last_name;
          }
          if (!order.customer.email && order.email) {
            order.customer.email = order.email;
          }
          if (!order.customer.phone && order.phone) {
            order.customer.phone = order.phone;
          }
        }
      } else {
        // Guest order - extract customer data from order (original Shopify data)
        order.customer = {
          email: order.email || order.billing_address?.email || order.shipping_address?.email || '',
          // Extract name from shipping address first (most reliable for guest orders)
          first_name: order.shipping_address?.first_name || order.billing_address?.first_name || '',
          last_name: order.shipping_address?.last_name || order.billing_address?.last_name || '',
          phone: order.phone || order.shipping_address?.phone || order.billing_address?.phone || '',
        };
      }
    }
    
    console.log(`✅ Customer enrichment completed for ${shopifyOrders.length} orders`);
    
    // Debug: Log customer names to verify extraction
    if (shopifyOrders.length > 0) {
      console.log(`\n📋 Customer Names Extracted:`);
      shopifyOrders.slice(0, 3).forEach((order, idx) => {
        const firstName = order.customer?.first_name || '';
        const lastName = order.customer?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        console.log(`   Order ${order.name}: "${fullName || 'NO NAME'}" (first: "${firstName}", last: "${lastName}")`);
      });
    }

    // Format orders with all details and customer info
    const orders = shopifyOrders.map((shopifyOrder) => {
      return {
        // Original Shopify order data
        ...shopifyOrder,
        
        // Helper fields for frontend
        _id: shopifyOrder.id?.toString() || shopifyOrder.id,
        orderNumber: shopifyOrder.name || shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
        
        // Enhanced customer object with all info - prioritize original Shopify data
        customer: {
          ...shopifyOrder.customer, // All original customer fields
          // Full name - extract from Shopify order (original name, not fake)
          name: (() => {
            // Priority 1: Customer first_name + last_name from order
            if (shopifyOrder.customer?.first_name || shopifyOrder.customer?.last_name) {
              const fullName = `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim();
              if (fullName) return fullName;
            }
            
            // Priority 2: Shipping address name
            if (shopifyOrder.shipping_address?.name) {
              return shopifyOrder.shipping_address.name;
            }
            
            // Priority 3: Shipping address first_name + last_name
            if (shopifyOrder.shipping_address?.first_name || shopifyOrder.shipping_address?.last_name) {
              const fullName = `${shopifyOrder.shipping_address.first_name || ''} ${shopifyOrder.shipping_address.last_name || ''}`.trim();
              if (fullName) return fullName;
            }
            
            // Priority 4: Billing address name
            if (shopifyOrder.billing_address?.name) {
              return shopifyOrder.billing_address.name;
            }
            
            // Priority 5: Billing address first_name + last_name
            if (shopifyOrder.billing_address?.first_name || shopifyOrder.billing_address?.last_name) {
              const fullName = `${shopifyOrder.billing_address.first_name || ''} ${shopifyOrder.billing_address.last_name || ''}`.trim();
              if (fullName) return fullName;
            }
            
            // Priority 6: Customer email (if name not available)
            if (shopifyOrder.customer?.email) {
              return shopifyOrder.customer.email;
            }
            
            // Priority 7: Order email
            if (shopifyOrder.email) {
              return shopifyOrder.email;
            }
            
            // Last resort: Only use "Guest" if absolutely no data available
            return 'Guest';
          })(),
          // Email - check all possible sources
          email: shopifyOrder.customer?.email || 
                 shopifyOrder.email || 
                 shopifyOrder.billing_address?.email || 
                 shopifyOrder.shipping_address?.email || 
                 '',
          // Phone - check all possible sources
          phone: shopifyOrder.customer?.phone || 
                 shopifyOrder.phone || 
                 shopifyOrder.shipping_address?.phone || 
                 shopifyOrder.billing_address?.phone || 
                 '',
          // First and last name separately - from original Shopify data
          firstName: shopifyOrder.customer?.first_name || 
                    shopifyOrder.shipping_address?.first_name || 
                    shopifyOrder.billing_address?.first_name || 
                    '',
          lastName: shopifyOrder.customer?.last_name || 
                   shopifyOrder.shipping_address?.last_name || 
                   shopifyOrder.billing_address?.last_name || 
                   '',
        },
        
        // Dates
        placedDate: shopifyOrder.created_at ? new Date(shopifyOrder.created_at).toISOString().split('T')[0] : null,
        date: shopifyOrder.created_at ? new Date(shopifyOrder.created_at).toISOString().split('T')[0] : null,
        deliveredDate: shopifyOrder.fulfillments?.[0]?.created_at ? 
          new Date(shopifyOrder.fulfillments[0].created_at).toISOString().split('T')[0] : null,
        
        // Amounts
        amount: parseFloat(shopifyOrder.total_price || 0),
        
        // Status
        status: shopifyOrder.cancelled_at ? 'Cancelled' :
                shopifyOrder.fulfillment_status === 'fulfilled' ? 'Delivered' :
                shopifyOrder.fulfillment_status === 'partial' ? 'In Transit' :
                shopifyOrder.financial_status === 'pending' ? 'Pending' :
                shopifyOrder.financial_status === 'paid' ? 'Processing' : 'Pending',
        
        paymentMethod: shopifyOrder.financial_status === 'pending' ? 'COD' : 'Prepaid',
        
        // Items
        items: (shopifyOrder.line_items || []).map(item => ({
          ...item,
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price || 0),
        })),
      };
    });

    // Sort by placed date (newest first)
    orders.sort((a, b) => {
      const dateA = new Date(a.placedDate || 0);
      const dateB = new Date(b.placedDate || 0);
      return dateB - dateA;
    });

    res.json({
      success: true,
      data: orders,
      message: `Fetched ${orders.length} orders from Shopify`,
    });
  } catch (error) {
    console.error('❌ Error fetching orders from Shopify:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders from Shopify',
    });
  }
};

// @desc    Sync orders from Shopify
// @route   POST /api/orders/sync
// @access  Private
export const syncShopifyOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with Shopify credentials
    const user = await User.findById(userId).select('+shopify.accessToken');
    
    if (!user || !user.shopify?.isConnected || !user.shopify.accessToken || !user.shopify.shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Shopify store not connected. Please connect your Shopify store first.',
      });
    }

    // Fetch orders from Shopify
    console.log(`🔄 Fetching orders from Shopify (${user.shopify.shopDomain})...`);
    const shopifyOrders = await fetchShopifyOrders(user.shopify.shopDomain, user.shopify.accessToken);
    console.log(`📦 Fetched ${shopifyOrders.length} orders from Shopify`);
    
    if (shopifyOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No orders found in Shopify store',
        data: {
          totalShopifyOrders: 0,
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
    for (const shopifyOrder of shopifyOrders) {
      try {
        const convertedOrder = convertShopifyOrder(shopifyOrder);
        console.log(`  - Processing order: ${convertedOrder.orderNumber} (Shopify ID: ${shopifyOrder.id})`);
        
        // Normalize order number (remove # if present)
        const normalizedOrderNumber = convertedOrder.orderNumber?.replace(/^#/, '') || convertedOrder.orderNumber;
        const orderNumberWithHash = convertedOrder.orderNumber?.startsWith('#') ? convertedOrder.orderNumber : `#${convertedOrder.orderNumber}`;
        
        // Check if order already exists (try multiple variations)
        const existingOrder = await Order.findOne({
          $or: [
            { shopifyOrderId: convertedOrder.shopifyOrderId },
            { orderNumber: convertedOrder.orderNumber },
            { orderNumber: normalizedOrderNumber },
            { orderNumber: orderNumberWithHash }
          ],
          userId,
        });

        if (existingOrder) {
          // Update existing order
          await Order.findByIdAndUpdate(existingOrder._id, {
            ...convertedOrder,
            orderNumber: normalizedOrderNumber, // Store normalized version
            userId,
          }, { new: true });
          console.log(`    ✅ Updated existing order: ${normalizedOrderNumber}`);
          updatedCount++;
        } else {
          // Create new order
          await Order.create({
            ...convertedOrder,
            orderNumber: normalizedOrderNumber, // Store normalized version
            userId,
          });
          console.log(`    ✅ Created new order: ${normalizedOrderNumber}`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`    ❌ Error syncing order ${shopifyOrder.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`📊 Sync Summary: ${syncedCount} new, ${updatedCount} updated, ${errorCount} errors`);

    res.json({
      success: true,
      message: 'Orders synced successfully',
      data: {
        totalShopifyOrders: shopifyOrders.length,
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

    const order = await Order.findOne({ _id: orderId, userId });

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

    const order = await Order.findOneAndUpdate(
      { _id: orderId, userId },
      updateData,
      { new: true, runValidators: true }
    );

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

    const order = await Order.findOneAndDelete({ _id: orderId, userId });

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

