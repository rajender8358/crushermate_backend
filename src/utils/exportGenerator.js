const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Removed temp directory creation for serverless compatibility
// const TEMP_DIR = path.join(__dirname, '..', 'temp');
// fs.ensureDirSync(TEMP_DIR);

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
      {
        label: 'Total Sales',
        value: formatCurrency(data.summary?.totalSales || 0),
      },
      {
        label: 'Raw Stone Cost',
        value: formatCurrency(data.summary?.totalRawStone || 0),
      },
      {
        label: 'Expenses',
        value: formatCurrency(data.summary?.totalOtherExpenses || 0),
      },
      {
        label: 'Net Profit',
        value: formatCurrency(
          data.summary?.netProfit ||
            (data.summary?.totalSales || 0) -
              (data.summary?.totalRawStone || 0) -
              (data.summary?.totalOtherExpenses || 0),
        ),
      },
      {
        label: 'Total Entries',
        value: (data.summary?.totalEntries || 0).toString(),
      },
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

    // Helper: add page if needed
    const bottomMargin = 60;
    let currentY = summaryY + 20 + 130; // reserve space after summary

    function ensureSpace(required) {
      if (currentY + required > pageHeight - bottomMargin) {
        doc.addPage();
        // reset header band for new page (optional minimal)
        doc.fillColor(colors.black);
        currentY = margin;
      }
    }

    function drawSectionTitle(title) {
      ensureSpace(30);
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(colors.header)
        .text(title, margin, currentY);
      currentY += 8;
      doc
        .fillColor(colors.border)
        .moveTo(margin, currentY)
        .lineTo(margin + contentWidth, currentY)
        .stroke();
      doc.fillColor(colors.black);
      currentY += 10;
    }

    function drawTable(headers, rows, widths, align = []) {
      // header bar
      const rowHeight = 18;
      ensureSpace(30);
      doc
        .fillColor(colors.header)
        .rect(margin, currentY, contentWidth, rowHeight)
        .fill();
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10);
      let x = margin;
      headers.forEach((h, i) => {
        const w = widths[i];
        doc.text(h, x + 4, currentY + 4, {
          width: w - 8,
          align: align[i] || 'left',
        });
        x += w;
      });
      currentY += rowHeight;

      // rows
      doc.fillColor(colors.black).font('Helvetica').fontSize(9);
      rows.forEach((row, idx) => {
        ensureSpace(rowHeight + 4);
        // zebra
        if (idx % 2 === 0) {
          doc
            .fillColor(colors.lightGray)
            .rect(margin, currentY, contentWidth, rowHeight)
            .fill();
          doc.fillColor(colors.black);
        }
        let x = margin;
        row.forEach((cell, i) => {
          const w = widths[i];
          doc.text(String(cell ?? ''), x + 4, currentY + 4, {
            width: w - 8,
            align: align[i] || 'left',
          });
          x += w;
        });
        currentY += rowHeight;
      });
      currentY += 10; // space after table
    }

    // Group data
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const sales = entries.filter(
      e => (e.entryType || '').toLowerCase() === 'sales',
    );
    const rawStones = entries.filter(e => {
      const t = (e.entryType || '').toLowerCase();
      return t === 'raw stone' || t === 'rawstone';
    });
    const expenses = entries.filter(
      e => (e.entryType || '').toLowerCase() === 'expense',
    );

    // SALES TABLE
    drawSectionTitle('Sales');
    const salesHeaders = [
      'Date',
      'Truck No',
      'Material',
      'Units',
      'Rate',
      'Amount',
    ];
    const salesWidths = [90, 90, 150, 60, 80, 95];
    const salesRows = sales.map(e => [
      formatDate(e.date),
      e.truckNumber || '—',
      e.materialType || '—',
      e.units ?? '—',
      e.ratePerUnit != null ? formatCurrency(Number(e.ratePerUnit)) : '—',
      e.totalAmount != null ? formatCurrency(Number(e.totalAmount)) : '—',
    ]);
    drawTable(salesHeaders, salesRows, salesWidths, [
      'left',
      'left',
      'left',
      'right',
      'right',
      'right',
    ]);

    // RAW STONE TABLE
    drawSectionTitle('Raw Stone');
    const rawHeaders = ['Date', 'Truck No', 'Units', 'Rate', 'Amount'];
    const rawWidths = [120, 120, 70, 100, 165];
    const rawRows = rawStones.map(e => [
      formatDate(e.date),
      e.truckNumber || '—',
      e.units ?? '—',
      e.ratePerUnit != null ? formatCurrency(Number(e.ratePerUnit)) : '—',
      e.totalAmount != null ? formatCurrency(Number(e.totalAmount)) : '—',
    ]);
    drawTable(rawHeaders, rawRows, rawWidths, [
      'left',
      'left',
      'right',
      'right',
      'right',
    ]);

    // EXPENSES TABLE
    drawSectionTitle('Expenses');
    const expHeaders = ['Date', 'Expense Name', 'Amount', 'Notes'];
    const expWidths = [90, 170, 90, contentWidth - 90 - 170 - 90];
    const expRows = expenses.map(e => [
      formatDate(e.date),
      e.materialType || 'Expense',
      e.totalAmount != null ? formatCurrency(Number(e.totalAmount)) : '—',
      e.description || '',
    ]);
    drawTable(expHeaders, expRows, expWidths, [
      'left',
      'left',
      'right',
      'left',
    ]);

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
