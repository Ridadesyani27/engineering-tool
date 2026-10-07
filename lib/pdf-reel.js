const PDFDocument = require('pdfkit');
const { fmtNum } = require('./helpers');
const { reelReportRows } = require('./reel-solver');

const PAGE_H = 842;
const BRAND_BLUE = [41, 55, 138];
const MUTED = [110, 112, 120];
const WHITE = [255, 255, 255];

function flipY(y) { return PAGE_H - y; }
function fitText(text, maxChars = 60, fallback = '-') {
  const value = String(text || '').trim();
  if (!value) return fallback;
  return value.length > maxChars ? value.slice(0, Math.max(0, maxChars - 3)) + '...' : value;
}

function createReelPdf(r) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // White background
    doc.rect(0, 0, 595, 842).fill(WHITE);
    doc.rect(40, flipY(802), 515, 762).fill(WHITE);

    // Blue banner
    doc.rect(40, flipY(802), 515, 80).fill(BRAND_BLUE);
    // Blue top bar
    doc.rect(40, flipY(807), 515, 5).fill(BRAND_BLUE);

    // Logo placeholder area
    doc.rect(58, flipY(794), 55, 60).fill(WHITE);
    // Fallback logo rectangles (yellow N-shape)
    doc.rect(64, flipY(789), 12, 34).fill([255, 240, 0]);
    doc.rect(94, flipY(789), 12, 34).fill([255, 240, 0]);
    doc.rect(64, flipY(795), 42, 8).fill([255, 240, 0]);
    // SEA text
    doc.font('Helvetica-Bold').fontSize(18).fillColor([0, 0, 0])
      .text('SEA', 64, flipY(738 + 13), { lineBreak: false });

    // Title
    doc.font('Helvetica-Bold').fontSize(22).fillColor(WHITE)
      .text('Reel Drive Stowage Report', 128, flipY(761 + 16), { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor([224, 230, 247])
      .text('Cable capacity and stowage assessment', 128, flipY(748 + 9), { lineBreak: false });

    // Project information
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_BLUE)
      .text('Project Information', 60, flipY(695 + 10), { lineBreak: false });

    doc.rect(60, flipY(680), 475, 68).fill([251, 252, 253]);
    doc.rect(60, flipY(680), 475, 68).lineWidth(0.5).stroke([201, 204, 214]);
    const projectRows = [
      ['Project Name', fitText(r.projectName, 36)],
      ['Project Number', fitText(r.projectNumber, 32)],
      ['Revision', fitText(r.revision, 16)],
      ['Author', fitText(r.author, 26)]
    ];
    const projectPositions = [[74, 658], [302, 658], [74, 632], [302, 632]];
    projectRows.forEach((row, index) => {
      const [x, y] = projectPositions[index];
      doc.font('Helvetica').fontSize(8).fillColor(MUTED)
        .text(row[0].toUpperCase(), x, flipY(y + 10 + 8), { lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor([26, 31, 46])
        .text(row[1], x, flipY(y + 10), { lineBreak: false });
    });

    // Details heading
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_BLUE)
      .text('Calculation Details', 60, flipY(586 + 10), { lineBreak: false });

    // Table header
    doc.rect(60, flipY(579), 475, 20).fill(BRAND_BLUE);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text('Parameter', 72, flipY(566 + 9), { lineBreak: false });
    doc.text('Value', 330, flipY(566 + 9), { lineBreak: false });

    // Table rows
    const rows = reelReportRows(r);
    let ty = 540;
    rows.forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.rect(60, flipY(ty + 12), 475, 17).fill([247, 247, 247]);
      }
      doc.font('Helvetica').fontSize(9).fillColor([33, 33, 33])
        .text(row[0], 72, flipY(ty + 7), { lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(BRAND_BLUE)
        .text(row[1], 330, flipY(ty + 7), { lineBreak: false });
      ty -= 17;
    });

    doc.end();
  });
}

module.exports = { createReelPdf };
