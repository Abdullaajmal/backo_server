import Order from '../models/Order.js';
import Return from '../models/Return.js';

// @desc    Get all customers with aggregated data
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all orders for this user
    const orders = await Order.find({ userId });
    
    // Get all returns for this user
    const returns = await Return.find({ userId });

    // Aggregate customer data from orders
    const customerMap = new Map();

    // Process orders
    orders.forEach(order => {
      const customerEmail = order.customer.email;
      const customerName = order.customer.name;
      
      if (!customerMap.has(customerEmail)) {
        customerMap.set(customerEmail, {
          name: customerName,
          email: customerEmail,
          phone: order.customer.phone || '',
          totalOrders: 0,
          totalReturns: 0,
          orderAmounts: [],
        });
      }
      
      const customer = customerMap.get(customerEmail);
      customer.totalOrders += 1;
      customer.orderAmounts.push(order.amount);
    });

    // Process returns
    returns.forEach(returnItem => {
      const customerEmail = returnItem.customer.email;
      
      if (customerMap.has(customerEmail)) {
        customerMap.get(customerEmail).totalReturns += 1;
      } else {
        // If customer only has returns but no orders
        customerMap.set(customerEmail, {
          name: returnItem.customer.name,
          email: customerEmail,
          phone: returnItem.customer.phone || '',
          totalOrders: 0,
          totalReturns: 1,
          orderAmounts: [],
        });
      }
    });

    // Calculate trust score for each customer
    // Trust score formula: Based on order count, return rate, and order value
    const customers = Array.from(customerMap.values()).map(customer => {
      const returnRate = customer.totalOrders > 0 
        ? (customer.totalReturns / customer.totalOrders) * 100 
        : customer.totalReturns > 0 ? 100 : 0;
      
      const avgOrderValue = customer.orderAmounts.length > 0
        ? customer.orderAmounts.reduce((sum, val) => sum + val, 0) / customer.orderAmounts.length
        : 0;

      // Trust score calculation (0-100):
      // - Base score: 50
      // - Order count bonus: up to 30 points (more orders = higher trust)
      // - Return rate penalty: up to -30 points (more returns = lower trust)
      // - Order value bonus: up to 20 points (higher value = higher trust)
      let trustScore = 50;
      
      // Order count bonus (max 30 points)
      trustScore += Math.min(customer.totalOrders * 2, 30);
      
      // Return rate penalty (max -30 points)
      trustScore -= Math.min(returnRate * 0.3, 30);
      
      // Order value bonus (max 20 points, normalized)
      const valueBonus = Math.min((avgOrderValue / 100) * 2, 20);
      trustScore += valueBonus;
      
      // Ensure score is between 0 and 100
      trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

      return {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        trustScore,
        totalOrders: customer.totalOrders,
        totalReturns: customer.totalReturns,
      };
    });

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single customer details
// @route   GET /api/customers/:email
// @access  Private
export const getCustomer = async (req, res) => {
  try {
    const userId = req.user._id;
    const customerEmail = req.params.email;

    // Get all orders for this customer
    const orders = await Order.find({ 
      userId, 
      'customer.email': customerEmail 
    }).sort({ placedDate: -1 });

    // Get all returns for this customer
    const returns = await Return.find({ 
      userId, 
      'customer.email': customerEmail 
    }).sort({ date: -1 });

    if (orders.length === 0 && returns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const customer = orders.length > 0 
      ? orders[0].customer 
      : returns[0].customer;

    res.json({
      success: true,
      data: {
        customer,
        orders,
        returns,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

