import User from '../models/User.js';
import { fetchShopifyProducts } from '../services/shopifyService.js';

// @desc    Get all products from Shopify
// @route   GET /api/products
// @access  Private
export const getProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with Shopify credentials
    const user = await User.findById(userId).select('+shopify.accessToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if Shopify is connected
    const isConnected = user.shopify?.isConnected || false;
    const shopDomain = user.shopify?.shopDomain || '';
    const accessToken = user.shopify?.accessToken || '';
    
    if (!isConnected || !shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shopify store not connected. Please connect your Shopify store first in Settings.',
      });
    }

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
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products from Shopify',
    });
  }
};

// @desc    Sync products from Shopify
// @route   POST /api/products/sync
// @access  Private
export const syncProducts = async (req, res) => {
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

    // Fetch products from Shopify
    const shopifyProducts = await fetchShopifyProducts(user.shopify.shopDomain, user.shopify.accessToken);
    
    res.json({
      success: true,
      message: 'Products synced successfully',
      data: {
        count: shopifyProducts.length,
      },
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync products from Shopify',
    });
  }
};

