const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { getCarouselData } = require('../lib/carousel-data');
const { calculateCarousel } = require('../lib/carousel-solver');

test('carousel crush warnings check every layer and appear in the PDF at the correct thresholds', async () => {
  const data = getCarouselData();
  const input = {
    ...data.defaults, vessel: 'Curo', carousel_mode: 'dual partition',
    cable_types: [{ name: 'Cable', od: 230, unit_weight: 80, allowable: 50, color: '#008c72' }],
    cables: [{ name: 'Cable', length: 1810, type: 'Cable', partition: 'inner' }]
  };
  for (const utilization of [90, 90.1, 100, 100.1]) {
    const result = calculateCarousel(input, data.vesselDatabase);
    result.detailed.forEach(row => { row['Crush_utilization [%]'] = 0; });
    // The flagged layer differs from the highest-load layer in the summary.
    result.detailed[1]['Crush_utilization [%]'] = utilization;
    const html = await ejs.renderFile(path.join(__dirname, '../views/carousel.ejs'), {
      ...data, input, result, graphData: { partitions: {} },
      mailtoLink: '', reportError: '', submitted: true
    });
    const phrase = utilization > 100
      ? 'NOT OK: Allowable crush load exceeded'
      : 'WARNING: Crush-load utilization exceeds 90%';
    assert.equal(html.split(phrase).length - 1, utilization > 90 ? 2 : 0);
    if (utilization > 90) assert.ok(html.includes('Inner Partition, Layer 2:'));
  }
});
