const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { buildMailtoLink, safeDocumentFileName } = require('../lib/helpers');
const { readReportInputs, calculateCatenary } = require('../lib/catenary-solver');
const { createCatenaryPdf } = require('../lib/pdf-catenary');

const mailtoLink = buildMailtoLink(
  'rdesyani@n-sea.com',
  'Feedback about the N-Sea Catenary Calculator',
  'Hi Rida,\n\nI have a question, suggestion or some feedback about the Catenary Calculator:\n\n'
);

router.get('/catenary', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('catenary', { reportError: '', mailtoLink });
});

router.post('/catenary', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const inputs = readReportInputs(req.body);
    const result = calculateCatenary(inputs);
    const pdfBuffer = await createCatenaryPdf(result);

    const filename = safeDocumentFileName(
      [inputs.projectNumber, inputs.projectName, inputs.revision],
      'Catenary Calculation Report',
      'pdf'
    );
    const pdfPath = path.join(__dirname, '..', 'pdf', filename);
    fs.writeFileSync(pdfPath, pdfBuffer);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.render('catenary', { reportError: err.message, mailtoLink });
  }
});

// URLs. The clean path is canonical; the .php path is what this tool was reached on
// when the site ran on PHP. It is kept as a redirect so existing bookmarks, mails and
// documents keep working — nothing on this server is PHP any more.
//
// 301 for GET, 308 for POST. 308 preserves the method and the body, so a form that
// somebody still has open on the old URL submits correctly instead of being silently
// turned into a GET and losing its input.
router.get('/Catenary_Calculator.php', (req, res) => res.redirect(301, '/catenary'));
router.post('/Catenary_Calculator.php', (req, res) => res.redirect(308, '/catenary'));

module.exports = router;
