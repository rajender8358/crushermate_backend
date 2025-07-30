const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
fs.ensureDirSync(TEMP_DIR);

const formatCurrency = amount => `Rs. ${amount.toLocaleString('en-IN')}`;
const formatDate = dateString =>
  new Date(dateString).toLocaleDateString('en-IN');
const formatTime = timeString => {
  if (!timeString) return '';
  const [hour, minute] = timeString.split(':');
  return `${parseInt(hour, 10) % 12 || 12}:${minute} ${
    parseInt(hour, 10) >= 12 ? 'PM' : 'AM'
  }`;
};

const generatePdf = data => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 20,
      size: 'A4',
      info: {
        Title: 'CrusherMate Financial Statement',
        Author: 'CrusherMate System',
        Subject: 'Truck Entry Statement',
        Keywords: 'crusher, truck, financial, statement',
      },
    });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Simple colors for bank statement style
    const colors = {
      header: '#2C3E50',
      white: '#FFFFFF',
      black: '#000000',
      gray: '#95A5A6',
      lightGray: '#ECF0F1',
      border: '#BDC3C7',
    };

    // Full page dimensions
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // 1. HEADER - Simple bank statement style
    doc.rect(0, 0, pageWidth, 60).fill(colors.header);
    doc.fillColor(colors.white);
    doc.fontSize(24).font('Helvetica-Bold').text('CrusherMate', margin, 15);
    doc.fontSize(12).font('Helvetica').text('Financial Statement', margin, 45);

    // Reset colors
    doc.fillColor(colors.black);

    // 2. REPORT INFO - Simple layout
    const infoY = 80;
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Statement Period:', margin, infoY);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(
        `${formatDate(data.reportInfo.dateRange.startDate)} - ${formatDate(
          data.reportInfo.dateRange.endDate,
        )}`,
        margin,
        infoY + 20,
      );
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Generated: ${new Date().toLocaleDateString('en-IN')}`,
        margin,
        infoY + 35,
      );

    // 3. SUMMARY SECTION - Simple grid like bank statement
    const summaryY = 140;
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Account Summary', margin, summaryY);

    // Simple summary table
    const summaryTableY = summaryY + 25;
    const summaryCols = [
      { label: 'Total Sales', value: formatCurrency(data.summary.totalSales) },
      {
        label: 'Raw Stone Cost',
        value: formatCurrency(data.summary.totalRawStone),
      },
      { label: 'Net Profit', value: formatCurrency(data.summary.netIncome) },
      { label: 'Total Entries', value: data.summary.totalEntries.toString() },
    ];

    summaryCols.forEach((item, index) => {
      const rowY = summaryTableY + index * 25;
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(item.label + ':', margin, rowY);
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(item.value, margin + 150, rowY);
    });

    // 4. TRANSACTIONS TABLE - Simple bank statement style
    const tableY = summaryY + 150;
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Transaction History', margin, tableY);

    // Simple table headers
    const headers = [
      'Date',
      'Time',
      'Truck No.',
      'Type',
      'Material',
      'Units',
      'Amount',
    ];
    const colPositions = [
      margin,
      margin + 80,
      margin + 140,
      margin + 220,
      margin + 280,
      margin + 350,
      margin + 400,
    ];

    // Header row
    doc
      .fillColor(colors.header)
      .rect(margin, tableY + 15, contentWidth, 20)
      .fill();
    doc.fillColor(colors.white);
    headers.forEach((header, index) => {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(header, colPositions[index], tableY + 20);
    });

    // Reset colors
    doc.fillColor(colors.black);

    // Data rows
    let currentY = tableY + 45;
    data.entries.forEach((entry, index) => {
      // Simple alternating background
      if (index % 2 === 0) {
        doc
          .fillColor(colors.lightGray)
          .rect(margin, currentY - 5, contentWidth, 20)
          .fill();
      }
      doc.fillColor(colors.black);

      // Row data
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(formatDate(entry.date), colPositions[0], currentY);
      doc.text(formatTime(entry.time), colPositions[1], currentY);
      doc.text(entry.truckNumber, colPositions[2], currentY);
      doc.text(entry.entryType, colPositions[3], currentY);
      doc.text(entry.materialType || 'N/A', colPositions[4], currentY);
      doc.text(entry.units.toString(), colPositions[5], currentY);
      doc
        .font('Helvetica-Bold')
        .text(formatCurrency(entry.totalAmount), colPositions[6], currentY);
      doc.font('Helvetica');

      currentY += 25;
    });

    // Simple table border
    doc.strokeColor(colors.border).lineWidth(1);
    doc
      .rect(margin, tableY + 15, contentWidth, currentY - tableY - 10)
      .stroke();

    // 5. FOOTER - Simple bank statement footer
    const footerY = pageHeight - 60;
    doc.fillColor(colors.gray);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Generated by CrusherMate System', margin, footerY);
    doc.text('This is an automated financial statement.', margin, footerY + 15);
    doc.text('Page 1 of 1', margin + contentWidth - 60, footerY, {
      align: 'right',
    });

    doc.end();
  });
};

module.exports = {
  generatePdf,
};
