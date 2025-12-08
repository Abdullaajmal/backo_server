import Return from '../models/Return.js';
import User from '../models/User.js';
import { fetchShopifyCustomers, fetchShopifyOrders, fetchShopifyCustomerById } from '../services/shopifyService.js';

// @desc    Get all customers (Dynamically from Shopify, not from DB)
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res) => {
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

    // Fetch customers directly from Shopify (real-time)
    console.log(`🔄 Fetching customers from Shopify (${user.shopify.shopDomain})...`);
    let shopifyCustomers = [];
    try {
      shopifyCustomers = await fetchShopifyCustomers(user.shopify.shopDomain, user.shopify.accessToken);
      console.log(`✅ Fetched ${shopifyCustomers.length} customers from Shopify`);
    } catch (error) {
      console.error('❌ Error fetching customers from Shopify:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to fetch customers from Shopify: ${error.message}`,
      });
    }

    // Also fetch orders to calculate stats AND get customers from orders
    let shopifyOrders = [];
    try {
      shopifyOrders = await fetchShopifyOrders(user.shopify.shopDomain, user.shopify.accessToken);
      console.log(`✅ Fetched ${shopifyOrders.length} orders from Shopify`);
      
      // Enrich orders with customer details if missing (same as orderController)
      console.log(`🔄 Enriching orders with customer details...`);
      const orderCustomerCache = new Map();
      
      for (const order of shopifyOrders) {
        if (order.customer?.id) {
          const customerId = order.customer.id.toString();
          const emailIsEmpty = !order.customer?.email && !order.email;
          const nameIsEmpty = !order.customer?.first_name && !order.customer?.last_name;
          
          if (emailIsEmpty || !order.customer?.email || nameIsEmpty) {
            if (!orderCustomerCache.has(customerId)) {
              try {
                const customerDetails = await fetchShopifyCustomerById(
                  user.shopify.shopDomain,
                  user.shopify.accessToken,
                  customerId
                );
                if (customerDetails) {
                  orderCustomerCache.set(customerId, customerDetails);
                }
              } catch (error) {
                console.error(`Failed to fetch customer ${customerId}:`, error.message);
              }
            }
            
            const cachedCustomer = orderCustomerCache.get(customerId);
            if (cachedCustomer) {
              order.customer = {
                ...order.customer,
                first_name: order.customer?.first_name || cachedCustomer.first_name || '',
                last_name: order.customer?.last_name || cachedCustomer.last_name || '',
                email: order.customer?.email || cachedCustomer.email || order.email || '',
                phone: order.customer?.phone || cachedCustomer.phone || order.phone || '',
              };
              if (!order.email && cachedCustomer.email) {
                order.email = cachedCustomer.email;
              }
            }
          }
        }
      }
      
      console.log(`✅ Enriched orders with customer details (cached ${orderCustomerCache.size} customers)`);
    } catch (error) {
      console.error('❌ Error fetching orders from Shopify:', error);
      // Continue even if orders fail - we still have customers
    }
    
    // Get returns from database for return count
    const returns = await Return.find({ userId });

    // Aggregate customer data from Shopify customers and orders
    const customerMap = new Map();

    // Process Shopify customers - include ALL customers (even without email)
    console.log(`\n🔍 Processing ${shopifyCustomers.length} Shopify customers...`);
    shopifyCustomers.forEach((shopifyCustomer, idx) => {
      // Debug: Log raw Shopify customer data
      if (idx < 3) {
        console.log(`\n📋 Raw Shopify Customer ${idx + 1} (ID: ${shopifyCustomer.id}):`);
        console.log(`   - first_name: "${shopifyCustomer.first_name || 'null'}"`);
        console.log(`   - last_name: "${shopifyCustomer.last_name || 'null'}"`);
        console.log(`   - email: "${shopifyCustomer.email || 'null'}"`);
        console.log(`   - phone: "${shopifyCustomer.phone || 'null'}"`);
        console.log(`   - default_address?.name: "${shopifyCustomer.default_address?.name || 'null'}"`);
        console.log(`   - default_address?.first_name: "${shopifyCustomer.default_address?.first_name || 'null'}"`);
        console.log(`   - default_address?.last_name: "${shopifyCustomer.default_address?.last_name || 'null'}"`);
        console.log(`   - All keys: ${Object.keys(shopifyCustomer).join(', ')}`);
      }
      
      // Use email as key if available, otherwise use customer ID
      const customerEmail = (shopifyCustomer.email || '').toLowerCase();
      const customerId = shopifyCustomer.id?.toString() || `customer-${Date.now()}-${Math.random()}`;
      const key = customerEmail || customerId;
      
      // Only skip if no email AND no name (completely empty customer)
      if (!customerEmail && !shopifyCustomer.first_name && !shopifyCustomer.last_name) {
        console.log('⚠️ Skipping customer with no email or name:', shopifyCustomer.id);
        return;
      }
      
      // CRITICAL: Extract original customer name from Shopify (NO "Guest Customer" fake name)
      // Priority: first_name + last_name > default_address name > email > phone
      let customerName = '';
      
      // Priority 1: first_name + last_name from Shopify Customer API
      if (shopifyCustomer.first_name || shopifyCustomer.last_name) {
        customerName = `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim();
        if (idx < 3) console.log(`   ✅ Extracted name from first_name+last_name: "${customerName}"`);
      }
      
      // Priority 2: default_address name
      if (!customerName && shopifyCustomer.default_address?.name) {
        customerName = shopifyCustomer.default_address.name.trim();
        if (idx < 3) console.log(`   ✅ Extracted name from default_address.name: "${customerName}"`);
      }
      
      // Priority 3: default_address first_name + last_name
      if (!customerName && (shopifyCustomer.default_address?.first_name || shopifyCustomer.default_address?.last_name)) {
        customerName = `${shopifyCustomer.default_address.first_name || ''} ${shopifyCustomer.default_address.last_name || ''}`.trim();
        if (idx < 3) console.log(`   ✅ Extracted name from default_address first_name+last_name: "${customerName}"`);
      }
      
      // Priority 4: email (if no name available)
      if (!customerName && shopifyCustomer.email) {
        customerName = shopifyCustomer.email;
        if (idx < 3) console.log(`   ✅ Using email as name: "${customerName}"`);
      }
      
      // Priority 5: phone (if no name or email)
      if (!customerName && shopifyCustomer.phone) {
        customerName = shopifyCustomer.phone;
        if (idx < 3) console.log(`   ✅ Using phone as name: "${customerName}"`);
      }
      
      // Last resort: Only use "Guest" if absolutely NO data available (not "Guest Customer")
      if (!customerName) {
        customerName = 'Guest';
        if (idx < 3) console.log(`   ⚠️ No name found, using "Guest" as fallback`);
      }
      
      if (idx < 3) console.log(`   📝 Final customer name: "${customerName}"`);
      
      customerMap.set(key, {
        name: customerName, // From Shopify Customer API
        email: shopifyCustomer.email || '', // From Shopify Customer API
        phone: shopifyCustomer.phone || shopifyCustomer.default_address?.phone || '', // From Shopify
        address: shopifyCustomer.default_address ? {
          street: shopifyCustomer.default_address.address1 || '', // From Shopify
          city: shopifyCustomer.default_address.city || '', // From Shopify
          state: shopifyCustomer.default_address.province || '', // From Shopify
          zipCode: shopifyCustomer.default_address.zip || '', // From Shopify
          country: shopifyCustomer.default_address.country || '', // From Shopify
        } : null,
        totalOrders: 0, // Calculated from Shopify orders
        totalReturns: 0, // Only this comes from DB (returns don't exist in Shopify)
        orderAmounts: [], // Calculated from Shopify orders
        createdAt: shopifyCustomer.created_at, // From Shopify
        shopifyCustomerId: shopifyCustomer.id?.toString(), // From Shopify
      });
      
      console.log(`   ✅ Added customer from Shopify: "${customerName}" (first: "${shopifyCustomer.first_name}", last: "${shopifyCustomer.last_name}", email: ${shopifyCustomer.email || 'no email'})`);
    });

    // Process Shopify orders to calculate stats AND add customers from orders (if not already in list)
    console.log(`\n🔍 Processing ${shopifyOrders.length} Shopify orders for customer data...`);
    let orderCustomerCount = 0;
    shopifyOrders.forEach((order, orderIdx) => {
      const orderCustomer = order.customer || {};
      const customerEmail = ((order.email || orderCustomer.email || '')).toLowerCase();
      const customerId = orderCustomer.id?.toString() || order.id?.toString() || '';
      const key = customerEmail || customerId || `order-${order.id}`;
      
      // If customer not in map, add them from order data (original Shopify data)
      if (!customerMap.has(key)) {
        orderCustomerCount++;
        
        // Debug first 3 orders
        if (orderCustomerCount <= 3) {
          console.log(`\n📦 Processing Order ${order.name} (Order ${orderIdx + 1}):`);
          console.log(`   - order.email: "${order.email || 'null'}"`);
          console.log(`   - orderCustomer.first_name: "${orderCustomer.first_name || 'null'}"`);
          console.log(`   - orderCustomer.last_name: "${orderCustomer.last_name || 'null'}"`);
          console.log(`   - orderCustomer.email: "${orderCustomer.email || 'null'}"`);
          console.log(`   - shipping_address?.name: "${order.shipping_address?.name || 'null'}"`);
          console.log(`   - shipping_address?.first_name: "${order.shipping_address?.first_name || 'null'}"`);
          console.log(`   - shipping_address?.last_name: "${order.shipping_address?.last_name || 'null'}"`);
        }
        
        // Extract original name from order (NO "Guest Customer" fake name)
        let customerName = '';
        
        // Priority 1: orderCustomer first_name + last_name
        if (orderCustomer.first_name || orderCustomer.last_name) {
          customerName = `${orderCustomer.first_name || ''} ${orderCustomer.last_name || ''}`.trim();
          if (orderCustomerCount <= 3) console.log(`   ✅ Extracted name from orderCustomer: "${customerName}"`);
        }
        
        // Priority 2: shipping_address name
        if (!customerName && order.shipping_address?.name) {
          customerName = order.shipping_address.name.trim();
          if (orderCustomerCount <= 3) console.log(`   ✅ Extracted name from shipping_address.name: "${customerName}"`);
        }
        
        // Priority 3: shipping_address first_name + last_name
        if (!customerName && (order.shipping_address?.first_name || order.shipping_address?.last_name)) {
          customerName = `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim();
          if (orderCustomerCount <= 3) console.log(`   ✅ Extracted name from shipping_address: "${customerName}"`);
        }
        
        // Priority 4: billing_address name
        if (!customerName && order.billing_address?.name) {
          customerName = order.billing_address.name.trim();
          if (orderCustomerCount <= 3) console.log(`   ✅ Extracted name from billing_address.name: "${customerName}"`);
        }
        
        // Priority 5: billing_address first_name + last_name
        if (!customerName && (order.billing_address?.first_name || order.billing_address?.last_name)) {
          customerName = `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim();
          if (orderCustomerCount <= 3) console.log(`   ✅ Extracted name from billing_address: "${customerName}"`);
        }
        
        // Priority 6: email
        if (!customerName && order.email) {
          customerName = order.email;
          if (orderCustomerCount <= 3) console.log(`   ✅ Using email as name: "${customerName}"`);
        }
        
        // Priority 7: phone
        if (!customerName && order.phone) {
          customerName = order.phone;
          if (orderCustomerCount <= 3) console.log(`   ✅ Using phone as name: "${customerName}"`);
        }
        
        // Last resort: Only "Guest" if absolutely no data
        if (!customerName) {
          customerName = 'Guest';
          if (orderCustomerCount <= 3) console.log(`   ⚠️ No name found, using "Guest" as fallback`);
        }
        
        if (orderCustomerCount <= 3) console.log(`   📝 Final customer name: "${customerName}"`);
        
        customerMap.set(key, {
          name: customerName, // Original Shopify name, NOT "Guest Customer"
          email: order.email || orderCustomer.email || '',
          phone: order.phone || orderCustomer.phone || '',
          address: order.shipping_address ? {
            street: order.shipping_address.address1 || '',
            city: order.shipping_address.city || '',
            state: order.shipping_address.province || '',
            zipCode: order.shipping_address.zip || '',
            country: order.shipping_address.country || '',
          } : null,
          totalOrders: 0,
          totalReturns: 0,
          orderAmounts: [],
          createdAt: order.created_at,
          shopifyCustomerId: customerId,
        });
      }
      
      // Update stats for customer (whether from customers list or orders)
      const customer = customerMap.get(key);
      if (customer) {
        customer.totalOrders += 1;
        customer.orderAmounts.push(parseFloat(order.total_price || 0));
      }
    });

    // Process returns from database (only for return count - returns don't exist in Shopify)
    // All customer data comes from Shopify, only return count from our DB
    console.log(`📊 Processing ${returns.length} returns from database for return count...`);
    returns.forEach(returnItem => {
      const customerEmail = ((returnItem.customer?.email || '')).toLowerCase();
      const customerId = returnItem.customer?.shopifyCustomerId;
      // Match by email OR shopify customer ID
      const key = customerEmail || customerId;
      if (key && customerMap.has(key)) {
        customerMap.get(key).totalReturns += 1;
        console.log(`   ✅ Added return count for customer: ${key}`);
      }
    });

    // Calculate trust score and format customer data
    const customers = Array.from(customerMap.values()).map(customer => {
      const returnRate = customer.totalOrders > 0 
        ? (customer.totalReturns / customer.totalOrders) * 100 
        : customer.totalReturns > 0 ? 100 : 0;
      
      const avgOrderValue = customer.orderAmounts.length > 0
        ? customer.orderAmounts.reduce((sum, val) => sum + val, 0) / customer.orderAmounts.length
        : 0;

      // Trust score calculation (0-100):
      // - Base score: 50
      // - Order count bonus: up to 30 points (more orders = higher trust)
      // - Return rate penalty: up to -30 points (more returns = lower trust)
      // - Order value bonus: up to 20 points (higher value = higher trust)
      let trustScore = 50;
      
      // Order count bonus (max 30 points)
      trustScore += Math.min(customer.totalOrders * 2, 30);
      
      // Return rate penalty (max -30 points)
      trustScore -= Math.min(returnRate * 0.3, 30);
      
      // Order value bonus (max 20 points, normalized)
      const valueBonus = Math.min((avgOrderValue / 100) * 2, 20);
      trustScore += valueBonus;
      
      // Ensure score is between 0 and 100
      trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

      return {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        trustScore,
        totalOrders: customer.totalOrders,
        totalReturns: customer.totalReturns,
        createdAt: customer.createdAt,
      };
    });

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`✅ Returning ${customers.length} customers to frontend`);
    if (customers.length > 0) {
      console.log(`\n📋 Final Customer Data (first 3):`);
      customers.slice(0, 3).forEach((customer, idx) => {
        console.log(`   Customer ${idx + 1}:`);
        console.log(`      - name: "${customer.name}"`);
        console.log(`      - email: "${customer.email || 'empty'}"`);
        console.log(`      - phone: "${customer.phone || 'empty'}"`);
        console.log(`      - totalOrders: ${customer.totalOrders}`);
      });
      console.log(`\n📄 First customer full JSON:`, JSON.stringify(customers[0], null, 2));
    } else {
      console.log('⚠️ No customers to return - customers array is empty');
      console.log('   Shopify customers fetched:', shopifyCustomers.length);
      console.log('   Shopify orders fetched:', shopifyOrders.length);
      console.log('   Customer map size:', customerMap.size);
    }

    // Ensure we always return data in the correct format
    if (!customers || customers.length === 0) {
      console.log('⚠️ No customers found - returning empty array');
    }

    res.json({
      success: true,
      data: customers || [],
    });
  } catch (error) {
    console.error('❌ Error in getCustomers controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching customers',
    });
  }
};

// @desc    Get single customer details (from Shopify)
// @route   GET /api/customers/:email
// @access  Private
export const getCustomer = async (req, res) => {
  try {
    const userId = req.user._id;
    const customerEmail = req.params.email;

    // Get user with Shopify credentials
    const user = await User.findById(userId).select('+shopify.accessToken');
    
    // Check if Shopify is connected
    if (!user?.shopify?.isConnected || !user.shopify.accessToken || !user.shopify.shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Shopify store not connected. Please connect your Shopify store first.',
      });
    }

    // Fetch customers from Shopify
    const shopifyCustomers = await fetchShopifyCustomers(user.shopify.shopDomain, user.shopify.accessToken);
    
    // Find the specific customer
    const shopifyCustomer = shopifyCustomers.find(
      c => (c.email || '').toLowerCase() === customerEmail.toLowerCase()
    );

    if (!shopifyCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Fetch orders to get customer's order history
    const shopifyOrders = await fetchShopifyOrders(user.shopify.shopDomain, user.shopify.accessToken);
    const customerOrders = shopifyOrders.filter(
      o => ((o.email || o.customer?.email || '')).toLowerCase() === customerEmail.toLowerCase()
    );

    // Get returns from database for this customer
    const returns = await Return.find({ 
      userId, 
      'customer.email': customerEmail 
    }).sort({ date: -1 });

    // Format customer data - extract original name (NO "Guest" fake name)
    let customerName = '';
    
    // Priority: first_name + last_name > default_address name > email
    if (shopifyCustomer.first_name || shopifyCustomer.last_name) {
      customerName = `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim();
    } else if (shopifyCustomer.default_address?.name) {
      customerName = shopifyCustomer.default_address.name;
    } else if (shopifyCustomer.default_address?.first_name || shopifyCustomer.default_address?.last_name) {
      customerName = `${shopifyCustomer.default_address.first_name || ''} ${shopifyCustomer.default_address.last_name || ''}`.trim();
    } else if (shopifyCustomer.email) {
      customerName = shopifyCustomer.email;
    } else {
      customerName = 'Guest'; // Only if absolutely no data
    }
    
    const customer = {
      name: customerName, // Original Shopify name
      email: shopifyCustomer.email,
      phone: shopifyCustomer.phone || shopifyCustomer.default_address?.phone || '',
      address: shopifyCustomer.default_address ? {
        street: shopifyCustomer.default_address.address1 || '',
        city: shopifyCustomer.default_address.city || '',
        state: shopifyCustomer.default_address.province || '',
        zipCode: shopifyCustomer.default_address.zip || '',
        country: shopifyCustomer.default_address.country || '',
      } : null,
      createdAt: shopifyCustomer.created_at,
    };

    // Convert Shopify orders to our format
    const { convertShopifyOrder } = await import('../services/shopifyService.js');
    const formattedOrders = customerOrders.map(convertShopifyOrder);

    res.json({
      success: true,
      data: {
        customer,
        orders: formattedOrders,
        returns,
      },
    });
  } catch (error) {
    console.error('Error in getCustomer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

