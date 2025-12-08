import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';
<<<<<<< HEAD
import { verifyShopifyConnection } from '../services/shopifyService.js';
=======
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Setup store information
// @route   POST /api/store/setup
// @access  Private
export const setupStore = async (req, res) => {
  try {
    const { storeName, storeUrl } = req.body;
    const userId = req.user._id;

    // Check if user exists
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update store information
    // Don't set isStoreSetup to true yet - wait until step 3 (branding) is complete
    const updateData = {
      storeName,
      storeUrl,
      // isStoreSetup will be set to true in step 3 (branding customization)
    };

    // Add logo path if file was uploaded
    if (req.file) {
      updateData.storeLogo = `/uploads/${req.file.filename}`;
    }

    user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        storeName: user.storeName,
        storeUrl: user.storeUrl,
        storeLogo: user.storeLogo,
        isStoreSetup: user.isStoreSetup,
      },
      message: 'Store setup completed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get store information
// @route   GET /api/store
// @access  Private
export const getStore = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        storeName: user.storeName,
        storeUrl: user.storeUrl,
        storeLogo: user.storeLogo,
        isStoreSetup: user.isStoreSetup,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update store information
// @route   PUT /api/store
// @access  Private
export const updateStore = async (req, res) => {
  try {
    const { storeName, storeUrl } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (storeName) updateData.storeName = storeName;
    if (storeUrl) updateData.storeUrl = storeUrl;

    // Add logo path if new file was uploaded
    if (req.file) {
      updateData.storeLogo = `/uploads/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: {
        storeName: user.storeName,
        storeUrl: user.storeUrl,
        storeLogo: user.storeLogo,
      },
      message: 'Store updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update return policy settings
// @route   PUT /api/store/return-policy
// @access  Private
export const updateReturnPolicy = async (req, res) => {
  try {
    const { returnWindow, refundMethods } = req.body;
    const userId = req.user._id;

    // Check if user exists
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update return policy
    const updateData = {};
    if (returnWindow !== undefined) {
      updateData['returnPolicy.returnWindow'] = returnWindow;
    }
    if (refundMethods) {
      if (refundMethods.bankTransfer !== undefined) {
        updateData['returnPolicy.refundMethods.bankTransfer'] = refundMethods.bankTransfer;
      }
      if (refundMethods.digitalWallet !== undefined) {
        updateData['returnPolicy.refundMethods.digitalWallet'] = refundMethods.digitalWallet;
      }
      if (refundMethods.storeCredit !== undefined) {
        updateData['returnPolicy.refundMethods.storeCredit'] = refundMethods.storeCredit;
      }
    }

    user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: {
        returnPolicy: user.returnPolicy,
      },
      message: 'Return policy updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get store information by store URL (Public)
// @route   GET /api/public/store/:storeUrl
// @access  Public
export const getStoreByUrl = async (req, res) => {
  try {
<<<<<<< HEAD
    // Handle storeUrl from different sources
    // 1. From middleware (if using wildcard route)
    // 2. From req.params.storeUrl (if using named parameter)
    // 3. From req.params[0] (if using positional parameter)
    let storeUrl = req.storeUrlParam || req.params.storeUrl || req.params[0];
    
    // If storeUrl is array (multiple path segments), join them
    if (Array.isArray(storeUrl)) {
      storeUrl = storeUrl.join('/');
    }
    
    // If still not found, extract from path or originalUrl
    if (!storeUrl) {
      // Try req.path (relative to router mount point)
      let match = req.path.match(/\/public\/store\/(.+)$/);
      if (match) {
        storeUrl = match[1];
      } else {
        // Try req.originalUrl (full path from app root)
        match = req.originalUrl.match(/\/public\/store\/(.+)$/);
        if (match) {
          storeUrl = match[1];
        }
      }
    }
    
    if (!storeUrl) {
      console.error('❌ No store URL found in request');
      console.error('   req.path:', req.path);
      console.error('   req.params:', req.params);
      return res.status(400).json({
        success: false,
        message: 'Store URL is required',
      });
    }
    
    // Decode URL if encoded
    try {
      storeUrl = decodeURIComponent(storeUrl);
    } catch (e) {
      // If decode fails, use as is
      console.warn('⚠️ URL decode failed, using raw URL:', storeUrl);
    }
    
    console.log('📥 Received store lookup request for:', storeUrl);
    
    console.log('🔍 Searching for store with URL:', storeUrl);

    // Normalize function to extract clean domain
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.trim().toLowerCase();
        // Remove protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        // Remove www
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        // Remove path if any
        normalized = normalized.split('/')[0];
        return normalized;
      } catch (e) {
        return url.toLowerCase();
      }
    };

    const normalizedRequestedUrl = normalizeUrl(storeUrl);
    console.log('🔍 Searching for store with URL:', storeUrl);
    console.log('🔍 Normalized requested URL:', normalizedRequestedUrl);

    // Try multiple variations for exact match
    let user = null;
    const searchVariations = [
      storeUrl, // Original
      storeUrl.includes('://') ? storeUrl.replace(/^https?:\/\//, '') : `https://${storeUrl}`, // Without/With protocol
      storeUrl.includes('://') ? storeUrl.replace(/^https:\/\//, 'http://') : storeUrl.replace(/^http:\/\//, 'https://'), // HTTP/HTTPS swap
      normalizedRequestedUrl, // Normalized
      `https://${normalizedRequestedUrl}`, // Normalized with https
      `http://${normalizedRequestedUrl}`, // Normalized with http
    ];
    
    // Remove duplicates
    const uniqueVariations = [...new Set(searchVariations)];
    
    for (const variation of uniqueVariations) {
      // Try with isStoreSetup first, then without if Shopify connected
      user = await User.findOne({ 
        $or: [
          { storeUrl: variation, isStoreSetup: true },
          { storeUrl: variation, 'shopify.isConnected': true }
        ]
      });
      if (user) {
        console.log(`✅ Found user by exact match (variation: ${variation}):`, user.storeName);
        break;
      }
    }
    
    // Also try matching normalized URLs in database
    if (!user) {
      console.log('❌ No exact match found, searching by normalized URL...');
      
      // If not found, try to match by normalized domain (allow Shopify connected users too)
      const allUsers = await User.find({ 
        $or: [
          { isStoreSetup: true },
          { 'shopify.isConnected': true }
        ]
      });
      console.log(`📋 Found ${allUsers.length} users with store setup or Shopify connected`);
      
      for (const u of allUsers) {
        // Check storeUrl
        if (u.storeUrl) {
          const normalizedStoredUrl = normalizeUrl(u.storeUrl);
          console.log(`  - Checking storeUrl: ${u.storeUrl} → ${normalizedStoredUrl}`);
          
          if (normalizedStoredUrl === normalizedRequestedUrl) {
            console.log(`✅ Match found by normalized storeUrl! Store: ${u.storeName}`);
            user = u;
            break;
          }
        }
        
        // Also check Shopify shopDomain
        if (u.shopify?.shopDomain) {
          const normalizedShopDomain = normalizeUrl(u.shopify.shopDomain);
          console.log(`  - Checking shopDomain: ${u.shopify.shopDomain} → ${normalizedShopDomain}`);
          
          if (normalizedShopDomain === normalizedRequestedUrl) {
            console.log(`✅ Match found by Shopify shopDomain! Store: ${u.storeName || u.email}`);
            user = u;
            break;
=======
    let { storeUrl } = req.params;
    storeUrl = decodeURIComponent(storeUrl);

    // Try to find user by exact storeUrl match first
    let user = await User.findOne({ storeUrl });

    // If not found, try to match by domain (extract domain from storeUrl if it's a full URL)
    if (!user) {
      // Extract domain from stored storeUrl in database
      const allUsers = await User.find({ isStoreSetup: true });
      for (const u of allUsers) {
        if (u.storeUrl) {
          let storedUrl = u.storeUrl;
          try {
            // Extract domain from stored URL
            if (storedUrl.includes('://')) {
              const urlObj = new URL(storedUrl);
              storedUrl = urlObj.hostname.replace('www.', '');
            } else {
              storedUrl = storedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
            }
            
            // Extract domain from requested URL
            let requestedUrl = storeUrl;
            if (requestedUrl.includes('://')) {
              const urlObj2 = new URL(requestedUrl);
              requestedUrl = urlObj2.hostname.replace('www.', '');
            } else {
              requestedUrl = requestedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
            }
            
            // Compare domains
            if (storedUrl.toLowerCase() === requestedUrl.toLowerCase()) {
              user = u;
              break;
            }
          } catch (e) {
            // If URL parsing fails, try direct match
            if (storedUrl.toLowerCase().includes(storeUrl.toLowerCase()) || 
                storeUrl.toLowerCase().includes(storedUrl.toLowerCase())) {
              user = u;
              break;
            }
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
          }
        }
      }
    }

<<<<<<< HEAD
    // If still not found, try matching by Shopify shopDomain
    if (!user) {
      console.log('❌ No match by storeUrl, trying Shopify shopDomain...');
      
      // Extract shop domain from requested URL (for myshopify.com domains)
      let shopDomainMatch = null;
      if (normalizedRequestedUrl.includes('.myshopify.com')) {
        shopDomainMatch = normalizedRequestedUrl;
      } else if (normalizedRequestedUrl.includes('merchant-')) {
        // If it's just the merchant ID, add .myshopify.com
        shopDomainMatch = `${normalizedRequestedUrl}.myshopify.com`;
      }
      
      if (shopDomainMatch) {
        // Find user by Shopify shopDomain
        const allUsers = await User.find({ 
          'shopify.isConnected': true,
          'shopify.shopDomain': shopDomainMatch 
        }).select('+shopify.shopDomain');
        
        console.log(`🔍 Searching for shopDomain: ${shopDomainMatch}, found ${allUsers.length} users`);
        
        // Try exact match first
        user = allUsers.find(u => {
          const userShopDomain = u.shopify?.shopDomain?.toLowerCase();
          return userShopDomain === shopDomainMatch.toLowerCase();
        });
        
        // If exact match not found, try partial match
        if (!user && shopDomainMatch.includes('.myshopify.com')) {
          const shopDomainWithoutSuffix = shopDomainMatch.replace('.myshopify.com', '');
          user = allUsers.find(u => {
            const userShopDomain = u.shopify?.shopDomain?.toLowerCase();
            return userShopDomain?.replace('.myshopify.com', '') === shopDomainWithoutSuffix;
          });
        }
        
        if (user) {
          console.log(`✅ Found user by Shopify shopDomain: ${user.storeName || user.email}`);
          
          // If user doesn't have storeUrl set, use shopDomain as fallback
          if (!user.storeUrl && user.shopify?.shopDomain) {
            user.storeUrl = user.shopify.shopDomain;
          }
          
          // If user doesn't have storeName set, generate from shopDomain
          if (!user.storeName && user.shopify?.shopDomain) {
            const shopName = user.shopify.shopDomain
              .replace('.myshopify.com', '')
              .replace(/-/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase());
            user.storeName = shopName;
          }
        }
      }
    }

    // Allow access if user has Shopify connected, even if isStoreSetup is false
    if (!user) {
      console.log('❌ Store not found');
      console.log('   Requested URL:', storeUrl);
      console.log('   Normalized URL:', normalizedRequestedUrl);
      
      // Try one more time - find any user with Shopify connected that might match
      const allShopifyUsers = await User.find({ 
        'shopify.isConnected': true 
      }).select('+shopify.shopDomain');
      
      console.log(`🔍 Total Shopify connected users: ${allShopifyUsers.length}`);
      for (const u of allShopifyUsers) {
        console.log(`   - User: ${u.email}, shopDomain: ${u.shopify?.shopDomain}, storeUrl: ${u.storeUrl}`);
      }
      
=======
    if (!user || !user.isStoreSetup) {
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }
<<<<<<< HEAD
    
    // If user found but Shopify is connected, allow access even if isStoreSetup is false
    if (!user.isStoreSetup && !user.shopify?.isConnected) {
      console.log('⚠️ User found but store setup incomplete and Shopify not connected');
      return res.status(404).json({
        success: false,
        message: 'Store setup incomplete. Please complete store setup first.',
      });
    }
    
    // Ensure storeUrl and storeName are set (use shopDomain as fallback)
    if (user.shopify?.isConnected && user.shopify.shopDomain) {
      // If storeUrl is not set, use shopDomain
      if (!user.storeUrl) {
        user.storeUrl = user.shopify.shopDomain;
        console.log(`📝 Using shopDomain as storeUrl: ${user.storeUrl}`);
      }
      
      // If storeName is not set, generate from shopDomain
      if (!user.storeName) {
        const shopName = user.shopify.shopDomain
          .replace('.myshopify.com', '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        user.storeName = shopName;
        console.log(`📝 Generated storeName from shopDomain: ${user.storeName}`);
      }
    }

    // Prepare store info response
    const storeInfo = {
      storeName: user.storeName || user.shopify?.shopDomain?.replace('.myshopify.com', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Store',
      storeUrl: user.storeUrl || user.shopify?.shopDomain || '',
      storeLogo: user.storeLogo || null,
    };
    
    console.log(`✅ Returning store info for: ${storeInfo.storeName}`);
    console.log(`   Store URL: ${storeInfo.storeUrl}`);
    console.log(`   Shopify Connected: ${user.shopify?.isConnected || false}`);
    
    res.json({
      success: true,
      data: storeInfo,
    });
  } catch (error) {
    console.error('❌ Error in getStoreByUrl:', error);
=======

    res.json({
      success: true,
      data: {
        storeName: user.storeName,
        storeUrl: user.storeUrl,
        storeLogo: user.storeLogo,
      },
    });
  } catch (error) {
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update branding settings
// @route   PUT /api/store/branding
// @access  Private
export const updateBranding = async (req, res) => {
  try {
    const { primaryColor } = req.body;
    const userId = req.user._id;

    // Check if user exists
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate color format
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color format. Please use hex format (e.g., #FF7F14)',
      });
    }

    // Update branding
    const updateData = {};
    if (primaryColor !== undefined) {
      updateData['branding.primaryColor'] = primaryColor;
    }
    
    // Set isStoreSetup to true only after step 3 (branding) is complete
    updateData.isStoreSetup = true;

    user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: {
        branding: user.branding,
      },
      message: 'Branding updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

<<<<<<< HEAD
// @desc    Connect Shopify store
// @route   POST /api/store/shopify/connect
// @access  Private
export const connectShopify = async (req, res) => {
  try {
    const { shopDomain, accessToken, apiKey, apiSecretKey } = req.body;
    const userId = req.user._id;

    if (!shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shop domain and access token are required',
      });
    }

    // Clean shop domain (remove https://, www., etc.)
    let cleanDomain = shopDomain.trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
    cleanDomain = cleanDomain.replace(/^www\./, '');
    cleanDomain = cleanDomain.replace(/\/$/, '');
    
    // If domain doesn't contain .myshopify.com, add it
    if (!cleanDomain.includes('.myshopify.com') && !cleanDomain.includes('.')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    // Verify Shopify connection
    const verification = await verifyShopifyConnection(cleanDomain, accessToken);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.error || 'Failed to connect to Shopify. Please check your credentials.',
      });
    }

    // Update user with Shopify credentials
    const updateData = {
      'shopify.shopDomain': cleanDomain,
      'shopify.accessToken': accessToken,
      'shopify.isConnected': true,
    };

    if (apiKey) {
      updateData['shopify.apiKey'] = apiKey;
    }
    if (apiSecretKey) {
      updateData['shopify.apiSecretKey'] = apiSecretKey;
    }

    const user = await User.findByIdAndUpdate(
      userId, 
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        upsert: false
      }
    ).select('+shopify.accessToken');

    // Verify update was successful
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Double-check the connection was saved
    if (!user.shopify || !user.shopify.isConnected) {
      console.error('Shopify connection not saved properly', user);
      return res.status(500).json({
        success: false,
        message: 'Failed to save Shopify connection',
      });
    }

    res.json({
      success: true,
      data: {
        shopify: {
          shopDomain: user.shopify?.shopDomain || cleanDomain,
          isConnected: user.shopify?.isConnected || true,
        },
      },
      message: 'Shopify store connected successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get Shopify connection status
// @route   GET /api/store/shopify/status
// @access  Private
export const getShopifyStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+shopify.accessToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isConnected = user.shopify?.isConnected || false;
    const shopDomain = user.shopify?.shopDomain || '';
    const accessToken = user.shopify?.accessToken || '';
    
    let connectionStatus = { 
      isConnected,
      shopDomain: shopDomain || ''
    };

    // Only verify if we have credentials - skip verification to avoid blocking
    if (isConnected && shopDomain && accessToken) {
      // Don't verify on every status check - just return stored status
      // Verification will happen on actual API calls (orders, products)
      connectionStatus = {
        isConnected: true,
        shopDomain: shopDomain,
      };
    } else {
      // If not connected, make sure to set isConnected to false
      connectionStatus = {
        isConnected: false,
        shopDomain: '',
      };
    }

    res.json({
      success: true,
      data: connectionStatus,
    });
  } catch (error) {
    console.error('Error getting Shopify status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

=======
>>>>>>> 84b8af3b1d14e60aac12946624e4d1c4ca9031fb
