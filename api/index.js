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

    // Add professional header with logo
    doc.fontSize(28).font('Helvetica-Bold').text('CrusherMate', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Construction Management System', { align: 'center' });
    doc.moveDown();
    
    // Add a line separator
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Report details
    doc.fontSize(14).font('Helvetica-Bold').text('STATEMENT REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary section with better styling
    doc.fontSize(16).font('Helvetica-Bold').text('FINANCIAL SUMMARY', { underline: true });
    doc.moveDown();
    
    // Create a summary table
    const summaryY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold').text('Total Sales:', 50, summaryY);
    doc.fontSize(12).font('Helvetica').text(`₹${totalSales.toLocaleString('en-IN')}`, 200, summaryY);
    
    doc.fontSize(12).font('Helvetica-Bold').text('Total Raw Stone:', 50, summaryY + 20);
    doc.fontSize(12).font('Helvetica').text(`₹${totalRawStone.toLocaleString('en-IN')}`, 200, summaryY + 20);
    
    doc.fontSize(12).font('Helvetica-Bold').text('Total Expenses:', 50, summaryY + 40);
    doc.fontSize(12).font('Helvetica').text(`₹${totalExpenses.toLocaleString('en-IN')}`, 200, summaryY + 40);
    
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Net Worth:', 50, doc.y);
    doc.fontSize(14).font('Helvetica-Bold').text(`₹${netWorth.toLocaleString('en-IN')}`, 200, doc.y);
    doc.moveDown(2);

    // Truck Entries section with better formatting
    if (entries.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('TRUCK ENTRIES', { underline: true });
      doc.moveDown();
      
      entries.forEach((entry, index) => {
        // Entry header
        doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${entry.truckNumber} - ${entry.entryType}`, { color: '#2C3E50' });
        
        // Entry details in a structured format
        const entryY = doc.y + 5;
        doc.fontSize(9).font('Helvetica').text(`Date: ${entry.entryDate.toLocaleDateString()}`, 60, entryY);
        doc.fontSize(9).font('Helvetica').text(`Time: ${entry.entryTime}`, 200, entryY);
        doc.fontSize(9).font('Helvetica').text(`Material: ${entry.materialType}`, 300, entryY);
        
        doc.fontSize(9).font('Helvetica').text(`Units: ${entry.units} tons`, 60, entryY + 12);
        doc.fontSize(9).font('Helvetica').text(`Rate: ₹${entry.ratePerUnit}`, 200, entryY + 12);
        doc.fontSize(9).font('Helvetica-Bold').text(`Total: ₹${entry.totalAmount.toLocaleString('en-IN')}`, 300, entryY + 12);
        
        doc.moveDown(1);
      });
      doc.moveDown();
    }

    // Expenses section with better formatting
    if (otherExpenses.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('EXPENSES', { underline: true });
      doc.moveDown();
      
      otherExpenses.forEach((expense, index) => {
        // Expense header
        doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${expense.expensesName}`, { color: '#E74C3C' });
        
        // Expense details
        const expenseY = doc.y + 5;
        doc.fontSize(9).font('Helvetica').text(`Date: ${expense.date.toLocaleDateString()}`, 60, expenseY);
        doc.fontSize(9).font('Helvetica-Bold').text(`Amount: ₹${expense.amount.toLocaleString('en-IN')}`, 300, expenseY);
        
        if (expense.others) {
          doc.fontSize(9).font('Helvetica').text(`Notes: ${expense.others}`, 60, expenseY + 12);
        }
        
        doc.moveDown(1);
      });
    }
    
    // Add footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text('Generated by CrusherMate System', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text('Construction Management & Analytics', { align: 'center' });

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
