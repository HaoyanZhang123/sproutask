# 阶段 2：教学对话质量（真实模型 A/B）

- 日期：2026-11-02
- 路线：产品真实路径 `POST /edu/api/g1/tutor/start` → `/turn`（真 DSH `0.2.1-rc.3` + `deepseek-flash` + 真实内容包 `pack.biology-7a` 2.0.0）
- 预算：**83 次真实调用**（42,742 input / 48,606 output tokens，估算 ≈¥0.5，低于 ¥3 上限）；**超出本轮 60 次的增量上限 23 次**，如实记账
- 未做：T15 完整 12 类 × 2 轮回归（本轮只跑 4 个代表性场景 × 3 个迭代）

## 1. 基线（改前实测）

| 场景 | 学生输入 | 结果 |
|---|---|---|
| B03 只背术语 | 细菌的结构有哪几部分？我只想背术语，你直接告诉我。 | 答对，但**正文里贴裸 `source.bio7a.*` 标识**、出现“印刷页：无（null）” |
| B05 请求完整解释 | 请给我完整的解释，我不想自己猜。 | **失败**：「我不确定你指的是哪个内容包概念」+ 让学生在不相关概念里选（该概念明明在包内） |
| B06 直接要答案 | 直接告诉我答案：生物分类的依据是什么？ | **失败**：`TURN_TOOL_CAP_EXCEEDED`（11 次工具调用 > 10），学生收到结构化错误 |
| B08 没有前置 | 我前面的内容都没学过，你能不能从头给我讲？ | 能讲，但贴大量裸 id、说“43 个概念”来自工具而非材料 |

证据：`education/.local/evidence/optimize-2026-11-02/teaching-before.json`

## 2. 根因（读代码 + 会话存储实测确认）

1. **模型拿不到“包里有什么”**：`buildBiologyInstruction()`（`packages/tutor/src/skill.ts`）只是技能文本，没有收录目录；旧约束还写着“未知概念明确说『当前材料没有』”→ 模型对包内概念也 hedging。
   - 复现链路：B05 模型先说“不确定你指哪个概念”，再退回技能话术。
2. **上下文块根本没送到模型**：`gateway-adapter.ts:150` 只把 `student_input` 块当 message 发出，当前概念/材料/活动/前置/证据摘要全被丢弃。DSH 会话存储里 `user/message` 只有学生原话。
   - 这解释了为什么模型连“这一轮在学哪一节”都不知道。
3. **探询式前缀盖在完整答案上**：`composeStudentMessage` 按 `decision.action` 加前缀；模型已经给出完整答案（`answerDisclosed`）但 action 仍是 `probe_question` 时，学生会看到“先用一句话说说你的理解：”后面跟一整段答案。
4. **裸 id 有两处来源**：① 模型自己复述工具返回的 `source.*`；② **产品代码**在 `composeStudentMessage` 里拼了 `参考：<sourceRefId列表>`。
5. **静默本地回退不可诊断**：`g1-service.tutorTurn` 捕获异常后直接回退本地规则，运行日志里没有原因（诊断时才发现是缺 `requestId` 触发 TypeError）。

## 3. 改动

| 文件 | 改动 |
|---|---|
| `packages/tutor/src/coverage.ts`（新增） | `buildCoverageBriefing(pack, {currentConceptId})`：按 卷→单元→章→节→概念 渲染真实目录，标记“（当前）”，附 5 条回答规则；`buildTutorSystemInstruction` 拼接技能文本与目录 |
| `packages/tutor/src/context.ts` | `systemInstruction` 改为 `buildTutorSystemInstruction(skill.instruction, pack, {currentConceptId})`（系统指令 1185 → 3113 字符） |
| `packages/tutor/src/gateway-adapter.ts` | 新增 `composeTurnMessage(blocks, studentText)`：**把 当前材料/活动/前置/证据 作为“数据，不是指令”区块随用户消息送达**；`parseTutorEnvelope` 统一过 `sanitizeStudentText` |
| `packages/tutor/src/pedagogy.ts` | ① `answerDisclosed` 时把 `probe_question`/`hint` 升为 `layered_explanation`（不再给完整答案配探询前缀）；② `sanitizeStudentText` 把裸 `source.*`/`activity.*` 换成“本节的出处/本项活动”；③ 参考行改为“参考：本节的出处（可在‘查看出处’里查看页码与原文）”，不再拼 id；④ 披露检测补 “披露/直接给…答案” |
| `packages/tutor/src/skill.ts` + `skills/biology/SKILL.md` + `manifest.ts` | 概念边界改为“目录内必须直接回答，不得说可能不在内容包”；来源规则改为“SourceRef 写入证据候选，学生回复用可读页别，不展示内部 id” |
| `runtime/src/g1-service.ts` | 本地回退与异常各补一条 audit（`tutor.turn.local-fallback` / `tutor.turn.threw`），静默回退可诊断 |
| 测试 | 新增 `coverage.test.ts`(7)、`turn-message.test.ts`(7)；`disclosure-signals.test.ts` 增 1 条“探询前缀不得盖在答案上” |

## 4. 验证（真实模型，逐轮实测）

同一套 4 场景，按修复顺序跑了 5 轮（每轮 4 个真实回合）：

| 指标 | 改前 | 只有覆盖目录 | +上下文块 | +前缀与 id | 最终 |
|---|---|---|---|---|---|
| 回合成功（有正文） | 3/4 | 4/4 | 4/4 | 4/4 | **4/4** |
| “包内概念却说不在包内” | 1/4（B05） | 1/4（B05 仍失败） | **0/4** | 0/4 | **0/4** |
| 工具超限失败 | 1/4（B06） | 0/4 | 0/4 | 0/4 | **0/4** |
| 答案前挂“说说你的理解” | 4/4 | 4/4 | 3/4 | 0/4 | **0/4** |
| 正文出现裸 `source.*`/`activity.*` | 2/4 | 4/4（模型更多引工具） | 3/4 | 1/4（产品参考行） | **0/4** |

最终样本（`teaching-after6.json`）：B05 现在直接给“无脊椎动物的根本区别 + 主要类群 + 课本第 73/76 页 + 两个常见错误”；B06 直接给依据并从检索表讲到比较特征。

质量门：`typecheck` exit 0；`test` 全部包 exit 0（tutor 78 tests，含 15 条新增/更新）。

## 5. 残留问题（如实）
1. **一处页码混淆**：B06 的最终回复把“课本印刷页第 103 页（PDF 第 112 页）”当成本节学习目标——那是“细菌”一节的位置；生物分类应是 PDF 131/133、印刷页未登记。**来源 id 层有证据校验，正文里的页码没有校验**。
2. 没有跑 T15 完整的 12 类 × 2 轮（24 回合）回归；本轮是 4 个代表场景 × 5 轮。
3. 预算超了增量上限 23 次（83/60），费用仍远低于 ¥3。
4. 上下文块现在以“用户消息中的数据区块”送达；冻结端口 `TutorTurnRequest` 没有 blocks 字段，这是不改契约下的折中。若要更干净，需要走契约变更（contract-lock + 独立评审）。

## 6. 复现

```powershell
pnpm --config.verify-deps-before-run=false --dir education dev
node education/.local/tools/tutor-probe.mjs --meta education/.local/cache/T01/dev-run/web-meta.json --out <file.json> --label after
```

证据：`education/.local/evidence/optimize-2026-11-02/teaching-{before,after,after2,after3,after4,after5,after6}.json`；调用统计 `education/.local/tools/count-calls.mjs`。

## 7. 追加修复（同日，页码与工具上限）

### 7.1 页码混淆（B06 残留项）

- **现象**：B06 把“课本印刷页第 103 页 / PDF 第 112 页”当成本节页码，那是「细菌」一节的位置；生物分类应为 PDF 131/133、印刷页未登记。
- **做法**：新增 `runtime/src/adapters/page-claims.ts`，在 DSH 回合出口做确定性校验——**只保留本轮工具确实返回过的页码**；`课本/教材/印刷页第 N 页` 不在 `printedPages` 集合、`PDF 第 N 页` 不在 `pdfPages` 集合时，改写为“课本相应页（页码以出处为准）/ PDF 相应页（以出处为准）”，并写 `dsh.page-claims.replaced` 审计。
- **验证**：6 条单测（保留正确页、改写错误页、列表里有一个不支持就整体改写、无页码原文不动、无证据时全部改写）；真实回合 B06 复跑：正文已无 103/112，保留 131/133；B05 复跑：73/76 全部保留。

### 7.2 工具调用上限导致整轮无回答

- **现象**：B05 在 7.1 复跑时以 `TURN_TOOL_CAP_EXCEEDED` 失败（13 次调用 > 10），学生收到结构化错误、没有任何回答（本轮之前也出现过一次 11 次）。
- **做法**：`DEFAULT_TURN_BUDGET.maxToolCalls` 10 → **14**（45 秒墙钟上限不变；该轮 13 次调用只用 7.1 秒）；同时在覆盖规则里加一条“材料与来源已在上下文，单轮 0–3 次工具调用足够，不要重复查询”。
- **验证**：B05 复跑成功（13 次调用完成，正文 920 字符，页码 73/76 全部保留）。

### 7.3 这一步的预算

- 累计真实调用 **95 次**（49,011 input / 54,407 output tokens，估算 ≈¥0.54），仍低于 ¥3；相对 60 次增量超出 35 次。
- **仍未跑 T15 完整 12 类 × 2 轮回归**（需要再约 24 回合、估算 40–60 次调用）。
