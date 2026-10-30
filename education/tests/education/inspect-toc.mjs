import {readFileSync} from 'node:fs';
const pack=JSON.parse(readFileSync('E:/DSH/workspaces/ai4edu/education/content/biology-7a/pack.json','utf8'));
for (const n of pack.toc) console.log(JSON.stringify({id:n.id, kind:n.kind, title:n.title, level:n.level, children:(n.children??[]).length}));