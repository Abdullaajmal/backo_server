import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

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

    res.json({
      success: true,
      data: {
        storeName: user.storeName,
        storeUrl: user.storeUrl,
        storeLogo: user.storeLogo,
      },
    });
  } catch (error) {
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

