const { fmtNum } = require('./helpers');

const G = 9.81;
const TONNE_FORCE_N = 9800;
const MAX_PLOT_POINTS = 2000;

function safeCosh(x) {
  if (x > 700) return Infinity;
  return Math.cosh(x);
}

function readReportInputs(body) {
  const defaults = {
    wetWeight: 37, minRadius: 3, maxTension: 20.7, chuteHeight: 3
  };
  const v = {};
  for (const [key, def] of Object.entries(defaults)) {
    const val = parseFloat(body[key]);
    v[key] = Number.isFinite(val) ? val : def;
  }
  v.laybackInput = String(body.layback ?? '25').trim();
  v.waterDepthLatInput = String(body.waterDepthLat ?? body.waterDepth ?? '30').trim();
  v.waterLevelInput = String(body.waterLevel ?? '0').trim();
  v.layback = parseFloat(v.laybackInput);
  v.waterDepth = parseFloat(v.waterDepthLatInput) + parseFloat(v.waterLevelInput);
  v.projectName = String(body.projectName ?? '').trim();
  v.projectNumber = String(body.projectNumber ?? '').trim();
  v.revision = String(body.revision ?? '').trim();
  v.author = String(body.author ?? '').trim();

  if (v.wetWeight <= 0) throw new Error('Wet cable weight must be greater than zero.');
  if (v.minRadius < 0) throw new Error('Minimum bending radius cannot be negative.');
  if (v.maxTension <= 0) throw new Error('Maximum cable tension must be greater than zero.');
  if (v.chuteHeight < 0) throw new Error('Depth values cannot be negative.');
  if (v.laybackInput !== '' && Number.isFinite(v.layback) && v.layback <= 0) throw new Error('Laybacks must be greater than zero.');
  if (v.waterDepthLatInput !== '' && Number.isFinite(parseFloat(v.waterDepthLatInput)) && parseFloat(v.waterDepthLatInput) < 0) {
    throw new Error('Depth values cannot be negative.');
  }
  if (Number.isFinite(v.waterDepth) && v.waterDepth + v.chuteHeight <= 0) {
    throw new Error('Total vertical distance must be greater than zero.');
  }
  if (v.waterDepthLatInput !== '' && Number.isFinite(parseFloat(v.waterDepthLatInput)) && parseFloat(v.waterDepthLatInput) === 0) {
    throw new Error('Water depths from LAT must be greater than zero.');
  }
  return v;
}

function uniqueValues(values) {
  const seen = new Map();
  values.forEach(value => {
    seen.set(fmtNum(value, 3), value);
  });
  return [...seen.values()];
}

function parsePositiveValues(text, label, emptyLabel) {
  const values = String(text ?? '').split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const value = Number(part.replace(',', '.'));
      if (!Number.isFinite(value)) throw new Error(`${label} must be numbers separated by semicolons only.`);
      if (value <= 0) throw new Error(`${label} must be greater than zero.`);
      return value;
    });
  if (!values.length) throw new Error(`Enter at least one ${emptyLabel} value.`);
  return uniqueValues(values);
}

function parseNumericValues(text, label, emptyLabel) {
  const values = String(text ?? '').split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const value = Number(part.replace(',', '.'));
      if (!Number.isFinite(value)) {
        throw new Error(`${label} must be numbers separated by semicolons only. Use either a comma or a dot for decimals.`);
      }
      return value;
    });
  if (!values.length) throw new Error(`Enter at least one ${emptyLabel} value.`);
  return uniqueValues(values);
}

function calculateCatenaryProfile(v, layback, waterDepthLat, waterLevel) {
  const waterDepth = waterDepthLat + waterLevel;
  if (waterDepth <= 0) throw new Error('Water depth from LAT plus water level must be greater than zero.');
  const totalDepth = waterDepth + v.chuteHeight;
  const w = v.wetWeight * G;
  const maxTensionN = v.maxTension * 1000 * G;
  const f = a => a * (safeCosh(layback / a) - 1) - totalDepth;

  let lo = Math.max(1e-3, layback / 10);
  let hi = Math.max(layback * 10, totalDepth * 10);
  for (let i = 0; i < 100 && !(f(lo) > 0); i++) lo = Math.max(1e-6, lo / 1.5);
  for (let i = 0; i < 100 && !(f(hi) < 0); i++) hi *= 1.5;
  if (!(f(lo) > 0) || !(f(hi) < 0)) throw new Error('Unable to find a valid catenary solution for these inputs.');

  let a = (lo + hi) / 2;
  for (let i = 0; i < 250; i++) {
    a = (lo + hi) / 2;
    const fm = f(a);
    if (Math.abs(fm) < 1e-10) break;
    if (fm > 0) lo = a; else hi = a;
  }

  // Bisection always returns a midpoint, whether or not it solved anything. At extreme
  // ratios cosh(layback/a) - 1 underflows to zero in double precision, so the search
  // converges on a number that does not satisfy the equation and the tool reports it
  // with full confidence. Check the answer against the equation it claims to solve: a
  // calculator that refuses is far less dangerous than one that is quietly wrong.
  const residual = a * (safeCosh(layback / a) - 1) - totalDepth;
  if (!Number.isFinite(residual) || Math.abs(residual) > Math.max(1e-6, totalDepth * 1e-6)) {
    throw new Error('Unable to find a valid catenary solution for these inputs. ' +
                    'Check the layback against the total vertical distance.');
  }

  const tBottomN = a * w;
  const length = a * Math.sinh(layback / a);
  const tVesselN = Math.hypot(tBottomN, w * length);
  const bottomTension = tBottomN / TONNE_FORCE_N;
  const onboardTension = tVesselN / TONNE_FORCE_N;
  const angle = Math.atan(Math.sinh(layback / a)) * 180 / Math.PI;

  // The curve is drawn from these points, and four per metre was fine until somebody
  // posts a layback of ten million: n becomes 40,000,000 and the process dies of heap
  // exhaustion before it can answer. The form's min/max attributes do not protect this
  // — a POST never sees them — and every signed-in N-Sea account can reach the route.
  //
  // Capping resolution rather than rejecting the input: 2,000 points already draw a
  // smoother curve than any screen or PDF can show, so no legitimate calculation
  // changes, and an absurd input now returns an answer instead of killing the server.
  const points = [];
  const n = Math.min(MAX_PLOT_POINTS, Math.max(100, Math.ceil(layback * 4)));
  for (let i = 0; i <= n; i++) {
    const x = layback * i / n;
    points.push({ x, y: -waterDepthLat + a * (Math.cosh(x / a) - 1) });
  }

  return {
    layback, waterDepthLat, waterLevel, waterDepth, chuteHeight: v.chuteHeight,
    totalDepth, a, length, angle, bottomTension, onboardTension,
    radiusOK: a >= v.minRadius,
    tensionOK: tVesselN <= maxTensionN,
    points
  };
}

function calculateCatenary(v) {
  const input = {
    ...v,
    laybackInput: v.laybackInput ?? String(v.layback ?? 25),
    waterDepthLatInput: v.waterDepthLatInput ?? String(v.waterDepthLat ?? v.waterDepth ?? 30),
    waterLevelInput: v.waterLevelInput ?? String(v.waterLevel ?? 0),
    chuteHeight: Number.isFinite(v.chuteHeight) ? v.chuteHeight : 3
  };
  const laybacks = parsePositiveValues(input.laybackInput, 'Laybacks', 'layback to TDP');
  const waterDepthLats = parsePositiveValues(input.waterDepthLatInput, 'Water depths from LAT', 'water depth from LAT');
  const waterLevels = parseNumericValues(input.waterLevelInput, 'Water levels', 'water level');
  const seriesCount = [laybacks, waterDepthLats, waterLevels].filter(values => values.length > 1).length;
  if (seriesCount > 1) {
    throw new Error('Use multiple values in only one field: layback, water depth from LAT, or water level.');
  }

  const profiles = [];
  if (waterLevels.length > 1) {
    const baseLayback = laybacks[0];
    const baseWaterDepthLat = waterDepthLats[0];
    const baseWaterLevel = waterLevels[0];
    const baseProfile = calculateCatenaryProfile(input, baseLayback, baseWaterDepthLat, baseWaterLevel);
    waterLevels.forEach((waterLevel, index) => {
      if (index === 0) {
        profiles.push(baseProfile);
        return;
      }
      const recalculatedLayback = baseLayback + (waterLevel - baseWaterLevel);
      if (recalculatedLayback <= 0) {
        throw new Error('Unable to recalculate layback because the water level adjustment gives a layback less than or equal to zero.');
      }
      profiles.push(calculateCatenaryProfile(input, recalculatedLayback, baseWaterDepthLat, waterLevel));
    });
  } else {
    laybacks.forEach(layback => {
      waterDepthLats.forEach(waterDepthLat => {
        waterLevels.forEach(waterLevel => {
          profiles.push(calculateCatenaryProfile(input, layback, waterDepthLat, waterLevel));
        });
      });
    });
  }

  return {
    ...input,
    ...profiles[0],
    laybackInput: laybacks.map(value => fmtNum(value, 1)).join(', '),
    waterDepthLatInput: waterDepthLats.map(value => fmtNum(value, 1)).join(', '),
    waterLevelInput: waterLevels.map(value => fmtNum(value, 1)).join(', '),
    laybacks,
    waterDepthLats,
    waterLevels,
    laybackMode: waterLevels.length > 1 ? 'water-level-shift' : 'input',
    profiles
  };
}

function reportRows(r) {
  if (Array.isArray(r.profiles) && r.profiles.length > 1) {
    const rows = [];
    if (r.laybackMode === 'water-level-shift') {
      rows.push([
        'Layback basis',
        'Input layback applies to first water level only; other laybacks use input layback plus the water level change.'
      ]);
    }
    r.profiles.forEach(profile => {
      rows.push([
        `Layback ${fmtNum(profile.layback, 1)} m / WL ${fmtNum(profile.waterLevel, 1)} m`,
        `Bottom ${fmtNum(profile.bottomTension, 2)} t; Onboard ${fmtNum(profile.onboardTension, 2)} t; ` +
          `Catenary length ${fmtNum(profile.length, 1)} m; Departure angle ${fmtNum(profile.angle, 1)} deg`
      ]);
      rows.push([
        `Checks ${fmtNum(profile.layback, 1)} m / WL ${fmtNum(profile.waterLevel, 1)} m`,
        `Radius ${fmtNum(profile.a, 2)} m ${profile.radiusOK ? 'OK' : 'NOT OK'}; ` +
          `Tension ${profile.tensionOK ? 'OK' : 'EXCEEDED'}`
      ]);
    });
    return rows;
  }

  return [
    ['Water depth LAT', fmtNum(r.waterDepthLat, 1) + ' m'],
    ['Water Level', fmtNum(r.waterLevel, 1) + ' m'],
    ['Water Depth to Waterline', fmtNum(r.waterDepth, 1) + ' m'],
    ['Waterline to Chute', fmtNum(r.chuteHeight, 1) + ' m'],
    ['Total Vertical Distance', fmtNum(r.totalDepth, 1) + ' m'],
    ['Layback', fmtNum(r.layback, 1) + ' m'],
    ['Catenary Length', fmtNum(r.length, 1) + ' m'],
    ['Onboard Tension (t)', fmtNum(r.onboardTension, 2) + ' t'],
    ['Onboard Tension (kg)', fmtNum(r.onboardTension * 1000, 1) + ' kg'],
    ['Bottom Tension (t)', fmtNum(r.bottomTension, 3) + ' t'],
    ['Bottom Tension (kg)', fmtNum(r.bottomTension * 1000, 1) + ' kg'],
    ['Departure Angle', fmtNum(r.angle, 1) + ' deg'],
    ['Effective Bend Radius', fmtNum(r.a, 2) + ' m'],
    ['Bend Radius OK', r.radiusOK ? 'Yes' : 'No'],
    ['Within Tension Limit OK', r.tensionOK ? 'Yes' : 'No']
  ];
}

module.exports = { readReportInputs, calculateCatenary, reportRows };
