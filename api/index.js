const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

// Import middleware and routes
const connectDB = require('../src/config/database');
const { errorHandler } = require('../src/middleware/errorHandler');
const { authenticateToken } = require('../src/middleware/auth');

// Import routes
const authRoutes = require('../src/routes/authRoutes');
const userRoutes = require('../src/routes/userRoutes');
const truckEntryRoutes = require('../src/routes/truckEntryRoutes');
const materialRateRoutes = require('../src/routes/materialRateRoutes');
const organizationRoutes = require('../src/routes/organizationRoutes');
const dashboardRoutes = require('../src/routes/dashboardRoutes');
const configRoutes = require('../src/routes/configRoutes');
const reportRoutes = require('../src/routes/reportRoutes');
const downloadRoutes = require('../src/routes/downloadRoutes');
const otherExpenseRoutes = require('../src/routes/expenses');

const app = express();

// Connect to MongoDB with better error handling
const initializeServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    // Handle initialization error silently
  }
};

// Initialize server but don't block startup
setTimeout(() => {
  initializeServer().catch(error => {
    // Handle initialization error silently
  });
}, 100);

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration for production
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['*'], // Allow all origins for production
    credentials: process.env.CORS_CREDENTIALS === 'true' || true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CrusherMate API Server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Simple health check without database dependency
app.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Pong! Server is responding',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/truck-entries', authenticateToken, truckEntryRoutes);
app.use('/api/material-rates', authenticateToken, materialRateRoutes);
app.use('/api/expenses', otherExpenseRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

// Public download route (no authentication required) - separate path to avoid conflicts
app.use('/api/download', downloadRoutes);

// Direct PDF download endpoint - NO AUTHENTICATION REQUIRED
app.post('/api/download-pdf', async (req, res) => {
  try {
    const { startDate, endDate, organizationId } = req.body;

    if (!startDate || !endDate || !organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and organization ID are required',
      });
    }

    console.log('🔍 Generating PDF for:', {
      startDate,
      endDate,
      organizationId,
    });

    const TruckEntry = require('../src/models/TruckEntry');
    const OtherExpense = require('../src/models/OtherExpense');
    const { generatePdf } = require('../src/utils/exportGenerator');

    // Get truck entries
    const entries = await TruckEntry.find({
      status: 'active',
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    })
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    // Get other expenses
    const otherExpenses = await OtherExpense.find({
      isActive: true,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    })
      .populate('user', 'username email')
      .sort({ date: -1 });

    // Transform data for export
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

    const allEntries = [
      ...truckEntriesForExport,
      ...otherExpensesForExport,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const exportData = {
      reportInfo: {
        title: 'CrusherMate Report (PDF)',
        generatedBy: 'CrusherMate System',
        organization: organizationId,
        dateRange: { startDate, endDate },
      },
      entries: allEntries,
    };

    // Generate PDF
    const pdfBuffer = await generatePdf(exportData);
    const fileName = `CrusherMate_Report_${
      new Date().toISOString().split('T')[0]
    }.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ PDF Download Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message,
    });
  }
});

// Direct CSV download endpoint - NO AUTHENTICATION REQUIRED
app.post('/api/download-csv', async (req, res) => {
  try {
    const { startDate, endDate, organizationId } = req.body;

    if (!startDate || !endDate || !organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and organization ID are required',
      });
    }

    console.log('🔍 Generating CSV for:', {
      startDate,
      endDate,
      organizationId,
    });

    const TruckEntry = require('../src/models/TruckEntry');
    const OtherExpense = require('../src/models/OtherExpense');

    // Get truck entries
    const entries = await TruckEntry.find({
      status: 'active',
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    })
      .populate('userId', 'username email')
      .sort({ entryDate: -1 });

    // Get other expenses
    const otherExpenses = await OtherExpense.find({
      isActive: true,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
      organization: organizationId,
    })
      .populate('user', 'username email')
      .sort({ date: -1 });

    // Transform data for export
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

    const allEntries = [
      ...truckEntriesForExport,
      ...otherExpensesForExport,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate CSV
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
    const csv = parser.parse(allEntries);

    const fileName = `CrusherMate_Report_${
      new Date().toISOString().split('T')[0]
    }.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (error) {
    console.error('❌ CSV Download Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CSV',
      error: error.message,
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus =
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const uptime = process.uptime();

    res.json({
      success: true,
      message: 'Server is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60,
        )}m ${Math.floor(uptime % 60)}s`,
        database: {
          status: dbStatus,
          name: mongoose.connection.name || 'unknown',
          host: mongoose.connection.host || 'unknown',
        },
        environment: process.env.NODE_ENV || 'production',
        version: '1.0.0',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
    });
  }
});

// Database connectivity test endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    // Test database connection with timeout
    const testQuery = Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database ping timeout')), 5000),
      ),
    ]);

    await testQuery;

    res.json({
      success: true,
      message: 'Database connection is healthy',
      data: {
        status: 'connected',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.name,
        host: mongoose.connection.host,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      data: {
        status: 'disconnected',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Export for Vercel serverless
module.exports = app;
