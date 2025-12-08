import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res) => {
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
        returnWindow: user.returnPolicy?.returnWindow || 30,
        automaticApprovalThreshold: user.returnPolicy?.automaticApprovalThreshold || 50,
        refundMethods: user.returnPolicy?.refundMethods || {
          bankTransfer: true,
          digitalWallet: true,
          storeCredit: true,
        },
        primaryColor: user.branding?.primaryColor || '#FF9724',
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

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private
export const updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { returnWindow, automaticApprovalThreshold, refundMethods, primaryColor } = req.body;

    // Check if user exists
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Parse refundMethods if it's a string
    let parsedRefundMethods = refundMethods;
    if (typeof refundMethods === 'string') {
      try {
        parsedRefundMethods = JSON.parse(refundMethods);
      } catch (e) {
        parsedRefundMethods = {
          bankTransfer: true,
          digitalWallet: true,
          storeCredit: true,
        };
      }
    }

    // Update settings
    const updateData = {};
    
    if (returnWindow !== undefined) {
      updateData['returnPolicy.returnWindow'] = parseInt(returnWindow);
    }
    
    if (automaticApprovalThreshold !== undefined) {
      updateData['returnPolicy.automaticApprovalThreshold'] = parseInt(automaticApprovalThreshold);
    }
    
    if (parsedRefundMethods) {
      if (parsedRefundMethods.bankTransfer !== undefined) {
        updateData['returnPolicy.refundMethods.bankTransfer'] = parsedRefundMethods.bankTransfer;
      }
      if (parsedRefundMethods.digitalWallets !== undefined) {
        updateData['returnPolicy.refundMethods.digitalWallet'] = parsedRefundMethods.digitalWallets;
      }
      if (parsedRefundMethods.storeCredit !== undefined) {
        updateData['returnPolicy.refundMethods.storeCredit'] = parsedRefundMethods.storeCredit;
      }
    }
    
    if (primaryColor !== undefined) {
      // Validate color format
      if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid color format. Please use hex format (e.g., #FF9724)',
        });
      }
      updateData['branding.primaryColor'] = primaryColor;
    }

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
        returnWindow: user.returnPolicy?.returnWindow,
        automaticApprovalThreshold: user.returnPolicy?.automaticApprovalThreshold,
        refundMethods: user.returnPolicy?.refundMethods,
        primaryColor: user.branding?.primaryColor,
        storeLogo: user.storeLogo,
      },
      message: 'Settings updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

