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
        date: returnItem.date.toISOString().split('T')[0],
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

