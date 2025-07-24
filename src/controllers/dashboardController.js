const TruckEntry = require('../models/TruckEntry');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const mongoose = require('mongoose');

// Helper function to get date ranges
const getDateRange = period => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.setHours(0, 0, 0, 0));
      endDate = new Date(yesterday.setHours(23, 59, 59, 999));
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      startDate = new Date(weekStart.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
  }

  return { startDate, endDate };
};

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = asyncHandler(async (req, res) => {
  const { organizationId, id: userId, role } = req.user;
  const {
    period = 'week',
    userId: queryUserId,
    startDate: queryStartDate,
    endDate: queryEndDate,
  } = req.query;

  let startDate, endDate;
  if (queryStartDate && queryEndDate) {
    startDate = new Date(queryStartDate);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate = new Date(queryEndDate);
    endDate.setUTCHours(23, 59, 59, 999);
  } else {
    const range = getDateRange(period);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  // Build filter based on user role and organization
  const filter = {
    organization: new mongoose.Types.ObjectId(organizationId),
  };
  if (role !== 'owner') {
    filter.userId = new mongoose.Types.ObjectId(userId);
  } else if (queryUserId) {
    filter.userId = new mongoose.Types.ObjectId(queryUserId);
  }

  // Get summary data for the selected range
  const summary = await TruckEntry.getSummaryByDateRange(
    startDate,
    endDate,
    filter,
  );

  // Get today's entries count separately
  const todayRange = getDateRange('today');
  const todayEntriesCount = await TruckEntry.countDocuments({
    ...filter,
    status: 'active',
    entryDate: { $gte: todayRange.startDate, $lte: todayRange.endDate },
  });

  // Get recent entries (last 5 from the selected range)
  const recentEntries = await TruckEntry.find({
    ...filter,
    status: 'active',
    entryDate: { $gte: startDate, $lte: endDate },
  })
    .populate('userId', 'username email')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get material-wise breakdown for sales
  const materialBreakdown = await TruckEntry.aggregate([
    {
      $match: {
        ...filter,
        status: 'active',
        entryType: 'Sales',
        entryDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$materialType',
        totalAmount: { $sum: '$totalAmount' },
        totalUnits: { $sum: '$units' },
        count: { $sum: 1 },
        avgRate: { $avg: '$ratePerUnit' },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]);

  // Get top trucks by frequency
  const topTrucks = await TruckEntry.aggregate([
    {
      $match: {
        ...filter,
        status: 'active',
        entryDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$truckNumber',
        totalAmount: { $sum: '$totalAmount' },
        totalUnits: { $sum: '$units' },
        entryCount: { $sum: 1 },
        lastEntry: { $max: '$entryDate' },
      },
    },
    {
      $sort: { entryCount: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  res.json({
    success: true,
    data: {
      period: queryStartDate ? 'custom' : period,
      dateRange: { startDate, endDate },
      summary,
      todayEntries: todayEntriesCount,
      recentEntries,
      materialBreakdown,
      topTrucks,
    },
  });
});

// @desc    Get financial metrics
// @route   GET /api/dashboard/financial
// @access  Private
const getFinancialMetrics = asyncHandler(async (req, res) => {
  const { organizationId, id: userId, role } = req.user;
  const { period = 'month', userId: queryUserId } = req.query;
  const { startDate, endDate } = getDateRange(period);

  // Build filter based on user role and organization
  const filter = {
    organization: new mongoose.Types.ObjectId(organizationId),
  };
  if (role !== 'owner') {
    filter.userId = new mongoose.Types.ObjectId(userId);
  } else if (queryUserId) {
    filter.userId = new mongoose.Types.ObjectId(queryUserId);
  }

  // Get daily breakdown for charts
  const dailyBreakdown = await TruckEntry.aggregate([
    {
      $match: {
        ...filter,
        status: 'active',
        entryDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$entryDate' } },
          entryType: '$entryType',
        },
        totalAmount: { $sum: '$totalAmount' },
        totalUnits: { $sum: '$units' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.date': 1 },
    },
  ]);

  // Get comparison with previous period
  const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - periodDays);
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);

  const previousPeriodSummary = await TruckEntry.getSummaryByDateRange(
    prevStartDate,
    prevEndDate,
    filter,
  );

  // Calculate growth percentages
  const currentSummary = await TruckEntry.getSummaryByDateRange(
    startDate,
    endDate,
    filter,
  );

  const salesGrowth =
    previousPeriodSummary.totalSales > 0
      ? (
          ((currentSummary.totalSales - previousPeriodSummary.totalSales) /
            previousPeriodSummary.totalSales) *
          100
        ).toFixed(2)
      : 0;

  const expenseGrowth =
    previousPeriodSummary.totalRawStone > 0
      ? (
          ((currentSummary.totalRawStone -
            previousPeriodSummary.totalRawStone) /
            previousPeriodSummary.totalRawStone) *
          100
        ).toFixed(2)
      : 0;

  // Get current material rates for reference
  const currentRates = await MaterialRate.getCurrentRates();

  res.json({
    success: true,
    data: {
      period,
      dateRange: { startDate, endDate },
      currentPeriod: currentSummary,
      previousPeriod: previousPeriodSummary,
      growth: {
        sales: parseFloat(salesGrowth),
        expenses: parseFloat(expenseGrowth),
      },
      dailyBreakdown,
      currentRates,
    },
  });
});

// @desc    Get dashboard statistics for owner
// @route   GET /api/dashboard/stats
// @access  Private (Owner only)
const getDashboardStats = asyncHandler(async (req, res) => {
  // Only owners can access overall stats
  if (req.user.role !== 'owner') {
    throw new AppError(
      'Owner access required',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  const { organizationId } = req.user;
  const { period = 'month' } = req.query;
  const { startDate, endDate } = getDateRange(period);

  const filter = {
    organization: new mongoose.Types.ObjectId(organizationId),
  };

  // Total users
  const totalUsers = await User.countDocuments({ ...filter, isActive: true });
  const newUsersThisPeriod = await User.countDocuments({
    ...filter,
    isActive: true,
    createdAt: { $gte: startDate, $lte: endDate },
  });

  // Active users (users who made entries in this period)
  const activeUsers = await TruckEntry.distinct('userId', {
    ...filter,
    status: 'active',
    entryDate: { $gte: startDate, $lte: endDate },
  });

  // Top performing users
  const topUsers = await TruckEntry.aggregate([
    {
      $match: {
        ...filter,
        status: 'active',
        entryDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalAmount: { $sum: '$totalAmount' },
        entryCount: { $sum: 1 },
        salesAmount: {
          $sum: {
            $cond: [{ $eq: ['$entryType', 'Sales'] }, '$totalAmount', 0],
          },
        },
        expenseAmount: {
          $sum: {
            $cond: [{ $eq: ['$entryType', 'Raw Stone'] }, '$totalAmount', 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        username: '$user.username',
        email: '$user.email',
        totalAmount: 1,
        entryCount: 1,
        salesAmount: 1,
        expenseAmount: 1,
        netAmount: { $subtract: ['$salesAmount', '$expenseAmount'] },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  // Overall system summary
  const overallSummary = await TruckEntry.getSummaryByDateRange(
    startDate,
    endDate,
    filter,
  );

  res.json({
    success: true,
    data: {
      period,
      dateRange: { startDate, endDate },
      userStats: {
        totalUsers,
        newUsersThisPeriod,
        activeUsersCount: activeUsers.length,
        topUsers,
      },
      overallSummary,
    },
  });
});

module.exports = {
  getDashboardSummary,
  getFinancialMetrics,
  getDashboardStats,
};
