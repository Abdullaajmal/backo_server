import User from '../models/User.js';
import Product from '../models/Product.js';
import { fetchShopifyProducts } from '../services/shopifyService.js';
import { fetchWooCommerceProducts, convertWooCommerceProduct } from '../services/woocommerceService.js';

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

// @desc    Get all products from WooCommerce or Shopify
// @route   GET /api/products
// @access  Private
export const getProducts = async (req, res) => {
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
    
    // Fetch from WooCommerce if connected
    if (isWooCommerceConnected) {
      return await getWooCommerceProducts(req, res, user);
    }
    
    // Otherwise fetch from Shopify if connected
    if (isShopifyConnected) {
      return await getShopifyProducts(req, res, user);
    }
    
    // No store connected
    return res.status(400).json({
      success: false,
      message: 'No store connected. Please connect your WooCommerce or Shopify store first in Settings.',
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products',
    });
  }
};

// Helper function to get WooCommerce products
const getWooCommerceProducts = async (req, res, user) => {
  try {
    // Always fetch directly from WooCommerce API - Consumer Key/Secret required
    if (!user.wooCommerce.consumerKey || !user.wooCommerce.consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'WooCommerce API credentials not found. Please connect using Consumer Key and Secret to fetch products directly from WordPress.',
      });
    }
    
    // Fetch products from WooCommerce API
    console.log(`🔄 Fetching products from WooCommerce API (${user.wooCommerce.storeUrl})...`);
    const wcProducts = await fetchWooCommerceProducts(
      user.wooCommerce.storeUrl,
      user.wooCommerce.consumerKey,
      user.wooCommerce.consumerSecret
    );
    console.log(`📦 Fetched ${wcProducts.length} products from WooCommerce API`);
    
    // Format products for frontend
    const formattedProducts = wcProducts.map(product => {
      const converted = convertWooCommerceProduct(product);
      return {
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
      };
    });

    res.json({
      success: true,
      data: formattedProducts,
      count: formattedProducts.length,
      source: 'woocommerce_api',
    });
  } catch (error) {
    console.error('Error fetching WooCommerce products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products from WooCommerce',
    });
  }
};

// Helper function to get Shopify products
const getShopifyProducts = async (req, res, user) => {
  try {
    // Fetch products from Shopify
    console.log(`🔄 Fetching products from Shopify (${user.shopify.shopDomain})...`);
    const shopifyProducts = await fetchShopifyProducts(user.shopify.shopDomain, user.shopify.accessToken);
    console.log(`📦 Fetched ${shopifyProducts.length} products from Shopify`);
    
    // Format products for frontend
    const formattedProducts = shopifyProducts.map(product => ({
      id: product.id?.toString(),
      title: product.title,
      handle: product.handle,
      vendor: product.vendor || '',
      productType: product.product_type || '',
      status: product.status,
      tags: product.tags || '',
      variants: (product.variants || []).map(variant => ({
        id: variant.id?.toString(),
        title: variant.title,
        price: variant.price,
        sku: variant.sku || '',
        inventoryQuantity: variant.inventory_quantity || 0,
        compareAtPrice: variant.compare_at_price || null,
      })),
      images: (product.images || []).map(image => ({
        src: image.src,
        alt: image.alt || product.title,
      })),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    }));

    res.json({
      success: true,
      data: formattedProducts,
      count: formattedProducts.length,
    });
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products from Shopify',
    });
  }
};

// @desc    Sync products from WooCommerce or Shopify
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

