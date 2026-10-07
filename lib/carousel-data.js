const defaults = require('./data/csc-data.json');
const vesselDatabase = require('./data/csc-vesseldatabase.json');

function uniqueOptions(rows, key) {
  return [...new Set(rows.map(row => String(row[key] ?? '').trim()).filter(Boolean))];
}

function getCarouselData() {
  return {
    defaults,
    vesselDatabase,
    vessels: uniqueOptions(vesselDatabase, 'vessel_name').sort((a, b) => {
      const priority = name => ({ curo: 0, altera: 1 }[name.toLowerCase()] ?? 2);
      return priority(a) - priority(b);
    }),
    modes: uniqueOptions(vesselDatabase, 'carousel_mode')
  };
}

module.exports = { getCarouselData };
