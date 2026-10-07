const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { buildMailtoLink, dateStamp } = require('../lib/helpers');
const { readSqueezeInputs, calculateSqueeze } = require('../lib/tensioner-solver');
const { createTensionerPdf } = require('../lib/pdf-tensioner');

const mailtoLink = buildMailtoLink(
  'rdesyani@n-sea.com',
  'Feedback about the Tensioner Squeeze Pressure Calculator',
  'Hi Rida,\n\nI have a question, suggestion or some feedback about the Tensioner Squeeze Pressure Calculator:\n\n'
);

router.get('/tensioner', (req, res) => {
  res.render('tensioner', { reportError: '', mailtoLink });
});

router.post('/tensioner', async (req, res) => {
  try {
    const inputs = readSqueezeInputs(req.body);
    const result = calculateSqueeze(inputs);
    const pdfBuffer = await createTensionerPdf(result);

    const filename = 'tensioner_squeeze_pressure_report_' + dateStamp() + '.pdf';
    const pdfPath = path.join(__dirname, '..', 'pdf', filename);
    fs.writeFileSync(pdfPath, pdfBuffer);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.render('tensioner', { reportError: err.message, mailtoLink });
  }
});

// URLs. The clean path is canonical; the .php path is what this tool was reached on
// when the site ran on PHP. It is kept as a redirect so existing bookmarks, mails and
// documents keep working — nothing on this server is PHP any more.
//
// 301 for GET, 308 for POST. 308 preserves the method and the body, so a form that
// somebody still has open on the old URL submits correctly instead of being silently
// turned into a GET and losing its input.
router.get('/Tensioner_Squeeze_Pressure_Calculator.php', (req, res) => res.redirect(301, '/tensioner'));
router.post('/Tensioner_Squeeze_Pressure_Calculator.php', (req, res) => res.redirect(308, '/tensioner'));

module.exports = router;
