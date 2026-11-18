const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
function prepareWindow(config,now=new Date()) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repo))throw Error('Invalid repo');
  if(typeof config.recipient!=='string'||!/^\S+@\S+\.\S+$/.test(config.recipient))throw Error('Set recipient email in Report Settings');
  const end=new Date(config.endISO||now);end.setUTCMilliseconds(0);
  const start=config.startISO?new Date(config.startISO):new Date(end.getTime()-7*86400000);
  start.setUTCMilliseconds(0);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw Error('Invalid report window');
  const iso=d=>d.toISOString().replace('.000Z','Z');
  // GitHub ranges are inclusive; end-minus-one-second implements [start,end).
  const prefix=`repo:${config.repo} is:issue created:${iso(start)}..${iso(new Date(end.getTime()-1000))}`;
  return {repo:config.repo,recipient:config.recipient,start:iso(start),end:iso(end),queries:{
    all:prefix,bug:prefix+' label:bug',task:prefix+' label:task',feature:prefix+' label:feature'}};
}
function collectStatistics(window,responses) {
  const datasets={};
  for(const kind of ['all','bug','task','feature']) {
    const r=responses[kind];
    if(!r||!Array.isArray(r.items)||!Number.isInteger(r.total_count)||r.incomplete_results)throw Error('Incomplete/invalid GitHub search: '+kind);
    if(r.total_count>100||r.items.length!==r.total_count)throw Error('Search exceeds 100 results or is truncated: '+kind+'. Narrow the report interval.');
    const seen=new Set();
    datasets[kind]=r.items.filter(i=>{
      if(!i.id||i.pull_request||!i.user?.login||!Array.isArray(i.labels))throw Error('Invalid issue in '+kind);
      const created=Date.parse(i.created_at);
      if(!Number.isFinite(created)||created<Date.parse(window.start)||created>=Date.parse(window.end))throw Error('Issue outside requested interval');
      if(seen.has(i.id))throw Error('Duplicate search item');seen.add(i.id);return true;
    });
  }
  const allIDs=new Set(datasets.all.map(i=>i.id));
  for(const kind of ['bug','task','feature']){
    if(datasets[kind].some(i=>!allIDs.has(i.id)))throw Error('Search snapshots disagree; retry after GitHub indexing');
    const labelIDs=new Set(datasets[kind].map(i=>i.id));
    const fromAll=datasets.all.filter(i=>i.labels.some(l=>(typeof l==='string'?l:l.name)===kind));
    if(fromAll.length!==labelIDs.size||fromAll.some(i=>!labelIDs.has(i.id)))throw Error('Label search differs from all issues; retry after GitHub indexing');
  }
  const types=['bug','task','feature','needs-triage','unclassified','conflicting-labels'];
  const byType=Object.fromEntries(types.map(t=>[t,0]));const byAuthor=new Map();
  for(const issue of datasets.all){
    const labels=new Set(issue.labels.map(l=>typeof l==='string'?l:l.name));
    const candidates=['bug','task','feature','needs-triage'].filter(t=>labels.has(t));
    const kind=candidates.length===0?'unclassified':candidates.length>1?'conflicting-labels':candidates[0];
    byType[kind]++;
    const author=issue.user.login;
    if(!byAuthor.has(author))byAuthor.set(author,{author,total:0,...Object.fromEntries(types.map(t=>[t,0]))});
    byAuthor.get(author).total++;byAuthor.get(author)[kind]++;
  }
  return {...window,total:datasets.all.length,byType,byAuthor:[...byAuthor.values()].sort((a,b)=>b.total-a.total||a.author.localeCompare(b.author)),
    queryCounts:Object.fromEntries(Object.entries(datasets).map(([k,v])=>[k,v.length]))};
}
function buildEmail(stats) {
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const caption={bug:'Ошибки',task:'Технические задачи',feature:'Новые возможности','needs-triage':'Требуют разбора',unclassified:'Без классификации','conflicting-labels':'Несколько классификационных лейблов'};
  const cell=s=>'<td style="border:1px solid #cbd5e1;padding:8px">'+escape(s)+'</td>';
  const table=(heads,rows)=>'<table style="border-collapse:collapse;margin-bottom:24px"><thead><tr>'+heads.map(h=>'<th style="text-align:left;border:1px solid #cbd5e1;padding:8px;background:#eef2ff">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell).join('')+'</tr>').join('')+'</tbody></table>';
  const keys=Object.keys(caption);
  const byType=keys.map(k=>[k,caption[k],stats.byType[k]]);
  const byAuthor=stats.byAuthor.map(a=>[a.author,a.total,...keys.map(k=>a[k])]);
  const html='<!doctype html><html lang="ru"><body style="font-family:Arial,sans-serif;color:#172033"><h1>Недельный отчёт по Issues</h1><p>Репозиторий: '+escape(stats.repo)+'</p><p>Период UTC: '+escape(stats.start)+' — '+escape(stats.end)+' (конец не включён).</p><p><strong>Создано Issues: '+stats.total+'</strong></p>'+
    (stats.total===0?'<p>За этот период новых Issues нет.</p>':'')+'<h2>По типам</h2>'+table(['Тип','Описание','Количество'],byType)+'<h2>По авторам</h2>'+
    table(['Автор','Всего',...keys],byAuthor)+'<p>Считаются Issues, созданные за последние 7 суток, по текущим лейблам. Pull requests исключены. Авторы — создатели Issues. Закрытые Issues также учитываются, если созданы в этом периоде.</p><p>Четыре запроса: все Issues, bug, task и feature. Issues без лейбла, с needs-triage и конфликтующими лейблами не теряются и не считаются дважды.</p></body></html>';
  return {sendTo:stats.recipient,subject:`GitHub Issues: ${stats.repo} | ${stats.start.slice(0,10)} — ${stats.end.slice(0,10)}`,html};
}
function generateWeekly(){
  const nodes=[],connections={};
  const add=(name,type,typeVersion,parameters,x,y=0)=>{nodes.push({id:randomUUID(),name,type,typeVersion,parameters,position:[x,y]});return name;};
  const code=(name,jsCode,x)=>add(name,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode},x);
  const link=(a,b)=>connections[a]={main:[[{node:b,type:'main',index:0}]]};
  const manual=add('Run Report Manually','n8n-nodes-base.manualTrigger',1,{},0,140);
  const cron=add('Monday 09 Moscow','n8n-nodes-base.scheduleTrigger',1.2,{rule:{interval:[{field:'cronExpression',expression:'0 9 * * MON'}]}},0,-100);
  const settings=code('Report Settings',`const config={
  repo:'DaniilEF/Homework_7-8_AI',
  recipient:'SET_RECIPIENT_EMAIL',
  startISO:'',
  endISO:''
};
return [{json:config}];`,260);
  const window=code('Report Window',prepareWindow.toString()+'\nreturn [{json:prepareWindow($input.first().json)}];',520);
  link(manual,settings);link(cron,settings);link(settings,window);
  let previous=window;
  for(const [index,kind] of ['all','bug','task','feature'].entries()){
    const n=add('Search '+kind+' Issues','n8n-nodes-base.httpRequest',4.2,{
      method:'GET',url:'https://api.github.com/search/issues',authentication:'predefinedCredentialType',nodeCredentialType:'githubApi',
      sendQuery:true,queryParameters:{parameters:[{name:'q',value:"={{ $('Report Window').first().json.queries."+kind+" }}"},{name:'per_page',value:'100'},{name:'page',value:'1'},{name:'sort',value:'created'},{name:'order',value:'asc'}]},
      sendHeaders:true,headerParameters:{parameters:[{name:'Accept',value:'application/vnd.github+json'}]},options:{timeout:60000,response:{response:{responseFormat:'json'}}}},780+index*240);
    link(previous,n);previous=n;
  }
  const stats=code('Group by Type and Author',collectStatistics.toString()+`\nconst w=$('Report Window').first().json;
const datasets={all:$('Search all Issues').first().json,bug:$('Search bug Issues').first().json,task:$('Search task Issues').first().json,feature:$('Search feature Issues').first().json};
return [{json:collectStatistics(w,datasets)}];`,1740);
  const mail=code('Build HTML Report',buildEmail.toString()+'\nreturn [{json:buildEmail($input.first().json)}];',1980);
  const send=add('Send Gmail Report','n8n-nodes-base.gmail',2.1,{resource:'message',operation:'send',sendTo:'={{ $json.sendTo }}',subject:'={{ $json.subject }}',emailType:'html',message:'={{ $json.html }}',options:{appendAttribution:false}},2220);
  link(previous,stats);link(stats,mail);link(mail,send);
  return {name:'HW 7.2 — Weekly Issues Report',nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Europe/Moscow'},pinData:{},tags:[]};
}
if(require.main===module){const out=process.argv[2]||__dirname;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'03-weekly-report.json'),JSON.stringify(generateWeekly(),null,2)+'\n');console.log('03-weekly-report.json created');}
module.exports={prepareWindow,collectStatistics,buildEmail,generateWeekly};
