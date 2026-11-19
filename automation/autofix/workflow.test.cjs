const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const workflow=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../homework/7.2/autofix/HW 7.2 — Bug report to tested fix and merge.json'),'utf8'));
const nodes=new Map(workflow.nodes.map(n=>[n.name,n]));
const source=fs.readFileSync(path.join(__dirname,'fixtures/base.js'),'utf8');
const event={config:{repo:'DaniilEF/Homework_7-8_AI',base:'main',allowedLogins:['DaniilEF'],fixModel:'first',reviewModel:'second',maxPolls:2},issue:5,title:'Length validation',description:'Regression example',branch:'autofix/issue-5',regressionPath:'automation/autofix/cases/issue-5.json'};
function run(name,input,values={},index=0){const context={$input:{first:()=>({json:input})},$:key=>({first:()=>({json:values[key]})}),$runIndex:index,Buffer};const value=vm.runInNewContext(`(function(){${nodes.get(name).parameters.jsCode}})()`,context,{timeout:1000});return JSON.parse(JSON.stringify(value));}
function fixture(){const context={data:{repository:{base:{oid:'a'.repeat(40),tree:{oid:'b'.repeat(40)},file:{object:{text:source}}},pullRequests:{nodes:[]}}}};const prepared=run('Prepare Fix',context,{'Normalize Bug':event})[0].json;const content=source.replace('if (!rxLocal.test(q)) {','if (q.length > 40 || !rxLocal.test(q)) {');const proposal=run('Validate Proposal',{text:JSON.stringify({summary:'Length check',content,cases:[{query:'a'.repeat(41),errorCode:'ValidationError.INVALID_FILTER'}]})},{'Normalize Bug':event,'Prepare Fix':prepared})[0].json;const sha='c'.repeat(40);return {prepared,proposal,sha,values:{'Normalize Bug':event,'Prepare Fix':prepared,'Validate Proposal':proposal,'Commit Fix':{data:{createCommitOnBranch:{commit:{oid:sha}}}},'Open Fix PR':{number:10,html_url:'https://github.com/DaniilEF/Homework_7-8_AI/pull/10',head:{sha}}}};}
test('compact graph has 24 nodes, valid links and executable expressions',()=>{
 assert.equal(workflow.nodes.length,24);assert.equal(nodes.size,24);
 for(const [from,connections]of Object.entries(workflow.connections)){assert(nodes.has(from));for(const output of Object.values(connections))for(const group of output)for(const edge of group||[])assert(nodes.has(edge.node));}
 for(const n of nodes.values()){
  assert.equal(n.position.length,2);assert(n.position.every(Number.isFinite));
  for(const match of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g))assert(nodes.has(match[1]),match[1]);
  if(n.parameters.jsCode)new vm.Script(`(function(){${n.parameters.jsCode}})()`);
  for(const key of ['url','jsonBody','text']){const value=n.parameters[key];if(typeof value==='string'&&value.startsWith('={{'))new vm.Script('('+value.slice(3,-2)+')');}
 }
});
test('grouped context prepares prompt and stops duplicate or invalid GraphQL response',()=>{
 const f=fixture();assert.equal(f.prepared.base.sha,'a'.repeat(40));assert.equal(JSON.parse(f.prepared.prompt.split('Данные: ').pop()).source,source);
 const duplicate={data:{repository:{base:{oid:'a'.repeat(40),tree:{oid:'b'.repeat(40)},file:{object:{text:source}}},pullRequests:{nodes:[{number:10}]}}}};
 assert.deepEqual(run('Prepare Fix',duplicate,{'Normalize Bug':event}),[]);
 assert.throws(()=>run('Prepare Fix',{errors:[{message:'no access'}]},{'Normalize Bug':event}));
});
test('atomic commit input keeps exactly the allowed files and expected base SHA',()=>{
 const {proposal}=fixture();assert.equal(proposal.commitInput.expectedHeadOid,'a'.repeat(40));
 assert.deepEqual(proposal.commitInput.fileChanges.additions.map(f=>f.path),['string-validator/ui/app.js',event.regressionPath]);
 assert.equal(Buffer.from(proposal.commitInput.fileChanges.additions[0].contents,'base64').toString('utf8'),proposal.content);
});
test('CI node prepares review only on successful exact-head checks',()=>{
 const f=fixture();const checks={total_count:1,check_runs:[{name:'autofix-contract',app:{slug:'github-actions'},head_sha:f.sha,status:'completed',conclusion:'success',details_url:'https://github.com/'+event.config.repo+'/actions/runs/1'}]};
 const result=run('Check CI',checks,f.values)[0].json;assert.equal(result.ready,true);assert(result.prompt.includes('CI'));assert.equal(JSON.parse(result.prompt.split('Данные: ').pop()).base,source);
 assert.equal(run('Check CI',{total_count:0,check_runs:[]},f.values)[0].json.ready,false);
 assert.throws(()=>run('Check CI',{total_count:0,check_runs:[]},f.values,2));
});
test('serious review is published but never approved for merge',()=>{
 const f=fixture();const r=run('Validate Review',{text:JSON.stringify({approve:true,summary:'Blocking defect',findings:[{severity:'critical',message:'Unsafe change'}]})},f.values)[0].json;
 assert.equal(r.approved,false);assert.match(r.reviewPayload.body,/manual review required/);
});
test('grouped merge-state keeps approval, current base/head and CI guards',()=>{
 const f=fixture();f.values['Validate Review']={review:{approved:true}};
 const state={data:{repository:{base:{oid:'a'.repeat(40)},pullRequest:{state:'OPEN',isDraft:false,mergeable:'MERGEABLE',headRefName:event.branch,headRefOid:f.sha,headRepository:{nameWithOwner:event.config.repo},baseRefName:'main',baseRefOid:'a'.repeat(40),baseRepository:{nameWithOwner:event.config.repo}},candidate:{oid:f.sha,checkSuites:{pageInfo:{hasNextPage:false},nodes:[{app:{slug:'github-actions'},checkRuns:{pageInfo:{hasNextPage:false},nodes:[{name:'autofix-contract',status:'COMPLETED',conclusion:'SUCCESS',detailsUrl:'https://github.com/'+event.config.repo+'/actions/runs/1'}]}}]}}}}};
 assert.equal(run('Guard Merge',state,f.values)[0].json.payload.sha,f.sha);
 const changed=structuredClone(state);changed.data.repository.base.oid='d'.repeat(40);assert.throws(()=>run('Guard Merge',changed,f.values));
 const failed=structuredClone(state);failed.data.repository.candidate.checkSuites.nodes[0].checkRuns.nodes[0].conclusion='FAILURE';assert.throws(()=>run('Guard Merge',failed,f.values));
});


function requestBody(name,values){
 const body=nodes.get(name).parameters.jsonBody;
 assert.match(body,/^=\{\{ \$\('[^']+'\)\.first\(\)\.json\.[a-zA-Z]+ \}\}$/);
 return JSON.parse(JSON.stringify(vm.runInNewContext('('+body.slice(3,-2)+')',{$:key=>({first:()=>({json:values[key]})})})));
}
test('GraphQL HTTP bodies are simple expressions referencing ready JSON objects',()=>{
 const f=fixture();
 const normalized=run('Normalize Bug',{repository:{full_name:'DaniilEF/Homework_7-8_AI'},sender:{login:'DaniilEF'},action:'opened',issue:{number:12,state:'open',title:'Case insensitive',body:'GA returns no matches',labels:[{name:'bug'}]}})[0].json;
 const context=requestBody('Read Context',{'Normalize Bug':normalized});
 assert.equal(context.variables.branch,'autofix/issue-12');assert(context.query.includes('file(path:"string-validator/ui/app.js")'));
 const commit=requestBody('Commit Fix',f.values);assert.deepEqual(commit.variables.input.branch,{repositoryNameWithOwner:event.config.repo,branchName:event.branch});assert.equal(commit.variables.input.branch.refName,undefined);
 f.values['Validate Review']=run('Validate Review',{text:JSON.stringify({approve:true,summary:'Approved',findings:[]})},f.values)[0].json;
 const merge=requestBody('Read Merge State',f.values);assert.equal(merge.variables.head,f.sha);assert.equal(merge.variables.pr,10);
});
test('GraphQL HTTP-200 errors or missing commit SHA cannot reach PR creation',()=>{
 assert.equal(workflow.connections['Commit Fix'].main[0][0].node,'Verify Commit');
 assert.equal(workflow.connections['Verify Commit'].main[0][0].node,'Open Fix PR');
 assert.throws(()=>run('Verify Commit',{errors:[{message:'branchName required'}]}),/branchName required/);
 assert.throws(()=>run('Verify Commit',{data:null}),/did not confirm/);
 const f=fixture();assert.equal(run('Verify Commit',f.values['Commit Fix'])[0].json.data.createCommitOnBranch.commit.oid,f.sha);
});
test('failed CI stops the pipeline before AI review',()=>{
 const f=fixture();assert.throws(()=>run('Check CI',{total_count:1,check_runs:[{name:'autofix-contract',status:'completed',conclusion:'failure'}]},f.values),/CI failed/);
});
