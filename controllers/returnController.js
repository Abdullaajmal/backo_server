import Return from '../models/Return.js';

// @desc    Get all returns
// @route   GET /api/returns
// @access  Private
export const getReturns = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all returns for this user
    const returns = await Return.find({ userId })
      .sort({ date: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: returns.map(returnItem => ({
        returnId: returnItem.returnId,
        customer: returnItem.customer,
        product: returnItem.product,
        reason: returnItem.reason,
        status: returnItem.status,
        amount: returnItem.amount,
        date: returnItem.date ? returnItem.date.toISOString().split('T')[0] : new Date(returnItem.createdAt).toISOString().split('T')[0],
        createdAt: returnItem.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single return
// @route   GET /api/returns/:id
// @access  Private
export const getReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const returnId = req.params.id;

    const returnItem = await Return.findOne({ _id: returnId, userId });

    if (!returnItem) {
      return res.status(404).json({
        success: false,
        message: 'Return not found',
      });
    }

    res.json({
      success: true,
      data: returnItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create new return
// @route   POST /api/returns
// @access  Private
export const createReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      customer,
      product,
      reason,
      amount,
      refundMethod,
      notes,
    } = req.body;

    // Generate return ID
    const returnCount = await Return.countDocuments({ userId });
    const returnId = `RT-${String(returnCount + 1).padStart(3, '0')}`;

    const returnItem = await Return.create({
      returnId,
      userId,
      customer,
      product,
      reason,
      amount,
      refundMethod,
      notes,
    });

    res.status(201).json({
      success: true,
      data: returnItem,
      message: 'Return created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update return
// @route   PUT /api/returns/:id
// @access  Private
export const updateReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const returnId = req.params.id;
    const updateData = req.body;

    const returnItem = await Return.findOneAndUpdate(
      { _id: returnId, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!returnItem) {
      return res.status(404).json({
        success: false,
        message: 'Return not found',
      });
    }

    res.json({
      success: true,
      data: returnItem,
      message: 'Return updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Delete return
// @route   DELETE /api/returns/:id
// @access  Private
export const deleteReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const returnId = req.params.id;

    const returnItem = await Return.findOneAndDelete({ _id: returnId, userId });

    if (!returnItem) {
      return res.status(404).json({
        success: false,
        message: 'Return not found',
      });
    }

    res.json({
      success: true,
      message: 'Return deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create return request (Public - from customer portal)
// @route   POST /api/public/returns/:storeUrl
// @access  Public
export const createPublicReturn = async (req, res) => {
  try {
    const { storeUrl } = req.params;
    
    // Handle both JSON and FormData
    let orderId, customer, product, reason, preferredResolution, amount, notes, photos;
    
    if (req.body.orderId) {
      // FormData
      orderId = req.body.orderId;
      customer = typeof req.body.customer === 'string' ? JSON.parse(req.body.customer) : req.body.customer;
      product = typeof req.body.product === 'string' ? JSON.parse(req.body.product) : req.body.product;
      reason = req.body.reason;
      preferredResolution = req.body.preferredResolution;
      amount = parseFloat(req.body.amount);
      notes = req.body.notes || '';
      
      // Handle file uploads - check both req.files (array) and req.file (single)
      if (req.files && req.files.length > 0) {
        photos = req.files.map(file => `/uploads/${file.filename}`);
      } else if (req.file) {
        photos = [`/uploads/${req.file.filename}`];
      } else {
        photos = [];
      }
    } else {
      // JSON
      ({
        orderId,
        customer,
        product,
        reason,
        preferredResolution,
        amount,
        notes,
        photos,
      } = req.body);
    }
    
    // Map reason codes to full names (if needed)
    const reasonMap = {
      'size': 'Wrong Size',
      'defective': 'Defective / Damaged',
      'not-as-described': 'Not as Described',
      'changed-mind': 'Changed Mind',
      'wrong-item': 'Received Wrong Item',
      'other': 'Other'
    };
    // If reason is a code, convert to full name
    if (reasonMap[reason]) {
      reason = reasonMap[reason];
    }
    // If already full name, use as is

    // Find user by storeUrl (with URL normalization - same as findOrder)
    const User = (await import('../models/User.js')).default;
    
    // Normalize the requested storeUrl
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.trim();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/^www\./, '');
        normalized = normalized.replace(/\/$/, '');
        return normalized.toLowerCase();
      } catch (e) {
        return url.toLowerCase();
      }
    };

    const normalizedRequestedUrl = normalizeUrl(storeUrl);

    // Try exact match first
    let user = await User.findOne({ storeUrl });

    // If not found, try normalized match
    if (!user) {
      const allUsers = await User.find({ isStoreSetup: true });
      for (const u of allUsers) {
        if (u.storeUrl) {
          const normalizedStoredUrl = normalizeUrl(u.storeUrl);
          if (normalizedStoredUrl === normalizedRequestedUrl) {
            user = u;
            break;
          }
        }
      }
    }

    if (!user || !user.isStoreSetup) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    // Generate unique return ID
    const returnCount = await Return.countDocuments({ userId: user._id });
    const returnId = `RT-${String(returnCount + 1).padStart(3, '0')}`;

    // Create timeline
    const timeline = [
      {
        step: 'Return Submitted',
        date: new Date(),
        description: 'Your return request has been submitted!',
        completed: true,
      },
      {
        step: 'Approved by Merchant',
        description: 'Waiting for merchant approval.',
        completed: false,
      },
      {
        step: 'Item Received',
        description: 'Waiting for the item to be received by the merchant.',
        completed: false,
      },
      {
        step: 'Inspection Complete',
        description: 'Item will be inspected for condition.',
        completed: false,
      },
      {
        step: 'Refund Issued',
        description: 'Refund will be processed to your account.',
        completed: false,
      },
    ];

    // Determine refund method based on preferred resolution
    let refundMethod = 'Bank Transfer';
    if (preferredResolution === 'store-credit') {
      refundMethod = 'Store Credit';
    } else if (preferredResolution === 'refund') {
      refundMethod = 'Bank Transfer';
    }

    const returnItem = await Return.create({
      returnId,
      userId: user._id,
      orderId,
      storeUrl,
      customer,
      product,
      reason,
      preferredResolution,
      amount,
      refundMethod,
      notes,
      photos: photos || [],
      returnAddress: `${user.storeName}, 123 Warehouse St, New York, NY 10002`,
      timeline,
      status: 'Pending Approval',
    });

    res.status(201).json({
      success: true,
      data: {
        returnId: returnItem.returnId,
        orderId: returnItem.orderId,
        status: returnItem.status,
        amount: returnItem.amount,
      },
      message: 'Return request submitted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get return by returnId (Public - for tracking)
// @route   GET /api/public/returns/:storeUrl/:returnId
// @access  Public
export const getPublicReturn = async (req, res) => {
  try {
    const { storeUrl, returnId } = req.params;

    const returnItem = await Return.findOne({ 
      returnId,
      storeUrl,
    }).populate('userId', 'storeName storeLogo');

    if (!returnItem) {
      return res.status(404).json({
        success: false,
        message: 'Return not found',
      });
    }

    res.json({
      success: true,
      data: returnItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Find order by orderId and email/phone (Public)
// @route   POST /api/public/orders/find
// @access  Public
export const findOrder = async (req, res) => {
  try {
    const { orderId, emailOrPhone, storeUrl } = req.body;

    // Find user by storeUrl (with URL normalization)
    const User = (await import('../models/User.js')).default;
    
    // Normalize the requested storeUrl
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.trim();
        // Remove protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        // Remove www
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        return normalized.toLowerCase();
      } catch (e) {
        return url.toLowerCase();
      }
    };

    const normalizedRequestedUrl = normalizeUrl(storeUrl);

    // Try exact match first
    let user = await User.findOne({ storeUrl });

    // If not found, try normalized match
    if (!user) {
      const allUsers = await User.find({ isStoreSetup: true });
      for (const u of allUsers) {
        if (u.storeUrl) {
          const normalizedStoredUrl = normalizeUrl(u.storeUrl);
          if (normalizedStoredUrl === normalizedRequestedUrl) {
            user = u;
            break;
          }
        }
      }
    }

    if (!user || !user.isStoreSetup) {
      return res.status(404).json({
        success: false,
        message: 'Store not found. Please check the URL and try again.',
      });
    }

    // Check which integrations are connected (Shopify or WooCommerce)
    const userWithIntegrations = await User.findById(user._id)
      .select('+shopify.accessToken +wooCommerce.consumerKey +wooCommerce.consumerSecret');
    
    const hasShopify = userWithIntegrations?.shopify?.isConnected && 
                       userWithIntegrations.shopify.shopDomain && 
                       userWithIntegrations.shopify.accessToken;
    
    const hasWooCommerce = userWithIntegrations?.wooCommerce?.isConnected && 
                           userWithIntegrations.wooCommerce.storeUrl &&
                           (userWithIntegrations.wooCommerce.consumerKey && userWithIntegrations.wooCommerce.consumerSecret);
    
    if (!hasShopify && !hasWooCommerce) {
      return res.status(400).json({
        success: false,
        message: 'Store does not have Shopify or WooCommerce connected. Cannot find orders. Please connect your store first.',
      });
    }

    // Normalize email/phone for matching
    const normalizedEmailOrPhone = emailOrPhone.trim().toLowerCase();
    
    // Normalize order ID (handle # prefix)
    const normalizedOrderId = orderId.replace(/^#/, ''); // Remove # if present
    const orderIdWithHash = orderId.startsWith('#') ? orderId : `#${orderId}`;
    
    let foundOrder = null;
    let orderSource = null;
    
    // Try Shopify first if connected
    if (hasShopify) {
      try {
        console.log(`🔄 Trying to find order from Shopify...`);
        foundOrder = await findOrderFromShopify(
          userWithIntegrations,
          orderId,
          normalizedOrderId,
          orderIdWithHash,
          normalizedEmailOrPhone,
          emailOrPhone
        );
        if (foundOrder) {
          orderSource = 'shopify';
          console.log(`✅ Order found from Shopify`);
        }
      } catch (shopifyError) {
        console.error('❌ Error fetching order from Shopify:', shopifyError.message);
        // If it's a validation error (email/phone mismatch or status), throw it
        if (shopifyError.message.includes('Email or phone') || shopifyError.message.includes('currently')) {
          throw shopifyError;
        }
        // Otherwise, continue to try WooCommerce if Shopify fails
      }
    }
    
    // Try WooCommerce if Shopify didn't find order or Shopify not connected
    if (!foundOrder && hasWooCommerce) {
      try {
        console.log(`🔄 Trying to find order from WooCommerce...`);
        foundOrder = await findOrderFromWooCommerce(
          userWithIntegrations,
          orderId,
          normalizedOrderId,
          orderIdWithHash,
          normalizedEmailOrPhone,
          emailOrPhone
        );
        if (foundOrder) {
          orderSource = 'woocommerce';
          console.log(`✅ Order found from WooCommerce`);
        }
      } catch (wooCommerceError) {
        console.error('❌ Error fetching order from WooCommerce:', wooCommerceError.message);
        // If it's a validation error (email/phone mismatch or status), throw it
        if (wooCommerceError.message.includes('Email or phone') || wooCommerceError.message.includes('currently')) {
          throw wooCommerceError;
        }
        // Otherwise, continue
      }
    }
    
    if (!foundOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found. Please check your order number and try again. Make sure you enter the exact order number.',
      });
    }
    
    // Order found and validated (status check already done in helper functions), return it
    // Format orderDate as ISO string for frontend
    const orderDate = foundOrder.placedDate 
      ? (foundOrder.placedDate instanceof Date 
          ? foundOrder.placedDate.toISOString() 
          : new Date(foundOrder.placedDate).toISOString())
      : new Date().toISOString();
    
    res.json({
      success: true,
      data: {
        orderNumber: foundOrder.orderNumber,
        orderDate: orderDate, // ISO string format
        items: foundOrder.items || [],
        total: foundOrder.amount || 0,
        customer: foundOrder.customer || {
          name: 'Customer',
          email: '',
          phone: '',
        },
      },
    });
  } catch (error) {
    console.error('❌ Error in findOrder:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Helper function to find order from Shopify
const findOrderFromShopify = async (user, orderId, normalizedOrderId, orderIdWithHash, normalizedEmailOrPhone, emailOrPhone) => {
  // Import Shopify service
  const { fetchShopifyOrders, convertShopifyOrder, fetchShopifyCustomerById } = await import('../services/shopifyService.js');
  
  // Fetch all orders from Shopify (real-time)
  console.log(`🔄 Fetching orders from Shopify for return portal (${user.shopify.shopDomain})...`);
  let shopifyOrders = await fetchShopifyOrders(
    user.shopify.shopDomain,
    user.shopify.accessToken
  );
  console.log(`📦 Fetched ${shopifyOrders.length} orders from Shopify`);
  
  // Enrich orders with customer details if email is missing
  console.log(`🔄 Enriching orders with customer details for return portal...`);
  const customerCache = new Map();
      
      // CRITICAL: Enrich ALL orders with customer.id - ALWAYS enrich for return portal
      for (const order of shopifyOrders) {
        // If order has customer ID, ALWAYS enrich with customer details
        // This is critical because orders created without email still have customer.id
        if (order.customer?.id) {
          const customerId = order.customer.id.toString();
          const emailIsEmpty = !order.customer?.email && !order.email;
          
          // FOR RETURN PORTAL: ALWAYS enrich if email is missing
          // This ensures we get complete customer data from customer API
          const shouldEnrich = emailIsEmpty || !order.customer?.email;
          
          console.log(`   🔍 Order ${order.name}: customer.id=${customerId}, emailIsEmpty=${emailIsEmpty}, shouldEnrich=${shouldEnrich}`);
          
          // ALWAYS enrich if email is missing - this is critical for portal
          if (shouldEnrich) {
            // Check cache first
            if (!customerCache.has(customerId)) {
              console.log(`   📧 Fetching customer details for customer ID: ${customerId} (order ${order.name})`);
              console.log(`      Current email in order: ${order.customer?.email || order.email || 'null'}`);
              try {
                const customerDetails = await fetchShopifyCustomerById(
                  user.shopify.shopDomain,
                  user.shopify.accessToken,
                  customerId
                );
                if (customerDetails) {
                  customerCache.set(customerId, customerDetails);
                  console.log(`      ✅ Fetched customer email from API: ${customerDetails.email || 'null'}`);
                  console.log(`      ✅ Customer name: ${customerDetails.first_name || ''} ${customerDetails.last_name || ''}`);
                } else {
                  console.log(`      ⚠️ Customer details returned null for ID: ${customerId}`);
                }
              } catch (error) {
                console.error(`      ❌ Failed to fetch customer ${customerId}:`, error.message);
              }
            } else {
              console.log(`   ♻️ Using cached customer data for customer ID: ${customerId}`);
            }
            
            // Enrich order with cached customer data
            const cachedCustomer = customerCache.get(customerId);
            if (cachedCustomer) {
              // Build enriched name from cached customer
              const enrichedFirstName = order.customer?.first_name || cachedCustomer.first_name || '';
              const enrichedLastName = order.customer?.last_name || cachedCustomer.last_name || '';
              const enrichedFullName = `${enrichedFirstName} ${enrichedLastName}`.trim();
              
              // Merge customer details into order - prioritize cached data
              const enrichedEmail = order.customer?.email || cachedCustomer.email || order.email || '';
              const enrichedPhone = order.customer?.phone || cachedCustomer.phone || order.phone || '';
              
              order.customer = {
                id: order.customer.id, // Keep customer ID
                ...order.customer, // Keep any existing customer data
                first_name: enrichedFirstName,
                last_name: enrichedLastName,
                email: enrichedEmail,
                phone: enrichedPhone,
              };
              
              // Also ensure order-level data is set for backward compatibility
              if (!order.email && cachedCustomer.email) {
                order.email = cachedCustomer.email;
              }
              if (!order.phone && enrichedPhone) {
                order.phone = enrichedPhone;
              }
              
              console.log(`      ✅ Enriched order ${order.name}:`);
              console.log(`         - customer.name: "${enrichedFullName || 'EMPTY!'}" (${enrichedFirstName} ${enrichedLastName})`);
              console.log(`         - customer.email: "${enrichedEmail || 'EMPTY!'}"`);
              console.log(`         - customer.phone: "${enrichedPhone || 'EMPTY!'}"`);
            } else {
              console.log(`      ⚠️ No cached customer data available for customer ID: ${customerId}`);
              console.log(`      ⚠️ This means customer API call failed or returned null for customer ${customerId}`);
            }
          } else {
            console.log(`   ✓ Order ${order.name} already has email: ${order.customer?.email || order.email}`);
          }
        } else {
          // Order has no customer ID - log for debugging
          console.log(`   ⚠️ Order ${order.name} has no customer ID`);
          if (order.email) {
            console.log(`   ℹ️ Order has email directly: ${order.email}`);
          } else {
            console.log(`   ⚠️ Order has no customer ID and no email - cannot enrich`);
            console.log(`   Order object keys: ${Object.keys(order).join(', ')}`);
            console.log(`   Order customer object: ${order.customer ? JSON.stringify(order.customer).substring(0, 200) : 'null'}`);
          }
        }
      }
      console.log(`✅ Orders enriched with customer details (cached ${customerCache.size} customers)`);
      
      // Find the order by order number (handle # prefix) - improved matching
      console.log(`🔍 Searching for order: ${orderId} (normalized: ${normalizedOrderId}, withHash: ${orderIdWithHash})`);
      console.log(`📋 Total orders to search: ${shopifyOrders.length}`);
      console.log(`📋 Sample order names:`, shopifyOrders.slice(0, 5).map(o => o.name));
      
      // Clean input order ID for matching
      const cleanOrderId = orderId.trim().replace(/^#/, '');
      const cleanNormalized = normalizedOrderId.trim().replace(/^#/, '');
      
      const shopifyOrder = shopifyOrders.find(o => {
        const shopifyOrderName = (o.name || '').trim();
        const shopifyOrderNumber = (o.order_number?.toString() || '').trim();
        const shopifyOrderId = (o.id?.toString() || '').trim();
        
        // Clean Shopify order name for comparison
        const cleanShopifyName = shopifyOrderName.replace(/^#/, '').trim();
        
        // Try multiple matching patterns - case insensitive and flexible
        const matches = (
          // Exact matches
          shopifyOrderName === orderId ||
          shopifyOrderName === normalizedOrderId ||
          shopifyOrderName === orderIdWithHash ||
          // Case insensitive matches
          shopifyOrderName.toLowerCase() === orderId.toLowerCase() ||
          shopifyOrderName.toLowerCase() === normalizedOrderId.toLowerCase() ||
          shopifyOrderName.toLowerCase() === orderIdWithHash.toLowerCase() ||
          // Cleaned matches (without #)
          cleanShopifyName === cleanOrderId ||
          cleanShopifyName === cleanNormalized ||
          cleanShopifyName.toLowerCase() === cleanOrderId.toLowerCase() ||
          cleanShopifyName.toLowerCase() === cleanNormalized.toLowerCase() ||
          // Order number matches
          shopifyOrderNumber === orderId ||
          shopifyOrderNumber === normalizedOrderId ||
          shopifyOrderNumber === cleanOrderId ||
          shopifyOrderNumber === cleanNormalized ||
          // ID matches
          shopifyOrderId === orderId ||
          shopifyOrderId === normalizedOrderId ||
          shopifyOrderId === cleanOrderId ||
          shopifyOrderId === cleanNormalized
        );
        
        if (matches) {
          console.log(`✅ Found order match: ${shopifyOrderName} (ID: ${shopifyOrderId})`);
        }
        
        return matches;
      });
      
      if (!shopifyOrder) {
        console.log(`❌ Order not found in Shopify: ${orderId}`);
        console.log(`   Searched in ${shopifyOrders.length} orders`);
        return null; // Return null so WooCommerce can be tried
      }

      console.log(`✅ Order found: ${shopifyOrder.name}`);
      console.log(`   Order ID: ${shopifyOrder.id}`);
      console.log(`   Customer ID: ${shopifyOrder.customer?.id || 'null'}`);
      console.log(`   Raw order.email: "${shopifyOrder.email || 'null'}"`);
      console.log(`   Raw order.customer object:`, shopifyOrder.customer ? {
        id: shopifyOrder.customer.id,
        email: shopifyOrder.customer.email,
        first_name: shopifyOrder.customer.first_name,
        last_name: shopifyOrder.customer.last_name,
      } : 'null');
      
      // CRITICAL: ALWAYS enrich customer data if customer.id exists (even if email seems present)
      // This ensures we get the most complete and up-to-date customer information
      if (shopifyOrder.customer?.id) {
        const customerId = shopifyOrder.customer.id.toString();
        console.log(`   🔄 Enriching customer data for customer ID: ${customerId}...`);
        
        // Always fetch from Customer API (don't rely on cache for critical operations)
        try {
          console.log(`   📧 Fetching customer details from Shopify Customer API...`);
          const customerDetails = await fetchShopifyCustomerById(
            user.shopify.shopDomain,
            user.shopify.accessToken,
            customerId
          );
          
          if (customerDetails) {
            // Update cache
            customerCache.set(customerId, customerDetails);
            
            // Enrich order with Customer API data (this is the source of truth)
            shopifyOrder.customer = {
              ...shopifyOrder.customer, // Keep all original fields
              id: shopifyOrder.customer.id,
              email: customerDetails.email || shopifyOrder.customer?.email || shopifyOrder.email || '',
              phone: customerDetails.phone || shopifyOrder.customer?.phone || shopifyOrder.phone || '',
              first_name: customerDetails.first_name || shopifyOrder.customer?.first_name || '',
              last_name: customerDetails.last_name || shopifyOrder.customer?.last_name || '',
            };
            
            // Also set order-level email if missing
            if (!shopifyOrder.email && customerDetails.email) {
              shopifyOrder.email = customerDetails.email;
            }
            
            const customerFullName = `${customerDetails.first_name || ''} ${customerDetails.last_name || ''}`.trim();
            console.log(`      ✅ Customer data enriched:`);
            console.log(`         - email: "${customerDetails.email || 'null'}"`);
            console.log(`         - phone: "${customerDetails.phone || 'null'}"`);
            console.log(`         - name: "${customerFullName || 'null'}"`);
          } else {
            console.log(`      ⚠️ Customer API returned null for ID: ${customerId}`);
            console.log(`      ⚠️ This might indicate:`);
            console.log(`         1. Customer was deleted from Shopify`);
            console.log(`         2. API permissions issue (read_customers scope missing)`);
            console.log(`         3. Customer ID is invalid`);
          }
        } catch (error) {
          console.error(`      ❌ Failed to fetch customer ${customerId}:`, error.message);
          console.error(`      ⚠️ This might indicate:`);
          console.error(`         1. API permissions issue - check read_customers scope`);
          console.error(`         2. Network error - check Shopify connection`);
          console.error(`         3. Invalid customer ID`);
        }
      } else {
        console.log(`   ℹ️ Order has no customer.id - this is a guest order`);
        console.log(`   ℹ️ Will use order-level email/phone or shipping address data`);
      }
      
      // Verify enriched customer data is present
      if (shopifyOrder.customer?.id && (!shopifyOrder.customer?.email && !shopifyOrder.email)) {
        console.log(`   ⚠️ WARNING: Order has customer ID but customer data still not enriched after retry!`);
        console.log(`      customer.email: "${shopifyOrder.customer?.email || 'null'}"`);
        console.log(`      order.email: "${shopifyOrder.email || 'null'}"`);
        console.log(`      Full customer object:`, JSON.stringify(shopifyOrder.customer, null, 2));
      }
      
      // Get email from ALL possible sources (with priority)
      // CRITICAL: Check enriched customer email first
      let orderEmail = '';
      
      // Priority 1: Enriched customer email (from customer API)
      if (shopifyOrder.customer?.email) {
        orderEmail = shopifyOrder.customer.email.toLowerCase().trim();
        console.log(`   ✅ Using enriched customer email: ${orderEmail}`);
      }
      // Priority 2: Order-level email
      else if (shopifyOrder.email) {
        orderEmail = shopifyOrder.email.toLowerCase().trim();
        console.log(`   ✅ Using order-level email: ${orderEmail}`);
      }
      // Priority 3: Billing address email
      else if (shopifyOrder.billing_address?.email) {
        orderEmail = shopifyOrder.billing_address.email.toLowerCase().trim();
        console.log(`   ✅ Using billing address email: ${orderEmail}`);
      }
      // Priority 4: Shipping address email
      else if (shopifyOrder.shipping_address?.email) {
        orderEmail = shopifyOrder.shipping_address.email.toLowerCase().trim();
        console.log(`   ✅ Using shipping address email: ${orderEmail}`);
      }
      
      // Final fallback - debug all possible email sources
      if (!orderEmail) {
        console.log(`   ⚠️ WARNING: No email found in any source for order ${shopifyOrder.name}`);
        console.log(`   🔍 Debugging email sources:`);
        console.log(`      shopifyOrder.customer: ${shopifyOrder.customer ? JSON.stringify(shopifyOrder.customer).substring(0, 200) : 'null'}`);
        console.log(`      shopifyOrder.email: "${shopifyOrder.email || 'null'}"`);
        console.log(`      shopifyOrder.billing_address?.email: "${shopifyOrder.billing_address?.email || 'null'}"`);
        console.log(`      shopifyOrder.shipping_address?.email: "${shopifyOrder.shipping_address?.email || 'null'}"`);
        
        // Try one more time to enrich if customer.id exists
        if (shopifyOrder.customer?.id && !customerCache.has(shopifyOrder.customer.id.toString())) {
          console.log(`   🔄 Last attempt: Trying to fetch customer ${shopifyOrder.customer.id}...`);
          try {
            const lastTryCustomer = await fetchShopifyCustomerById(
              user.shopify.shopDomain,
              user.shopify.accessToken,
              shopifyOrder.customer.id.toString()
            );
            if (lastTryCustomer?.email) {
              orderEmail = lastTryCustomer.email.toLowerCase().trim();
              shopifyOrder.customer.email = lastTryCustomer.email;
              shopifyOrder.email = lastTryCustomer.email;
              console.log(`      ✅ SUCCESS! Found email in last attempt: ${orderEmail}`);
            }
          } catch (err) {
            console.error(`      ❌ Last attempt failed:`, err.message);
          }
        }
      }
      
      // Get phone from ALL possible sources
      const orderPhone = (
        shopifyOrder.customer?.phone || 
        shopifyOrder.phone || 
        shopifyOrder.shipping_address?.phone || 
        shopifyOrder.billing_address?.phone || 
        ''
      ).trim();
      
      console.log(`   📧 Customer Email: "${orderEmail || 'N/A'}"`);
      console.log(`   📞 Customer Phone: "${orderPhone || 'N/A'}"`);
      console.log(`   Email sources checked (in priority order):`);
      console.log(`      1. shopifyOrder.customer?.email (enriched): "${shopifyOrder.customer?.email || 'null'}"`);
      console.log(`      2. shopifyOrder.email: "${shopifyOrder.email || 'null'}"`);
      console.log(`      3. shopifyOrder.billing_address?.email: "${shopifyOrder.billing_address?.email || 'null'}"`);
      console.log(`      4. shopifyOrder.shipping_address?.email: "${shopifyOrder.shipping_address?.email || 'null'}"`);
      console.log(`      ✅ Final email selected: "${orderEmail || 'EMPTY!'}"`);
      
      if (!orderEmail) {
        console.log(`   ⚠️ WARNING: Order ${shopifyOrder.name} has NO email after enrichment!`);
      }

      // Check if email/phone matches
      
      console.log(`🔍 Matching email/phone:`);
      console.log(`   Order Email: ${orderEmail}`);
      console.log(`   Order Phone: ${orderPhone}`);
      console.log(`   Provided: ${normalizedEmailOrPhone}`);
      
      const emailMatches = orderEmail && orderEmail === normalizedEmailOrPhone;
      const phoneMatches = orderPhone && (
        orderPhone === normalizedEmailOrPhone || 
        orderPhone === emailOrPhone.trim() ||
        orderPhone.replace(/\D/g, '') === emailOrPhone.trim().replace(/\D/g, '')
      );
      
      if (!emailMatches && !phoneMatches) {
        console.log(`❌ Email/Phone mismatch for Shopify order`);
        throw new Error(`Email or phone number does not match this order. Please verify your details. Order email: ${orderEmail || 'N/A'}, Phone: ${orderPhone || 'N/A'}`);
      }
      
      console.log(`✅ Email/Phone verified!`);

      // Convert Shopify order to our format
      const convertedOrder = convertShopifyOrder(shopifyOrder);
      
      // Check if order is Delivered - only delivered orders can be returned
      if (convertedOrder.status !== 'Delivered') {
        throw new Error(`This order is currently ${convertedOrder.status}. Only delivered orders can be returned. Please wait until your order is delivered.`);
      }
      
      // Return converted order
      return convertedOrder;
};

// Helper function to find order from WooCommerce
const findOrderFromWooCommerce = async (user, orderId, normalizedOrderId, orderIdWithHash, normalizedEmailOrPhone, emailOrPhone) => {
  // Import WooCommerce service
  const { fetchWooCommerceOrders, convertWooCommerceOrder } = await import('../services/woocommerceService.js');
  
  // Fetch all orders from WooCommerce (real-time)
  console.log(`🔄 Fetching orders from WooCommerce for return portal (${user.wooCommerce.storeUrl})...`);
  let wcOrders = await fetchWooCommerceOrders(
    user.wooCommerce.storeUrl,
    user.wooCommerce.consumerKey,
    user.wooCommerce.consumerSecret
  );
  console.log(`📦 Fetched ${wcOrders.length} orders from WooCommerce`);
  
  // Find the order by order number (handle # prefix and order ID)
  console.log(`🔍 Searching for order: ${orderId} (normalized: ${normalizedOrderId}, withHash: ${orderIdWithHash})`);
  console.log(`📋 Total orders to search: ${wcOrders.length}`);
  
  // Clean input order ID for matching
  const cleanOrderId = orderId.trim().replace(/^#/, '');
  const cleanNormalized = normalizedOrderId.trim().replace(/^#/, '');
  
  const wcOrder = wcOrders.find(o => {
    const wcOrderNumber = (o.number?.toString() || '').trim();
    const wcOrderId = (o.id?.toString() || '').trim();
    
    // Try multiple matching patterns - case insensitive and flexible
    const matches = (
      // Order number matches
      wcOrderNumber === orderId ||
      wcOrderNumber === normalizedOrderId ||
      wcOrderNumber === orderIdWithHash ||
      wcOrderNumber === cleanOrderId ||
      wcOrderNumber === cleanNormalized ||
      wcOrderNumber.toLowerCase() === orderId.toLowerCase() ||
      wcOrderNumber.toLowerCase() === normalizedOrderId.toLowerCase() ||
      // ID matches
      wcOrderId === orderId ||
      wcOrderId === normalizedOrderId ||
      wcOrderId === cleanOrderId ||
      wcOrderId === cleanNormalized ||
      wcOrderId.toLowerCase() === orderId.toLowerCase() ||
      wcOrderId.toLowerCase() === normalizedOrderId.toLowerCase()
    );
    
    if (matches) {
      console.log(`✅ Found WooCommerce order match: ${wcOrderNumber} (ID: ${wcOrderId})`);
    }
    
    return matches;
  });
  
  if (!wcOrder) {
    console.log(`❌ Order not found in WooCommerce: ${orderId}`);
    console.log(`   Searched in ${wcOrders.length} orders`);
    return null; // Return null so caller knows order not found
  }
  
  console.log(`✅ WooCommerce order found: ${wcOrder.number || wcOrder.id}`);
  console.log(`   Order ID: ${wcOrder.id}`);
  console.log(`   Customer Email: "${wcOrder.billing?.email || 'null'}"`);
  console.log(`   Customer Phone: "${wcOrder.billing?.phone || 'null'}"`);
  
  // Get email and phone from WooCommerce order
  const orderEmail = (wcOrder.billing?.email || '').toLowerCase().trim();
  const orderPhone = (wcOrder.billing?.phone || '').trim();
  
  console.log(`🔍 Matching email/phone:`);
  console.log(`   Order Email: ${orderEmail}`);
  console.log(`   Order Phone: ${orderPhone}`);
  console.log(`   Provided: ${normalizedEmailOrPhone}`);
  
  // Check if email/phone matches
  const emailMatches = orderEmail && orderEmail === normalizedEmailOrPhone;
  const phoneMatches = orderPhone && (
    orderPhone === normalizedEmailOrPhone || 
    orderPhone === emailOrPhone.trim() ||
    orderPhone.replace(/\D/g, '') === emailOrPhone.trim().replace(/\D/g, '')
  );
  
  if (!emailMatches && !phoneMatches) {
    console.log(`❌ Email/Phone mismatch for WooCommerce order`);
    throw new Error(`Email or phone number does not match this order. Please verify your details. Order email: ${orderEmail || 'N/A'}, Phone: ${orderPhone || 'N/A'}`);
  }
  
  console.log(`✅ Email/Phone verified!`);
  
  // Convert WooCommerce order to our format
  const convertedOrder = convertWooCommerceOrder(wcOrder);
  
  // Check if order is Delivered - only delivered orders can be returned
  // WooCommerce "completed" status maps to "Delivered" in our system
  if (convertedOrder.status !== 'Delivered') {
    throw new Error(`This order is currently ${convertedOrder.status}. Only delivered orders can be returned. Please wait until your order is delivered.`);
  }
  
  // Return converted order
  return convertedOrder;
};

