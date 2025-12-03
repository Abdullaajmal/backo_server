import Order from '../models/Order.js';

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all orders for this user
    const orders = await Order.find({ userId })
      .sort({ placedDate: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: orders.map(order => ({
        orderNumber: order.orderNumber,
        customer: order.customer,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        placedDate: order.placedDate.toISOString().split('T')[0],
        deliveredDate: order.deliveredDate 
          ? order.deliveredDate.toISOString().split('T')[0] 
          : null,
        date: order.placedDate.toISOString().split('T')[0],
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      customer,
      items,
      amount,
      paymentMethod,
      shippingAddress,
      notes,
    } = req.body;

    // Generate order number
    const orderCount = await Order.countDocuments({ userId });
    const orderNumber = `ORD-${1000 + orderCount + 1}`;

    const order = await Order.create({
      orderNumber,
      userId,
      customer,
      items,
      amount,
      paymentMethod,
      shippingAddress,
      notes,
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;
    const updateData = req.body;

    // If status is Delivered, set deliveredDate
    if (updateData.status === 'Delivered' && !updateData.deliveredDate) {
      updateData.deliveredDate = new Date();
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;

    const order = await Order.findOneAndDelete({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

