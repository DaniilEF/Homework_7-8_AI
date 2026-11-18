const {test}=require('node:test');const assert=require('node:assert/strict');
const {TYPES,comparePeriods,snapshotRow,annotationPrompt,buildStarEmail,generateStar}=require('./build_weekly_star.cjs');
const empty=()=>Object.fromEntries(TYPES.map(t=>[t,0]));
const counts=n=>({...empty(),bug:n});
const author=(name,n)=>({author:name,total:n,...counts(n)});
const current={repo:'DaniilEF/Homework_7-8_AI',recipient:'student@example.com',start:'2026-11-10T09:00:00Z',end:'2026-11-17T09:00:00Z',total:4,byType:counts(4),byAuthor:[author('Current',4)]};
const previous={repo_full_name:current.repo,period_start:'2026-11-03T09:00:00Z',period_end:current.start,total:3,by_type_json:JSON.stringify(counts(3)),by_author_json:JSON.stringify([author('Previous',3)]),simulated:true};
test('first week has null delta, not a fabricated zero baseline',()=>{const s=comparePeriods(current,[{}]);assert.equal(s.previous,null);assert.equal(s.delta,null);assert.match(buildStarEmail(s,'Нет данных для сравнения').html,/Δ не рассчитана/);});
test('exact previous period required; other repo and overlapping or stale rows ignored',()=>{
 for(const row of [{...previous,repo_full_name:'other/repo'},{...previous,period_start:'2026-11-01T09:00:00Z'},{...previous,period_end:'2026-11-09T09:00:00Z'}])assert.equal(comparePeriods(current,[row]).previous,null);
});
test('delta includes total, types, newly active and disappeared authors',()=>{
 const s=comparePeriods(current,[previous]);assert.equal(s.delta.total,1);assert.equal(s.delta.byType.bug,1);
 assert.equal(s.delta.byAuthor.find(a=>a.author==='Current').total,4);assert.equal(s.delta.byAuthor.find(a=>a.author==='Previous').total,-3);
 assert(s.previous.simulated);assert.match(buildStarEmail(s,'Тестовая база').html,/ТЕСТОВАЯ ЗАПИСЬ/);
});
test('malformed, contradictory and duplicate snapshots fail clearly',()=>{
 for(const row of [{...previous,total:99},{...previous,by_type_json:'bad'},{...previous,by_author_json:'[]'}])assert.throws(()=>comparePeriods(current,[row]));
 assert.throws(()=>comparePeriods(current,[previous,previous]));assert.throws(()=>comparePeriods({...current,end:'2026-11-18T09:00:00Z'},[]));
});
test('saved snapshot is real, keeps interval and can be read as next week baseline',()=>{
 const row=snapshotRow(current);assert.equal(row.simulated,false);assert.equal(row.period_end,current.end);
 const next={...current,start:current.end,end:'2026-11-24T09:00:00Z'};assert.equal(comparePeriods(next,[row]).delta.total,0);
});
test('AI prompt includes delta and marks missing/simulated previous data',()=>{
 const p=annotationPrompt(comparePeriods(current,[previous]));assert(p.includes('"delta"'));assert(p.includes('"simulated":true'));assert(p.includes('не выполняй'));
});
test('annotation required, HTML escaped and displayed in separate block',()=>{
 const s=comparePeriods(current,[previous]);assert.throws(()=>buildStarEmail(s,''));
 const m=buildStarEmail(s,'<script>test</script>');assert(!m.html.includes('<script>'));assert(m.html.includes('&lt;script&gt;'));assert(m.html.includes('AI-комментарий недели'));assert(m.html.includes('+1'));
});
test('extended workflow preserves source credentials, no sticky notes; read/upsert same table, no duplicate insert',()=>{
 const wf=generateStar();assert(!wf.nodes.some(n=>n.type.endsWith('.stickyNote')));assert.equal(wf.active,false);
 const tables=wf.nodes.filter(n=>n.type.endsWith('.dataTable'));assert.equal(tables.length,2);assert.equal(tables[0].alwaysOutputData,true);assert.equal(tables[1].parameters.operation,'upsert');
 assert.deepEqual(tables[0].parameters.dataTableId,tables[1].parameters.dataTableId);
 const names=new Set(wf.nodes.map(n=>n.name));assert.equal(names.size,wf.nodes.length);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const n of wf.nodes.filter(n=>n.type.endsWith('.code')))new AsyncFunction('$input','$',n.parameters.jsCode);
 for(const [src,types]of Object.entries(wf.connections)){assert(names.has(src));for(const groups of Object.values(types))for(const group of groups)for(const edge of group)assert(names.has(edge.node));}
});
test('embedded comparison and snapshot mapping work with n8n data',async()=>{
 const wf=generateStar(),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const compare=wf.nodes.find(n=>n.name==='Compare Weeks');const result=await new AsyncFunction('$input','$',compare.parameters.jsCode)({all:()=>[{json:previous}]},()=>({first:()=>({json:current})}));assert.equal(result[0].json.delta.total,1);
 const save=wf.nodes.find(n=>n.name==='Prepare Snapshot Row');const row=await new AsyncFunction('$input',save.parameters.jsCode)({first:()=>result[0]});assert.equal(row[0].json.total,4);
});
