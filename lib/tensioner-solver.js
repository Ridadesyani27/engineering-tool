const { fmtNum } = require('./helpers');

function readSqueezeInputs(body) {
  const defaults = {
    cableMaximumTension: 150,
    tensionerContactLength: 4.9,
    frictionCoefficient: 0.4,
    allowableSqueezeLoad: 70
  };
  const v = {};
  for (const [key, def] of Object.entries(defaults)) {
    const val = parseFloat(body[key]);
    v[key] = Number.isFinite(val) ? val : def;
  }

  if (v.cableMaximumTension < 0) throw new Error('Cable maximum tension cannot be negative.');
  if (v.tensionerContactLength <= 0) throw new Error('Tensioner contact length must be greater than zero.');
  if (v.frictionCoefficient <= 0) throw new Error('Friction coefficient must be greater than zero.');
  if (v.allowableSqueezeLoad <= 0) throw new Error('Allowable squeeze load must be greater than zero.');

  return v;
}

function calculateSqueeze(v) {
  const squeezePressure = v.cableMaximumTension / (v.tensionerContactLength * v.frictionCoefficient * 2);
  const utilizationFactor = (squeezePressure / v.allowableSqueezeLoad) * 100;
  const isWithinAllowable = squeezePressure <= v.allowableSqueezeLoad;

  return {
    ...v,
    squeezePressure,
    utilizationFactor,
    isWithinAllowable,
    status: isWithinAllowable
      ? 'OK, required squeeze pressure is below the allowable squeeze load'
      : 'NOT OK, required squeeze pressure is above the allowable squeeze load'
  };
}

function squeezeReportRows(r) {
  return [
    ['Cable maximum tension', fmtNum(r.cableMaximumTension, 2) + ' kN'],
    ['Tensioner contact length', fmtNum(r.tensionerContactLength, 2) + ' m'],
    ['Friction coefficient', fmtNum(r.frictionCoefficient, 2)],
    ['Required squeeze pressure', fmtNum(r.squeezePressure, 2) + ' kN/m'],
    ['Allowable squeeze load', fmtNum(r.allowableSqueezeLoad, 2) + ' kN/m'],
    ['Utilization factor', fmtNum(r.utilizationFactor, 2) + ' %'],
    ['Status', r.status]
  ];
}

module.exports = { readSqueezeInputs, calculateSqueeze, squeezeReportRows };
