// The reel solver, tested against the geometry it claims to model.
const test = require('node:test');
const assert = require('node:assert');
const { readReelInputs, calculateReel } = require('../lib/reel-solver');

const base = { cableOd: 200, outerFlange: 15, unusedArea: 0.5, innerFlange: 5,
               drumWidth: 5, stowageFactor: 1, cableLength: 3000, leadSheaveAngle: 2 };

test('capacity is the sum of the layer capacities it reports', () => {
  const r = calculateReel({ ...base, cableLength: 1e6 });   // never fits, so all layers run
  const summed = r.layerData.reduce((t, l) => t + l.layerCapacity, 0);
  assert.ok(Math.abs(summed - r.capacity) < 1e-6, `${summed} vs ${r.capacity}`);
});

test('each layer holds pi * centreline * wraps, divided by the stowage factor', () => {
  const r = calculateReel({ ...base, cableLength: 1e6 });
  const cableOdM = base.cableOd / 1000;
  const wraps = Math.floor(base.drumWidth / cableOdM);
  for (const l of r.layerData.slice(0, 5)) {
    const expected = Math.PI * l.centerlineHeight * wraps / base.stowageFactor;
    assert.ok(Math.abs(l.layerCapacity - expected) < 1e-9, `layer ${l.layer}`);
  }
});

test('outer layers hold more than inner layers', () => {
  const r = calculateReel({ ...base, cableLength: 1e6 });
  for (let i = 1; i < r.layerData.length; i++) {
    assert.ok(r.layerData[i].layerCapacity > r.layerData[i - 1].layerCapacity,
      `layer ${i + 1} should hold more than layer ${i}`);
  }
});

test('a cable within capacity fits, one beyond it does not', () => {
  const probe = calculateReel({ ...base, cableLength: 1e6 });
  assert.strictEqual(calculateReel({ ...base, cableLength: probe.capacity * 0.5 }).fits, true);
  assert.strictEqual(calculateReel({ ...base, cableLength: probe.capacity * 2 }).fits, false);
});

test('a thicker stowage factor reduces capacity', () => {
  const tight = calculateReel({ ...base, stowageFactor: 1, cableLength: 1e6 });
  const loose = calculateReel({ ...base, stowageFactor: 2, cableLength: 1e6 });
  assert.ok(loose.capacity < tight.capacity);
});

test('readReelInputs rejects geometry that cannot hold a single wrap', () => {
  assert.throws(() => readReelInputs({ ...base, drumWidth: 0.1 }), /width/i);
  assert.throws(() => readReelInputs({ ...base, cableOd: 0 }), /diameter/i);
  assert.throws(() => readReelInputs({ ...base, leadSheaveAngle: 90 }), /angle/i);
  assert.throws(() => readReelInputs({ ...base, leadSheaveAngle: 0 }), /angle/i);
});

// Regression. A thin cable in a tall flange with a cable that never fits used to run the
// layer loop five million times, allocating a row each pass, and hand that array to the
// PDF writer. Reachable by POST from any signed-in account.
test('an impossible number of layers is refused instead of allocated', () => {
  const t0 = Date.now();
  assert.throws(
    () => calculateReel({ cableOd: 1, outerFlange: 10000, unusedArea: 0, innerFlange: 1,
                          drumWidth: 0.002, stowageFactor: 1, cableLength: 1e15, leadSheaveAngle: 2 }),
    /not a physical reel/i);
  assert.ok(Date.now() - t0 < 1000, 'should refuse immediately, not after building the table');
});
