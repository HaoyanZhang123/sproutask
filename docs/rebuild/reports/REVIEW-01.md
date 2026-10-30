# REVIEW-01 — 已接受实现的独立只读复核

- 复核人：executor-5（独立只读；未修改产品代码、测试、配置、证据或 PROGRESS）
- 复核时间：2026-10-29 19:50–20:05 +08:00（Asia/Shanghai）
- 复核范围：`@edu/domain`、`@edu/storage`、`@edu/knowledge`、`@edu/learner`、`@edu/tutor` + `education/skills/biology`、`@edu/importer`、`@edu/visuals` + `@edu/client-visuals`、`@edu/client-shell`、`@edu/client-library`
- 规范依据：`docs/rebuild/05-data-contracts.md`（唯一契约事实源）、`docs/rebuild/07-acceptance.md`（A01–A36 与证据等级）、`docs/rebuild/01-product-contract.md`（R01–R18）、`docs/rebuild/06-system-design.md`、`docs/rebuild/08-execution.md`、`docs/rebuild/09-report-template.md`
- 范围外：`education/content/biology-7a`（T05 内容包，仅抽查报告与真实材料声明，不重做内容审校）、`education/client/map`（T10 未交回报告；本次未复核）。

## 1. 文件指纹与复核对象

Git 仍未提交（整个 `education/`、`docs/rebuild/` 在工作区为未跟踪目录）。按目录内非 `node_modules/.local/dist` 文件逐文件 SHA-256 后再整体 SHA-256：

| 目录 | 文件数 | 目录摘要（排序后 `相对路径<TAB>sha256` 的 SHA-256） |
|---|---:|---|
| `education/packages/domain` | 80 | `d003bf67aee7646be9281ec28ba5d652b7e411bbc1d334821c7c521f83afa298` |
| `education/packages/storage` | 22 | `bbbad7ed2a7dc4e5cfbb1899d36a318fa79899aeadecd8ddaf5b0a87d1f3b63` |
| `education/packages/knowledge` | 28 | `8ecd3495ef7759e999ebf5530c0eede35f1db23fb1d34d88b138e43bab58823a` |
| `education/packages/learner` | 20 | `a751dc98a8ebd0b9d0a4edd576db75af1921ef3758fb35983a8c1910a8733318` |
| `education/packages/tutor` | 24 | `5962a3b0124203411c8e6bf9c365b434c95448d707f07e48a0b68b2b4fbef6a8` |
| `education/packages/importer` | 37 | `bc6258af85556878828494a25fcf47c5d70691cb6d36144239aba456063edf4e` |
| `education/packages/visuals` | 37 | `577046daf0002a7ed82af22e910e4b74ed3504b70475aae93ed02cd50973ee64` |
| `education/client/shell` | 44 | `585d762a3ad5bf9418fe52291138be6daba99e57775007932d1afdcf0d863910` |
| `education/client/library` | 20 | `c5f17fceba1a156d67ce202227f6193a9f26a536197987e4c89a8edea7a60623` |
| `education/client/visuals` | 13 | `3ef9063012491d33e118c02ea4a40ebad69e35fd2cd6c2f20adf4480c98e7374` |
| `education/skills/biology` | 5 | `b703c49efa26037be70bd829a1861d2bf28af4ca4cc7617b1b4b2ed7faa98694` |

关键文件/材料：

| 文件 | SHA-256 | 说明 |
|---|---|---|
| `education/package.json` | `5DEAD1BB696985FF446E041BBE1D5AE0289219B18AFAA2BA02AAF8D8B7CA550F` | 已非 T01 基线 `A7137668…`（`content:validate` 被后续任务接线） |
| `docs/rebuild/contract-lock.json` | `8B5DAB3429E728060AF07AA0C9F115F31BD4D31CA0DB021DFEAB7AE7C54D7FAD` | 仍为 T01 生成值（早于多个新包），见 B-01 |
| `education/pnpm-lock.yaml` | `8E78F5F0B1BABD8451494AED0D6E63918ADF6A7B892368CA52A52A94CCEC3194` | 多任务并发 install 后状态；最终应由主控统一重生 |
| `education/config/task-routes.json` | `171D07EF9C1785EF42C7EC1F493F2E681F3F8BF976B749CB41E3ABC76E9BEB22` | 已与 contract-lock 不一致 |
| `education/config/commands.json` | `561BCBC44DAD9B2128BC219E3A90241F0AB9A0F39E0731A5885214972D9384FA` | 已与 contract-lock 不一致 |
| `义务教育教科书·生物学·七年级·上册.pdf` | `33EED60CE56AA402AE683B9C3A573F2FD780B766D635B04580D604928A23E59F` | 40,259,982 B；T03/T05 声称的真实教材基线文件存在且 hash 一致（只核指纹，不读正文） |

## 2. 只读命令与结果

所有命令均带 `--config.verify-deps-before-run=false`，未执行 `pnpm install`、未启动真实模型/DSH、未读写用户学习数据。

| 命令 | 退出码 | 结果/摘要 |
|---|---:|---|
| `pnpm ... test:task T01` | 0 | domain 104 + runtime 21 = 125 tests |
| `pnpm ... test:task T02` | 0 | 6 files / 41 tests |
| `pnpm ... test:task T03` | 0 | 6 files / 40 tests |
| `pnpm ... test:task T04` | 0 | 10 files / 87 tests |
| `pnpm ... test:task T06` | 0 | 6 files / 34 tests |
| `pnpm ... test:task T07` | 0 | 7 files / 46 tests（测试自身重写了 `education/.local/evidence/T07/replay-12-classes.json`；见 §6 说明） |
| `pnpm ... test:task T08` | 0 | 9 files / 47 tests |
| `pnpm ... test:task T09` | 0 | 5 files / 27 tests |
| `pnpm ... test:task T11` | 0 | packages/visuals 31 + client/visuals 17 = 48 tests |
| `pnpm ... typecheck:task T01/T02/T03/T04/T06/T07/T08/T09/T11` | 全部 0 | 各路由 tsc 0；T07 含 `skills/biology`，T11 含两个包 |
| `pnpm ... contract:lock:verify` | **1** | `contract-lock verify: 177 problem(s)`；含 `education/package.json`/`commands.json`/`task-routes.json` hash mismatch，以及 importer/storage/knowledge/learner/tutor/visuals/client 等新文件 missing hash |
| `pnpm ... test:contracts` | **1** | 被上项阻断，未进入 contracts 测试 |
| `git check-ignore -v education/.local/...` | 0 | `.local/` 被 `education/.gitignore:2` 忽略；真实 PDF/图片/密钥未进入 Git |
| `git ls-files 'education/**'` + 二进制过滤 | 0 | 当前无已跟踪 PDF/PNG/JPG/WebP |

测试全绿说明“各自实现按现有测试可运行”；**不等于** 07 的最低 AC 级别已满足（见 H-05）。

## 3. 发现清单

> 证据类型标注：**实测** = 本次运行的命令/文件事实；**静态阅读** = 直接读代码/报告；**推断** = 由结构推导、未复现。未执行的破坏性验证不冒充实测。

| ID | 严重度 | 位置（文件:行） | 问题 | 规范依据 | 证据（命令/代码片段） | 建议处置/归属 |
|---|---|---|---|---|---|---|
| B-01 | **阻断（流程/配置）** | `education/scripts/test-contracts.mjs:17-21`；`docs/rebuild/contract-lock.json`；`education/config/*.json` | `contract:lock:verify` 失败（177 problems），`test:contracts` 直接 exit 1；当前质量门红灯。冻结锁早于 importer/storage/knowledge/learner/tutor/visuals/client 包，且 `education/package.json`、`commands.json`、`task-routes.json` 已变更 | 07 §6（功能卡必须跑冻结 contracts）；08 §9（检查屏障）；T01 契约冻结 | **实测**：`pnpm ... contract:lock:verify` → 1；`pnpm ... test:contracts` → 1；输出含 `hash mismatch: education/package.json`、`missing file hash: education/packages/importer/...` | 主控/配置 owner 在写屏障后统一 `pnpm --dir education install` + `contract:lock:generate`，复跑 verify/test:contracts；各卡报告需引用重生后的锁，而不是旧的 `8b5dab34…` |
| B-02 | **阻断（代码/数据安全）** | `education/packages/storage/src/maintenance.ts:170-207`（`deleteData` 只对 `plan.targets` 做 root 内校验）；`:130-168`（`prepareDelete` 的 scope 目标） | `deleteData(plan, true)` 不校验 `plan.targets` 是否等于 `plan.scope` 对应的规范目标；调用者可篡改 plan（保持 root 不变）把目标改成 root 内任意目录（如 `assets/pages`、`migration`、`receipts`）并删除，违反“删除学习记录不得误删教材源/共享内容”。现有测试只覆盖“target 在 root 外”和“root 不符”，未覆盖 root 内跨 scope 伪造 | 05 §6（删除按范围二次确认）；07 A33（导出/删除影响分别明确、源文件未误删）；T02 卡 | **静态阅读（高置信）**：`maintenance.ts:190-191` 仅 `assertDeleteTarget`；`:130-168` scope→targets 关系未在 delete 时复算；测试 `test/export-delete.test.ts:112-119` 只测 root 外 forged target | T02 在 `deleteData` 内按 `plan.scope` 重新计算规范 targets 并做集合全等校验（拒绝额外/缺失/父目录替换），新增 root 内跨 scope 回归测试；T13 UI 只传 `prepareDelete` 原样 plan |
| H-01 | **高（三轴/证据语义）** | `education/packages/learner/src/evidence.ts:101-151`；`education/packages/domain/src/rules/learning-rules.ts:316-321` | 反证收集对 `assistance`/`answerDisclosed` 不设限：assisted 或看过解释后的错误作答仍进入 counter，可把理解从 supported/developing 降到 needs_support；§3.2 要求“最近可解释的**独立**作答出现核心误概念”才判 needs_support。现有测试只测 assisted→unassessed（criterion met），未测 assisted+counter | 05 §3.2.2/§3.2.5；01 §5（帮助后重答与独立作答区分）；T06 卡步骤 2 | **静态阅读**：`evidence.ts:149-151` 对 `validity==='current'` 的任一 counter 加入 `counterEvidenceIds`，未查 `independence.independent`；`learning-rules.ts:316-321` 的 counter filter 也未过滤 assistance；`test/evidence-rules.test.ts` 无 assisted 错答用例 | T06 在推导/反证中把 assisted 或 answerDisclosed 证据排除出 counter（或显式定义不降级）；增加“看过答案后仍错→不因该轮降级”测试；若需改 domain helper，由 T01 owner 串行变更契约测试 |
| H-02 | **高（取消/并发）** | `education/packages/importer/src/import/service.ts:437-446`（`tryCloudConcepts`/`pauseForCloud`/最终 transition 前无 cancel 复检）；`:780-805`（cloud 阶段不复检磁盘状态） | 取消发生在 structure 完成后、cloud concept 阶段/最终 transition 期间时，`execute` 可能用旧的 `working` 写 `concepts` 或 `await_review`，覆盖已写入的 `cancelled`；违反“cancel 后不发布迟到结果”。现有 cancel/resume 测试默认 `network=unavailable, cloudConcepts=null`，主要覆盖 OCR 延迟，未覆盖 cloud 阶段窗口 | 05 §4（cancel 后迟到结果不发布）；07 A06；T03 卡 | **静态阅读（高置信，未复现）**：`service.ts:437-446` 无 cancel check；`tryCloudConcepts` 直接 `transition(stored,'concepts','running')`；`pauseForCloud` 直接写 paused；`cancel()` 的写与 execute 的写无版本/CAS 保护 | T03 在每个 stage/transition 前从磁盘重读 job 并检查 cancelRequested；写 job 增加 runEpoch/CAS；新增“cloud 抽取中取消”测试（FakeCloud 可注入延迟） |
| H-03 | **高（发布/审校）** | `education/packages/knowledge/src/publication.ts:297-345`（`PublishRegistry.publish` 只调 `validatePublication`，未调 `validateReviewTransition`）；`education/packages/domain/src/rules/content-rules.ts:522-531`（published pack 只要求至少一条 pack reviewLedger） | 只要把 pack.status 设为 published 并在 reviewLedger 放一条 `ai_static_reviewer`/`system` 记录，`PublishRegistry.publish` 即可注册；没有强制 human_curator/scope checklist。T04 报告声称“curator/published 需 human_curator”，但该约束只在独立 `validateReviewTransition` 中，发布入口未调用 | 05 §4（published 要求 scope 验收清单；AI 可 machine_checked 不等于 human curator）；07 A09/A34；01 §4.3 | **静态阅读**：`publication.ts:298-314` 仅 gate/hash/版本；domain `content-rules.ts:522-531` 只检查 ledger 存在；`publication.test.ts` 只测 `validateReviewTransition`，未测 registry 的 actor 绕过 | T04 在 `PublishRegistry.publish`/`registerPack(published)` 调用 `validateReviewTransition` 的 actor/checklist 约束；补“AI ledger + published → 拒绝”测试；T05/T14 内容发布走同一入口 |
| H-04 | **高（证据来源）** | `education/packages/tutor/src/evidence-guard.ts:143-154` | 只检查 `sourceRefs` 中“不存在的引用”，不要求非空；`sourceRefs: []` 的模型候选可通过，随后写入 Evidence。视觉包的 gate 则明确拒绝空出处（`visuals/src/grading/evidence-gate.ts:138-141`），两套闸门语义不一致。缺少出处意味着判断无法回溯到教材/活动依据 | 05 §5（模型只提候选，服务验证来源/活动/assistance 后提交）；R03/R08；A15/A21 | **静态阅读**：`evidence-guard.ts:143-154` 无 `sourceRefs.length === 0` 分支；`tutor/test/helpers.ts:643-658` 的候选默认带 `source.p18`，测试未覆盖空数组；与 visuals gate 第 138 行对照 | T07 对 model-origin（建议全部 accepted evidence）要求至少一个可解析 sourceRef，或显式继承 activity.sourceRefs 并记录理由；补空出处拒绝测试；与 T11 gate 对齐 |
| H-05 | **高（报告/AC 等级）** | `docs/rebuild/reports/T08.md:45-49`；`T09.md:38-42`；`T06.md:38-42`；`T03.md:49` | AC 结果列写 **PASS**，但实际只提供 L2（T08/T09 的 DOM/fixture；T06 的服务层；T03 的 L2），低于 07 最低级别（A17/A23/A24/A33/A06/A07/A08/A29/A14/A15/A18/A05 等分别要求 L3/L4/L2+L3/L2+L5）。正文虽有“L3/L4 归 T13/T15”限定，但矩阵列仍可能被下游当作最终 AC 通过 | 07 §1（NOT_RUN/BLOCKED 不算通过；L2 不冒充 L3/L4）；07 §2 最低级别；09 模板 | **静态阅读（报告矩阵）** + **实测**（测试全 0 但均为 L2/fixture，无真实 UI/DSH；T08/T09 报告自己写明无真实浏览器/宿主） | T03/T06/T08/T09 把 AC 列改为 `NOT_RUN`/`BLOCKED`/`PARTIAL`，另设“本卡贡献 PASS@L2”列；主控 T17 只把最低级别证据当 PASS；不要用 L2 贡献替代最终 AC |
| M-01 | 中（跨学习者读取） | `education/packages/storage/src/journal.ts:405-433`；`storage-service.ts:121-127` | `EventStore.readFrom(ctx, ...)` 只按 `seq` 过滤，不使用 `ctx.learnerId`；同一 root 下任何持有 EventStore 的调用者可读取全部 learner 的 journal。T06 的 LearnerService 自身按 learner 过滤，但 port 语义与 05 §6“宿主绑定 learnerId”不一致（当前单本地匿名档案，实际影响有限） | 05 §6（宿主绑定 learner，不信任模型/浏览器指定他人 ID）；§7 单写者语境 | **静态阅读**：`readFrom` 的 `matching = commits.filter(seq>fromSeq)`；ctx 只用于非空校验 | T02 在 EventStore 层按 ctx.learnerId 过滤（或提供显式 admin 读取接口并审计）；补跨 learner 读取拒绝测试 |
| M-02 | 中（匹配/信任态） | `education/packages/importer/src/matching.ts:69-78` | `same_hash` 一律返回 `trustMode:'published'`；`KnownBook` 只有 metadata/页数，没有已知 book 的审校/候选状态。若已有书是 candidate/未核实，重新导入同 hash 会被标为 published，可能被宿主误当基准复用 | 05 §4/§9（candidate 身份贯穿；未审内容不得冒称基准）；A07 | **静态阅读**：`matchBookIdentity` exact hash 分支硬编码 published；接口无 trust 字段 | T03 让 `KnownBook` 带 book 的 review/trust 状态并原样返回；或返回 `trustMode:null` 由宿主绑定；补 candidate book 同 hash 测试 |
| M-03 | 中（批改证据闸门） | `education/packages/visuals/src/grading/evidence-gate.ts:89-105` | 不校验传入 `rubric` 是否属于 `activity.rubricId`/`rubricVersion`（T07 的 guard 会校验 `request.rubricVersion === activity.rubricVersion`）；调用方可传错误 rubric 的 criteria，gate 仍按该 criteria 接受候选 | 05 §5/§9（活动绑定 rubricVersion；评分依据可查）；A21 | **静态阅读**：gate 只建 `rubricCriteria` 并使用，未比较 activity.rubricId/version；`GradeResult` 无 rubric 字段，因此更需显式校验 | T11 在 gate 输入/实现中校验 `activity.rubricId === rubric.id` 且版本一致；T13 从活动解析 rubric，不接受调用方任意 rubric |
| M-04 | 中（复习轴越权） | `education/packages/learner/src/learner-service.ts:519-555` | `completeReview` 接受调用方显式 `outcome`，不要求其与最新 Assessment/Evidence 一致；可写 `review.latestOutcome='supported'` 而 `understanding` 仍 unassessed。T07 当前从 grade 派生 outcome，但服务 API 允许绕过证据闸门 | 05 §3.3（复习结果应有证据；复习完成≠掌握）；A18 | **静态阅读**：outcome 直接来自 `request.outcome`；无 assessment 检查 | T06 要求显式 outcome 必须匹配该概念最新 assessment（或 evidence 推导），否则拒绝；UI/T07 只传推导值 |
| M-05 | 中（兼容映射审计） | `education/packages/knowledge/src/knowledge-service.ts:102-104`；`education/packages/learner/src/learner-service.ts:1463` 起 | `KnowledgeService.registerCompatibilityMap` 不调用 `auditCompatibilityMap`；T06 `applyCompatibilityMap` 只做 domain 结构校验，不检查 diff 覆盖/实际包 hash。若调用方直接注册/应用未审映射，变更概念可缺失映射而仍被当作“兼容” | 05 §9（CompatibilityMap 需审阅、未验证映射不得 inherit）；T04 报告声称 audit | **静态阅读**：register 无 audit；T06 不依赖 T04 审计结果（仅 `validateCompatibilityMap`） | T04 注册即审计（或要求 `auditCompatibility` receipt）；T06 应用时要求传入 audit/receipt；T13 接线只用审计通过的 map |
| L-01 | 低（内存） | `education/packages/tutor/src/tools.ts:709` | 工具幂等缓存 `responses: Map` 无上限/过期；长会话（大量 requestId）内存持续增长 | 05 §7 资源/恢复；工程稳健性 | **静态阅读**：`responses.set(cacheKey, outcome)`，无淘汰 | T07 限制缓存条数/TTL，或在 session end 清理 |
| L-02 | 低（可访问性） | `education/client/visuals/src/diagram-view.ts:181` | 输入 `id = visual-target-${target.number}` 是全局 id；同页挂载两个图示（活动+反馈预览）会产生重复 id，label 关联可能指向错误输入 | 07 A19/A23（键盘/等价路径）；A11 可访问性 | **静态阅读**：`input.id` 未加实例前缀；测试只挂载一个视图 | T11 用 `idPrefix`/实例 id 前缀；加双挂载组件测试 |
| L-03 | 低（输入过度限制） | `education/packages/visuals/src/diagram/validate.ts:24-48` | `UNSAFE_FRAGMENTS` 把 `<`、`>` 一律拒绝；合法的比较/数学表达（如“A < B”）无法作为图示标签。安全上安全，但产品语义过窄 | 05 §5（受控图示需完整表达）；A19 | **静态阅读**：unsafeTextReason lower.includes('<') | T11 改为渲染层转义 + 仅拒绝 HTML/事件上下文，或明确内容规范；T15 内容审查确认是否可接受 |
| L-04 | 低（预算台账） | `docs/rebuild/runtime-lock.json:286-295`；`docs/rebuild/reports/T11.md:76-79` | 中央预算台账 `liveModelCallsUsed=4`（T00），T11 另用 8 次图像调用（报告称上限 20、估算 ¥0.0247）；项目总上限 150 未超，但中央台账未累计 T11，后续 live 预算判断可能低估 | 08 §7（预算台账）；A20/30 | **实测**（runtime-lock 字段）+ **静态阅读**（T11 报告调用数） | 主控在 runtime-lock/PROGRESS 更新累计 calls/费用；T11/T15 live 前先核对中央预算 |

## 4. 分项说明（关键证据与判读）

### 4.1 B-01 合同锁（实测）

- 实际运行 `contract:lock:verify` 退出 1，输出 `contract-lock verify: 177 problem(s)`；`test:contracts` 因此退出 1。
- `education/package.json`、`education/config/commands.json`、`education/config/task-routes.json` 的 hash 与锁中记录不一致；importer/storage/knowledge/learner/tutor/visuals/client 的新文件为“missing file hash”。
- 这是当前唯一让公共质量门红灯的事实；各卡（T02/T03/T04/T08/T09/T11）报告均已提到锁待重建，但**在重建前不能把“test:contracts 通过”写入任何最终报告**。归属：主控/配置 owner（T01 契约 owner 串行变更），不是单个包的局部修复。

### 4.2 B-02 删除计划（静态阅读）

- `prepareDelete(scope)` 生成 targets（如 `learning_records → journal+snapshots`），但 `deleteData(plan, confirm)` 只校验 root、scope 枚举、target 在 root 内；没有证明 `plan.targets` 是 `scope` 的规范集合。
- `DeletePlan` 是普通对象；T13/T08 从 UI 传入时如果被篡改（或前端 bug 传错 target），可以删除 `assets/pages` 等 root 内非学习记录。T02 的“源文件未误删”承诺依赖此校验。
- 建议：`deleteData` 内调用 `expectedTargets(plan.scope)` 并做集合全等 + realpath 校验；或把 targets 从 plan 中移除，只接受 scope 由服务重算。这是数据安全类阻断项。

### 4.3 H-01 证据语义（静态阅读）

- 05 §3.2.2 明确“最近可解释的**独立**作答出现核心误概念或不能解释关键区分→needs_support”；T06 的 `deriveConceptUnderstanding` 把 `effective.validity === 'current'` 的所有反证都计入，不检查 `independence.independent`。`deriveUnderstandingState` 的 counter filter 同样未过滤 assistance。
- 场景：学生先看答案（attempt.helpUsed 含 answer）后提交错误作答 → evidence.assistance=assisted；当前实现仍可能把 understanding 从 supported 降为 needs_support。即使最终是“保守”降级，也违反“帮助后作答不作为本轮独立证据”的语义，且没有测试覆盖。
- 建议由 T06 在反证输入处过滤，或由 T01 修正 domain helper 并追加契约测试；在未决前 T15 不应把此类路径当教学证据。

### 4.4 H-02 导入取消（静态阅读，未复现）

- `execute` 在 structure 后有一次 cancel check（`:433`），随后 `tryCloudConcepts` 在 cloud 可用时会 `transition` 到 `concepts`，`pauseForCloud` 或最终 `await_review` 还会写 job；这些写入都不再复检取消状态，也没有 runEpoch/CAS 保护。
- 现有 `cancel-resume.test.ts` 默认 `network:'unavailable', cloudConcepts:null`，取消主要发生在 OCR 批次；cloud 阶段窗口未被覆盖。建议 T03 用可注入延迟的 FakeCloud 补一条“cloud 抽取中取消→最终仍 cancelled”的测试。

### 4.5 H-03 发布人工闸门（静态阅读）

- `PublishRegistry.publish` 走 `validatePublication`（领域结构 + 覆盖）与 `contentHashMatches`，但没有调用 `validateReviewTransition`；`validatePublication` 只要求 reviewLedger 中有 `content_pack` 条目，不检查 actorKind。
- 因此 AI 静态检查（`ai_static_reviewer`）即可构造 status=published 的包并注册，绕过 T04 自己实现的“human_curator + scopeChecklist”。这直接关系 A34“AI 审校不冒称专家审核”和 T05 当前 candidate 内容不得被误发布。

### 4.6 H-04 证据来源（静态阅读）

- T07 guard 的注释声称“every source ref must be resolvable”，实现只验证给出的 ref 在允许集合；空数组通过。对比 T11 gate 明确 `sourceRefs.length === 0` 拒绝。两套对同一 05 §5 的解释不一致，且 T07 的测试候选默认有 `source.p18`，没有空出处用例。
- 若 T13 接线后模型省略 sourceRefs，Evidence 仍可能落库，UI 无法给出可查来源；建议统一为“至少一个可解析来源”，或让服务自动补 activity 的来源并记录来源来源。

### 4.7 H-05 AC 等级（报告静态阅读）

- 07 §1 规定 L0–L5 与“NOT_RUN/BLOCKED 不算通过”；§2 给每项 AC 最低级别。T08/T09 的 AC 表把 L2 DOM/fixture 写成 PASS；T06 把服务层 L2 写成 PASS；T03 A05 把 L2 写成 PASS（L5 未做）。这与 09 模板的 PASS 语义冲突，容易让 T17 误判。
- 建议统一改为“AC 结果=NOT_RUN/BLOCKED，本卡贡献=PASS@L2”，并在阶段就绪表明确延期 owner。T07/T11 的做法（最终 NOT_RUN）是正确的对照。

### 4.8 其他

- M-01 跨 learner：当前产品定位为单个本地匿名档案，实际暴露面小；但 port 层应在宿主绑定处拒绝跨 learner 读取，避免未来多档案或多设备误用。
- M-02 同 hash：`BookInstance` 本身没有 trustMode 字段，返回 `published` 是过度承诺；应在 KnownBook 增加审校状态或由调用方显式决定。
- M-03/M-05：T11 与 T04/T06 的校验分工在报告里都声称存在，但调用入口未强制；T13 接线时应把审计/校验作为类型/参数要求，而不是可选步骤。
- L-02/L-03 不影响当前 L2 证据，但 T15 真实 UI/内容审查应处理。

## 5. 安全与数据边界抽查

| 检查 | 结果 | 证据 |
|---|---|---|
| 客户端渲染是否使用 `innerHTML`/`eval`/`new Function` | 产品源码无；仅测试清空 DOM 用 `innerHTML` | `rg` 结果；`client/shell/src/dom.ts:2` 明确 no innerHTML |
| 客户端是否显示 `error.message`/`detailsRef`/stack/路径/token | 结构化错误只显示中文标题/说明/错误码；测试断言无 `sk-`/Bearer/路径/stack | `client/shell/src/errors.ts:146-161`；`client/shell/test/navigation.test.ts:172` 等 |
| DiagramSpec 是否执行脚本/HTML | 服务端拒绝 `<`/`>`/事件/`javascript:`；SVG 转义；客户端 DOM 构建不用 HTML 字符串 | `visuals/src/diagram/validate.ts:24-48`、`svg.ts:12-19`；`client/visuals/src/diagram-view.ts` |
| 工具 allowlist 是否封闭 | 注册仅 6 个 `edu_*`；未知/危险名统一 `unknown tool` + 审计；但实际 DSH profile 是否只加载这 6 个由 T13/T16 决定 | `tutor/src/tools.ts:50-84`、`:736-755`；测试 `test/permissions.test.ts` |
| 证据/自评是否越权写 Assessment | T06 self report 只写独立事件；但 `completeReview` 显式 outcome 可绕过（M-04） | `learner/src/projection.ts` self_report 分支；`learner-service.ts:519-555` |
| 真实材料/密钥是否入 Git | 真实 PDF 存在但 `.local` 被忽略；`git ls-files` 无二进制；T11 secret-scan `leaks:0` | `git check-ignore`、`git ls-files`、`education/.local/evidence/T11/.../secret-scan.json` |
| 分层/依赖 | packages/client 运行期只依赖 `@edu/domain` 类型/冻结校验；无 React/Vue/Electron/DSH import；workspace 包无第三方运行期依赖 | `rg 'from ...'`；各 package.json |

## 6. 复核副作用与局限

- 运行 `test:task T07` 时，测试自身重新生成 `education/.local/evidence/T07/replay-12-classes.json`（hash 从 T07 报告记录的 `584c8a9f…` 变为本次 `fea89589…`，原因是其中的 `generatedAt` 时间戳；`run-.../replay-12-classes.json` 仍保留原 hash）。这是测试行为，不是本次手写产品文件；该目录被 `.gitignore` 忽略。其余测试使用临时目录，未发现对真实用户数据的读写。
- 未执行 `pnpm install`、未启动真实 DSH、未调用真实模型（T11 的 live 证据只读取已有 evidence；本次未重跑 vision CLI）。
- 未对 T10 `client/map`、T12 `client/study`、T13 集成、T14 全册、T15/G2、T16/G3 做实现复核；这些没有接受报告或不在本次范围。
- 对 T05 内容仅验证真实 PDF 指纹与 T03/T05 报告的一致性，不重做内容审校/全册覆盖；T05 的 candidate 状态不得当作已发布内容。
- 所有代码级发现中标注“静态阅读”的，均未构造破坏性测试（尤其 B-02 未执行删除验证）；建议 owner 按条目补回归测试后再声称修复。

## 7. 总体判断

**有条件接受（2 个阻断项；高 5、中 5、低 4）。**

- **可以接受的部分**：各包 `typecheck:task`/`test:task` 全部真实退出 0（共 495 tests）；真实临时 journal、取消/重试、三轴、证据/复习、图示安全、导入取消/恢复等 L2 机制有实质测试；T03 真实教材基线（PDF hash/146 页/OCR 结果）与 T11 真实图像证据文件存在且指纹与报告一致；客户端未发现 token/HTML 注入/开发入口。
- **不能直接进入最终验收的部分**：B-01 公共合同质量门红灯；B-02 删除 scope 数据安全；H-01/H-02/H-03/H-04 语义/并发/发布/来源闸门；H-05 报告 AC 等级高于证据。修复后应重新生成 contract-lock、重跑全局 typecheck/test/test:contracts，并按 07 最低级别复核 AC。
- **阻断问题数量：2**（B-01、B-02）。
- **建议主控优先处理 3 条**：
  1. **B-02**：`StorageService.deleteData` 必须按 scope 重算并全等校验 targets，先补数据安全回归，再允许 T13/T08 接真实删除。
  2. **B-01**：写屏障后统一 `install` + `contract:lock:generate`，把当前 177 个问题清零并重跑 `test:contracts`；在此之前任何“契约通过”报告都不成立。
  3. **H-01 + H-03（一并处理语义闸门）**：assisted/看答案后的反证不得降级；发布入口必须强制 human_curator + scope checklist，并给 T07 空来源候选补拒绝测试。
