function calculateActualWrapsUsed(innerDia, outerDia, cableOd, placedLength) {
  let remaining = placedLength;
  let actualWraps = 0;
  let wrapDia = innerDia + 2 * cableOd;

  while (wrapDia <= outerDia + 1e-9 && remaining > 0) {
    const wrapLength = Math.PI * wrapDia;
    if (remaining >= wrapLength) {
      actualWraps += 1;
      remaining -= wrapLength;
    } else {
      actualWraps += remaining / wrapLength;
      remaining = 0;
    }
    wrapDia += 2 * cableOd;
  }
  if (remaining > 1e-9 && outerDia > 0) {
    const boundaryWrapLength = Math.PI * outerDia;
    actualWraps += boundaryWrapLength > 0 ? remaining / boundaryWrapLength : 0;
  }

  return actualWraps;
}

function sum(values) {
  return Object.values(values).reduce((total, value) => total + Number(value || 0), 0);
}

function packOneCable(cable, prevState, sharedWeightByLayer) {
  let prevInner = prevState.prev_inner_end;
  let prevOuter = prevState.prev_outer_end;
  let prevLayer = Number(prevState.prev_layer_index);
  let elevation = prevState.elevation;
  let cumulativeWeightT = prevState.cumulative_weight_t;
  const layerMaxOd = { ...prevState.layer_max_od };
  const sharedWeights = { ...sharedWeightByLayer };

  let remaining = cable['Cable Length [m]'];
  const rows = [];
  let stopReason = null;

  while (remaining > 0) {
    const sharedWeightT = sum(sharedWeights);
    const sharedRemainingWeightT = cable['Carousel Capacity [t]'] - sharedWeightT;
    const partitionRemainingWeightT = cable['Partition Capacity [t]'] - cumulativeWeightT;
    const allowableRemainingWeightT = Math.min(sharedRemainingWeightT, partitionRemainingWeightT);
    if (allowableRemainingWeightT <= 1e-9) {
      stopReason = partitionRemainingWeightT <= 1e-9 ? 'Partition capacity limit reached' : 'Carousel capacity limit reached';
      break;
    }

    const gap = prevOuter - prevInner;
    const newLayer = gap < cable.Cable_OD_m / 2 ? prevLayer + 1 : prevLayer;
    if (newLayer !== prevLayer) {
      const previousLayerOd = layerMaxOd[prevLayer] ?? cable.Cable_OD_m;
      elevation += previousLayerOd * cable['Stacking Factor'];
    }

    const isContinuingLayer = newLayer === prevLayer && Object.prototype.hasOwnProperty.call(layerMaxOd, newLayer);
    const innerStart = isContinuingLayer ? prevInner : cable['Carousel ID [m]'];
    let outerStart = isContinuingLayer ? prevOuter : cable['Carousel OD [m]'];
    const direction = newLayer % 2 === 0 ? 'In->Out' : 'Out->In';

    if (!isContinuingLayer && direction === 'Out->In') {
      outerStart -= cable.Cable_OD_m;
    }

    let innerCorr;
    let outerCorr;
    let wrapsPossible;
    if (isContinuingLayer) {
      innerCorr = innerStart;
      outerCorr = outerStart;
      wrapsPossible = (outerStart - innerStart) / (2 * cable.Cable_OD_m);
    } else {
      wrapsPossible = (outerStart - innerStart) / (2 * cable.Cable_OD_m);
      const wrapsInt = Math.max(Math.trunc(wrapsPossible), 0);
      const fractional = Math.max(wrapsPossible - wrapsInt, 0);
      if (direction === 'In->Out') {
        innerCorr = innerStart;
        outerCorr = outerStart - 2 * fractional * cable.Cable_OD_m;
      } else {
        innerCorr = innerStart + 2 * fractional * cable.Cable_OD_m;
        outerCorr = outerStart;
      }
    }

    if (outerCorr <= innerCorr) {
      stopReason = 'No radial space left';
      break;
    }

    const lmax = Math.PI * (outerCorr ** 2 - innerCorr ** 2) / (4 * cable.Cable_OD_m);
    const maxLengthByWeight = cable['Cable Unit Weight [kg/m]'] > 0
      ? allowableRemainingWeightT * 1000 / cable['Cable Unit Weight [kg/m]']
      : remaining;
    const placed = Math.min(lmax, remaining, maxLengthByWeight);
    if (placed <= 0) {
      stopReason = 'No usable length in layer';
      break;
    }

    const area = 4 * placed * cable.Cable_OD_m / Math.PI;
    let innerEnd;
    let outerEnd;
    let actualWrapsUsed;
    if (direction === 'In->Out') {
      innerEnd = Math.sqrt(innerCorr ** 2 + area);
      outerEnd = outerCorr;
      actualWrapsUsed = calculateActualWrapsUsed(innerStart, innerEnd, cable.Cable_OD_m, placed);
    } else {
      innerEnd = innerCorr;
      outerEnd = Math.sqrt(Math.max(outerCorr ** 2 - area, 0));
      actualWrapsUsed = calculateActualWrapsUsed(outerEnd, outerStart, cable.Cable_OD_m, placed);
    }

    const layerEffectiveOd = Math.max(layerMaxOd[newLayer] ?? 0, cable.Cable_OD_m);
    const elevationBottom = elevation;
    const elevationTop = elevationBottom + layerEffectiveOd;
    if (elevationTop > cable['Carousel Height [m]']) {
      stopReason = 'Height limit reached: top of layer exceeds carousel height';
      break;
    }

    remaining -= placed;
    const weightT = placed * cable['Cable Unit Weight [kg/m]'] / 1000;
    cumulativeWeightT += weightT;
    sharedWeights[newLayer] = (sharedWeights[newLayer] ?? 0) + weightT;
    layerMaxOd[newLayer] = layerEffectiveOd;
    const layerCogz = elevationBottom + layerEffectiveOd / 2;

    rows.push({
      Layer: newLayer,
      'Layer Actual': newLayer + 1,
      Cable_OD_m: cable.Cable_OD_m,
      Direction: direction,
      Inner_start: innerStart,
      Outer_start: outerStart,
      Inner_end: innerEnd,
      Outer_end: outerEnd,
      'Placed [m]': placed,
      'Remaining [m]': remaining,
      'Weight_placed [t]': weightT,
      'Cumulative_weight [t]': cumulativeWeightT,
      Max_possible_wraps: Math.max(wrapsPossible, 0),
      Actual_wraps_used: actualWrapsUsed,
      Actual_wraps_used_ceil: Math.ceil(actualWrapsUsed),
      'Elevation_bottom_of_layer [m]': elevationBottom,
      'Elevation_top_of_layer [m]': elevationTop,
      'Elevation_used [%]': elevationTop / cable['Carousel Height [m]'] * 100,
      Layer_effective_od_m: layerEffectiveOd,
      'Layer_CoGz [m]': layerCogz,
      'Allowable_crush_load [kN/m]': cable['Allowable Dynamic Crush Load [kN/m]'],
      DAF: cable.DAF,
      Stowing_status: 'OK',
      Stop_reason: null
    });

    if (remaining > 1e-6 && Math.abs(placed - maxLengthByWeight) <= 1e-6) {
      stopReason = partitionRemainingWeightT <= sharedRemainingWeightT ? 'Partition capacity limit reached' : 'Carousel capacity limit reached';
      break;
    }

    prevInner = innerEnd;
    prevOuter = outerEnd;
    prevLayer = newLayer;
  }

  if (rows.length && remaining > 1e-6 && stopReason !== null) {
    rows[rows.length - 1].Stop_reason = stopReason;
  }

  if (!rows.length) {
    rows.push({
      Layer: null,
      'Layer Actual': null,
      Cable_OD_m: cable.Cable_OD_m,
      Direction: null,
      Inner_start: null,
      Outer_start: null,
      Inner_end: null,
      Outer_end: null,
      'Placed [m]': 0,
      'Remaining [m]': cable['Cable Length [m]'],
      'Weight_placed [t]': 0,
      'Cumulative_weight [t]': cumulativeWeightT,
      Max_possible_wraps: 0,
      Actual_wraps_used: 0,
      Actual_wraps_used_ceil: 0,
      'Elevation_bottom_of_layer [m]': elevation,
      'Elevation_top_of_layer [m]': elevation,
      'Elevation_used [%]': 0,
      Layer_effective_od_m: null,
      'Layer_CoGz [m]': null,
      'Allowable_crush_load [kN/m]': cable['Allowable Dynamic Crush Load [kN/m]'],
      DAF: cable.DAF,
      Stowing_status: 'NOT STOWED',
      Stop_reason: stopReason
    });
  }

  return [rows, {
    prev_inner_end: prevInner,
    prev_outer_end: prevOuter,
    prev_layer_index: prevLayer,
    elevation,
    cumulative_weight_t: cumulativeWeightT,
    layer_max_od: layerMaxOd
  }, sharedWeights];
}

function stowAllCables(inputRows) {
  const partitionStates = {};
  let sharedWeightByLayer = {};
  const detailed = [];

  inputRows.forEach(r => {
    const part = r.Partition;
    if (!partitionStates[part]) {
      partitionStates[part] = {
        prev_inner_end: r['Carousel ID [m]'],
        prev_outer_end: r['Carousel OD [m]'],
        prev_layer_index: 0,
        elevation: 0,
        cumulative_weight_t: 0,
        layer_max_od: {}
      };
    }

    const packed = packOneCable(r, partitionStates[part], sharedWeightByLayer);
    const rows = packed[0];
    partitionStates[part] = packed[1];
    sharedWeightByLayer = packed[2];

    rows.forEach(row => {
      detailed.push({
        ...row,
        Partition: part,
        'Cable Name': r['Cable Name'],
        'Carousel_capacity [t]': r['Carousel Capacity [t]'],
        'Partition_capacity [t]': r['Partition Capacity [t]'],
        'Initial_cable_length [m]': r['Cable Length [m]'],
        'Carousel_height [m]': r['Carousel Height [m]'],
        'Carousel ID [m]': r['Carousel ID [m]'],
        'Carousel OD [m]': r['Carousel OD [m]']
      });
    });
  });

  return [partitionStates, detailed];
}

function addCrushLoadCheck(detailed) {
  const layerSummary = {};
  detailed.forEach(row => {
    if (row.Layer === null) return;
    const key = `${row.Partition}|${row['Layer Actual']}`;
    if (!layerSummary[key]) {
      layerSummary[key] = {
        Partition: row.Partition,
        'Layer Actual': row['Layer Actual'],
        Layer_weight_t: 0,
        Layer_length_m: 0,
        Allowable_crush_load: row['Allowable_crush_load [kN/m]'],
        DAF: row.DAF
      };
    }
    layerSummary[key].Layer_weight_t += row['Weight_placed [t]'];
    layerSummary[key].Layer_length_m += row['Placed [m]'];
    layerSummary[key].Allowable_crush_load = Math.min(layerSummary[key].Allowable_crush_load, row['Allowable_crush_load [kN/m]']);
    layerSummary[key].DAF = Math.max(layerSummary[key].DAF, row.DAF);
  });

  const byPartition = {};
  Object.values(layerSummary).forEach(row => {
    byPartition[row.Partition] = byPartition[row.Partition] || [];
    byPartition[row.Partition].push(row);
  });

  const crushMap = {};
  Object.entries(byPartition).forEach(([part, rows]) => {
    rows.sort((a, b) => a['Layer Actual'] - b['Layer Actual']);
    rows.forEach(row => {
      const weightAbove = rows
        .filter(candidate => candidate['Layer Actual'] > row['Layer Actual'])
        .reduce((total, candidate) => total + candidate.Layer_weight_t, 0);
      const staticLoad = row.Layer_length_m > 0 ? weightAbove * 9.80665 / row.Layer_length_m : 0;
      const dynamic = staticLoad * row.DAF;
      crushMap[`${part}|${row['Layer Actual']}`] = {
        'Weight_above [t]': weightAbove,
        'Static_crush_load [kN/m]': staticLoad,
        'Dynamic_crush_load [kN/m]': dynamic,
        'Allowable_crush_load [kN/m]': row.Allowable_crush_load,
        'Crush_utilization [%]': row.Allowable_crush_load ? dynamic / row.Allowable_crush_load * 100 : null
      };
    });
  });

  return detailed.map(row => ({
    ...row,
    ...(crushMap[`${row.Partition}|${row['Layer Actual']}`] || {})
  }));
}

function makeSummary(detailed) {
  const summary = {};
  const seenCable = {};
  detailed.forEach(row => {
    const part = row.Partition;
    if (!summary[part]) {
      summary[part] = {
        Partition: part,
        Total_weight: 0,
        Carousel_capacity: row['Carousel_capacity [t]'],
        Partition_capacity: row['Partition_capacity [t]'],
        Total_length_stowed: 0,
        Max_layer: null,
        Max_elevation_top: 0,
        Carousel_height: row['Carousel_height [m]'],
        'Initial_cable_length [m]': 0,
        Stop_reason: '',
        weighted_cog: 0
      };
    }
    summary[part].Total_weight += row['Weight_placed [t]'];
    summary[part].Total_length_stowed += row['Placed [m]'];
    summary[part].Max_layer = Math.max(summary[part].Max_layer ?? 0, row['Layer Actual'] ?? 0);
    summary[part].Max_elevation_top = Math.max(summary[part].Max_elevation_top, row['Elevation_top_of_layer [m]']);
    if (row.Stop_reason) summary[part].Stop_reason = row.Stop_reason;
    if (row['Layer_CoGz [m]'] !== null) {
      summary[part].weighted_cog += row['Layer_CoGz [m]'] * row['Weight_placed [t]'];
    }
    const cableKey = `${part}|${row['Cable Name']}`;
    if (!seenCable[cableKey]) {
      summary[part]['Initial_cable_length [m]'] += row['Initial_cable_length [m]'];
      seenCable[cableKey] = true;
    }
  });

  return Object.values(summary).map(row => {
    const next = { ...row };
    next['Weight_used [%]'] = next.Partition_capacity > 0 ? next.Total_weight / next.Partition_capacity * 100 : null;
    next['Length_stowed [%]'] = next['Initial_cable_length [m]'] > 0 ? next.Total_length_stowed / next['Initial_cable_length [m]'] * 100 : null;
    next['Elevation_used [%]'] = next.Carousel_height > 0 ? next.Max_elevation_top / next.Carousel_height * 100 : null;
    next.CoG_z = next.Total_weight > 0 ? next.weighted_cog / next.Total_weight : null;
    delete next.weighted_cog;
    return next;
  });
}

function makeCrushSummary(detailed) {
  const summary = {};
  detailed.forEach(row => {
    if (row['Layer Actual'] === null || row['Static_crush_load [kN/m]'] === undefined) return;
    const part = row.Partition;
    if (!summary[part] || row['Static_crush_load [kN/m]'] > summary[part]['Static_crush_load [kN/m]']) {
      summary[part] = {
        Partition: part,
        'Cable Name': row['Cable Name'],
        'Layer Actual': row['Layer Actual'],
        'Static_crush_load [kN/m]': row['Static_crush_load [kN/m]'],
        'Dynamic_crush_load [kN/m]': row['Dynamic_crush_load [kN/m]'],
        'Allowable_crush_load [kN/m]': row['Allowable_crush_load [kN/m]'],
        'Crush_utilization [%]': row['Crush_utilization [%]']
      };
    }
  });
  return Object.values(summary);
}

function calculateWrapsForStowedLayers(detailed) {
  const wrapRows = [];
  detailed.forEach(row => {
    if (row.Layer === null || row['Placed [m]'] <= 0) return;
    let innerDia;
    let outerDia;
    let wrapDia;
    let wrapStep;
    let boundaryDia;
    if (row.Direction === 'In->Out') {
      innerDia = row.Inner_start;
      outerDia = row.Inner_end;
      wrapDia = innerDia + 2 * row.Cable_OD_m;
      wrapStep = 2 * row.Cable_OD_m;
      boundaryDia = outerDia;
    } else {
      innerDia = row.Outer_end;
      outerDia = row.Outer_start;
      wrapDia = outerDia;
      wrapStep = -2 * row.Cable_OD_m;
      boundaryDia = innerDia;
    }

    let remainingLength = row['Placed [m]'];
    let wrapNo = 1;
    while (remainingLength > 1e-9) {
      const outsideWrapLimit = row.Direction === 'In->Out'
        ? wrapDia > outerDia + 1e-9
        : wrapDia < innerDia - 1e-9;
      if (outsideWrapLimit) {
        wrapDia = boundaryDia;
        if (wrapDia <= 0) break;
      }
      const fullWrapLength = Math.PI * wrapDia;
      const actualWrapLength = Math.min(remainingLength, fullWrapLength);
      wrapRows.push({
        Partition: row.Partition,
        'Cable Name': row['Cable Name'],
        Direction: row.Direction,
        'Layer Actual': row['Layer Actual'],
        'Wrap No': wrapNo,
        'Wrap Diameter [m]': wrapDia,
        Cable_OD_m: row.Cable_OD_m,
        'Full Wrap Length [m]': fullWrapLength,
        'Actual Wrap Length [m]': actualWrapLength,
        'Wrap Fill [%]': fullWrapLength > 0 ? actualWrapLength / fullWrapLength * 100 : null,
        'Wrap Status': remainingLength >= fullWrapLength && !outsideWrapLimit ? 'Full wrap' : 'Partial wrap'
      });
      remainingLength -= actualWrapLength;
      if (remainingLength <= 1e-9 || outsideWrapLimit) break;
      wrapDia += wrapStep;
      wrapNo++;
    }
  });
  return wrapRows;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getVesselPartitions(database, vesselName, carouselMode, useMaxHeight) {
  const heightKey = useMaxHeight ? 'partition_max_height' : 'partition_height';
  return database
    .filter(item =>
      String(item.vessel_name).trim().toLowerCase() === String(vesselName).trim().toLowerCase() &&
      String(item.carousel_mode).trim().toLowerCase() === String(carouselMode).trim().toLowerCase())
    .map(item => ({
      'Is Custom': Boolean(item.is_custom),
      Vessel: item.vessel_name,
      'Carousel Mode': item.carousel_mode,
      Partition: String(item.partition).toLowerCase(),
      'Carousel ID [m]': item.partition_id,
      'Carousel OD [m]': item.partition_od,
      'Carousel Height [m]': item[heightKey],
      'Carousel Max Height [m]': item.partition_max_height,
      'Weight Capacity': item.individual_capacity ?? item.carousel_total_capacity ?? item.carousel_capacity,
      'Individual Capacity': item.individual_capacity ?? null,
      'Total Weight Capacity': item.carousel_total_capacity ?? item.carousel_capacity,
      DAF: item.daf
    }));
}

function buildCalculationRows(input, vesselDatabase) {
  const errors = [];
  const useMaxHeight = String(input.partition_extension || '').toLowerCase() === 'yes';
  const vesselRows = getVesselPartitions(vesselDatabase, input.vessel, input.carousel_mode, useMaxHeight);
  const partitionInfo = Object.fromEntries(vesselRows.map(row => [row.Partition, row]));

  if (!vesselRows.length) {
    errors.push('No vessel database entry found for the selected vessel and carousel mode.');
  }

  const cableTypeMap = {};
  (input.cable_types || []).forEach(cableType => {
    const typeName = String(cableType.name || '').trim();
    if (!typeName) return;
    const typeKey = typeName.toLowerCase();
    if (cableTypeMap[typeKey]) {
      errors.push(`Cable type names must be unique: '${typeName}'.`);
      return;
    }
    cableTypeMap[typeKey] = cableType;
  });

  const calculationRows = [];
  (input.cables || []).forEach(cable => {
    const cableName = String(cable.name || '').trim();
    if (!cableName) return;
    const partition = String(cable.partition || '').trim().toLowerCase();
    if (!partitionInfo[partition]) {
      errors.push(`Cable '${cableName}' uses partition '${partition}', which is not available for this vessel/mode.`);
      return;
    }
    const typeName = String(cable.type || '').trim();
    const cableType = cableTypeMap[typeName.toLowerCase()];
    if (!cableType) {
      errors.push(`Cable '${cableName}' does not have a valid cable type.`);
      return;
    }
    const info = partitionInfo[partition];
    calculationRows.push({
      'Cable Name': cableName,
      'Cable Type': typeName,
      Partition: partition,
      'Carousel ID [m]': Number(info['Carousel ID [m]']),
      'Carousel OD [m]': Number(info['Carousel OD [m]']),
      'Carousel Height [m]': Number(info['Carousel Height [m]']),
      'Partition Capacity [t]': Number(info['Weight Capacity']),
      'Carousel Capacity [t]': Number(info['Total Weight Capacity']),
      DAF: Number(info.DAF),
      'Cable Length [m]': numberValue(cable.length),
      'Cable OD [mm]': numberValue(cableType.od),
      Cable_OD_m: numberValue(cableType.od) / 1000,
      'Cable Unit Weight [kg/m]': numberValue(cableType.unit_weight),
      'Allowable Dynamic Crush Load [kN/m]': numberValue(cableType.allowable),
      'Stacking Factor': numberValue(input.stowing_factor, 0.866)
    });
  });

  if (!calculationRows.length) {
    errors.push('Add at least one cable with a cable name and valid partition.');
  }

  return { errors, calculationRows, vesselRows, partitionInfo };
}

function calculateCarousel(input, vesselDatabase) {
  const prepared = buildCalculationRows(input, vesselDatabase);
  if (prepared.errors.length) {
    return { ...prepared, detailed: [], summary: [], crushSummary: [], wrapRows: [] };
  }

  let [, detailed] = stowAllCables(prepared.calculationRows);
  detailed = addCrushLoadCheck(detailed);
  return {
    ...prepared,
    detailed,
    summary: makeSummary(detailed),
    crushSummary: makeCrushSummary(detailed),
    wrapRows: calculateWrapsForStowedLayers(detailed)
  };
}

module.exports = {
  calculateActualWrapsUsed,
  packOneCable,
  stowAllCables,
  addCrushLoadCheck,
  makeSummary,
  makeCrushSummary,
  calculateWrapsForStowedLayers,
  getVesselPartitions,
  buildCalculationRows,
  calculateCarousel
};
