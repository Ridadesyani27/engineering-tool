const test = require('node:test');
const assert = require('node:assert');
const { getCarouselData } = require('../lib/carousel-data');
const { calculateCarousel } = require('../lib/carousel-solver');

test('default carousel calculation stows the expected partitions', () => {
  const data = getCarouselData();
  const sampleInput = {
    ...data.defaults,
    project: 'Rida is the best',
    project_number: 'PJ00359',
    revision: '1.0',
    vessel: 'Curo',
    carousel_mode: 'dual partition',
    partition_extension: 'no',
    stowing_factor: 0.866,
    cable_types: [
      { name: 'HOW Recover', od: 230, unit_weight: 80, allowable: 50, color: '#008C72' },
      { name: 'HOW Spare', od: 120, unit_weight: 36, allowable: 50, color: '#7C4DFF' }
    ],
    cables: [
      { name: 'HOW Recover', length: 1810, type: 'HOW Recover', partition: 'inner' },
      { name: 'HOW Spare', length: 3000, type: 'HOW Spare', partition: 'outer' }
    ]
  };
  const result = calculateCarousel(sampleInput, data.vesselDatabase);

  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.summary.length, 2);
  assert.strictEqual(result.detailed.length, 18);
  assert.strictEqual(result.wrapRows.length, 151);

  const inner = result.summary.find(row => row.Partition === 'inner');
  const outer = result.summary.find(row => row.Partition === 'outer');
  assert.ok(inner);
  assert.ok(outer);
  assert.strictEqual(inner.Stop_reason, 'Partition capacity limit reached');
  assert.ok(Math.abs(inner.Total_weight - 130) < 1e-9);
  assert.ok(Math.abs(outer.Total_length_stowed - 3000) < 1e-9);
});
