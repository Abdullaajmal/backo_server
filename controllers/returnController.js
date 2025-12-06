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
      photos = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
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

    // Find user by storeUrl
    const User = (await import('../models/User.js')).default;
    const user = await User.findOne({ storeUrl });

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

    // Find user by storeUrl
    const User = (await import('../models/User.js')).default;
    const user = await User.findOne({ storeUrl });

    if (!user || !user.isStoreSetup) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    // Find order in database
    const Order = (await import('../models/Order.js')).default;
    let order = await Order.findOne({
      orderNumber: orderId,
      userId: user._id,
      $or: [
        { 'customer.email': emailOrPhone },
        { 'customer.phone': emailOrPhone },
      ],
    });

    // If order not found in DB, return error
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found. Please check your order ID and email/phone.',
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        orderDate: order.placedDate,
        items: order.items,
        total: order.amount,
        customer: order.customer,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

