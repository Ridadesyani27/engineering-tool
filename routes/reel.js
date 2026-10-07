const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { buildMailtoLink, safeDocumentFileName } = require('../lib/helpers');
const { readReelInputs, calculateReel } = require('../lib/reel-solver');
const { createReelPdf } = require('../lib/pdf-reel');

const mailtoLink = buildMailtoLink(
  'rdesyani@n-sea.com',
  'Feedback about the N-Sea Reel Drive Volume Calculator',
  'Hi Rida,\n\nI have a question, suggestion or some feedback about the Reel Drive Volume Calculator:\n\n'
);

router.get('/reel', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('reel', { reportError: '', mailtoLink });
});

router.post('/reel', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const inputs = readReelInputs(req.body);
    const result = calculateReel(inputs);
    const pdfBuffer = await createReelPdf(result);

    const filename = safeDocumentFileName(
      [inputs.projectNumber, inputs.projectName, inputs.revision],
      'Reel Drive Stowage Report',
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
    res.render('reel', { reportError: err.message, mailtoLink });
  }
});

// URLs. The clean path is canonical; the .php path is what this tool was reached on
// when the site ran on PHP. It is kept as a redirect so existing bookmarks, mails and
// documents keep working — nothing on this server is PHP any more.
//
// 301 for GET, 308 for POST. 308 preserves the method and the body, so a form that
// somebody still has open on the old URL submits correctly instead of being silently
// turned into a GET and losing its input.
router.get('/Reel_Drive_Volume_Calculator.php', (req, res) => res.redirect(301, '/reel'));
router.post('/Reel_Drive_Volume_Calculator.php', (req, res) => res.redirect(308, '/reel'));

module.exports = router;
