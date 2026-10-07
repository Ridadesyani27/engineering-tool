const PDFDocument = require('pdfkit');
const { squeezeReportRows } = require('./tensioner-solver');

const BRAND_BLUE = [41, 55, 138];
const WHITE = [255, 255, 255];

function createTensionerPdf(r) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.rect(40, 40, 515, 762).fill(WHITE);
    doc.rect(40, 40, 515, 80).fill(BRAND_BLUE);
    doc.rect(58, 52, 55, 60).fill(WHITE);
    doc.rect(64, 58, 12, 34).fill([255, 240, 0]);
    doc.rect(94, 58, 12, 34).fill([255, 240, 0]);
    doc.rect(64, 52, 42, 8).fill([255, 240, 0]);
    doc.font('Helvetica-Bold').fontSize(18).fillColor([0, 0, 0]).text('SEA', 64, 93);

    doc.font('Helvetica-Bold').fontSize(20).fillColor(WHITE)
      .text('Tensioner Squeeze Pressure Report', 128, 65, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor([224, 230, 247])
      .text('Cable hold-back squeeze load check', 128, 92, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_BLUE)
      .text('Calculation Details', 60, 147, { lineBreak: false });
    doc.rect(60, 174, 475, 20).fill(BRAND_BLUE);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text('Parameter', 72, 180, { lineBreak: false });
    doc.text('Value', 330, 180, { lineBreak: false });

    let y = 209;
    squeezeReportRows(r).forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(60, y - 5, 475, 17).fill([247, 247, 247]);
      const valueColor = row[0] === 'Status' && !r.isWithinAllowable ? [161, 61, 61] : BRAND_BLUE;
      doc.font('Helvetica').fontSize(8.5).fillColor([33, 33, 33])
        .text(row[0], 72, y, { lineBreak: false });
      doc.font('Helvetica').fontSize(row[0] === 'Status' ? 7 : 8.5).fillColor(valueColor)
        .text(row[1], 330, y, { width: 185 });
      y += 20;
    });

    doc.font('Helvetica').fontSize(8).fillColor([110, 112, 120])
      .text('N-Sea Cable Engineering Tools', 60, 764, { lineBreak: false });

    doc.end();
  });
}

module.exports = { createTensionerPdf };
