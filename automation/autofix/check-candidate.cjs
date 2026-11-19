const assert = require('node:assert/strict');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const items = [{id:'1',name:'Alpha'},{id:'2',name:'Beta'},{id:'3',name:'Gamma'},{id:'4',name:'Delta'},{id:'5',name:'Omega'}];

function evaluate(source, c) {
  const end = source.indexOf('let allItems = []');
  assert(end > 0, 'Missing pure-function boundary');
  const sandbox = { query:c.query,items:structuredClone(items) };
  const before = JSON.stringify(sandbox.items);
  let output, error;
  try { output = vm.runInNewContext(source.slice(0,end)+'\nfilterItems(query, items)',sandbox,{timeout:500}); }
  catch (e) { error=e; }
  if (c.errorCode) assert.equal(error?.code,c.errorCode,'Expected validation error');
  else {
    if(error) throw error;
    assert.deepEqual(Array.from(output,x=>x.name),c.expectedNames);
    if(c.query==='') assert.equal(output,sandbox.items,'Empty query preserves array identity');
  }
  assert.equal(JSON.stringify(sandbox.items),before,'Input array mutated');
}

function validate(baseSource, candidateSource, document) {
  const begin=baseSource.indexOf('function filterItems('),end=baseSource.indexOf('let allItems = []');
  const newBegin=candidateSource.indexOf('function filterItems('),newEnd=candidateSource.indexOf('let allItems = []');
  assert(begin>=0 && end>begin && newBegin>=0 && newEnd>newBegin);
  assert.equal(baseSource.slice(0,begin),candidateSource.slice(0,newBegin),'Prefix must stay unchanged');
  assert.equal(baseSource.slice(end),candidateSource.slice(newEnd),'Browser UI must stay unchanged');
  assert(!/\b(?:eval|Function|require|process|globalThis|fetch|XMLHttpRequest|import|window|document)\b/.test(candidateSource.slice(newBegin,newEnd)));
  assert(Number.isSafeInteger(document.issue) && document.issue > 0);
  assert(Array.isArray(document.cases) && document.cases.length > 0 && document.cases.length <= 15);
  const core = [
    {query:'',expectedNames:items.map(x=>x.name)},
    {query:'alp',expectedNames:['Alpha']}, {query:'GA',expectedNames:['Gamma','Omega']},
    {query:'zzz',expectedNames:[]}, {query:'a'.repeat(40),expectedNames:[]},
    {query:'a'.repeat(41),errorCode:'ValidationError.INVALID_FILTER'},
    {query:'@@@',errorCode:'ValidationError.INVALID_FILTER'},
    {query:'Альфа',errorCode:'ValidationError.INVALID_FILTER'},
    {query:'\t',expectedNames:[]}, {query:'\n',expectedNames:[]},
    {query:' alp',expectedNames:[]}
  ];
  for (const c of core) evaluate(candidateSource,c);
  let reproduced=0;
  for (const c of document.cases) {
    assert.equal(typeof c.query,'string'); assert(c.query.length <= 200);
    const hasError = c.errorCode === 'ValidationError.INVALID_FILTER';
    const hasNames = Array.isArray(c.expectedNames) && c.expectedNames.every(n=>items.some(i=>i.name===n));
    assert.notEqual(hasError,hasNames,'Case must specify names OR validation error');
    assert(Object.keys(c).every(k=>['query','expectedNames','errorCode'].includes(k)));
    try { evaluate(baseSource,c); } catch { reproduced++; }
    evaluate(candidateSource,c);
  }
  assert(reproduced>0,'Regression must fail on base code and pass on candidate');
  return {coreCases:core.length,regressionCases:document.cases.length,reproduced};
}

if (require.main === module) {
  const base=process.env.PR_BASE_SHA,head=process.env.PR_HEAD_SHA;
  assert(/^[a-f0-9]{40}$/.test(base) && /^[a-f0-9]{40}$/.test(head),'Invalid commit SHA');
  const branch=process.env.PR_HEAD_REF;
  const match=/^autofix\/issue-([1-9]\d*)$/.exec(branch || ''); assert(match,'Invalid autofix branch');
  const sourcePath='string-validator/ui/app.js';
  const casesPath=`automation/autofix/cases/issue-${match[1]}.json`;
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:1024*1024});
  const changed=git('diff','--name-only',base,head).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.slice().sort(),[sourcePath,casesPath].sort(),'Only app.js and the issue regression JSON may change');
  const baseSource=git('show',`${base}:${sourcePath}`),candidate=git('show',`${head}:${sourcePath}`);
  assert(candidate.length<=30000);
  const cases=JSON.parse(git('show',`${head}:${casesPath}`)); assert.equal(cases.issue,Number(match[1]));
  const result=validate(baseSource,candidate,cases);
  // Existing tests come from trusted base checkout; the model cannot edit them.
  fs.writeFileSync(sourcePath,candidate);
  execFileSync(process.execPath,['--test','string-validator/tests/test_filter.cjs'],{stdio:'inherit'});
  console.log('PASS autofix-contract:',JSON.stringify({...result,base,head}));
}
module.exports={validate,evaluate};
