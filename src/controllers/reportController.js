const TruckEntry = require('../models/TruckEntry');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generatePdf, generateCsv } = require('../utils/exportGenerator');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const downloadTokens = new Map();

// @desc    Get report data with filters
// @route   GET /api/reports/data
// @access  Private
const getReportData = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    entryType,
    materialType,
    truckNumber,
    userId,
    groupBy = 'date', // date, truck, material, user
    sortBy = 'entryDate',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = req.query;

  // Build base filter
  const filter = { status: 'active' };

  // Role-based filtering
  if (req.user.role !== 'owner') {
    filter.userId = req.user.id;
  } else if (userId) {
    filter.userId = userId;
  }

  // Apply filters
  if (entryType) filter.entryType = entryType;
  if (materialType) filter.materialType = materialType;
  if (truckNumber) filter.truckNumber = truckNumber.toUpperCase();

  // Date range (required for reports)
  if (!startDate || !endDate) {
    throw new AppError(
      'Start date and end date are required for reports',
      400,
      'VALIDATION_ERROR',
    );
  }

  filter.entryDate = {
    $gte: new Date(startDate),
    $lte: new Date(endDate),
  };

  // Get detailed entries
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortObj = {};
  sortObj[sortBy] = sortDirection;

  const [entries, total] = await Promise.all([
    TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit)),
    TruckEntry.countDocuments(filter),
  ]);

  // Get summary for the filtered data
  const summary = await TruckEntry.getSummaryByDateRange(
    new Date(startDate),
    new Date(endDate),
    req.user.role !== 'owner'
      ? { userId: req.user.id }
      : userId
      ? { userId }
      : {},
  );

  // Get grouped data based on groupBy parameter
  let groupedData = [];

  if (groupBy === 'date') {
    groupedData = await TruckEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryDate' } },
          totalAmount: { $sum: '$totalAmount' },
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
          totalUnits: { $sum: '$units' },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { _id: sortDirection } },
    ]);
  } else if (groupBy === 'truck') {
    groupedData = await TruckEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$truckNumber',
          totalAmount: { $sum: '$totalAmount' },
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
          totalUnits: { $sum: '$units' },
          entryCount: { $sum: 1 },
          lastEntry: { $max: '$entryDate' },
        },
      },
      { $sort: { totalAmount: sortDirection } },
    ]);
  } else if (groupBy === 'material') {
    groupedData = await TruckEntry.aggregate([
      {
        $match: {
          ...filter,
          entryType: 'Sales',
          materialType: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$materialType',
          totalAmount: { $sum: '$totalAmount' },
          totalUnits: { $sum: '$units' },
          entryCount: { $sum: 1 },
          avgRate: { $avg: '$ratePerUnit' },
          minRate: { $min: '$ratePerUnit' },
          maxRate: { $max: '$ratePerUnit' },
        },
      },
      { $sort: { totalAmount: sortDirection } },
    ]);
  } else if (groupBy === 'user' && req.user.role === 'owner') {
    groupedData = await TruckEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$userId',
          totalAmount: { $sum: '$totalAmount' },
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
          totalUnits: { $sum: '$units' },
          entryCount: { $sum: 1 },
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
      { $unwind: '$user' },
      {
        $project: {
          username: '$user.username',
          email: '$user.email',
          totalAmount: 1,
          salesAmount: 1,
          expenseAmount: 1,
          totalUnits: 1,
          entryCount: 1,
          netAmount: { $subtract: ['$salesAmount', '$expenseAmount'] },
        },
      },
      { $sort: { totalAmount: sortDirection } },
    ]);
  }

  // Calculate pagination
  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      entries,
      summary,
      groupedData,
      filters: {
        startDate,
        endDate,
        entryType,
        materialType,
        truckNumber,
        userId,
        groupBy,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalEntries: total,
        entriesPerPage: parseInt(limit),
      },
    },
  });
});

// @desc    Generate export data
// @route   POST /api/reports/export
// @access  Private
const generateExportData = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.body;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const filter = {
      status: 'active',
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };
    if (req.user.role !== 'owner') {
      filter.userId = req.user.id;
    }

    const entries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(startDate),
      new Date(endDate),
      filter,
    );

    const exportData = {
      reportInfo: {
        title: `CrusherMate Report (${format.toUpperCase()})`,
        generatedBy: req.user.username,
        dateRange: { startDate, endDate },
      },
      summary,
      entries: entries.map(entry => ({
        date: entry.entryDate.toISOString().split('T')[0],
        time: entry.entryTime,
        truckNumber: entry.truckNumber,
        entryType: entry.entryType,
        materialType: entry.materialType || 'N/A',
        units: entry.units,
        ratePerUnit: entry.ratePerUnit,
        totalAmount: entry.totalAmount,
      })),
    };

    let fileId;
    if (format === 'pdf') {
      fileId = await generatePdf(exportData);
    } else {
      fileId = await generateCsv(exportData);
    }

    const token = uuidv4();
    downloadTokens.set(token, fileId);

    // Token expires in 1 minute
    setTimeout(() => {
      downloadTokens.delete(token);
    }, 60000);

    res.json({
      success: true,
      message: `Export data generated successfully in ${format.toUpperCase()} format`,
      data: { token, fileId },
    });
  } catch (error) {
    console.error('--- EXPORT ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data.',
      error: error.message,
    });
  }
});

const downloadExportedFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const { token } = req.query;
  const expectedFileId = downloadTokens.get(token);

  if (!expectedFileId || expectedFileId !== fileId) {
    throw new AppError('Invalid or expired download link', 403, 'FORBIDDEN');
  }

  // Invalidate the token
  downloadTokens.delete(token);

  const filePath = path.join(TEMP_DIR, fileId);

  if (await fs.pathExists(filePath)) {
    res.download(filePath, err => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      fs.remove(filePath);
    });
  } else {
    throw new AppError('File not found', 404, 'NOT_FOUND');
  }
});

// @desc    Get report templates
// @route   GET /api/reports/templates
// @access  Private
const getReportTemplates = asyncHandler(async (req, res) => {
  const templates = [
    {
      id: 'daily-summary',
      name: 'Daily Summary Report',
      description: 'Daily breakdown of all truck entries',
      defaultFilters: {
        groupBy: 'date',
        period: 'month',
      },
    },
    {
      id: 'material-analysis',
      name: 'Material Analysis Report',
      description: 'Analysis of sales by material type',
      defaultFilters: {
        entryType: 'Sales',
        groupBy: 'material',
      },
    },
    {
      id: 'truck-performance',
      name: 'Truck Performance Report',
      description: 'Performance analysis by truck number',
      defaultFilters: {
        groupBy: 'truck',
      },
    },
    {
      id: 'financial-summary',
      name: 'Financial Summary Report',
      description: 'Complete financial overview',
      defaultFilters: {
        includeCharts: true,
      },
    },
  ];

  // Add user performance template for owners
  if (req.user.role === 'owner') {
    templates.push({
      id: 'user-performance',
      name: 'User Performance Report',
      description: 'Performance analysis by user',
      defaultFilters: {
        groupBy: 'user',
      },
    });
  }

  res.json({
    success: true,
    data: {
      templates,
    },
  });
});

module.exports = {
  getReportData,
  generateExportData,
  getReportTemplates,
  downloadExportedFile,
};
