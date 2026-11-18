const {test}=require('node:test');const assert=require('node:assert/strict');
const {prepareWindow,collectStatistics,buildEmail,generateWeekly}=require('./build_weekly.cjs');
const config={repo:'DaniilEF/Homework_7-8_AI',recipient:'student@example.com'};
const window=prepareWindow(config,new Date('2026-11-17T18:00:00Z'));
const issue=(id,labels,author='DaniilEF')=>({id,number:id,labels:labels.map(name=>({name})),user:{login:author},created_at:'2026-11-17T12:00:00Z'});
const response=items=>({items,total_count:items.length,incomplete_results:false});
function fixture(){const all=[issue(1,['bug']),issue(2,['task']),issue(3,['feature'],'Other'),issue(4,['needs-triage']),issue(5,[]),issue(6,['bug','feature'])];return {all:response(all),bug:response([all[0],all[5]]),task:response([all[1]]),feature:response([all[2],all[5]])};}
test('rolling seven days and exclusive end across a year boundary',()=>{
 assert.equal(window.start,'2026-11-10T18:00:00Z');assert.equal(window.end,'2026-11-17T18:00:00Z');
 assert.match(window.queries.all,/is:issue/);assert.match(window.queries.all,/17:59:59Z/);
 assert.equal(prepareWindow(config,new Date('2027-01-02T00:00:00Z')).start,'2026-12-26T00:00:00Z');
});
test('manual interval overrides, invalid email/repo/date fail before HTTP',()=>{
 assert.equal(prepareWindow({...config,startISO:'2026-11-01',endISO:'2026-11-08'}).start,'2026-11-01T00:00:00Z');
 for(const c of [{...config,recipient:'SET_RECIPIENT_EMAIL'},{...config,repo:'invalid'},{...config,startISO:'bad'},{...config,startISO:window.end,endISO:window.start}])assert.throws(()=>prepareWindow(c));
});
test('groups by author/type without double-counting overlapping label queries',()=>{
 const s=collectStatistics(window,fixture());assert.equal(s.total,6);assert.equal(s.byType.bug,1);assert.equal(s.byType['conflicting-labels'],1);
 assert.equal(Object.values(s.byType).reduce((a,b)=>a+b),6);assert.equal(s.byAuthor.reduce((a,b)=>a+b.total,0),6);
 assert.equal(s.byType['needs-triage'],1);assert.equal(s.byType.unclassified,1);assert.equal(s.queryCounts.bug,2);
});
test('empty week produces a complete zero report',()=>{
 const s=collectStatistics(window,Object.fromEntries(['all','bug','task','feature'].map(k=>[k,response([])])));
 assert.equal(s.total,0);assert.match(buildEmail(s).html,/новых Issues нет/);
});
test('truncated/incomplete searches and index disagreement stop before sending',()=>{
 for(const mutate of [r=>r.all.total_count=101,r=>r.all.incomplete_results=true,r=>r.bug.items.pop(),r=>r.bug=response([]),r=>r.all.items[0].pull_request={}]){
 const r=fixture();mutate(r);assert.throws(()=>collectStatistics(window,r));}
});
test('end boundary excluded and duplicate IDs rejected',()=>{
 const r=fixture();r.all.items[0].created_at=window.end;assert.throws(()=>collectStatistics(window,r));
 const s=fixture();s.all.items.push(s.all.items[0]);s.all.total_count++;assert.throws(()=>collectStatistics(window,s));
});
test('email escapes untrusted author names; includes counters and time window',()=>{
 const r=fixture();r.all.items[2].user.login='<script>&';const s=collectStatistics(window,r);const m=buildEmail(s);
 assert(!m.html.includes('<script>'));assert(m.html.includes('&lt;script&gt;&amp;'));assert(m.html.includes(window.start));assert(m.html.includes('<table'));
 assert.equal(m.sendTo,config.recipient);assert(m.subject.includes(config.repo));
});
test('workflow has exactly four GitHub queries, Gmail, manual/cron and no yellow notes',()=>{
 const wf=generateWeekly();assert.equal(wf.settings.timezone,'Europe/Moscow');assert.equal(wf.active,false);
 const http=wf.nodes.filter(n=>n.type.endsWith('.httpRequest'));assert.equal(http.length,4);
 assert.equal(wf.nodes.find(n=>n.type.endsWith('.scheduleTrigger')).parameters.rule.interval[0].expression,'0 9 * * MON');
 assert.equal(wf.nodes.find(n=>n.type.endsWith('.gmail')).parameters.emailType,'html');assert(!wf.nodes.some(n=>n.type.endsWith('.stickyNote')));
 const names=new Set(wf.nodes.map(n=>n.name));assert.equal(names.size,wf.nodes.length);
 for(const [src,kinds]of Object.entries(wf.connections)){assert(names.has(src));for(const groups of Object.values(kinds))for(const group of groups)for(const e of group)assert(names.has(e.node));}
});
test('embedded Code nodes execute with n8n-shaped inputs',async()=>{
 const wf=generateWeekly();const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const all=fixture();const outputs={'Report Window':window,...Object.fromEntries(Object.entries(all).map(([k,v])=>['Search '+k+' Issues',v]))};
 const $=name=>({first:()=>({json:outputs[name]})});
 const group=wf.nodes.find(n=>n.name==='Group by Type and Author');const result=await new AsyncFunction('$input','$',group.parameters.jsCode)({},$);
 assert.equal(result[0].json.total,6);
 const mail=wf.nodes.find(n=>n.name==='Build HTML Report');const report=await new AsyncFunction('$input','$',mail.parameters.jsCode)({first:()=>result[0]},$);
 assert.equal(report[0].json.sendTo,config.recipient);
 for(const n of wf.nodes.filter(n=>n.type.endsWith('.code')))new AsyncFunction('$input','$',n.parameters.jsCode);
});
