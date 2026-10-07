const { fmtNum } = require('./helpers');

const MAX_LAYERS = 5000;

function readReelInputs(body) {
  const defaults = {
    cableOd: 200, outerFlange: 15, unusedArea: 0.5, innerFlange: 5,
    drumWidth: 5, stowageFactor: 1, cableLength: 3000, leadSheaveAngle: 1.5
  };
  const v = {};
  for (const [key, def] of Object.entries(defaults)) {
    const val = parseFloat(body[key]);
    v[key] = Number.isFinite(val) ? val : def;
  }
  v.projectName = String(body.projectName || '').trim();
  v.projectNumber = String(body.projectNumber || '').trim();
  v.revision = String(body.revision || '').trim();
  v.author = String(body.author || '').trim();
  if (v.cableOd <= 0) throw new Error('Cable outer diameter must be greater than zero.');
  if (v.outerFlange <= 0) throw new Error('Outer drum flange height B must be greater than zero.');
  if (v.unusedArea < 0) throw new Error('Unused top height D cannot be negative.');
  if (v.innerFlange <= 0) throw new Error('Inner drum height A must be greater than zero.');
  if (v.drumWidth <= 0) throw new Error('Inner drum width C must be greater than zero.');
  if (v.stowageFactor <= 0) throw new Error('Stowage factor must be greater than zero.');
  if (v.cableLength <= 0) throw new Error('Required cable length must be greater than zero.');
  if (v.leadSheaveAngle <= 0 || v.leadSheaveAngle >= 90) throw new Error('Lead sheave angle must be between 0 and 90 degrees.');
  if ((v.outerFlange - v.unusedArea) <= 0) throw new Error('B minus D must be greater than zero.');
  if ((v.outerFlange - (2 * v.unusedArea)) <= v.innerFlange) throw new Error('Usable storage height after D must be larger than inner drum height A.');
  if (v.drumWidth < (v.cableOd / 1000)) throw new Error('Inner drum width C must fit at least one cable wrap.');
  if (((v.outerFlange - (2 * v.unusedArea) - v.innerFlange) / 2) < (v.cableOd / 1000)) throw new Error('Available storage height must fit at least one cable layer.');
  return v;
}

function calculateReel(v) {
  const cableOdM = v.cableOd / 1000;
  const usableLayerHeight = v.outerFlange - (2 * v.unusedArea);
  const storageHeightEachSide = (usableLayerHeight - v.innerFlange) / 2;
  const maxNumberLayer = Math.floor(storageHeightEachSide / cableOdM);
  const wrapsPerLayer = Math.floor(v.drumWidth / cableOdM);
  let capacity = 0;
  let remainingLength = v.cableLength;
  let layersUsed = 0;
  let cumulativeLength = 0;
  const layerData = [];

  // The loop below breaks when the cable is stowed. When it does NOT fit it runs to
  // maxNumberLayer, pushing a row each time. A thin cable in a tall flange gives five
  // million rows in a couple of seconds, and that array then goes to the PDF writer.
  // A reel with this many layers is not a reel, so say so rather than trying to draw it.
  if (maxNumberLayer > MAX_LAYERS) {
    throw new Error(
      `This geometry gives ${maxNumberLayer.toLocaleString('en-GB')} layers, which is not a ` +
      `physical reel. Check the cable outside diameter against the flange heights A and B.`);
  }

  for (let layer = 1; layer <= maxNumberLayer; layer++) {
    const centerlineHeight = v.innerFlange + ((2 * layer - 1) * cableOdM);
    const layerCapacity = Math.PI * centerlineHeight * wrapsPerLayer / v.stowageFactor;
    capacity += layerCapacity;
    const usedLength = Math.min(layerCapacity, Math.max(0, remainingLength));
    cumulativeLength += usedLength;
    remainingLength -= usedLength;
    if (usedLength > 0) layersUsed = layer;
    layerData.push({ layer, centerlineHeight, layerCapacity, usedLength, cumulativeLength });
    if (remainingLength <= 0) break;
  }

  const leadDistance = (v.drumWidth / 2) / Math.tan(v.leadSheaveAngle * Math.PI / 180);
  return {
    ...v, capacity, layers: maxNumberLayer, layersUsed, leadDistance,
    fits: remainingLength <= 0,
    spareLength: capacity - v.cableLength,
    layerData
  };
}

function reelReportRows(r) {
  return [
    ['Cable outer diameter', fmtNum(r.cableOd, 0) + ' mm'],
    ['Outer drum flange height B', fmtNum(r.outerFlange, 2) + ' m'],
    ['Unused top height D', fmtNum(r.unusedArea, 2) + ' m'],
    ['Inner drum height A', fmtNum(r.innerFlange, 2) + ' m'],
    ['Inner drum width C', fmtNum(r.drumWidth, 2) + ' m'],
    ['Stowage factor', fmtNum(r.stowageFactor, 3) + ' x'],
    ['Required cable length', fmtNum(r.cableLength, 0) + ' m'],
    ['Maximum stowed cable length', fmtNum(r.capacity, 0) + ' m'],
    ['Cable fits in drum', r.fits ? 'Yes' : 'No'],
    ['Stowed layers', fmtNum(r.layersUsed, 0) + ' layers'],
    ['Maximum stowing layer', fmtNum(r.layers, 0) + ' layers'],
    ['Lead sheave fleet angle', fmtNum(r.leadSheaveAngle, 1) + ' deg'],
    ['Minimum lead sheave distance', fmtNum(r.leadDistance, 2) + ' m']
  ];
}

module.exports = { readReelInputs, calculateReel, reelReportRows };
