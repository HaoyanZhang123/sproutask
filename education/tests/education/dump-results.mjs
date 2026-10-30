import { readFileSync } from 'node:fs';
const run='E:/DSH/workspaces/ai4edu/education/.local/evidence/T15/run-final';
const rows=readFileSync(run+'/results.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
for (const r of rows) {
  console.log('### '+r.id+' ['+r.category+'] calls='+r.callCount+' '+Math.round((r.durationMs||0)/1000)+'s concept='+(r.concept?.title||''));
  console.log((r.finalText||'').replace(/\s+/g,' ').slice(0,520));
  console.log('');
}