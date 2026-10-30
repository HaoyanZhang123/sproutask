import { readFileSync } from 'node:fs';
const base='E:/DSH/workspaces/ai4edu/education/.local/evidence/T15';
function auditCalls(file){
  try{
    const raw=readFileSync(file,'utf8').trim();
    let rows;
    if (raw.startsWith('[')) rows=JSON.parse(raw);
    else rows=raw.split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
    const idle=rows.filter(e=>e.payload&&e.payload.kind==='dsh.debug'&&e.payload.event==='dsh.idle');
    let total=0; for(const e of idle){ const roles=e.payload.roles||[]; total+=roles.filter(r=>r==='assistant').length; }
    return {idleEvents:idle.length, assistantMessages:total, toolCalls: rows.filter(e=>e.event==='tool.call').length};
  }catch(e){ return {error:String(e.message)}; }
}
for (const [name,file] of [
  ['rerun-pilot', base+'/rerun-pilot/runtime-audit.json'],
  ['rerun-review1', base+'/rerun-review/runtime-audit.json'],
  ['rerun-review3', base+'/rerun-review3/runtime-audit.json'],
  ['rerun-review5', base+'/rerun-review5/runtime-audit.json'],
]) console.log(name, JSON.stringify(auditCalls(file)));