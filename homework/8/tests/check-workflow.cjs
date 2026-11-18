const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows/HW 8 — String Validator API.json'), 'utf8'));
const originalItems = JSON.parse(fs.readFileSync(path.join(root, 'string-validator/ui/items.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map(node => [node.name,node]));
assert.equal(workflow.active, false);
assert.equal(workflow.nodes.length, 4);
assert.equal(nodes.get('Items Webhook').parameters.httpMethod, 'GET');
assert.equal(nodes.get('Items Webhook').parameters.responseMode, 'responseNode');
assert.equal(nodes.get('Respond to Webhook').parameters.responseBody, '={{ $json.body }}');
assert.equal(nodes.get('Respond to Webhook').parameters.options.responseCode, '={{ $json.statusCode }}');
assert.equal(nodes.get('Respond to Webhook').parameters.options.responseHeaders.entries.find(h => h.name === 'Access-Control-Allow-Origin').value, '*');
for (const [source,target] of [['Items Webhook','Check Request'],['Check Request','Validate and Filter'],['Validate and Filter','Respond to Webhook']]) {
  assert.equal(workflow.connections[source].main[0][0].node,target);
}
function execute(name, input) {
  const result = vm.runInNewContext(`(function () { ${nodes.get(name).parameters.jsCode}\n})()`, {$input: {first: () => ({json:input})}}, {timeout:1000});
  assert.equal(result.length,1);
  return JSON.parse(JSON.stringify(result[0].json));
}
function request(queryParams) {
  return execute('Validate and Filter', execute('Check Request', {query:queryParams}));
}
const successCases = [
  ['',originalItems],
  ['alp',[originalItems[0]]],
  ['GA',[originalItems[2],originalItems[4]]],
  ['a',originalItems],
  ['zzz',[]],
  [' alp',[]],
  [' ',[]],
  ['\t',[]],
  ['\n',[]],
  ['a'.repeat(40),[]],
  ['a'.repeat(39)+'\n',[]]
];
let count=0;
for (const [query,items] of successCases) {
  assert.deepEqual(request({query}),{statusCode:200,body:{items}},JSON.stringify(query));
  count++;
}
for (const query of ['@@@','Привет','a'.repeat(41),'a'.repeat(40)+'\n','💚','<script>']) {
  const result=request({query});
  assert.equal(result.statusCode,400);
  assert.equal(result.body.error.code,'INVALID_FILTER');
  assert.equal(typeof result.body.error.message,'string');
  assert.equal(result.body.items,undefined);
  count++;
}
for (const params of [undefined,{},null,[],{query:null},{query:1},{query:['alp','GA']},{query:{name:'alp'}}]) {
  const result=request(params);
  assert.equal(result.statusCode,400);
  assert.equal(result.body.error.code,'INVALID_REQUEST');
  count++;
}
console.log(`PASS: workflow structure and ${count} request cases. Code executed locally; n8n HTTP not tested.`);
