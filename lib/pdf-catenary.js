const PDFDocument = require('pdfkit');
const { fmtNum } = require('./helpers');
const { reportRows } = require('./catenary-solver');

const PAGE_H = 842;
const BRAND_BLUE = [41, 55, 138];
const MUTED = [110, 112, 120];
const WHITE = [255, 255, 255];

function flipY(y) { return PAGE_H - y; }

function createCatenaryPdf(r) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Background
    doc.rect(0, 0, 595, 842).fill([242, 242, 242]);
    // White content area
    doc.rect(40, flipY(802), 515, 762).fill(WHITE);

    // Yellow banner
    doc.rect(40, flipY(802), 515, 80).fill([255, 240, 0]);
    // Blue top bar
    doc.rect(40, flipY(807), 515, 5).fill(BRAND_BLUE);

    // Title
    doc.font('Helvetica-Bold').fontSize(22).fillColor(BRAND_BLUE)
      .text('Cable Catenary Calculation Report', 60, flipY(766 + 16), { lineBreak: false });
    // Date
    doc.font('Helvetica').fontSize(10).fillColor(BRAND_BLUE)
      .text('Generated: ' + new Date().toISOString().replace('T', ' ').slice(0, 19), 60, flipY(746 + 8), { lineBreak: false });

    // Summary heading
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_BLUE)
      .text('Summary', 60, flipY(700 + 10), { lineBreak: false });

    // Summary cards
    const cards = [
      ['Bottom tension', fmtNum(r.bottomTension, 3) + ' t'],
      ['Onboard tension', fmtNum(r.onboardTension, 3) + ' t'],
      ['Catenary length', fmtNum(r.length, 1) + ' m'],
      ['Departure angle', fmtNum(r.angle, 1) + ' deg']
    ];
    let cx = 60;
    for (const card of cards) {
      doc.rect(cx, flipY(685), 115, 45).fill([243, 245, 251]);
      doc.rect(cx, flipY(685), 115, 45).lineWidth(0.5).stroke([217, 219, 230]);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED)
        .text(card[0].toUpperCase(), cx + 10, flipY(669 + 6), { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(BRAND_BLUE)
        .text(card[1], cx + 10, flipY(649 + 11), { lineBreak: false });
      cx += 125;
    }

    // Details heading
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_BLUE)
      .text('Calculation details', 60, flipY(608 + 10), { lineBreak: false });

    // Table header
    doc.rect(60, flipY(602), 475, 20).fill(BRAND_BLUE);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text('Parameter', 72, flipY(589 + 7), { lineBreak: false });
    doc.text('Value', 330, flipY(589 + 7), { lineBreak: false });

    // Table rows
    const rows = reportRows(r);
    let ty = 562;
    rows.forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.rect(60, flipY(ty + 13), 475, 18).fill([247, 247, 247]);
      }
      doc.font('Helvetica').fontSize(9).fillColor([33, 33, 33])
        .text(row[0], 72, flipY(ty + 7), { lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(BRAND_BLUE)
        .text(row[1], 330, flipY(ty + 7), { lineBreak: false });
      ty -= 20;
    });

    // Chart heading
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_BLUE)
      .text('Catenary profile', 60, flipY(320 + 10), { lineBreak: false });

    // Chart area
    const gx = 70, gy = 105, gw = 455, gh = 190;
    const chartTop = flipY(gy + gh);
    doc.rect(gx, chartTop, gw, gh).fill(WHITE);
    doc.rect(gx, chartTop, gw, gh).lineWidth(0.5).stroke([217, 219, 230]);

    const xMax = r.layback * 1.08;
    const yMin = -r.waterDepthLat * 1.08;
    const yMax = Math.max(1, (r.waterLevel + r.chuteHeight) * 1.18);
    const px = x => gx + (x / xMax) * gw;
    const py = y => flipY(gy + ((y - yMin) / (yMax - yMin)) * gh);

    // Water line
    doc.moveTo(gx, py(r.waterLevel)).lineTo(gx + gw, py(r.waterLevel)).lineWidth(1).stroke([140, 189, 204]);
    // Seabed line
    doc.moveTo(gx, py(-r.waterDepthLat)).lineTo(gx + gw, py(-r.waterDepthLat)).lineWidth(1.5).stroke([153, 153, 153]);

    // Catenary curve
    doc.lineWidth(2.5).strokeColor(BRAND_BLUE);
    r.points.forEach((point, i) => {
      const x = px(point.x), y = py(point.y);
      if (i === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    });
    doc.stroke();

    // Axis label
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('Layback (m)', gx + (gw / 2) - 25, flipY(gy - 16 + 6), { lineBreak: false });

    // Disclaimer
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('Static ideal catenary calculation. Dynamic effects, drag, stiffness and seabed interaction are excluded.', 60, flipY(68 + 6), { lineBreak: false });

    doc.end();
  });
}

module.exports = { createCatenaryPdf };
