const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Run the ORIGINAL pure function, before the browser/DOM initialization.
const source = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');
const end = source.indexOf('let allItems = []');
assert(end > 0, 'Cannot locate original function boundary');
const filterItems = vm.runInNewContext(source.slice(0, end) + '\nfilterItems;');
const items = [{id:'1', name:'Alpha'}, {id:'2', name:'Beta'}, {id:'3', name:'Gamma'}];
test('case-insensitive substring filtering', () => {
  assert.equal(filterItems('alp',items)[0].name, 'Alpha');
  assert.equal(filterItems('GA',items)[0].name, 'Gamma');
});
test('empty query returns original list', () => assert.equal(filterItems('',items),items));
test('valid query with no matches returns empty array', () => assert.equal(filterItems('zzz',items).length,0));
test('invalid characters and Cyrillic reject with contract error', () => {
  for (const query of ['@@@','<script>','Альфа'])
    assert.throws(() => filterItems(query,items), e => e.code === 'ValidationError.INVALID_FILTER');
});
test('40 characters accepted; 41 rejected', () => {
  assert.equal(filterItems('a'.repeat(40),items).length,0);
  assert.throws(() => filterItems('a'.repeat(41),items), e => e.code === 'ValidationError.INVALID_FILTER');
});
test('original whitespace behavior is preserved (tabs/newlines accepted by regex)', () => {
  assert.equal(filterItems('\t',items).length,0);
  assert.equal(filterItems('\n',items).length,0);
});
test('filter does not mutate source list', () => {
  const before=JSON.stringify(items);filterItems('a',items);assert.equal(JSON.stringify(items),before);
});
