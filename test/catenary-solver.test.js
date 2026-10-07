// The catenary solver, tested against the physics rather than against itself.
//
// calculateCatenary finds the catenary parameter `a` by bisection, such that
//     a * (cosh(layback / a) - 1) = waterDepth + chuteHeight
// Asserting the returned numbers against hardcoded values would only prove the code
// still does what it did. These tests assert the relation it is supposed to satisfy,
// so they stay meaningful if the solver is ever rewritten.
const test = require('node:test');
const assert = require('node:assert');
const { readReportInputs, calculateCatenary } = require('../lib/catenary-solver');

const base = { wetWeight: 37, minRadius: 3, maxTension: 20.7, layback: 25, waterDepth: 30, chuteHeight: 10 };

test('the solution satisfies the catenary equation', () => {
  for (const depth of [5, 30, 100, 400]) {
    const v = { ...base, waterDepth: depth };
    const r = calculateCatenary(v);
    const total = v.waterDepth + v.chuteHeight;
    const residual = r.a * (Math.cosh(v.layback / r.a) - 1) - total;
    assert.ok(Math.abs(residual) < 1e-6,
      `depth ${depth}: residual ${residual}, a=${r.a}`);
  }
});

test('deeper water at the same layback raises the tension', () => {
  const shallow = calculateCatenary({ ...base, waterDepth: 20 });
  const deep = calculateCatenary({ ...base, waterDepth: 200 });
  assert.ok(deep.onboardTension > shallow.onboardTension,
    `expected deeper to pull harder: ${deep.onboardTension} vs ${shallow.onboardTension}`);
});

test('a heavier cable raises the tension proportionally', () => {
  const light = calculateCatenary({ ...base, wetWeight: 37 });
  const heavy = calculateCatenary({ ...base, wetWeight: 74 });
  // Weight scales the force but not the shape, so `a` is unchanged and tension doubles.
  assert.ok(Math.abs(heavy.a - light.a) < 1e-9, 'shape should not depend on weight');
  assert.ok(Math.abs(heavy.onboardTension / light.onboardTension - 2) < 1e-6,
    `expected double, got ${heavy.onboardTension / light.onboardTension}`);
});

test('suspended length is at least the straight-line distance', () => {
  const v = { ...base, waterDepth: 60 };
  const r = calculateCatenary(v);
  const straight = Math.hypot(v.layback, v.waterDepth + v.chuteHeight);
  assert.ok(r.length >= straight,
    `a curve cannot be shorter than the chord: ${r.length} < ${straight}`);
});

test('the departure angle stays within a quarter turn', () => {
  for (const layback of [1, 25, 500]) {
    const r = calculateCatenary({ ...base, layback });
    assert.ok(r.angle > 0 && r.angle < 90, `layback ${layback} gave ${r.angle}°`);
  }
});

test('readReportInputs falls back to defaults for missing or unreadable fields', () => {
  const v = readReportInputs({});
  assert.strictEqual(v.wetWeight, 37);
  assert.strictEqual(v.layback, 25);
  const partial = readReportInputs({ layback: '40', wetWeight: 'not a number' });
  assert.strictEqual(partial.layback, 40);
  assert.strictEqual(partial.wetWeight, 37, 'unreadable input should fall back, not become NaN');
});

test('readReportInputs rejects physically impossible input', () => {
  const cases = [
    [{ wetWeight: 0 }, /weight/i],
    [{ maxTension: -1 }, /tension/i],
    [{ layback: 0 }, /layback/i],
    [{ waterDepth: -5 }, /negative/i],
    [{ waterDepth: 0, chuteHeight: 0 }, /vertical/i],
  ];
  for (const [override, pattern] of cases) {
    assert.throws(() => readReportInputs({ ...base, ...override }), pattern,
      `should reject ${JSON.stringify(override)}`);
  }
});

test('an unreachable geometry fails loudly rather than returning nonsense', () => {
  // cosh grows fast enough that a very long layback over a shallow drop has no
  // solution within the bracket. It must throw, not return NaN or Infinity.
  assert.throws(() => calculateCatenary({ ...base, layback: 1e7, waterDepth: 0.001, chuteHeight: 0 }),
    /valid catenary|solution/i);
});
