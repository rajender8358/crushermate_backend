const TruckEntry = require('../models/TruckEntry');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generatePdf } = require('../utils/exportGenerator');
const jwt = require('jsonwebtoken');
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
// @access  Private (requires authentication)
const generateExportData = asyncHandler(async (req, res) => {
  try {
    // Handle both POST (body) and GET (query) requests
    const {
      startDate,
      endDate,
      format = 'pdf',
    } = req.method === 'POST' ? req.body : req.query;

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

    // Filter by user's organization
    if (req.user.organization) {
      console.log('🔍 User organization:', req.user.organization);
      console.log('🔍 User organization type:', typeof req.user.organization);

      // Validate that organization is a valid ObjectId
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(req.user.organization)) {
        console.log('✅ Valid organization ID, applying filter');
        filter.organization = req.user.organization;
      } else {
        console.log(
          '❌ Invalid organization ID format:',
          req.user.organization,
        );
        throw new AppError('Invalid organization configuration', 400);
      }
    } else {
      console.log('⚠️ No organization found for user');
      throw new AppError('User organization not found', 400);
    }

    // Role-based filtering
    if (req.user.role !== 'owner') {
      filter.userId = req.user.id;
    }

    console.log('🔍 Final filter:', JSON.stringify(filter, null, 2));

    const entries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    console.log(`📊 Found ${entries.length} entries for organization`);

    // Get summary for the filtered data
    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(startDate),
      new Date(endDate),
      filter, // Pass the filter to get summary for the same data
    );

    const exportData = {
      reportInfo: {
        title: `CrusherMate Report (${format.toUpperCase()})`,
        generatedBy: req.user.username || 'CrusherMate System',
        organization: req.user.organization,
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

    if (format === 'pdf') {
      const pdfBuffer = await generatePdf(exportData);
      const fileName = `CrusherMate_Report_${
        new Date().toISOString().split('T')[0]
      }.pdf`;

      // Return PDF directly
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(pdfBuffer);
    } else if (format === 'csv') {
      const { Parser } = require('json2csv');

      // Define CSV fields
      const fields = [
        'date',
        'time',
        'truckNumber',
        'truckName',
        'entryType',
        'materialType',
        'units',
        'ratePerUnit',
        'totalAmount',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(exportData.entries);

      const fileName = `CrusherMate_Report_${
        new Date().toISOString().split('T')[0]
      }.csv`;

      // Return CSV directly
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(csv);
    } else {
      throw new AppError(
        'Only PDF and CSV formats are supported',
        400,
        'INVALID_FORMAT',
      );
    }
  } catch (error) {
    console.error('--- EXPORT ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data.',
      error: error.message,
    });
  }
});

// @desc    Generate browser download URL (for PDF/CSV)
// @route   POST /api/reports/browser-download
// @access  Private (requires authentication)
const generateBrowserDownload = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, format = 'pdf' } = req.body;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    console.log('🔍 User object:', req.user);
    console.log('🔍 User organization:', req.user.organization);
    console.log('🔍 Organization type:', typeof req.user.organization);
    console.log('🔍 User organizationId:', req.user.organizationId);

    // Use organizationId directly since it's always available
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      console.error('❌ No organization found for user:', req.user);
      throw new AppError('User organization not found', 400);
    }

    console.log('🔍 Organization ID for download:', organizationId);

    // Generate a temporary download token
    const downloadToken = jwt.sign(
      {
        userId: req.user.id,
        organization: organizationId,
        startDate,
        endDate,
        format,
        type: 'download',
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }, // Token expires in 5 minutes
    );

    // Store the download token
    downloadTokens.set(downloadToken, {
      userId: req.user.id,
      organization: organizationId,
      startDate,
      endDate,
      format,
      createdAt: new Date(),
    });

    console.log('🔍 Download token created with organization:', organizationId);

    // Return the download URL
    const downloadUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/reports/download/${downloadToken}`;

    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: `CrusherMate_Report_${
          new Date().toISOString().split('T')[0]
        }.${format}`,
      },
    });
  } catch (error) {
    console.error('--- BROWSER DOWNLOAD ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate download URL.',
      error: error.message,
    });
  }
});

// @desc    Download file using temporary token
// @route   GET /api/reports/download/:token
// @access  Public (uses temporary token)
const downloadWithToken = asyncHandler(async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔍 Download token received:', token);

    // Verify the download token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const downloadData = downloadTokens.get(token);

    console.log('🔍 Decoded token:', decoded);
    console.log('🔍 Download data:', downloadData);

    if (!downloadData || decoded.type !== 'download') {
      throw new AppError('Invalid or expired download token', 401);
    }

    // Clean up expired tokens (older than 5 minutes)
    const now = new Date();
    for (const [key, data] of downloadTokens.entries()) {
      if (now - data.createdAt > 5 * 60 * 1000) {
        downloadTokens.delete(key);
      }
    }

    const filter = {
      status: 'active',
      entryDate: {
        $gte: new Date(downloadData.startDate),
        $lte: new Date(downloadData.endDate),
      },
      organization: downloadData.organization,
    };

    // Role-based filtering
    if (decoded.userId !== downloadData.userId) {
      filter.userId = downloadData.userId;
    }

    console.log('🔍 Final filter:', JSON.stringify(filter, null, 2));
    console.log(
      '🔍 Date range:',
      downloadData.startDate,
      'to',
      downloadData.endDate,
    );
    console.log('🔍 Organization:', downloadData.organization);

    const entries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    console.log('🔍 Found entries:', entries.length);
    console.log(
      '🔍 Sample entry data:',
      entries[0]
        ? {
            entryType: entries[0].entryType,
            totalAmount: entries[0].totalAmount,
            units: entries[0].units,
            ratePerUnit: entries[0].ratePerUnit,
            materialType: entries[0].materialType,
          }
        : 'No entries',
    );

    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(downloadData.startDate),
      new Date(downloadData.endDate),
      filter,
    );

    console.log('🔍 Summary:', summary);

    const exportData = {
      reportInfo: {
        title: `CrusherMate Report (${downloadData.format.toUpperCase()})`,
        generatedBy: 'CrusherMate System',
        organization: downloadData.organization,
        dateRange: {
          startDate: downloadData.startDate,
          endDate: downloadData.endDate,
        },
      },
      summary,
      entries: entries.map(entry => ({
        date: entry.entryDate.toISOString().split('T')[0],
        time: entry.entryTime,
        truckNumber: entry.truckNumber,
        truckName: entry.truckName || 'N/A',
        entryType: entry.entryType,
        materialType: entry.materialType || 'N/A',
        units: entry.units,
        ratePerUnit: entry.ratePerUnit,
        totalAmount: entry.totalAmount,
      })),
    };

    console.log('🔍 Export data entries count:', exportData.entries.length);

    if (downloadData.format === 'pdf') {
      const pdfBuffer = await generatePdf(exportData);
      const fileName = `CrusherMate_Report_${
        new Date().toISOString().split('T')[0]
      }.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(pdfBuffer);
    } else if (downloadData.format === 'csv') {
      const { Parser } = require('json2csv');

      const fields = [
        'date',
        'time',
        'truckNumber',
        'truckName',
        'entryType',
        'materialType',
        'units',
        'ratePerUnit',
        'totalAmount',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(exportData.entries);

      const fileName = `CrusherMate_Report_${
        new Date().toISOString().split('T')[0]
      }.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(csv);
    } else {
      throw new AppError('Only PDF and CSV formats are supported', 400);
    }

    // Clean up the token after successful download
    downloadTokens.delete(token);
  } catch (error) {
    console.error('--- DOWNLOAD WITH TOKEN ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file.',
      error: error.message,
    });
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

// @desc    Test endpoint to check database data
// @route   GET /api/reports/test-data
// @access  Public (for debugging)
const testDatabaseData = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, organizationId } = req.query;

    console.log('🔍 Test data request:', {
      startDate,
      endDate,
      organizationId,
    });

    const filter = {
      status: 'active',
    };

    if (startDate && endDate) {
      filter.entryDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (organizationId) {
      filter.organization = organizationId;
    }

    console.log('🔍 Test filter:', JSON.stringify(filter, null, 2));

    const entries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .populate('organization', 'name')
      .sort({ entryDate: -1 })
      .limit(10);

    console.log('🔍 Found entries:', entries.length);

    const totalEntries = await TruckEntry.countDocuments(filter);
    const totalByOrg = await TruckEntry.aggregate([
      { $match: filter },
      { $group: { _id: '$organization', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        filter,
        entries: entries.map(entry => ({
          id: entry._id,
          truckNumber: entry.truckNumber,
          entryType: entry.entryType,
          materialType: entry.materialType,
          entryDate: entry.entryDate,
          organization: entry.organization?.name || entry.organization,
          user: entry.userId?.username || entry.userId,
        })),
        summary: {
          totalEntries,
          totalByOrg,
          sampleEntries: entries.length,
        },
      },
    });
  } catch (error) {
    console.error('--- TEST DATA ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test data.',
      error: error.message,
    });
  }
});

module.exports = {
  getReportData,
  generateExportData,
  getReportTemplates,
  generateBrowserDownload,
  downloadWithToken,
  testDatabaseData,
};
