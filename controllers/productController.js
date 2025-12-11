import User from '../models/User.js';
import Product from '../models/Product.js';
import { fetchWooCommerceProducts, convertWooCommerceProduct } from '../services/woocommerceService.js';
import { fetchShopifyProducts, convertShopifyProduct } from '../services/shopifyService.js';

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

// @desc    Get all products from Shopify or WooCommerce (API + Database)
// @route   GET /api/products
// @access  Private
export const getProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with integration credentials (including Shopify and WooCommerce)
    const user = await User.findById(userId).select('+shopify.accessToken +wooCommerce.consumerKey +wooCommerce.consumerSecret +wooCommerce.secretKey');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

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
      return await getShopifyProducts(req, res, user);
    }
    
    // Otherwise try WooCommerce if connected
    if (isWooCommerceConnected) {
      return await getWooCommerceProducts(req, res, user);
    }
    
    // No store connected
    return res.status(400).json({
      success: false,
      message: 'No store connected. Please connect your Shopify or WooCommerce store first in Settings.',
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products',
    });
  }
};

// Helper function to get Shopify products (from API + Database)
const getShopifyProducts = async (req, res, user) => {
  try {
    let apiProducts = [];
    let dbProducts = [];
    
    // Fetch from Shopify API
    try {
      console.log(`🔄 Fetching products from Shopify API (${user.shopify.shopDomain})...`);
      const shopifyProducts = await fetchShopifyProducts(
        user.shopify.shopDomain,
        user.shopify.accessToken
      );
      console.log(`📦 Fetched ${shopifyProducts.length} products from Shopify API`);
      
      // Format API products AND save to database
      apiProducts = [];
      for (const shopifyProduct of shopifyProducts) {
        const converted = convertShopifyProduct(shopifyProduct);
        
        // Save to database (only real Shopify products)
        try {
          const productData = {
            userId: user._id,
            shopifyProductId: converted.id,
            productId: converted.id,
            name: converted.title || 'Untitled Product',
            sku: converted.sku || '',
            price: parseFloat(converted.price || 0),
            stockQuantity: converted.inventoryQuantity || 0,
            status: converted.status === 'active' ? 'publish' : 'draft',
            description: '',
            images: converted.images || [],
            categories: [],
            tags: converted.tags ? converted.tags.split(', ').filter(t => t) : [],
            lastSyncedAt: new Date(),
          };
          
          // Check if product already exists
          const existingProduct = await Product.findOne({
            userId: user._id,
            $or: [
              { shopifyProductId: converted.id },
              { productId: converted.id }
            ]
          });
          
          if (existingProduct) {
            // Update existing product
            await Product.findByIdAndUpdate(existingProduct._id, productData, { new: true });
            console.log(`  ✅ Updated product in DB: ${productData.name} (ID: ${converted.id})`);
          } else {
            // Create new product
            await Product.create(productData);
            console.log(`  ✅ Saved new product to DB: ${productData.name} (ID: ${converted.id})`);
          }
        } catch (dbError) {
          console.error(`  ⚠️ Error saving product ${converted.id} to DB:`, dbError.message);
        }
        
        // Format for response
        apiProducts.push({
          id: converted.id,
          title: converted.title,
          handle: converted.handle,
          vendor: converted.vendor,
          productType: converted.productType,
          status: converted.status,
          tags: converted.tags,
          variants: converted.variants,
          images: converted.images,
          createdAt: converted.createdAt,
          updatedAt: converted.updatedAt,
          price: converted.price,
          sku: converted.sku,
          inventoryQuantity: converted.inventoryQuantity,
          source: 'api',
        });
      }
    } catch (apiError) {
      console.error('⚠️ Error fetching from Shopify API:', apiError.message);
      // If it's a 401/403 error, return helpful message
      if (apiError.message && (apiError.message.includes('401') || apiError.message.includes('403'))) {
        return res.status(401).json({
          success: false,
          message: apiError.message || 'Shopify API authentication failed. Please check your access token in Settings.',
        });
      }
      // For other errors, continue with DB fetch
      console.log('⚠️ Continuing with database data only due to API error');
    }
    
    // Fetch from Database (synced products)
    try {
      console.log(`🔄 Fetching products from Database (userId: ${user._id})...`);
      const dbProductsData = await Product.find({ 
        userId: user._id,
        shopifyProductId: { $exists: true, $ne: null, $ne: '' } // Only Shopify products
      });
      console.log(`📦 Fetched ${dbProductsData.length} products from Database`);
      
      // Format DB products
      dbProducts = dbProductsData.map(product => ({
        id: product.shopifyProductId || product.productId || product._id.toString(),
        title: product.name || 'Untitled Product',
        handle: product.sku || '',
        vendor: '',
        productType: 'simple',
        status: product.status === 'publish' ? 'active' : 'draft',
        tags: (product.tags || []).join(', '),
        variants: [{
          id: product.shopifyProductId || product.productId || product._id.toString(),
          title: 'Default',
          price: product.price?.toString() || '0',
          sku: product.sku || '',
          inventoryQuantity: product.stockQuantity || 0,
          compareAtPrice: null,
        }],
        images: product.images || [],
        createdAt: product.lastSyncedAt || product.createdAt || new Date().toISOString(),
        updatedAt: product.lastSyncedAt || product.updatedAt || new Date().toISOString(),
        price: product.price?.toString() || '0',
        sku: product.sku || '',
        inventoryQuantity: product.stockQuantity || 0,
        source: 'database',
      }));
    } catch (dbError) {
      console.error('⚠️ Error fetching from Database:', dbError.message);
    }
    
    // Merge products - API products take priority, then add unique DB products
    const productMap = new Map();
    
    // Add API products first
    apiProducts.forEach(product => {
      productMap.set(product.id, product);
    });
    
    // Add DB products that don't exist in API
    dbProducts.forEach(product => {
      if (!productMap.has(product.id)) {
        productMap.set(product.id, product);
      }
    });
    
    const allProducts = Array.from(productMap.values());
    
    console.log(`✅ Total products: ${allProducts.length} (${apiProducts.length} from API, ${dbProducts.length} from DB)`);
    
    res.json({
      success: true,
      data: allProducts,
      count: allProducts.length,
      source: 'shopify_api_and_db',
      stats: {
        fromApi: apiProducts.length,
        fromDb: dbProducts.length,
        total: allProducts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products from Shopify',
    });
  }
};

// Helper function to get WooCommerce products (from API + Database)
const getWooCommerceProducts = async (req, res, user) => {
  try {
    let apiProducts = [];
    let dbProducts = [];
    
    // Fetch from WooCommerce API if credentials available
    if (user.wooCommerce.consumerKey && user.wooCommerce.consumerSecret) {
      try {
        console.log(`🔄 Fetching products from WooCommerce API (${user.wooCommerce.storeUrl})...`);
        const wcProducts = await fetchWooCommerceProducts(
          user.wooCommerce.storeUrl,
          user.wooCommerce.consumerKey,
          user.wooCommerce.consumerSecret
        );
        console.log(`📦 Fetched ${wcProducts.length} products from WooCommerce API`);
        
        // Format API products AND save to database
        apiProducts = [];
        for (const wcProduct of wcProducts) {
          const converted = convertWooCommerceProduct(wcProduct);
          
          // Save to database (only real WooCommerce products)
          try {
            const productData = {
              userId: user._id,
              wooCommerceProductId: converted.id,
              productId: converted.id,
              name: converted.title || 'Untitled Product',
              sku: converted.sku || '',
              price: parseFloat(converted.price || 0),
              stockQuantity: converted.inventoryQuantity || 0,
              status: converted.status === 'active' ? 'publish' : converted.status || 'publish',
              description: '',
              images: converted.images || [],
              categories: [],
              tags: converted.tags ? converted.tags.split(', ').filter(t => t) : [],
              lastSyncedAt: new Date(),
            };
            
            // Check if product already exists
            const existingProduct = await Product.findOne({
              userId: user._id,
              $or: [
                { wooCommerceProductId: converted.id },
                { productId: converted.id }
              ]
            });
            
            if (existingProduct) {
              // Update existing product
              await Product.findByIdAndUpdate(existingProduct._id, productData, { new: true });
              console.log(`  ✅ Updated product in DB: ${productData.name} (ID: ${converted.id})`);
            } else {
              // Create new product
              await Product.create(productData);
              console.log(`  ✅ Saved new product to DB: ${productData.name} (ID: ${converted.id})`);
            }
          } catch (dbError) {
            console.error(`  ⚠️ Error saving product ${converted.id} to DB:`, dbError.message);
          }
          
          // Format for response
          apiProducts.push({
            id: converted.id,
            title: converted.title,
            handle: converted.handle,
            vendor: converted.vendor,
            productType: converted.productType,
            status: converted.status,
            tags: converted.tags,
            variants: converted.variants,
            images: converted.images,
            createdAt: converted.createdAt,
            updatedAt: converted.updatedAt,
            price: converted.price,
            sku: converted.sku,
            inventoryQuantity: converted.inventoryQuantity,
            source: 'api',
          });
        }
      } catch (apiError) {
        console.error('⚠️ Error fetching from WooCommerce API:', apiError.message);
        // If it's a 401 error, return helpful message
        if (apiError.message && apiError.message.includes('401')) {
          return res.status(401).json({
            success: false,
            message: apiError.message || 'WooCommerce API authentication failed. Please check your API credentials in Settings.',
          });
        }
        // For other errors, continue with DB fetch
        console.log('⚠️ Continuing with database data only due to API error');
      }
    }
    
    // Fetch from Database (webhook synced products)
    try {
      console.log(`🔄 Fetching products from Database (userId: ${user._id})...`);
      const dbProductsData = await Product.find({ userId: user._id });
      console.log(`📦 Fetched ${dbProductsData.length} products from Database`);
      
      // Format DB products
      dbProducts = dbProductsData.map(product => ({
        id: product.wooCommerceProductId || product.productId || product._id.toString(),
        title: product.name || 'Untitled Product',
        handle: product.sku || '',
        vendor: '',
        productType: 'simple',
        status: product.status === 'publish' ? 'active' : 'draft',
        tags: (product.tags || []).join(', '),
        variants: [{
          id: product.wooCommerceProductId || product.productId || product._id.toString(),
          title: 'Default',
          price: product.price?.toString() || '0',
          sku: product.sku || '',
          inventoryQuantity: product.stockQuantity || 0,
          compareAtPrice: null,
        }],
        images: product.images || [],
        createdAt: product.lastSyncedAt || product.createdAt || new Date().toISOString(),
        updatedAt: product.lastSyncedAt || product.updatedAt || new Date().toISOString(),
        price: product.price?.toString() || '0',
        sku: product.sku || '',
        inventoryQuantity: product.stockQuantity || 0,
        source: 'database',
      }));
    } catch (dbError) {
      console.error('⚠️ Error fetching from Database:', dbError.message);
    }
    
    // Merge products - API products take priority, then add unique DB products
    const productMap = new Map();
    
    // Add API products first
    apiProducts.forEach(product => {
      productMap.set(product.id, product);
    });
    
    // Add DB products that don't exist in API
    dbProducts.forEach(product => {
      if (!productMap.has(product.id)) {
        productMap.set(product.id, product);
      }
    });
    
    const allProducts = Array.from(productMap.values());
    
    console.log(`✅ Total products: ${allProducts.length} (${apiProducts.length} from API, ${dbProducts.length} from DB)`);
    
    res.json({
      success: true,
      data: allProducts,
      count: allProducts.length,
      source: 'woocommerce_api_and_db',
      stats: {
        fromApi: apiProducts.length,
        fromDb: dbProducts.length,
        total: allProducts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching WooCommerce products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products from WooCommerce',
    });
  }
};

// @desc    Sync products from WooCommerce
// @route   POST /api/products/sync
// @access  Private
export const syncProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with integration credentials (including secret key for portal method)
    const user = await User.findById(userId).select('+shopify.accessToken +wooCommerce.consumerKey +wooCommerce.consumerSecret +wooCommerce.secretKey');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if WooCommerce is connected (priority)
    // Support both methods: API (consumerKey/Secret) or Portal (secretKey)
    const isWooCommerceConnected = user?.wooCommerce?.isConnected && 
                                   user.wooCommerce.storeUrl &&
                                   ((user.wooCommerce.consumerKey && user.wooCommerce.consumerSecret) || 
                                    user.wooCommerce.secretKey);
    
    // Check if Shopify is connected
    const isShopifyConnected = user?.shopify?.isConnected && 
                               user.shopify.shopDomain && 
                               user.shopify.accessToken;
    
    // Sync from WooCommerce if connected
    if (isWooCommerceConnected) {
      // Check if using portal method (secretKey) or API method (consumerKey/Secret)
      if (user.wooCommerce.secretKey && !user.wooCommerce.consumerKey) {
        // Portal method - products come from plugin, not directly from WooCommerce API
        return res.json({
          success: true,
          message: 'WooCommerce connected via portal method. Products will sync automatically from your WordPress plugin when they are created or updated.',
          data: {
            count: 0,
            note: 'Products are synced automatically via WordPress plugin. No manual sync needed.'
          },
        });
      }
      
      // API method - fetch products directly from WooCommerce
      if (!user.wooCommerce.consumerKey || !user.wooCommerce.consumerSecret) {
        return res.status(400).json({
          success: false,
          message: 'WooCommerce API credentials not found. Please reconnect using Consumer Key and Secret.',
        });
      }
      
      const wcProducts = await fetchWooCommerceProducts(
        user.wooCommerce.storeUrl,
        user.wooCommerce.consumerKey,
        user.wooCommerce.consumerSecret
      );
      
      return res.json({
        success: true,
        message: 'Products synced successfully from WooCommerce',
        data: {
          count: wcProducts.length,
        },
      });
    }
    
    // Otherwise sync from Shopify if connected
    if (isShopifyConnected) {
      const shopifyProducts = await fetchShopifyProducts(user.shopify.shopDomain, user.shopify.accessToken);
      
      return res.json({
        success: true,
        message: 'Products synced successfully from Shopify',
        data: {
          count: shopifyProducts.length,
        },
      });
    }
    
    // No store connected
    return res.status(400).json({
      success: false,
      message: 'No store connected. Please connect your WooCommerce or Shopify store first.',
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync products',
    });
  }
};

// @desc    Sync product from WooCommerce plugin
// @route   POST /api/products/sync-from-plugin
// @access  Public (with secret key)
export const syncProductFromPlugin = async (req, res) => {
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

    const { product_id, name, sku, price, stock_quantity, status, description, images, categories, tags } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    // Store product in database
    const productData = {
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
      await Product.findByIdAndUpdate(existingProduct._id, productData, { new: true });
      action = 'updated';
      console.log(`📦 Product updated from plugin: ${name} (ID: ${product_id})`);
    } else {
      // Create new product
      await Product.create(productData);
      console.log(`📦 Product synced from plugin: ${name} (ID: ${product_id})`);
    }

    res.json({
      success: true,
      message: 'Product synced successfully',
      data: {
        productId: product_id,
        name: name,
        action: action,
      },
    });
  } catch (error) {
    console.error('Error syncing product from plugin:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

