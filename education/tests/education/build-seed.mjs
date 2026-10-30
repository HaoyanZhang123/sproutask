import { readFileSync, writeFileSync } from 'node:fs';
const base='E:/DSH/workspaces/ai4edu/education/.local/evidence/T15';
const out=base+'/run-final';
const map=new Map();
for (const file of [base+'/smoke/results.jsonl', base+'/run-20261029T2335+0800/results.jsonl']) {
  for (const line of readFileSync(file,'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r=JSON.parse(line);
    map.set(r.id, {...r, personaVariant: 'v1-tools-allowed'});
  }
}
const rows=[...map.values()];
writeFileSync(out+'/results-seed.jsonl', rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
let calls=0; for (const r of rows) calls+=r.callCount;
console.log(JSON.stringify({turns:rows.length, ids:rows.map(r=>r.id), calls}));