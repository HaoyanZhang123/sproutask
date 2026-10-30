import { readFileSync, writeFileSync } from 'node:fs';
const base='E:/DSH/workspaces/ai4edu/education/.local/evidence/T15';
const rows=readFileSync(base+'/rerun-tools-smoke/results.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
writeFileSync(base+'/rerun-tools-final/results-seed.jsonl', rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
let calls=0; for(const r of rows) calls+=r.callCount;
console.log(JSON.stringify({turns:rows.length, ids:rows.map(r=>r.id), calls}));