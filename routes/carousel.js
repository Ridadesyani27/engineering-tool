const express = require('express');
const router = express.Router();
const { buildMailtoLink } = require('../lib/helpers');
const { getCarouselData } = require('../lib/carousel-data');
const { calculateCarousel } = require('../lib/carousel-solver');

const mailtoLink = buildMailtoLink(
  'rdesyani@n-sea.com',
  'Feedback about the Carousel Stowage Calculation tool',
  'Hi Rida,\n\nI have a question, suggestion or some feedback about the Carousel Stowage Calculation tool:\n\n'
);

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key]);
  return [];
}

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeCarouselInput(body, defaults) {
  const input = {
    active_tab: String(body.active_tab ?? 'results'),
    project: String(body.project ?? defaults.project ?? ''),
    project_number: String(body.project_number ?? defaults.project_number ?? ''),
    revision: String(body.revision ?? defaults.revision ?? ''),
    date: String(body.date ?? defaults.date ?? ''),
    vessel: String(body.vessel ?? defaults.vessel ?? ''),
    carousel_mode: String(body.carousel_mode ?? defaults.carousel_mode ?? ''),
    partition_extension: String(body.partition_extension ?? defaults.partition_extension ?? 'no'),
    stowing_factor: parseNumber(body.stowing_factor, defaults.stowing_factor),
    cable_types: toArray(body.cable_types).map(row => ({
      name: String(row?.name ?? ''),
      od: parseNumber(row?.od),
      unit_weight: parseNumber(row?.unit_weight),
      allowable: parseNumber(row?.allowable),
      color: String(row?.color ?? '')
    })),
    cables: toArray(body.cables).map(row => ({
      name: String(row?.name ?? ''),
      length: parseNumber(row?.length),
      type: String(row?.type ?? ''),
      partition: String(row?.partition ?? '')
    })),
    custom_vessels: toArray(body.custom_vessels).map(row => ({
      vessel_name: String(row?.vessel_name ?? ''),
      carousel_mode: String(row?.carousel_mode ?? ''),
      partition: String(row?.partition ?? ''),
      partition_id: parseNumber(row?.partition_id),
      partition_od: parseNumber(row?.partition_od),
      partition_height: parseNumber(row?.partition_height),
      partition_max_height: parseNumber(row?.partition_max_height, parseNumber(row?.partition_height)),
      individual_capacity: String(row?.individual_capacity ?? '').trim() === '' ? null : parseNumber(row?.individual_capacity),
      carousel_total_capacity: parseNumber(row?.carousel_total_capacity, parseNumber(row?.individual_capacity)),
      daf: parseNumber(row?.daf, 1),
      is_custom: true
    }))
  };

  return input;
}

function vesselDatabaseForInput(data, input) {
  const customRows = (input.custom_vessels || [])
    .filter(row =>
      row.vessel_name &&
      row.carousel_mode &&
      row.partition &&
      row.partition_id > 0 &&
      row.partition_od > 0 &&
      row.partition_height > 0
    );
  return [...data.vesselDatabase, ...customRows];
}

function buildGraphData(result) {
  const partitions = {};
  result.detailed.forEach(row => {
    if (row.Layer === null) return;
    const partition = row.Partition;
    const layer = String(row['Layer Actual']);
    partitions[partition] = partitions[partition] || {
      id: row['Carousel ID [m]'],
      od: row['Carousel OD [m]'],
      layers: {}
    };
    partitions[partition].layers[layer] = partitions[partition].layers[layer] || {
      totalLength: 0,
      cables: {},
      directions: {},
      wraps: []
    };
    partitions[partition].layers[layer].totalLength += row['Placed [m]'];
    partitions[partition].layers[layer].cables[row['Cable Name']] =
      (partitions[partition].layers[layer].cables[row['Cable Name']] || 0) + row['Placed [m]'];
    partitions[partition].layers[layer].directions[row['Cable Name']] = row.Direction;
  });
  result.wrapRows.forEach(row => {
    const partition = row.Partition;
    const layer = String(row['Layer Actual']);
    if (!partitions[partition]?.layers[layer]) return;
    partitions[partition].layers[layer].wraps.push(row);
  });
  return { partitions };
}

function renderCarousel(res, data, input, reportError = '', submitted = false) {
  const vesselDatabase = vesselDatabaseForInput(data, input);
  const result = calculateCarousel(input, vesselDatabase);
  res.render('carousel', {
    mailtoLink,
    input,
    result,
    graphData: buildGraphData(result),
    reportError,
    submitted,
    ...data,
    vessels: [...new Set([...data.vessels, ...(input.custom_vessels || []).map(row => row.vessel_name).filter(Boolean)])],
    modes: [...new Set([...data.modes, ...(input.custom_vessels || []).map(row => row.carousel_mode).filter(Boolean)])]
  });
}

router.get('/carousel', (req, res) => {
  const data = getCarouselData();
  renderCarousel(res, data, data.defaults);
});

router.post('/carousel', (req, res) => {
  const data = getCarouselData();
  renderCarousel(res, data, normalizeCarouselInput(req.body, data.defaults), '', true);
});

router.get('/Carousel_Stowage_Calculation.php', (req, res) => res.redirect(301, '/carousel'));
router.post('/Carousel_Stowage_Calculation.php', (req, res) => res.redirect(308, '/carousel'));

module.exports = router;
