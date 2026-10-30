/** T15 helper: read the real content pack structure (read-only). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packPath =
  process.argv[2] ?? fileURLToPath(new URL('../../content/biology-7a/pack.json', import.meta.url));
const pack = JSON.parse(readFileSync(packPath, 'utf8'));

const concepts = pack.concepts ?? [];
const activities = pack.activities ?? [];
const rubrics = pack.rubrics ?? [];
const relations = pack.relations ?? [];

console.log(JSON.stringify({ keys: Object.keys(pack), version: pack.version, status: pack.status }, null, 1));
console.log(`concepts=${concepts.length} activities=${activities.length} rubrics=${rubrics.length} relations=${relations.length}`);

const byChapter = new Map();
for (const concept of concepts) {
  const placements = Array.isArray(concept.placements) ? concept.placements : [];
  for (const placement of placements) {
    const chapter = placement.chapterId ?? placement.unitId ?? '(none)';
    byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), concept.id]);
  }
}
for (const [chapter, ids] of byChapter) {
  console.log(`${chapter} -> ${ids.length} concepts: ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? ' …' : ''}`);
}
console.log('sample concept keys: ' + Object.keys(concepts[0] ?? {}).join(','));
console.log('sample placement: ' + JSON.stringify(concepts[0]?.placements?.[0]));
console.log('sample activity: ' + JSON.stringify(activities[0]).slice(0, 500));
