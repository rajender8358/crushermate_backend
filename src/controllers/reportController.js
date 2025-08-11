const TruckEntry = require('../models/TruckEntry');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const OtherExpense = require('../models/OtherExpense');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Organization = require('../models/Organization');
const { generatePdf } = require('../utils/exportGenerator');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Removed temp directory for serverless compatibility
// const TEMP_DIR = path.join(__dirname, '..', 'temp');
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
    $lte: new Date(endDate + 'T23:59:59.999Z'),
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
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    };

    // Filter by user's organization
    if (req.user.organizationId) {
      filter.organization = req.user.organizationId;
    } else if (req.user.organization) {
      filter.organization = req.user.organization;
    } else {
      throw new AppError('User organization not found', 400);
    }

    // Role-based filtering
    if (req.user.role !== 'owner') {
      filter.userId = req.user.id;
    }

    // Fetch truck entries
    const truckEntries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    // Fetch other expenses with same filter
    const otherExpensesFilter = {
      isActive: true,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    };

    // Filter by user's organization for other expenses
    if (req.user.organizationId) {
      otherExpensesFilter.organization = req.user.organizationId;
    } else if (req.user.organization) {
      otherExpensesFilter.organization = req.user.organization;
    }

    // Role-based filtering for other expenses
    if (req.user.role !== 'owner') {
      otherExpensesFilter.user = req.user.id;
    }

    const otherExpenses = await OtherExpense.find(otherExpensesFilter)
      .populate('user', 'username email')
      .sort({ date: -1 });

    // Get summary for the filtered data (includes other expenses)
    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(startDate),
      new Date(endDate),
      filter, // Pass the filter to get summary for the same data
    );

    // Transform truck entries for export
    const truckEntriesForExport = truckEntries.map(entry => ({
      date: entry.entryDate.toISOString().split('T')[0],
      time: entry.entryTime,
      truckNumber: entry.truckNumber,
      entryType: entry.entryType,
      materialType: entry.materialType || 'N/A',
      units: entry.units,
      ratePerUnit: entry.ratePerUnit,
      totalAmount: entry.totalAmount,
      type: 'truck_entry',
    }));

    // Transform other expenses for export
    const otherExpensesForExport = otherExpenses.map(expense => ({
      date: expense.date.toISOString().split('T')[0],
      time: expense.date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      truckNumber: 'N/A',
      entryType: 'Expense',
      materialType: expense.expensesName || 'Expense',
      units: 'N/A',
      ratePerUnit: 'N/A',
      totalAmount: expense.amount,
      description: expense.others || '',
      type: 'other_expense',
    }));

    // Combine all entries and sort by date
    const allEntries = [
      ...truckEntriesForExport,
      ...otherExpensesForExport,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('🔍 Export data summary:');
    console.log('🔍 Truck entries for export:', truckEntriesForExport.length);
    console.log('🔍 Other expenses for export:', otherExpensesForExport.length);
    console.log('🔍 Total entries for export:', allEntries.length);

    if (otherExpensesForExport.length > 0) {
      console.log(
        '🔍 Sample other expense for export:',
        otherExpensesForExport[0],
      );
    } else {
      console.log('🔍 No other expenses found for export');
      console.log('🔍 Other expenses filter used:', otherExpensesFilter);
      console.log('🔍 User organization:', req.user.organization);
      console.log('🔍 User organizationId:', req.user.organizationId);
      console.log('🔍 Date range:', { startDate, endDate });

      // Let's also check what Other Expenses exist in the database
      const allOtherExpenses = await OtherExpense.find({ isActive: true }).sort(
        { date: -1 },
      );
      console.log(
        '🔍 Total Other Expenses in database:',
        allOtherExpenses.length,
      );
      if (allOtherExpenses.length > 0) {
        console.log('🔍 Sample Other Expense from database:', {
          id: allOtherExpenses[0]._id,
          expensesName: allOtherExpenses[0].expensesName,
          amount: allOtherExpenses[0].amount,
          date: allOtherExpenses[0].date,
          organization: allOtherExpenses[0].organization,
        });
      }
    }

    const exportData = {
      reportInfo: {
        title: `CrusherMate Report (${format.toUpperCase()})`,
        generatedBy: req.user.username || 'CrusherMate System',
        organization: req.user.organization,
        organizationName:
          (req.user.organization && req.user.organization.name) ||
          req.user.organizationName ||
          undefined,
        dateRange: { startDate, endDate },
      },
      summary,
      entries: allEntries,
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
        'entryType',
        'materialType',
        'units',
        'ratePerUnit',
        'totalAmount',
        'description',
        'type',
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

    // Get organization ID with fallback
    let organizationId = req.user.organizationId;

    if (!organizationId && req.user.organization) {
      organizationId = req.user.organization._id || req.user.organization;
    }

    // If still no organizationId, fetch from database
    if (!organizationId) {
      try {
        const user = await User.findById(req.user.id).populate('organization');
        if (user && user.organization) {
          organizationId = user.organization._id || user.organization;
        }
      } catch (error) {
        console.error('❌ Error fetching user organization:', error);
      }
    }

    if (!organizationId) {
      console.error('❌ No organization found for user:', req.user);
      throw new AppError('User organization not found', 400);
    }

    console.log('🔍 Organization ID for download:', organizationId);

    console.log('🔍 Generating download token with:', {
      userId: req.user.id,
      organization: organizationId,
      startDate,
      endDate,
      format,
    });

    // Generate a simple download token (no JWT needed)
    const downloadToken = uuidv4();

    console.log('🔍 Generated download token:', downloadToken);

    // Store the download token
    downloadTokens.set(downloadToken, {
      userId: req.user.id,
      organization: organizationId,
      startDate,
      endDate,
      format,
      createdAt: new Date(),
    });

    console.log('🔍 Stored download token in memory');

    // Get summary data for the response
    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(startDate),
      new Date(endDate),
      { organization: organizationId },
    );

    // Get entry count
    const entriesCount = await TruckEntry.countDocuments({
      status: 'active',
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    });

    // Return the download URL
    const downloadUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/download/${downloadToken}`;

    const responseData = {
      success: true,
      data: {
        downloadUrl,
        fileName: `CrusherMate_Report_${
          new Date().toISOString().split('T')[0]
        }.${format}`,
        entriesCount,
        summary,
      },
    };

    console.log('🔍 Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('--- BROWSER DOWNLOAD ERROR ---', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate download URL.',
      error: error.message,
    });
  }
});

// @desc    Generate public download URL (no authentication required)
// @route   POST /api/download/generate
// @access  Public
const generatePublicDownload = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, format = 'pdf', organizationId } = req.body;

    if (!startDate || !endDate || !organizationId) {
      throw new AppError(
        'Start date, end date, and organization ID are required',
        400,
      );
    }

    console.log('🔍 Generating public download with:', {
      organizationId,
      startDate,
      endDate,
      format,
    });

    // Generate a simple download token (no JWT needed)
    const downloadToken = uuidv4();

    console.log('🔍 Generated download token:', downloadToken);

    // Store the download token
    downloadTokens.set(downloadToken, {
      organization: organizationId,
      startDate,
      endDate,
      format,
      createdAt: new Date(),
    });

    console.log('🔍 Stored download token in memory');

    // Get summary data for the response
    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(startDate),
      new Date(endDate),
      { organization: organizationId },
    );

    // Get entry count
    const entriesCount = await TruckEntry.countDocuments({
      status: 'active',
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    });

    // Return the download URL
    const downloadUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/download/${downloadToken}`;

    const responseData = {
      success: true,
      data: {
        downloadUrl,
        fileName: `CrusherMate_Report_${
          new Date().toISOString().split('T')[0]
        }.${format}`,
        entriesCount,
        summary,
      },
    };

    console.log('🔍 Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('--- PUBLIC DOWNLOAD ERROR ---', error);
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

    // Get download data from token (no JWT verification needed)
    const downloadData = downloadTokens.get(token);

    if (!downloadData) {
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
        $lte: new Date(downloadData.endDate + 'T23:59:59.999Z'),
      },
      organization: downloadData.organization,
    };

    // Organization-based filtering only (no user filtering for public downloads)
    // Data is already filtered by organization in downloadData.organization

    const entries = await TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    // Fetch other expenses with same filter
    const otherExpensesFilter = {
      isActive: true,
      date: {
        $gte: new Date(downloadData.startDate),
        $lte: new Date(downloadData.endDate + 'T23:59:59.999Z'),
      },
      organization: downloadData.organization,
    };

    const otherExpenses = await OtherExpense.find(otherExpensesFilter)
      .populate('user', 'username email')
      .sort({ date: -1 });

    console.log('🔍 Found other expenses:', otherExpenses.length);

    const summary = await TruckEntry.getSummaryByDateRange(
      new Date(downloadData.startDate),
      new Date(downloadData.endDate),
      filter,
    );

    console.log('🔍 Summary:', summary);

    // Transform truck entries for export
    const truckEntriesForExport = entries.map(entry => ({
      date: entry.entryDate.toISOString().split('T')[0],
      time: entry.entryTime,
      truckNumber: entry.truckNumber,
      truckName: entry.truckName || 'N/A',
      entryType: entry.entryType,
      materialType: entry.materialType || 'N/A',
      units: entry.units,
      ratePerUnit: entry.ratePerUnit,
      totalAmount: entry.totalAmount,
    }));

    // Transform other expenses for export
    const otherExpensesForExport = otherExpenses.map(expense => ({
      date: expense.date.toISOString().split('T')[0],
      time: expense.date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      truckNumber: 'N/A',
      truckName: 'N/A',
      entryType: 'Expense',
      materialType: expense.expensesName || 'Expense',
      units: 'N/A',
      ratePerUnit: 'N/A',
      totalAmount: expense.amount,
    }));

    // Combine all entries and sort by date
    const allEntries = [
      ...truckEntriesForExport,
      ...otherExpensesForExport,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get organization name for header (if available)
    let organizationName;
    try {
      const org = await Organization.findById(downloadData.organization).lean();
      organizationName = org?.name;
    } catch (e) {
      organizationName = undefined;
    }

    const exportData = {
      reportInfo: {
        title: `CrusherMate Report (${downloadData.format.toUpperCase()})`,
        generatedBy: 'CrusherMate System',
        organization: downloadData.organization,
        organizationName,
        dateRange: {
          startDate: downloadData.startDate,
          endDate: downloadData.endDate,
        },
      },
      summary,
      entries: allEntries,
    };

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
  generatePublicDownload,
  downloadWithToken,
  testDatabaseData,
};
