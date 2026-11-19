const REPO = 'DaniilEF/Homework_7-8_AI';
const SOURCE = 'string-validator/ui/app.js';
const SHA = /^[a-f0-9]{40}$/;

function normalize(payload, config) {
  const p = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  if (p.repository?.full_name !== config.repo || !p.issue || p.issue.pull_request || p.issue.state !== 'open') return null;
  const actor = p.sender?.login;
  if (!config.allowedLogins.includes(actor)) return null;
  const labels = (p.issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
  if (!labels.includes('bug')) return null;
  const requested = p.action === 'opened' || (p.action === 'labeled' && p.label?.name === 'bug')
    || (p.action === 'created' && p.comment?.body?.trim() === '/fix_bug' && config.allowedLogins.includes(p.comment.user?.login));
  if (!requested) return null;
  if (!Number.isSafeInteger(p.issue.number) || p.issue.number < 1 || typeof p.issue.title !== 'string'
      || typeof (p.issue.body ?? '') !== 'string' || (p.issue.title + (p.issue.body ?? '')).length > 15000) throw Error('Invalid issue');
  return { config, issue: p.issue.number, title: p.issue.title, description: p.issue.body ?? '',
    branch: `autofix/issue-${p.issue.number}`, regressionPath: `automation/autofix/cases/issue-${p.issue.number}.json` };
}

function validateProposal(raw, source, event, base) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!SHA.test(base.sha) || !SHA.test(base.commit?.tree?.sha)) throw Error('Invalid base commit');
  if (!p || typeof p.summary !== 'string' || !p.summary.trim() || p.summary.length > 2000
      || typeof p.content !== 'string' || p.content.length > 30000 || !p.content.trim() || p.content === source) throw Error('Empty/invalid patch');
  if (!p.content.includes('function filterItems(') || !p.content.includes('let allItems = []')) throw Error('Function boundary removed');
  const begin=source.indexOf('function filterItems('),end=source.indexOf('let allItems = []');
  const newBegin=p.content.indexOf('function filterItems('),newEnd=p.content.indexOf('let allItems = []');
  if (begin<0 || end<begin || source.slice(0,begin)!==p.content.slice(0,newBegin)
      || source.slice(end)!==p.content.slice(newEnd)) throw Error('Changes outside filterItems are forbidden');
  if (/\b(?:eval|Function|require|process|globalThis|fetch|XMLHttpRequest|import|window|document)\b/.test(p.content.slice(newBegin,newEnd))) throw Error('Forbidden side effect in filter');
  if (!Array.isArray(p.cases) || p.cases.length < 1 || p.cases.length > 15) throw Error('Missing regression cases');
  for (const c of p.cases) {
    if (!c || typeof c.query !== 'string' || c.query.length > 200) throw Error('Invalid regression query');
    const error = c.errorCode === 'ValidationError.INVALID_FILTER';
    const names = Array.isArray(c.expectedNames) && c.expectedNames.every(n => ['Alpha','Beta','Gamma','Delta','Omega'].includes(n));
    if (error === names || (c.errorCode !== undefined && !error)) throw Error('Expected names OR contract error');
    if (Object.keys(c).some(k => !['query','expectedNames','errorCode'].includes(k))) throw Error('Unknown regression field');
  }
  return {...event, baseSha: base.sha, baseTree: base.commit.tree.sha, summary: p.summary, content:p.content,
    cases:p.cases, treePayload:{base_tree:base.commit.tree.sha,tree:[
      {path:'string-validator/ui/app.js',mode:'100644',type:'blob',content:p.content},
      {path:event.regressionPath,mode:'100644',type:'blob',content:JSON.stringify({issue:event.issue,cases:p.cases},null,2)+'\n'}
    ]}};
}

function checkCI(response, sha, repo, attempts, maxPolls) {
  if (!Array.isArray(response.check_runs) || response.total_count > 100) throw Error('Invalid/incomplete CI response');
  const checks = response.check_runs;
  const required = checks.filter(c => c.name === 'autofix-contract' && c.app?.slug === 'github-actions'
    && c.head_sha === sha && typeof c.details_url === 'string' && c.details_url.startsWith(`https://github.com/${repo}/actions/runs/`));
  if (checks.some(c => c.status === 'completed' && !['success','neutral','skipped'].includes(c.conclusion))) throw Error('CI failed; PR left open');
  if (!required.length || checks.some(c => c.status !== 'completed') || required.some(c => c.status !== 'completed')) {
    if (attempts >= maxPolls) throw Error('CI timeout; PR left open');
    return false;
  }
  if (required.some(c => c.conclusion !== 'success')) throw Error('Required CI did not succeed');
  return true;
}

function parseReview(raw) {
  const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!r || typeof r.approve !== 'boolean' || typeof r.summary !== 'string' || !r.summary.trim()
      || r.summary.length > 4000 || !Array.isArray(r.findings) || r.findings.length > 30) throw Error('Invalid review');
  for (const f of r.findings) if (!f || !['low','medium','high','critical'].includes(f.severity)
    || typeof f.message !== 'string' || !f.message.trim() || f.message.length > 2000) throw Error('Invalid review finding');
  return {...r, approved:r.approve && !r.findings.some(f => ['high','critical'].includes(f.severity))};
}

function guardMerge(pr, main, expected, review, checks) {
  if (!review.approved) throw Error('Review rejected');
  if (pr.state !== 'open' || pr.draft || pr.head?.sha !== expected.sha || pr.head?.ref !== expected.branch
      || pr.head?.repo?.full_name !== expected.config.repo || pr.base?.repo?.full_name !== expected.config.repo
      || pr.base?.ref !== expected.config.base || main.sha !== expected.baseSha || pr.base?.sha !== expected.baseSha
      || pr.mergeable !== true) throw Error('PR/base changed or merge unavailable; manual handling required');
  if (!checkCI(checks,expected.sha,expected.config.repo,expected.config.maxPolls,expected.config.maxPolls)) throw Error('CI not complete');
  return {sha:expected.sha,merge_method:'merge'};
}

module.exports = { REPO, SOURCE, normalize, validateProposal, checkCI, parseReview, guardMerge };
