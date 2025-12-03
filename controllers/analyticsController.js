import Return from '../models/Return.js';
import Order from '../models/Order.js';

// @desc    Get analytics data
// @route   GET /api/analytics
// @access  Private
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all returns for this user
    const returns = await Return.find({ userId });
    
    // Get all orders for this user
    const orders = await Order.find({ userId });

    // Calculate current month (February) metrics
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const currentMonthReturns = returns.filter(r => {
      const returnDate = new Date(r.date);
      return returnDate.getMonth() === currentMonth && returnDate.getFullYear() === currentYear;
    });

    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const previousMonthReturns = returns.filter(r => {
      const returnDate = new Date(r.date);
      return returnDate.getMonth() === previousMonth && returnDate.getFullYear() === previousYear;
    });

    // Total Returns
    const totalReturns = currentMonthReturns.length;
    const prevTotalReturns = previousMonthReturns.length;
    const totalReturnsChange = prevTotalReturns > 0 
      ? ((totalReturns - prevTotalReturns) / prevTotalReturns) * 100 
      : 0;

    // Approval Rate
    const approvedReturns = currentMonthReturns.filter(r => 
      ['Completed', 'Refund Pending'].includes(r.status)
    ).length;
    const approvalRate = currentMonthReturns.length > 0 
      ? (approvedReturns / currentMonthReturns.length) * 100 
      : 0;

    const prevApprovedReturns = previousMonthReturns.filter(r => 
      ['Completed', 'Refund Pending'].includes(r.status)
    ).length;
    const prevApprovalRate = previousMonthReturns.length > 0 
      ? (prevApprovedReturns / previousMonthReturns.length) * 100 
      : 0;
    const approvalRateChange = prevApprovalRate > 0 
      ? approvalRate - prevApprovalRate 
      : 0;

    // Average Processing Time
    const completedReturns = returns.filter(r => r.status === 'Completed');
    let avgProcessingTime = 0;
    if (completedReturns.length > 0) {
      const totalDays = completedReturns.reduce((sum, r) => {
        const days = Math.floor((new Date(r.updatedAt) - new Date(r.date)) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avgProcessingTime = totalDays / completedReturns.length;
    }

    const prevCompletedReturns = previousMonthReturns.filter(r => r.status === 'Completed');
    let prevAvgProcessingTime = 0;
    if (prevCompletedReturns.length > 0) {
      const totalDays = prevCompletedReturns.reduce((sum, r) => {
        const days = Math.floor((new Date(r.updatedAt) - new Date(r.date)) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      prevAvgProcessingTime = totalDays / prevCompletedReturns.length;
    }
    const avgProcessingTimeChange = prevAvgProcessingTime > 0 
      ? avgProcessingTime - prevAvgProcessingTime 
      : 0;

    // Refund Amount
    const refundAmount = currentMonthReturns.reduce((sum, r) => sum + (r.amount || 0), 0);
    const prevRefundAmount = previousMonthReturns.reduce((sum, r) => sum + (r.amount || 0), 0);
    const refundAmountChange = prevRefundAmount > 0 
      ? ((refundAmount - prevRefundAmount) / prevRefundAmount) * 100 
      : 0;

    // Return Rate Trend (last 8 months)
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const returnRateTrend = [];
    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthReturns = returns.filter(r => {
        const returnDate = new Date(r.date);
        return returnDate.getMonth() === date.getMonth() && returnDate.getFullYear() === date.getFullYear();
      });
      const monthOrders = orders.filter(o => {
        const orderDate = new Date(o.placedDate);
        return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
      });
      const returnRate = monthOrders.length > 0 
        ? (monthReturns.length / monthOrders.length) * 100 
        : 0;
      returnRateTrend.push({
        month: months[7 - i],
        value: parseFloat(returnRate.toFixed(1))
      });
    }

    // Return Reasons Count
    const reasonsCount = {};
    returns.forEach(r => {
      reasonsCount[r.reason] = (reasonsCount[r.reason] || 0) + 1;
    });
    const returnReasonsCount = Object.keys(reasonsCount).map(reason => ({
      reason,
      count: reasonsCount[reason]
    })).sort((a, b) => b.count - a.count);

    // Return Reasons Distribution
    const totalReturnsCount = returns.length;
    const returnReasonsDistribution = Object.keys(reasonsCount).map(reason => {
      const percentage = totalReturnsCount > 0 
        ? Math.round((reasonsCount[reason] / totalReturnsCount) * 100) 
        : 0;
      return {
        label: reason,
        value: percentage,
        color: getReasonColor(reason, Object.keys(reasonsCount).indexOf(reason))
      };
    }).sort((a, b) => b.value - a.value);

    // Resolution Methods
    const resolutionMethods = {};
    returns.forEach(r => {
      if (r.refundMethod) {
        resolutionMethods[r.refundMethod] = (resolutionMethods[r.refundMethod] || 0) + 1;
      }
    });
    const totalWithMethod = Object.values(resolutionMethods).reduce((sum, val) => sum + val, 0);
    const resolutionMethodsData = Object.keys(resolutionMethods).map(method => {
      const percentage = totalWithMethod > 0 
        ? Math.round((resolutionMethods[method] / totalWithMethod) * 100) 
        : 0;
      return {
        label: method,
        value: percentage,
        color: getResolutionColor(method, Object.keys(resolutionMethods).indexOf(method))
      };
    });

    // Approval vs Rejection (last 7 months)
    const approvalVsRejection = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthReturns = returns.filter(r => {
        const returnDate = new Date(r.date);
        return returnDate.getMonth() === date.getMonth() && returnDate.getFullYear() === date.getFullYear();
      });
      const approved = monthReturns.filter(r => 
        ['Completed', 'Refund Pending'].includes(r.status)
      ).length;
      const rejected = monthReturns.filter(r => r.status === 'Rejected').length;
      approvalVsRejection.push({
        month: months[7 - i] || date.toLocaleDateString('en-US', { month: 'short' }),
        approved,
        rejected
      });
    }

    res.json({
      success: true,
      data: {
        metrics: {
          totalReturns,
          approvalRate: parseFloat(approvalRate.toFixed(1)),
          avgProcessingTime: parseFloat(avgProcessingTime.toFixed(1)),
          refundAmount,
          changes: {
            totalReturns: parseFloat(totalReturnsChange.toFixed(1)),
            approvalRate: parseFloat(approvalRateChange.toFixed(1)),
            avgProcessingTime: parseFloat(avgProcessingTimeChange.toFixed(1)),
            refundAmount: parseFloat(refundAmountChange.toFixed(1))
          }
        },
        returnRateTrend,
        returnReasonsCount,
        returnReasonsDistribution,
        resolutionMethods: resolutionMethodsData,
        approvalVsRejection
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Helper function to get reason color
const getReasonColor = (reason, index) => {
  const colors = ['#FF6B35', '#FF8C69', '#FFA07A', '#666666', '#CCCCCC'];
  return colors[index % colors.length];
};

// Helper function to get resolution color
const getResolutionColor = (method, index) => {
  const colors = ['#FF6B35', '#FF8C69', '#666666'];
  return colors[index % colors.length];
};

