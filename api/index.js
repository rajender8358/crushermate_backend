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

// Simple PDF download endpoint - NO AUTHENTICATION REQUIRED
app.get('/api/download-pdf', async (req, res) => {
  try {
    const { startDate, endDate, organizationId } = req.query;

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

    // Calculate totals
    const totalSales = entries.reduce(
      (sum, entry) =>
        sum + (entry.entryType === 'Sales' ? entry.totalAmount : 0),
      0,
    );
    const totalRawStone = entries.reduce(
      (sum, entry) =>
        sum + (entry.entryType === 'Raw Stone' ? entry.totalAmount : 0),
      0,
    );
    const totalExpenses = otherExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const netWorth = totalSales - totalRawStone - totalExpenses;

    // Generate simple PDF using pdfkit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CrusherMate_Report_${startDate}_${endDate}.pdf"`,
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add colorful header with CrusherMate branding
    doc.rect(0, 0, 600, 120).fill('#1E3A8A'); // Blue header background
    doc
      .fontSize(32)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text('CrusherMate', 50, 30);
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('white')
      .text('Construction Management System', 50, 65);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('white')
      .text('Professional Statement Report', 50, 85);

    // Add logo placeholder (since we can't embed images in this PDF library)
    doc.rect(450, 20, 80, 80).fill('#3B82F6').stroke('#FFFFFF');
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text('LOGO', 470, 55, { align: 'center' });

    // Reset colors for content
    doc.fillColor('black');

    // Statement details in a professional format
    doc.moveDown(3);
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('STATEMENT DETAILS', { underline: true });
    doc.moveDown();

    const detailsY = doc.y;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Statement Period:', 50, detailsY);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`${startDate} to ${endDate}`, 200, detailsY);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Generated Date:', 50, detailsY + 20);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(new Date().toLocaleDateString(), 200, detailsY + 20);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Report Type:', 50, detailsY + 40);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Financial Statement', 200, detailsY + 40);
    doc.moveDown(2);

    // Financial Summary with colorful design
    doc
      .rect(40, doc.y - 10, 520, 80)
      .fill('#F0F9FF')
      .stroke('#3B82F6');
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#1E3A8A')
      .text('FINANCIAL SUMMARY', 50, doc.y);
    doc.moveDown();

    const summaryY = doc.y;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#059669')
      .text('Total Sales:', 60, summaryY);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('black')
      .text(`₹${totalSales.toLocaleString('en-IN')}`, 220, summaryY);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#DC2626')
      .text('Total Raw Stone:', 60, summaryY + 20);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('black')
      .text(`₹${totalRawStone.toLocaleString('en-IN')}`, 220, summaryY + 20);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#D97706')
      .text('Total Expenses:', 60, summaryY + 40);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('black')
      .text(`₹${totalExpenses.toLocaleString('en-IN')}`, 220, summaryY + 40);

    doc.moveDown();
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1E3A8A')
      .text('Net Worth:', 60, doc.y);
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('black')
      .text(`₹${netWorth.toLocaleString('en-IN')}`, 220, doc.y);
    doc.moveDown(2);

    // Truck Entries section with table format like bank statement
    if (entries.length > 0) {
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1E3A8A')
        .text('TRUCK ENTRIES', { underline: true });
      doc.moveDown();

      // Table header
      doc
        .rect(40, doc.y - 5, 520, 25)
        .fill('#E5E7EB')
        .stroke('#9CA3AF');
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Date', 50, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Truck No.', 120, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Truck Name', 200, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Type', 280, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Material', 340, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Units', 420, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Rate', 480, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Amount', 520, doc.y);
      doc.moveDown();

      entries.forEach((entry, index) => {
        const rowY = doc.y;
        const bgColor = index % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        doc
          .rect(40, rowY - 5, 520, 20)
          .fill(bgColor)
          .stroke('#E5E7EB');

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(entry.entryDate.toLocaleDateString(), 50, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(entry.truckNumber || 'N/A', 120, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(entry.truckName || 'N/A', 200, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(entry.entryType, 280, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(entry.materialType, 340, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(`${entry.units} tons`, 420, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(`₹${entry.ratePerUnit}`, 480, rowY);
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#059669')
          .text(`₹${entry.totalAmount.toLocaleString('en-IN')}`, 520, rowY);

        doc.moveDown();
      });
      doc.moveDown();
    }

    // Expenses section with table format
    if (otherExpenses.length > 0) {
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#DC2626')
        .text('EXPENSES', { underline: true });
      doc.moveDown();

      // Table header
      doc
        .rect(40, doc.y - 5, 520, 25)
        .fill('#FEF2F2')
        .stroke('#FCA5A5');
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#7F1D1D')
        .text('Date', 50, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#7F1D1D')
        .text('Expense Name', 120, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#7F1D1D')
        .text('Amount', 300, doc.y);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#7F1D1D')
        .text('Notes', 400, doc.y);
      doc.moveDown();

      otherExpenses.forEach((expense, index) => {
        const rowY = doc.y;
        const bgColor = index % 2 === 0 ? '#FEF2F2' : '#FFFFFF';
        doc
          .rect(40, rowY - 5, 520, 20)
          .fill(bgColor)
          .stroke('#FCA5A5');

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(expense.date.toLocaleDateString(), 50, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(expense.expensesName, 120, rowY);
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#DC2626')
          .text(`₹${expense.amount.toLocaleString('en-IN')}`, 300, rowY);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('black')
          .text(expense.others || 'N/A', 400, rowY);

        doc.moveDown();
      });
    }

    // Add professional footer
    doc.moveDown(2);
    doc.rect(0, doc.y, 600, 60).fill('#1E3A8A');
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text('Generated by CrusherMate System', 50, doc.y + 20);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('white')
      .text('Construction Management & Analytics Platform', 50, doc.y + 40);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('white')
      .text(`Report ID: ${Date.now()} | Page 1 of 1`, 50, doc.y + 55);

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('❌ PDF Download Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message,
    });
  }
});

// Simple CSV download endpoint - NO AUTHENTICATION REQUIRED
app.get('/api/download-csv', async (req, res) => {
  try {
    const { startDate, endDate, organizationId } = req.query;

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

    // Create CSV content
    let csvContent =
      'Date,Time,Truck Number,Truck Name,Type,Material,Units,Rate,Total Amount\n';

    // Add truck entries
    entries.forEach(entry => {
      csvContent += `${entry.entryDate.toISOString().split('T')[0]},${
        entry.entryTime
      },${entry.truckNumber},${entry.truckName || 'N/A'},${entry.entryType},${
        entry.materialType || 'N/A'
      },${entry.units},${entry.ratePerUnit},${entry.totalAmount}\n`;
    });

    // Add expenses
    otherExpenses.forEach(expense => {
      csvContent += `${
        expense.date.toISOString().split('T')[0]
      },${expense.date.toLocaleTimeString()},N/A,N/A,Expense,${
        expense.expensesName || 'Expense'
      },N/A,N/A,${expense.amount}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CrusherMate_Report_${startDate}_${endDate}.csv"`,
    );
    res.send(csvContent);
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
