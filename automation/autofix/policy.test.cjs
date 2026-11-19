const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {normalize,validateProposal,checkCI,parseReview,guardMerge}=require('./policy.cjs');
const {validate}=require('./check-candidate.cjs');
const config={repo:'DaniilEF/Homework_7-8_AI',base:'main',allowedLogins:['DaniilEF'],maxPolls:40};
const base={sha:'a'.repeat(40),commit:{tree:{sha:'b'.repeat(40)}}};
const event={config,issue:5,branch:'autofix/issue-5',regressionPath:'automation/autofix/cases/issue-5.json'};
const sourcePath=process.env.AUTOFIX_SOURCE || path.join(__dirname,'fixtures/base.js');
const source=fs.readFileSync(sourcePath,'utf8');
const candidate=source.replace('if (!rxLocal.test(q)) {','if (q.length > 40 || !rxLocal.test(q)) {');
const cases=[{query:'a'.repeat(40)+'\n',errorCode:'ValidationError.INVALID_FILTER'}];
const goodCheck={total_count:1,check_runs:[{name:'autofix-contract',app:{slug:'github-actions'},head_sha:'c'.repeat(40),status:'completed',conclusion:'success',details_url:'https://github.com/DaniilEF/Homework_7-8_AI/actions/runs/1/job/1'}]};
test('trusted bug event accepted; unrelated/untrusted events ignored',()=>{
 const payload={repository:{full_name:config.repo},sender:{login:'DaniilEF'},action:'labeled',label:{name:'bug'},issue:{state:'open',number:5,title:'bug',body:'repro',labels:[{name:'bug'}]}};
 assert.equal(normalize(payload,config).branch,'autofix/issue-5');
 assert.equal(normalize({...payload,sender:{login:'stranger'}},config),null);
 assert.equal(normalize({...payload,label:{name:'feature'}},config),null);
 assert.equal(normalize({...payload,issue:{...payload.issue,pull_request:{}}},config),null);
});
test('proposal creates only two fixed files; malformed/no-op proposals rejected',()=>{
 const proposal=validateProposal({summary:'Length guard',content:candidate,cases},source,event,base);
 assert.deepEqual(proposal.treePayload.tree.map(x=>x.path),['string-validator/ui/app.js',event.regressionPath]);
 assert.throws(()=>validateProposal({summary:'noop',content:source,cases},source,event,base));
 assert.throws(()=>validateProposal({summary:'x',content:candidate,cases:[]},source,event,base));
});
test('CI must belong to GitHub Actions, exact head and expected workflow job; failures/timeouts stop',()=>{
 assert.equal(checkCI(goodCheck,'c'.repeat(40),config.repo,0,40),true);
 assert.equal(checkCI({total_count:0,check_runs:[]},'c'.repeat(40),config.repo,0,40),false);
 assert.throws(()=>checkCI({total_count:0,check_runs:[]},'c'.repeat(40),config.repo,40,40));
 assert.throws(()=>checkCI({total_count:1,check_runs:[{...goodCheck.check_runs[0],conclusion:'failure'}]},'c'.repeat(40),config.repo,0,40));
 assert.throws(()=>checkCI(goodCheck,'d'.repeat(40),config.repo,40,40));
});
test('serious finding blocks merge even if AI says approve',()=>{
 assert.equal(parseReview({approve:true,summary:'ok',findings:[]}).approved,true);
 assert.equal(parseReview({approve:true,summary:'bad',findings:[{severity:'high',message:'bug'}]}).approved,false);
 assert.throws(()=>parseReview({approve:'true',summary:'ok',findings:[]}));
});
test('merge locks head, requires original base, approval and successful CI',()=>{
 const expected={...event,sha:'c'.repeat(40),baseSha:base.sha};
 const pr={state:'open',draft:false,mergeable:true,head:{sha:expected.sha,ref:event.branch,repo:{full_name:config.repo}},base:{sha:base.sha,ref:'main',repo:{full_name:config.repo}}};
 assert.equal(guardMerge(pr,base,expected,{approved:true},goodCheck).sha,expected.sha);
 assert.throws(()=>guardMerge(pr,{sha:'d'.repeat(40)},expected,{approved:true},goodCheck));
 assert.throws(()=>guardMerge({...pr,head:{...pr.head,sha:'d'.repeat(40)}},base,expected,{approved:true},goodCheck));
 assert.throws(()=>guardMerge(pr,base,expected,{approved:false},goodCheck));
});
test('controlled faulty fixture must fail regression and fixed candidate must pass',()=>{
 // A synthetic defect in test memory, never installed in the real application.
 const faulty=source.replace('const rxLocal = /^[a-zA-Z0-9\\s]{0,40}$/;', 'const rxLocal = /^[a-zA-Z0-9\\s]{0,41}$/;');
 assert.notEqual(faulty,source);
 const regression=[{query:'a'.repeat(41),errorCode:'ValidationError.INVALID_FILTER'}];
 assert.equal(validate(faulty,candidate,{issue:5,cases:regression}).reproduced,1);
 assert.throws(()=>validate(faulty,faulty,{issue:5,cases:regression}));
 assert.throws(()=>validate(source,candidate,{issue:5,cases:[{query:'alp',expectedNames:['Alpha']}]}));
});
