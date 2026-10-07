const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { getCarouselData } = require('../lib/carousel-data');
const { calculateCarousel } = require('../lib/carousel-solver');

const payload = '</ScRiPt><script>globalThis.injected = true</script><!--';
const render = (view, locals) => ejs.renderFile(path.join(__dirname, '../views', view + '.ejs'), locals);

function inlineJson(html, name) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  const script = scripts.find(match => match[1].includes(`const ${name} = `));
  assert.ok(script, `${name} remains inside its script`);
  const value = script[1].match(new RegExp(`const ${name} = (.*);`))[1];
  assert.ok(!value.includes('<'), `${name} cannot terminate its script`);
  return JSON.parse(value);
}

test('carousel inline JSON cannot break out of the script and preserves submitted text', async () => {
  const data = getCarouselData();
  const input = {
    ...data.defaults, project: payload,
    cable_types: [{ name: 'Test cable', od: 230, unit_weight: 80, allowable: 50, color: '#008c72' }],
    cables: [{ name: payload, length: 1810, type: 'Test cable', partition: 'inner' }]
  };
  const result = calculateCarousel(input, data.vesselDatabase);
  result.errors.push(payload);
  const html = await render('carousel', {
    ...data, input, result, graphData: { partitions: { [payload]: payload } },
    mailtoLink: '', reportError: '', submitted: true
  });
  assert.ok(!html.includes(payload));
  assert.equal(inlineJson(html, 'projectState').project, payload);
  assert.equal(inlineJson(html, 'carouselGraphData').partitions[payload], payload);
  assert.ok(Object.hasOwn(inlineJson(html, 'carouselCableColors'), payload));
  assert.ok(Array.isArray(inlineJson(html, 'carouselPartitions')));
  assert.equal(inlineJson(html, 'carouselSubmitted'), true);
  assert.ok(inlineJson(html, 'carouselResultSnapshot').errors.includes(payload));
});

test('tensioner report errors cannot inject scripts and preserve their text', async () => {
  const html = await render('tensioner', { reportError: payload, mailtoLink: '' });
  assert.ok(!html.includes(payload));
  assert.equal(inlineJson(html, 'initialReportError'), payload);
});

test('operational limit JSON cannot terminate its script', async () => {
  const html = await render('operational-limit', {
    mailtoLink: '', scriptVersion: 1, operationLimitData: JSON.stringify({ label: payload })
  });
  assert.ok(!html.includes(payload));
  const json = html.match(/window.OPERATION_LIMIT_DATA = (.*);/)[1];
  assert.ok(!json.includes('<'));
  assert.equal(JSON.parse(json).label, payload);
});
