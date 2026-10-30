import { existsSync, readFileSync } from 'node:fs';
const base='E:/DSH/workspaces/ai4edu/education/.local/evidence/T15';
for (const id of ['B01-R1','B02-R1','B03-R1','B10-R1']) {
  let raw=null;
  for (const dir of [base+'/rerun-tools-final/turns/'+id, base+'/rerun-tools-smoke/turns/'+id]) {
    if (existsSync(dir+'/runtime.jsonl')) { raw=readFileSync(dir+'/runtime.jsonl','utf8').trim(); break; }
  }
  if (raw===null) { console.log(id+' no log'); continue; }
  const rows=raw.split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
  const calls=rows.filter(e=>e.event==='tool.call');
  const results=rows.filter(e=>e.event==='tool.result');
  console.log('## '+id+' toolCalls='+calls.length);
  for (let i=0;i<calls.length;i+=1){
    const c=calls[i], r=results[i];
    console.log('  call', c.name, JSON.stringify(c.args).slice(0,150));
    console.log('  result', JSON.stringify(r?.value ?? r?.error ?? r).slice(0,260));
  }
}