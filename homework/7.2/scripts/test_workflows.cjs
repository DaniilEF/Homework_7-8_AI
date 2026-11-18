const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeIssue,normalizeClassification,routeClassification,generateClassifier,generateTriage}=require('./build_workflows.cjs');
const event={action:'opened',repository:{full_name:'DaniilEF/Homework_7-8_AI'},issue:{number:4,id:123,title:'Filter crashes',body:'Reproduction'}};
test('only opened real issues of configured repository pass',()=>{
  assert.equal(normalizeIssue({body:event}).issue_number,4);
  assert.equal(normalizeIssue({...event,action:'labeled'}),null);
  assert.equal(normalizeIssue({...event,issue:{...event.issue,pull_request:{}}}),null);
  assert.equal(normalizeIssue({...event,repository:{full_name:'wrong/repo'}}),null);
  assert.equal(normalizeIssue({...event,issue:{...event.issue,body:null}}).body,'');
});
test('reject invalid title, number and excessive length without silent truncation',()=>{
  for(const issue of [{...event.issue,title:''},{...event.issue,number:-1},{...event.issue,body:'x'.repeat(20001)}]) assert.throws(()=>normalizeIssue({...event,issue}));
});
test('valid types route to correct labels; 0.8 is accepted; 0.799 is escalated',()=>{
  for(const type of ['bug','task','feature']) {
    assert.equal(routeClassification({type,confidence:.8}).label,type);
    assert.equal(routeClassification({type,confidence:1}).label,type);
    assert.equal(routeClassification({type,confidence:.799}).label,'needs-triage');
  }
});
test('unknown type and malformed/error responses safely escalate',()=>{
  for(const r of [{type:'unknown',confidence:1},{type:'other',confidence:.99},{type:'bug',confidence:'0.9'},{type:'bug',confidence:-1},{type:'bug',confidence:1.1},{type:'bug',confidence:NaN},{error:'LLM failed'},null,[],'invalid']) {
    assert.equal(routeClassification(r).label,'needs-triage');
  }
});
test('supports parsed chain output wrappers and JSON strings',()=>{
  const r={type:'feature',confidence:.95};
  for(const raw of [r,{text:r},{output:r},{text:JSON.stringify(r)}])assert.deepEqual(normalizeClassification(raw),r);
});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const wf of [generateClassifier(),generateTriage()]) {
  test(wf.name+': structure, parser/model links and absence of instructions/secrets',()=>{
    const names=new Set(wf.nodes.map(n=>n.name));assert.equal(names.size,wf.nodes.length);assert.equal(wf.active,false);
    assert.equal(new Set(wf.nodes.map(n=>n.id)).size,wf.nodes.length);
    for(const n of wf.nodes){assert(!n.type.endsWith('.stickyNote'));assert(!n.notes);if(n.type.endsWith('.code'))new AsyncFunction('$input','$',n.parameters.jsCode);}
    for(const [src,kinds] of Object.entries(wf.connections)){
      assert(names.has(src));for(const outputs of Object.values(kinds))for(const group of outputs)for(const edge of group)assert(names.has(edge.node));
    }
    assert(!/ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/.test(JSON.stringify(wf)));
  });
}
test('embedded Normalize and Route preserve issue identity and cutoff',async()=>{
  const wf=generateTriage();const norm=wf.nodes.find(n=>n.name==='Normalize Issue');
  const output=await new AsyncFunction('$input',norm.parameters.jsCode)({first:()=>({json:event})});
  const route=wf.nodes.find(n=>n.name==='Validate and Route');
  for(const [confidence,label] of [[.8,'bug'],[.7,'needs-triage']]){
    const r=await new AsyncFunction('$input','$',route.parameters.jsCode)({all:()=>[{json:{type:'bug',confidence}}]},()=>({first:()=>output[0]}));
    assert.equal(r[0].json.label,label);assert.equal(r[0].json.issue_number,4);
  }
});
test('subworkflow has explicit title/body contract and parser; caller waits',()=>{
  const child=generateClassifier(),parent=generateTriage();
  assert.deepEqual(child.nodes[0].parameters.workflowInputs.values.map(x=>x.name),['title','body']);
  assert.equal(child.connections['Classification JSON Parser'].ai_outputParser[0][0].node,'Classify Issue');
  assert.equal(child.connections['Classifier Chat Model'].ai_languageModel[0][0].node,'Classify Issue');
  const p=parent.nodes.find(n=>n.name==='Call Issue Classifier').parameters;
  assert.equal(p.options.waitForSubWorkflow,true);assert.deepEqual(Object.keys(p.workflowInputs.value),['title','body']);
});
test('all routes ONLY add labels, preserve other labels and never post a comment',()=>{
  const wf=generateTriage();const requests=wf.nodes.filter(n=>n.type.endsWith('.httpRequest'));
  assert.equal(requests.length,4);
  for(const n of requests){assert.equal(n.parameters.method,'POST');assert.equal(n.parameters.url,'={{ $json.api_labels }}');assert.equal(JSON.parse(n.parameters.jsonBody).labels.length,1);}
  assert.equal(wf.connections['Switch Issue Type'].main[3][0].node,'Label needs-triage');
  assert.equal(wf.connections['Switch Issue Type'].main[4][0].node,'Label needs-triage');
});
test('embedded classifier input and return fallback execute',async()=>{
  const wf=generateClassifier();const prep=wf.nodes.find(n=>n.name==='Prepare Classifier Input');
  await assert.rejects(()=>new AsyncFunction('$input',prep.parameters.jsCode)({all:()=>[{json:{title:'',body:''}}]}));
  const ret=wf.nodes.find(n=>n.name==='Return Classification');
  const r=await new AsyncFunction('$input',ret.parameters.jsCode)({first:()=>({json:{error:'Invalid model JSON'}})});
  assert.deepEqual(r,[{json:{type:'unknown',confidence:0}}]);
});
