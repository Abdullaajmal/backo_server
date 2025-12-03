import User from '../models/User.js';
import Return from '../models/Return.js';

// @desc    Get dashboard data
// @route   GET /api/dashboard
// @access  Private
export const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all returns for this user
    const returns = await Return.find({ userId });

    // Calculate metrics
    const openReturns = returns.filter(r => 
      ['Pending Approval', 'Awaiting Receipt', 'In Inspection', 'Refund Pending'].includes(r.status)
    ).length;

    // Calculate average refund time (in days)
    const completedReturns = returns.filter(r => r.status === 'Completed');
    let avgRefundTime = 0;
    if (completedReturns.length > 0) {
      const totalDays = completedReturns.reduce((sum, r) => {
        const days = Math.floor((new Date(r.updatedAt) - new Date(r.date)) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avgRefundTime = (totalDays / completedReturns.length).toFixed(1);
    } else {
      avgRefundTime = 2.4; // Default value
    }

    // Calculate return rate (percentage)
    // This would typically be based on total orders, but for now we'll use a default
    const returnRate = 8.5; // Default value - would calculate from orders

    // Count urgent actions (returns pending for more than 7 days)
    const urgentActions = returns.filter(r => {
      const daysPending = Math.floor((new Date() - new Date(r.date)) / (1000 * 60 * 60 * 24));
      return daysPending > 7 && ['Pending Approval', 'Awaiting Receipt', 'In Inspection'].includes(r.status);
    }).length;

    // Get returns for last 30 days for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentReturns = returns.filter(r => new Date(r.date) >= thirtyDaysAgo);

    // Group by date for chart
    const returnsByDate = {};
    recentReturns.forEach(r => {
      const dateKey = new Date(r.date).toISOString().split('T')[0];
      returnsByDate[dateKey] = (returnsByDate[dateKey] || 0) + 1;
    });

    // Get return reasons distribution
    const reasonsCount = {};
    returns.forEach(r => {
      reasonsCount[r.reason] = (reasonsCount[r.reason] || 0) + 1;
    });

    const totalReturns = returns.length;
    const returnReasons = Object.keys(reasonsCount).map(reason => ({
      label: reason,
      value: totalReturns > 0 ? Math.round((reasonsCount[reason] / totalReturns) * 100) : 0,
    }));

    // Get latest returns (last 8)
    const latestReturns = returns
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8)
      .map(r => ({
        id: r.returnId,
        customer: r.customer.name,
        product: r.product.name,
        status: r.status,
        date: new Date(r.date).toISOString().split('T')[0],
        amount: `$${r.amount.toFixed(2)}`,
        statusColor: getStatusColor(r.status),
      }));

    res.json({
      success: true,
      data: {
        metrics: {
          openReturns,
          avgRefundTime: `${avgRefundTime} days`,
          returnRate: `${returnRate}%`,
          urgentActions,
        },
        returnsChart: Object.keys(returnsByDate).map(date => ({
          date: formatDateForChart(date),
          value: returnsByDate[date],
        })),
        returnReasons,
        latestReturns,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Helper function to get status color
const getStatusColor = (status) => {
  const colors = {
    'Pending Approval': '#FFC107',
    'Awaiting Receipt': '#2196F3',
    'In Inspection': '#9C27B0',
    'Refund Pending': '#FF6B35',
    'Completed': '#4CAF50',
    'Rejected': '#F44336',
  };
  return colors[status] || '#666666';
};

// Helper function to format date for chart
const formatDateForChart = (dateString) => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

