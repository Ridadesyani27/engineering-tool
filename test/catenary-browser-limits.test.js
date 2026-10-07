const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual browser parsers without requiring the page's DOM.
const source = fs.readFileSync(path.join(__dirname, '../views/catenary.ejs'), 'utf8');
const functions = ['uniqueValues', 'parsePositiveValues', 'parseNumericValues']
  .map(name => source.match(new RegExp(`  function ${name}\\([\\s\\S]*?\\n  }`))[0]).join('\n');
const parsers = vm.runInNewContext(functions + '\n({ parsePositiveValues, parseNumericValues })');

test('browser catenary parsers enforce the same 50-value boundary', () => {
  for (const parse of Object.values(parsers)) {
    assert.equal(parse(Array.from({ length: 50 }, (_, i) => i + 1).join(';'), 'Values', 'value').length, 50);
    for (const count of [51, 10000]) {
      assert.throws(() => parse(Array(count).fill('1').join(';'), 'Values', 'value'), /at most 50 values/);
    }
  }
});
