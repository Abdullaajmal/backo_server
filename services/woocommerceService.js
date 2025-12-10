// WooCommerce API service
// WooCommerce REST API uses Basic Auth with Consumer Key and Consumer Secret

// Helper function to clean and normalize URL
const cleanWooCommerceUrl = (url) => {
  if (!url) return '';
  let cleanUrl = url.trim();
  
  // Remove any whitespace
  cleanUrl = cleanUrl.replace(/\s+/g, '');
  
  // Remove trailing slash
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  
  // Remove any path after domain (keep only domain)
  try {
    const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
    cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (e) {
    // If URL parsing fails, just add protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
  }
  
  return cleanUrl;
};

// Verify WooCommerce connection
export const verifyWooCommerceConnection = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    // Clean store URL
    const cleanUrl = cleanWooCommerceUrl(storeUrl);
    
    // Validate URL format
    if (!cleanUrl || !cleanUrl.includes('.')) {
      return { 
        success: false, 
        error: `Invalid store URL: ${storeUrl}\n\nPlease enter a complete URL like: https://yourstore.com` 
      };
    }

    console.log(`📥 Verifying WooCommerce connection: ${cleanUrl}`);
    
    // First, check if the site is accessible (without auth)
    try {
      const siteCheckUrl = cleanUrl;
      const siteController = new AbortController();
      const siteTimeout = setTimeout(() => siteController.abort(), 5000);
      
      const siteResponse = await fetch(siteCheckUrl, {
        method: 'GET',
        signal: siteController.signal,
        redirect: 'follow',
      });
      
      clearTimeout(siteTimeout);
      
      if (!siteResponse.ok && siteResponse.status !== 401 && siteResponse.status !== 403) {
        return {
          success: false,
          error: `Website not accessible at ${cleanUrl}\n\nStatus: ${siteResponse.status}\n\nPlease check:\n1. The URL is correct\n2. The website is online\n3. There are no firewall restrictions`
        };
      }
      
      console.log(`✅ Website is accessible at ${cleanUrl}`);
    } catch (siteError) {
      if (siteError.name === 'AbortError') {
        return {
          success: false,
          error: `Connection timeout. The website at ${cleanUrl} is not responding.\n\nPlease check:\n1. The URL is correct\n2. The website is online\n3. Your internet connection`
        };
      } else if (siteError.message.includes('ENOTFOUND') || siteError.message.includes('getaddrinfo')) {
        return {
          success: false,
          error: `Website not found: ${cleanUrl}\n\nPlease check:\n1. The URL is correct (e.g., https://yourstore.com)\n2. There are no typos\n3. The domain exists`
        };
      }
      // Continue with API check even if site check fails
      console.log(`⚠️ Site accessibility check failed, but continuing with API check:`, siteError.message);
    }

    // Try multiple endpoints to verify connection (in order of preference)
    const endpoints = [
      { path: '/wp-json/wc/v3/products?per_page=1', name: 'Products API' },
      { path: '/wp-json/wc/v3/orders?per_page=1', name: 'Orders API' },
      { path: '/wp-json/wc/v3/system_status', name: 'System Status API' },
      { path: '/wp-json/wc/v3', name: 'WooCommerce API Root' },
      { path: '/wp-json/', name: 'WordPress REST API Root' },
    ];
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    let lastError = null;
    let successfulEndpoint = null;
    
    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        const url = `${cleanUrl}${endpoint.path}`;
        console.log(`  Trying ${endpoint.name}: ${url}`);
        
        // Create timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // Check if response is HTML (error page)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const htmlText = await response.text();
          console.log(`⚠️ Received HTML response instead of JSON from ${url}`);
          
          // Check if it's a WordPress site but WooCommerce not installed
          if (htmlText.includes('WordPress') || htmlText.includes('wp-content')) {
            lastError = 'WordPress site detected but WooCommerce API not found. Please ensure:\n1. WooCommerce plugin is installed and activated\n2. REST API is enabled in WooCommerce settings\n3. Permalinks are set to "Post name" or "Custom structure"';
          } else {
            lastError = 'WooCommerce API not found. Please ensure WooCommerce is installed and REST API is enabled.';
          }
          continue; // Try next endpoint
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Invalid credentials';
          
          if (response.status === 401) {
            errorMessage = 'Invalid Consumer Key or Consumer Secret. Please check your WooCommerce API credentials.\n\nTo create API keys:\n1. Go to WooCommerce → Settings → Advanced → REST API\n2. Click "Add key"\n3. Set permissions to "Read/Write"\n4. Copy Consumer Key and Consumer Secret';
          } else if (response.status === 404) {
            // For 404, try next endpoint
            console.log(`  ❌ ${endpoint.name} returned 404, trying next endpoint...`);
            lastError = 'WooCommerce API endpoint not found. Trying alternative endpoints...';
            continue;
          } else if (response.status === 403) {
            errorMessage = 'Access denied. Please check your API key permissions. Make sure the key has "Read" or "Read/Write" permissions.';
          } else {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorData.code || errorMessage;
            } catch (e) {
              errorMessage = `WooCommerce API Error: ${response.status}`;
            }
          }
          
          // Don't set lastError for 404, continue trying
          if (response.status !== 404) {
            lastError = errorMessage;
          }
          continue; // Try next endpoint
        }

        // Success - parse JSON response
        try {
          const data = await response.json();
          console.log(`✅ WooCommerce connection verified successfully using ${endpoint.name}`);
          
          // Even if we get a valid response, make sure it's actually WooCommerce
          // Check if it's WordPress REST API (wp-json/) or WooCommerce (wc/v3)
          if (endpoint.path.includes('wp-json/') && !endpoint.path.includes('wc/v3')) {
            // It's WordPress but might not be WooCommerce - try to verify
            console.log(`⚠️ WordPress REST API found, but need WooCommerce API...`);
            // Continue to try WooCommerce-specific endpoints
            lastError = 'WordPress REST API found but WooCommerce API not accessible. Please ensure WooCommerce plugin is installed and activated.';
            continue;
          }
          
          // Success! We found a working WooCommerce endpoint
          successfulEndpoint = endpoint.name;
          console.log(`✅ WooCommerce connection verified successfully using ${endpoint.name}`);
          return { success: true, store: data, storeUrl: cleanUrl };
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          lastError = 'Invalid response from WooCommerce API. Please check your store URL.';
          continue;
        }
      } catch (fetchError) {
        console.error(`Error trying ${endpoint.name}:`, fetchError.message);
        if (fetchError.name === 'AbortError') {
          lastError = 'Connection timeout. Please check your store URL and internet connection.';
        } else if (fetchError.message.includes('ENOTFOUND') || fetchError.message.includes('getaddrinfo')) {
          lastError = `Store URL not found: ${cleanUrl}\n\nPlease check:\n1. The URL is correct (e.g., https://yourstore.com)\n2. The website is accessible\n3. There are no typos in the URL`;
        } else if (fetchError.message.includes('ECONNREFUSED')) {
          lastError = `Connection refused. Please check if the store URL is correct and the website is running.`;
        } else {
          lastError = fetchError.message;
        }
        // Don't break on network errors for first endpoint, try others
        if (endpoint !== endpoints[0]) {
          continue;
        }
      }
    }
    
    // If all endpoints failed, return detailed error message
    let detailedError = lastError;
    
    if (!detailedError || detailedError.includes('Trying alternative endpoints')) {
      detailedError = 'Failed to connect to WooCommerce store at ' + cleanUrl + '\n\n' +
        '🔍 Troubleshooting Steps:\n\n' +
        '1. ✅ Verify Store URL\n' +
        '   - Make sure URL is complete (e.g., https://backo.great-site.net)\n' +
        '   - Remove any trailing paths or parameters\n' +
        '   - Try accessing the URL in browser first\n\n' +
        '2. ✅ Check WooCommerce Installation\n' +
        '   - Go to WordPress Admin → Plugins\n' +
        '   - Ensure WooCommerce is installed and activated\n' +
        '   - Check WooCommerce → Status → Tools → "Verify base database tables"\n\n' +
        '3. ✅ Enable REST API\n' +
        '   - Go to WooCommerce → Settings → Advanced → REST API\n' +
        '   - Ensure "Legacy REST API" is enabled (if using older WooCommerce)\n' +
        '   - Check that API is accessible at: ' + cleanUrl + '/wp-json/wc/v3\n\n' +
        '4. ✅ Create API Keys\n' +
        '   - Go to WooCommerce → Settings → Advanced → REST API\n' +
        '   - Click "Add key"\n' +
        '   - Description: "BACKO Integration"\n' +
        '   - User: Select an Administrator account\n' +
        '   - Permissions: "Read/Write" (recommended) or "Read"\n' +
        '   - Click "Generate API key"\n' +
        '   - ⚠️ IMPORTANT: Copy Consumer Key and Secret immediately (they won\'t be shown again)\n\n' +
        '5. ✅ Check Permalinks\n' +
        '   - Go to WordPress → Settings → Permalinks\n' +
        '   - Set to "Post name" or any option except "Plain"\n' +
        '   - Click "Save Changes"\n\n' +
        '6. ✅ Test API Manually\n' +
        '   - Try accessing: ' + cleanUrl + '/wp-json/wc/v3/products\n' +
        '   - You should see a JSON response (or authentication prompt)\n' +
        '   - If you see HTML error page, REST API is not enabled\n\n' +
        '7. ✅ Check Server/Firewall\n' +
        '   - Ensure website is accessible\n' +
        '   - Check if any security plugins are blocking REST API\n' +
        '   - Verify .htaccess allows /wp-json/ paths\n\n' +
        '💡 Quick Test:\n' +
        'Open this URL in browser: ' + cleanUrl + '/wp-json/wc/v3/products\n' +
        'If you see JSON data or authentication prompt, API is working.';
    }

    return { success: false, error: detailedError };
  } catch (error) {
    console.error('Error verifying WooCommerce connection:', error);
    
    let errorMessage = 'Failed to connect to WooCommerce';
    if (error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection and store URL.';
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'Store URL not found. Please check your store URL (e.g., https://yourstore.com).';
    } else {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

// Fetch orders from WooCommerce
export const fetchWooCommerceOrders = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const cleanUrl = cleanWooCommerceUrl(storeUrl);
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    let allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${cleanUrl}/wp-json/wc/v3/orders?per_page=100&page=${page}&status=any`;
      
      console.log(`📥 Fetching orders from WooCommerce (page: ${page}): ${url}`);
      
      // Create timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response is HTML
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const htmlText = await response.text();
        throw new Error(`WooCommerce API returned HTML instead of JSON. Please check your store URL and ensure WooCommerce REST API is enabled.`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allOrders = allOrders.concat(data);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1');
      hasMore = page < totalPages;
      page++;
      
      console.log(`✅ Fetched ${data.length} orders (total so far: ${allOrders.length})`);
      
      // Safety limit - don't fetch more than 1000 orders at once
      if (allOrders.length >= 1000) {
        console.log(`⚠️ Reached safety limit of 1000 orders`);
        break;
      }
    }
    
    console.log(`✅ Total orders fetched from WooCommerce: ${allOrders.length}`);
    return allOrders;
  } catch (error) {
    console.error('❌ Error fetching WooCommerce orders:', error);
    throw error;
  }
};

// Fetch products from WooCommerce
export const fetchWooCommerceProducts = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const cleanUrl = cleanWooCommerceUrl(storeUrl);
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    let allProducts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${cleanUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`;
      
      console.log(`📥 Fetching products from WooCommerce (page: ${page})...`);
      
      // Create timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response is HTML
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const htmlText = await response.text();
        throw new Error(`WooCommerce API returned HTML instead of JSON. Please check your store URL and ensure WooCommerce REST API is enabled.`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allProducts = allProducts.concat(data);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1');
      hasMore = page < totalPages;
      page++;
      
      console.log(`✅ Fetched ${data.length} products (total so far: ${allProducts.length})`);
      
      // Safety limit
      if (allProducts.length >= 1000) {
        console.log(`⚠️ Reached safety limit of 1000 products`);
        break;
      }
    }
    
    console.log(`✅ Total products fetched from WooCommerce: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error('❌ Error fetching WooCommerce products:', error);
    throw error;
  }
};

// Fetch customers from WooCommerce
export const fetchWooCommerceCustomers = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const cleanUrl = cleanWooCommerceUrl(storeUrl);
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    let allCustomers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${cleanUrl}/wp-json/wc/v3/customers?per_page=100&page=${page}`;
      
      console.log(`📥 Fetching customers from WooCommerce (page: ${page})...`);
      
      // Create timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response is HTML
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const htmlText = await response.text();
        throw new Error(`WooCommerce API returned HTML instead of JSON. Please check your store URL and ensure WooCommerce REST API is enabled.`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allCustomers = allCustomers.concat(data);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1');
      hasMore = page < totalPages;
      page++;
      
      console.log(`✅ Fetched ${data.length} customers (total so far: ${allCustomers.length})`);
      
      // Safety limit
      if (allCustomers.length >= 1000) {
        console.log(`⚠️ Reached safety limit of 1000 customers`);
        break;
      }
    }
    
    console.log(`✅ Total customers fetched from WooCommerce: ${allCustomers.length}`);
    return allCustomers;
  } catch (error) {
    console.error('❌ Error fetching WooCommerce customers:', error);
    throw error;
  }
};

// Convert WooCommerce order to our format
export const convertWooCommerceOrder = (wcOrder) => {
  return {
    wooCommerceOrderId: wcOrder.id?.toString(),
    orderNumber: wcOrder.number?.toString() || wcOrder.id?.toString() || '',
    customer: {
      name: `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim() || 
             wcOrder.billing?.company || 
             'Guest',
      email: wcOrder.billing?.email || '',
      phone: wcOrder.billing?.phone || '',
    },
    items: (wcOrder.line_items || []).map(item => ({
      productName: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price || 0),
      wooCommerceProductId: item.product_id?.toString(),
      wooCommerceVariationId: item.variation_id?.toString(),
    })),
    amount: parseFloat(wcOrder.total || 0),
    paymentMethod: wcOrder.payment_method_title || 'Unknown',
    status: mapWooCommerceStatusToOurStatus(wcOrder.status),
    placedDate: new Date(wcOrder.date_created),
    deliveredDate: wcOrder.date_completed ? new Date(wcOrder.date_completed) : null,
    shippingAddress: wcOrder.shipping ? {
      street: wcOrder.shipping.address_1 || '',
      city: wcOrder.shipping.city || '',
      state: wcOrder.shipping.state || '',
      zipCode: wcOrder.shipping.postcode || '',
      country: wcOrder.shipping.country || '',
    } : null,
    notes: wcOrder.customer_note || '',
    wooCommerceData: wcOrder, // Store full WooCommerce data for reference
  };
};

// Convert WooCommerce product to our format
export const convertWooCommerceProduct = (wcProduct) => {
  return {
    id: wcProduct.id?.toString(),
    title: wcProduct.name || 'Untitled Product',
    handle: wcProduct.slug || '',
    vendor: '',
    productType: wcProduct.type || 'simple',
    status: wcProduct.status === 'publish' ? 'active' : 'draft',
    tags: wcProduct.tags ? wcProduct.tags.map(t => t.name).join(', ') : '',
    variants: wcProduct.variations && wcProduct.variations.length > 0 
      ? wcProduct.variations.map((variationId, index) => ({
          id: variationId?.toString() || `${wcProduct.id}_${index}`,
          title: wcProduct.variations_data?.[index]?.name || 'Variant',
          price: wcProduct.variations_data?.[index]?.price || wcProduct.price || '0',
          sku: wcProduct.variations_data?.[index]?.sku || wcProduct.sku || '',
          inventoryQuantity: wcProduct.variations_data?.[index]?.stock_quantity || wcProduct.stock_quantity || 0,
          compareAtPrice: wcProduct.variations_data?.[index]?.regular_price || null,
        }))
      : [{
          id: wcProduct.id?.toString(),
          title: 'Default',
          price: wcProduct.price || '0',
          sku: wcProduct.sku || '',
          inventoryQuantity: wcProduct.stock_quantity || 0,
          compareAtPrice: wcProduct.regular_price || null,
        }],
    images: wcProduct.images ? wcProduct.images.map(img => ({
      src: img.src || img.url || '',
      alt: img.alt || wcProduct.name || '',
    })) : [],
    createdAt: wcProduct.date_created || '',
    updatedAt: wcProduct.date_modified || wcProduct.date_created || '',
    price: wcProduct.price || '0',
    sku: wcProduct.sku || '',
    inventoryQuantity: wcProduct.stock_quantity || 0,
  };
};

// Map WooCommerce status to our status
const mapWooCommerceStatusToOurStatus = (wcStatus) => {
  const statusMap = {
    'pending': 'Pending',
    'processing': 'Processing',
    'on-hold': 'Processing',
    'completed': 'Delivered',
    'cancelled': 'Cancelled',
    'refunded': 'Cancelled',
    'failed': 'Cancelled',
  };
  
  return statusMap[wcStatus] || 'Pending';
};

