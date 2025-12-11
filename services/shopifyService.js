const SHOPIFY_API_VERSION = '2024-10';

// Fetch orders from Shopify (fetch ALL data, don't limit fields)
export const fetchShopifyOrders = async (shopDomain, accessToken) => {
  try {
    // Don't use 'fields' parameter - fetch complete order data including ALL customer details
    // Using 'fields' might exclude nested customer data
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;
    
    console.log(`📥 Fetching orders from Shopify: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const orders = data.orders || [];
    
    console.log(`✅ Fetched ${orders.length} orders from Shopify`);
    
    // Debug: Log detailed structure of first order to see ALL available data
    if (orders.length > 0) {
      const firstOrder = orders[0];
      console.log(`\n🔍 ===== DETAILED ORDER DATA DEBUG (${firstOrder.name}) =====`);
      console.log(`📧 Email Sources:`);
      console.log(`   - shopifyOrder.email (direct): "${firstOrder.email || 'null'}"`);
      console.log(`   - shopifyOrder.customer?.email: "${firstOrder.customer?.email || 'null'}"`);
      console.log(`   - shopifyOrder.shipping_address?.email: "${firstOrder.shipping_address?.email || 'null'}"`);
      console.log(`   - shopifyOrder.billing_address?.email: "${firstOrder.billing_address?.email || 'null'}"`);
      
      console.log(`\n📞 Phone Sources:`);
      console.log(`   - shopifyOrder.phone (direct): "${firstOrder.phone || 'null'}"`);
      console.log(`   - shopifyOrder.customer?.phone: "${firstOrder.customer?.phone || 'null'}"`);
      console.log(`   - shopifyOrder.shipping_address?.phone: "${firstOrder.shipping_address?.phone || 'null'}"`);
      
      console.log(`\n👤 Customer Object:`);
      if (firstOrder.customer) {
        console.log(`   - customer exists: YES`);
        console.log(`   - customer.id: ${firstOrder.customer.id || 'null'}`);
        console.log(`   - customer.first_name: "${firstOrder.customer.first_name || 'null'}"`);
        console.log(`   - customer.last_name: "${firstOrder.customer.last_name || 'null'}"`);
        console.log(`   - customer.email: "${firstOrder.customer.email || 'null'}"`);
        console.log(`   - customer.phone: "${firstOrder.customer.phone || 'null'}"`);
        console.log(`   - All customer keys: ${Object.keys(firstOrder.customer).join(', ')}`);
      } else {
        console.log(`   - customer exists: NO (null/undefined)`);
      }
      
      console.log(`\n📦 Order Object Keys: ${Object.keys(firstOrder).join(', ')}`);
      console.log(`===========================================\n`);
    }
    
    return orders;
  } catch (error) {
    console.error('❌ Error fetching Shopify orders:', error);
    throw error;
  }
};

// Fetch single customer from Shopify by ID
export const fetchShopifyCustomerById = async (shopDomain, accessToken, customerId) => {
  try {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If customer not found, return null (don't throw error)
      if (response.status === 404) {
        console.log(`⚠️ Customer ${customerId} not found in Shopify`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Shopify API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.customer;
  } catch (error) {
    console.error(`Error fetching customer ${customerId}:`, error.message);
    return null; // Return null instead of throwing to prevent blocking
  }
};

// Fetch single order from Shopify
export const fetchShopifyOrder = async (shopDomain, accessToken, orderId) => {
  try {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.order;
  } catch (error) {
    console.error('Error fetching Shopify order:', error);
    throw error;
  }
};

// Fetch products from Shopify (with pagination support)
export const fetchShopifyProducts = async (shopDomain, accessToken) => {
  try {
    let allProducts = [];
    let hasNextPage = true;
    let pageInfo = null;
    let page = 1;

    while (hasNextPage) {
      let url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;
      
      // Add pagination cursor if we have one
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }

      console.log(`📥 Fetching products from Shopify (page: ${page})...`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Shopify API Error: ${response.status} - ${errorText}`;
        
        // Check for scope-related errors
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.errors && typeof errorData.errors === 'string' && errorData.errors.includes('read_products')) {
              errorMessage = `Shopify API Error: 403 - Access token ko 'read_products' scope ki permission nahi hai.\n\n` +
                `Solution:\n` +
                `1. Shopify Admin → Settings → Apps and sales channels → Develop apps\n` +
                `2. Apni app select karo (ya nayi app create karo)\n` +
                `3. "Configure Admin API scopes" section mein yeh scopes select karo:\n` +
                `   ✅ read_products (Products read karne ke liye)\n` +
                `   ✅ read_orders (Orders read karne ke liye)\n` +
                `   ✅ read_customers (Customers read karne ke liye)\n` +
                `4. "Save" karo\n` +
                `5. "Install app" karo (agar pehle install nahi hai)\n` +
                `6. Naya Admin API access token copy karo\n` +
                `7. Settings page se Shopify ko disconnect karo aur phir naye token ke sath connect karo`;
            }
          } catch (e) {
            // If parsing fails, use original error
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const products = data.products || [];
      allProducts = allProducts.concat(products);
      console.log(`✅ Fetched ${products.length} products (total so far: ${allProducts.length})`);

      // Check for next page using Link header
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        // Extract page_info from link header
        const nextMatch = linkHeader.match(/page_info=([^&>]+)/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
          page++;
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`✅ Total products fetched from Shopify: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error('❌ Error fetching Shopify products:', error);
    throw error;
  }
};

// Fetch customers from Shopify (with pagination support)
export const fetchShopifyCustomers = async (shopDomain, accessToken) => {
  try {
    let allCustomers = [];
    let hasNextPage = true;
    let pageInfo = null;
    const limit = 250;

    while (hasNextPage) {
      let url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=${limit}`;
      
      // Add pagination cursor if we have one
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }

      console.log(`📥 Fetching customers from Shopify (page: ${pageInfo ? 'next' : 'first'})...`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const customers = data.customers || [];
      allCustomers = allCustomers.concat(customers);

      // Check for next page
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        // Extract page_info from link header
        const nextMatch = linkHeader.match(/page_info=([^&>]+)/);
        pageInfo = nextMatch ? nextMatch[1] : null;
        hasNextPage = !!pageInfo;
      } else {
        hasNextPage = false;
      }

      console.log(`✅ Fetched ${customers.length} customers (total so far: ${allCustomers.length})`);
    }

    console.log(`✅ Total customers fetched from Shopify: ${allCustomers.length}`);
    
    // Debug: Log first few customers to verify data structure
    if (allCustomers.length > 0) {
      console.log(`\n🔍 Sample customer data from Shopify:`);
      allCustomers.slice(0, 3).forEach((customer, idx) => {
        const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        console.log(`   Customer ${idx + 1}: "${name || 'NO NAME'}" (first: "${customer.first_name || ''}", last: "${customer.last_name || ''}", email: ${customer.email || 'no email'})`);
      });
    }
    
    return allCustomers;
  } catch (error) {
    console.error('❌ Error fetching Shopify customers:', error);
    throw error;
  }
};

// Verify Shopify credentials
export const verifyShopifyConnection = async (shopDomain, accessToken) => {
  try {
    // Clean shop domain (remove https://, www., etc.)
    let cleanDomain = shopDomain.trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
    cleanDomain = cleanDomain.replace(/^www\./, '');
    cleanDomain = cleanDomain.replace(/\/$/, '');
    
    // Ensure it ends with .myshopify.com if it doesn't already
    if (!cleanDomain.includes('.myshopify.com') && !cleanDomain.includes('.')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    const url = `https://${cleanDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Invalid credentials';
      
      if (response.status === 401) {
        errorMessage = 'Invalid access token. Please check your Admin API Access Token.';
      } else if (response.status === 404) {
        errorMessage = 'Shop not found. Please check your shop domain.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please check your API permissions.';
      } else {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.errors || errorMessage;
        } catch (e) {
          errorMessage = `Shopify API Error: ${response.status}`;
        }
      }
      
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, shop: data.shop };
  } catch (error) {
    console.error('Error verifying Shopify connection:', error);
    
    let errorMessage = 'Failed to connect to Shopify';
    if (error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection and shop domain.';
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'Shop domain not found. Please check your shop domain (e.g., mystore.myshopify.com).';
    } else {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

// Convert Shopify product to our format
export const convertShopifyProduct = (shopifyProduct) => {
  return {
    id: shopifyProduct.id?.toString(),
    title: shopifyProduct.title || 'Untitled Product',
    handle: shopifyProduct.handle || '',
    vendor: shopifyProduct.vendor || '',
    productType: shopifyProduct.product_type || 'simple',
    status: shopifyProduct.status === 'active' ? 'active' : 'draft',
    tags: shopifyProduct.tags || '',
    variants: (shopifyProduct.variants || []).map(variant => ({
      id: variant.id?.toString(),
      title: variant.title || 'Default',
      price: variant.price || '0',
      sku: variant.sku || '',
      inventoryQuantity: variant.inventory_quantity || 0,
      compareAtPrice: variant.compare_at_price || null,
    })),
    images: (shopifyProduct.images || []).map(img => ({
      src: img.src || '',
      alt: img.alt || shopifyProduct.title || '',
    })),
    createdAt: shopifyProduct.created_at || new Date().toISOString(),
    updatedAt: shopifyProduct.updated_at || shopifyProduct.created_at || new Date().toISOString(),
    price: shopifyProduct.variants?.[0]?.price || '0',
    sku: shopifyProduct.variants?.[0]?.sku || '',
    inventoryQuantity: shopifyProduct.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0,
  };
};

// Convert Shopify order to our format
export const convertShopifyOrder = (shopifyOrder) => {
  // Shopify order name format: "#1001" or "1001"
  // Normalize to remove # for storage, but keep original for matching
  let orderNumber = shopifyOrder.name || shopifyOrder.order_number?.toString() || '';
  
  return {
    shopifyOrderId: shopifyOrder.id?.toString(),
    orderNumber: orderNumber, // Keep original format for now
    customer: {
      name: `${shopifyOrder.customer?.first_name || ''} ${shopifyOrder.customer?.last_name || ''}`.trim() || 
             shopifyOrder.email || 
             shopifyOrder.shipping_address?.name || 
             shopifyOrder.billing_address?.name || 
             'Guest',
      email: shopifyOrder.email || 
             shopifyOrder.customer?.email || 
             shopifyOrder.billing_address?.email || 
             shopifyOrder.shipping_address?.email || 
             '',
      phone: shopifyOrder.phone || 
             shopifyOrder.customer?.phone || 
             shopifyOrder.shipping_address?.phone || 
             shopifyOrder.billing_address?.phone || 
             '',
    },
    items: (shopifyOrder.line_items || []).map(item => ({
      productName: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price || 0),
      shopifyProductId: item.product_id?.toString(),
      shopifyVariantId: item.variant_id?.toString(),
    })),
    amount: parseFloat(shopifyOrder.total_price || 0),
    paymentMethod: shopifyOrder.financial_status === 'pending' ? 'COD' : 'Prepaid',
    status: mapShopifyStatusToOurStatus(shopifyOrder.fulfillment_status, shopifyOrder.financial_status, shopifyOrder.cancelled_at, shopifyOrder.fulfillments),
    placedDate: new Date(shopifyOrder.created_at),
    deliveredDate: shopifyOrder.fulfillments?.[0]?.created_at ? new Date(shopifyOrder.fulfillments[0].created_at) : null,
    shippingAddress: shopifyOrder.shipping_address ? {
      street: shopifyOrder.shipping_address.address1 || '',
      city: shopifyOrder.shipping_address.city || '',
      state: shopifyOrder.shipping_address.province || '',
      zipCode: shopifyOrder.shipping_address.zip || '',
      country: shopifyOrder.shipping_address.country || '',
    } : null,
    notes: shopifyOrder.note || '',
    shopifyData: shopifyOrder, // Store full Shopify data for reference
  };
};

// Map Shopify status to our status
const mapShopifyStatusToOurStatus = (fulfillmentStatus, financialStatus, cancelledAt, fulfillments) => {
  if (cancelledAt) {
    return 'Cancelled';
  }
  
  // Check if order has fulfillments (even if fulfillment_status is null/unfulfilled)
  // If fulfillments exist and have status 'success', consider it delivered
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    const hasSuccessfulFulfillment = fulfillments.some(f => 
      f.status === 'success' || f.status === 'open' || !f.status
    );
    if (hasSuccessfulFulfillment) {
      return 'Delivered';
    }
  }
  
  // Check fulfillment_status
  if (fulfillmentStatus === 'fulfilled') {
    return 'Delivered';
  }
  
  if (fulfillmentStatus === 'partial') {
    return 'In Transit';
  }
  
  if (financialStatus === 'pending' || financialStatus === 'authorized') {
    return 'Processing';
  }
  
  // If order is paid and has no fulfillment status, check if it's been some time
  // For now, default to Processing if paid
  if (financialStatus === 'paid') {
    return 'Processing';
  }
  
  return 'Pending';
};

