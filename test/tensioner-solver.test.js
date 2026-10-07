const test = require('node:test');
const assert = require('node:assert');
const { readSqueezeInputs, calculateSqueeze } = require('../lib/tensioner-solver');

test('squeeze pressure follows tension divided by contact, friction and track factor', () => {
  const result = calculateSqueeze({
    cableMaximumTension: 150,
    tensionerContactLength: 4.9,
    frictionCoefficient: 0.4,
    allowableSqueezeLoad: 70
  });
  const expected = 150 / (4.9 * 0.4 * 2);
  assert.ok(Math.abs(result.squeezePressure - expected) < 1e-12);
  assert.ok(result.isWithinAllowable);
});

test('readSqueezeInputs rejects invalid inputs', () => {
  assert.throws(() => readSqueezeInputs({ cableMaximumTension: '-1' }), /tension/i);
  assert.throws(() => readSqueezeInputs({ tensionerContactLength: '0' }), /contact length/i);
  assert.throws(() => readSqueezeInputs({ frictionCoefficient: '0' }), /friction/i);
  assert.throws(() => readSqueezeInputs({ allowableSqueezeLoad: '0' }), /allowable/i);
});
