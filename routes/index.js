const express = require('express');
const router = express.Router();
const fs = require('fs');
const { buildMailtoLink } = require('../lib/helpers');

const mailtoLink = buildMailtoLink(
  'rdesyani@n-sea.com',
  'Feedback about the N-Sea Cable Engineering Tools dashboard',
  'Hi Rida,\n\nI have a question, suggestion or some feedback about the Cable Engineering Tools dashboard:\n\n'
);

const tools = [
  {
    title: 'Cable Catenary Calculator',
    subtitle: 'Cable catenary profile and tension tool',
    description: 'Calculate cable profile, suspended length, bend radius, chute angle and tensions for an ideal static catenary.',
    href: '/catenary',
    status: 'Available',
    tag: 'Cable Engineering Tools'
  },
  {
    title: 'Reel Drive Volume Calculator',
    subtitle: 'Reel capacity and fleet angle tool',
    description: 'Calculate reel drum cable capacity, estimated number of layers, cable fit status and minimum lead sheave distance.',
    href: '/reel',
    status: 'Available',
    tag: 'Cable Engineering Tools'
  },
  {
    title: 'Operational Limit Assessment',
    subtitle: 'Weather assessment and operation limits tool',
    description: 'Assess operational limits using forecast timing, alpha factors, wave limits and wind speed checks.',
    href: '/operational-limit',
    status: 'Available',
    tag: 'Cable Engineering Tools'
  },
  {
    title: 'Tensioner Squeeze Pressure Calculator',
    subtitle: 'Cable hold-back squeeze load check',
    description: 'Calculate required squeeze pressure and utilization against the allowable cable squeeze load.',
    href: '/tensioner',
    status: 'Available',
    tag: 'Cable Engineering Tools'
  },
  {
    title: 'Carousel Stowage Calculation',
    subtitle: 'Carousel partition stowing and crush load check',
    description: 'Calculate cable stowage by vessel partition, including layer placement, length stowed, capacity use, elevation and crush load utilization.',
    href: '/carousel',
    status: 'Available',
    tag: 'Cable Engineering Tools'
  }
];

function renderDashboardOrOpLimit(req, res) {
  const activeTool = req.query.tool || 'dashboard';

  if (activeTool === 'operational-limit') {
    const dataPath = require.resolve('../lib/data/olt-data.json');
    const scriptPath = require.resolve('../public/operational-limit.js');

    let operationLimitData = '{}';
    if (fs.existsSync(dataPath)) {
      operationLimitData = fs.readFileSync(dataPath, 'utf8');
    }
    const scriptVersion = fs.existsSync(scriptPath) ? fs.statSync(scriptPath).mtimeMs : Date.now();

    res.render('operational-limit', { mailtoLink, operationLimitData, scriptVersion });
  } else {
    res.render('index', { tools, mailtoLink });
  }
}

router.get('/', renderDashboardOrOpLimit);

// The operational-limit tool used to be a query parameter on index.php rather than a
// page of its own. It now has a real path; the query form still works so an old link
// lands in the right place.
router.get('/operational-limit', (req, res) => {
  req.query.tool = 'operational-limit';
  renderDashboardOrOpLimit(req, res);
});

// Legacy PHP entry point. Nothing here is PHP any more — see the note in the tool
// routers. Sends the operational-limit query to its own path, everything else home.
router.get('/index.php', (req, res) =>
  res.redirect(301, req.query.tool === 'operational-limit' ? '/operational-limit' : '/'));

module.exports = router;
