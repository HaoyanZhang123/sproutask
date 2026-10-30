#!/usr/bin/env node
/**
 * curator-worksheet.mjs — 生成人类 curator 审校工作单（只读内容包，输出 Markdown）。
 *
 * 用法：
 *   node education/content/biology-7a/tools/curator-worksheet.mjs [--out docs/rebuild/CURATOR-WORKSHEET.md] [--section <tocId>] [--limit N]
 *
 * 目的：让人类审校者按"概念 → 教材页 → 原句锚点 → rubric → 活动"逐条核对，
 * 只需要判断学科正确性，不需要读代码。脚本不修改任何内容，只读 pack.json 与 source-refs.json。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(here, '..');
const read = (rel) => JSON.parse(readFileSync(path.join(packRoot, rel), 'utf8'));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const outPath = path.resolve(packRoot, '..', '..', '..', flag('--out', 'docs/rebuild/CURATOR-WORKSHEET.md'));
const onlySection = flag('--section', null);
const limit = Number(flag('--limit', '0')) || 0;

const pack = read('pack.json');
const sourceRefs = read('source/source-refs.json');
const refsById = new Map((sourceRefs.sourceRefs ?? sourceRefs.refs ?? sourceRefs).map((r) => [r.id, r]));

const tocById = new Map((pack.toc ?? []).map((n) => [n.id, n]));
const tocOrder = new Map((pack.toc ?? []).map((n, i) => [n.id, i]));
const rubricsById = new Map((pack.rubrics ?? []).map((r) => [r.id, r]));
const activitiesById = new Map((pack.activities ?? []).map((a) => [a.id, a]));

const sectionOf = (concept) => {
  const placements = concept.placements ?? [];
  const sections = placements
    .map((id) => tocById.get(id))
    .filter((n) => n && n.type === 'section');
  return sections[0] ?? tocById.get(placements[0]) ?? null;
};

const sectionPath = (node) => {
  const names = [];
  let cur = node;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.unshift(cur.title);
    cur = cur.parentId ? tocById.get(cur.parentId) : null;
  }
  return names.join(' / ');
};

const concepts = [...(pack.concepts ?? [])].sort((a, b) => {
  const sa = sectionOf(a);
  const sb = sectionOf(b);
  const oa = sa ? tocOrder.get(sa.id) ?? 999 : 999;
  const ob = sb ? tocOrder.get(sb.id) ?? 999 : 999;
  return oa - ob || a.title.localeCompare(b.title, 'zh');
});

const filtered = concepts.filter((c) => {
  if (!onlySection) return true;
  return (c.placements ?? []).includes(onlySection);
});
const selected = limit > 0 ? filtered.slice(0, limit) : filtered;

const tick = '- [ ] ';
const lines = [];
lines.push('# 人类审校工作单（curator worksheet）');
lines.push('');
lines.push(`- 生成时间：${new Date().toISOString()}`);
lines.push(`- 内容包：\`${pack.id}@${pack.version}\`（scope=${pack.scope}，coverage=${pack.coverageStatus}，status=${pack.status}）`);
lines.push(`- 概念总数：${(pack.concepts ?? []).length}；本单包含：${selected.length}`);
lines.push(`- 出处总数：${refsById.size}；活动：${(pack.activities ?? []).length}；rubric：${(pack.rubrics ?? []).length}`);
lines.push('');
lines.push('> 说明：本工作单只帮人核对**学科正确性**。每项打勾表示"我已对照原书核对"，');
lines.push('> 全部勾完并把结果交给主控后，才能按 `PublishRegistry` 规则写 `curator_checked → published` 记录。');
lines.push('> 出处里的 **PDF 页**与**印刷页**是两套编号，不能混用；页面位置来自 OCR 基线，可能存在个别误差，请以原书为准。');
lines.push('');
lines.push('## 0. 全册审校总体勾选项');
for (const item of [
  '目录（2 单元 / 7 章 / 22 节）与原书一致，无缺节/多节',
  '每个概念的"定义/边界"与教材表述不冲突',
  '没有编造页码、没有把生成文字冒充教材原句',
  '每个概念至少一个基础活动 + 一个变式/迁移活动，答案键正确',
  'rubric 的关键标准与常见误概念符合学科事实',
  '先修关系有依据（教材明示或教学推断并写明理由），不是按目录顺序硬推',
  '图注/图示的使用或排除理由可接受（图义视觉核对另附）',
  '版次/印次/ISBN/总页数已对照版权页核实（当前为 unverified）',
]) {
  lines.push(`${tick}${item}`);
}
lines.push('');

let currentSection = null;
for (const concept of selected) {
  const section = sectionOf(concept);
  if (section && section.id !== currentSection) {
    currentSection = section.id;
    lines.push(`## ${sectionPath(section)}`);
    lines.push('');
  }
  lines.push(`### ${concept.title}  \`${concept.id}\``);
  lines.push('');
  lines.push(`- ${tick}**定义/边界准确**：${String(concept.explanation ?? '').replace(/\s+/g, ' ').slice(0, 400)}${String(concept.explanation ?? '').length > 400 ? '…' : ''}`);
  const objectives = concept.learningObjectives ?? [];
  if (objectives.length > 0) {
    lines.push(`- ${tick}**学习目标可观察**：`);
    for (const o of objectives) lines.push(`  - ${o}`);
  }
  const misconceptions = concept.misconceptions ?? [];
  if (misconceptions.length > 0) {
    lines.push(`- ${tick}**易错点与纠正准确**：`);
    for (const m of misconceptions) {
      lines.push(`  - 迷思：${m.statement ?? ''}；纠正：${m.correction ?? ''}`);
    }
  }
  const refs = (concept.sourceRefs ?? []).map((id) => refsById.get(id)).filter(Boolean);
  if (refs.length > 0) {
    lines.push(`- ${tick}**出处真实可定位**（PDF 页 / 印刷页）：`);
    for (const r of refs.slice(0, 12)) {
      const printed = r.printedPage === null || r.printedPage === undefined ? '（无印刷页标签）' : r.printedPage;
      lines.push(`  - \`${r.id}\`：PDF ${r.pdfPage} / 印刷页 ${printed}${r.blockId ? ` / 块 \`${r.blockId}\`` : ''}`);
    }
    if (refs.length > 12) lines.push(`  - …另有 ${refs.length - 12} 条出处`);
  }
  const rubrics = (concept.rubricIds ?? []).map((id) => rubricsById.get(id)).filter(Boolean);
  for (const rubric of rubrics) {
    const criteria = rubric.criteria ?? rubric.keyCriteria ?? [];
    lines.push(`- ${tick}**rubric 与解释一致**（\`${rubric.id}\`）：`);
    for (const c of criteria.slice(0, 6)) {
      const text = typeof c === 'string' ? c : c.description ?? c.statement ?? JSON.stringify(c);
      lines.push(`  - ${text}`);
    }
  }
  const acts = (concept.activityIds ?? []).map((id) => activitiesById.get(id)).filter(Boolean);
  if (acts.length > 0) {
    lines.push(`- ${tick}**活动答案键正确**：`);
    for (const a of acts) {
      const kind = a.type ?? a.answerSchema?.kind ?? 'unknown';
      const key = a.answerSchema?.correctOptionIds ?? a.answerSchema?.pairs ?? a.answerSchema?.targets ?? a.answerSchema?.kind ?? '';
      lines.push(`  - \`${a.id}\`（${kind}）：${typeof key === 'string' ? key : JSON.stringify(key).slice(0, 160)}`);
    }
  }
  lines.push('');
}

lines.push('## 审校结论（由审校者填写）');
lines.push('');
lines.push('- 审校人（姓名/角色，例如"生物学教师 张老师"）：');
lines.push('- 审校日期：');
lines.push('- 覆盖范围（本节 / 第几单元 / 全册）：');
lines.push('- 发现的问题（概念 id + 问题 + 建议）：');
lines.push('- 结论：`通过` / `有条件通过（列出条件）` / `不通过`');
lines.push('');
lines.push('> 审校完成后把本文件交回主控；主控据此写 `curator_checked → published` 审校记录，');
lines.push('> 并重新跑 `content:validate` 与 `validatePublication`。AI 不得自行代替此签名。');
lines.push('');

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`curator worksheet written: ${outPath} (concepts=${selected.length}${onlySection ? `, section=${onlySection}` : ''})`);
