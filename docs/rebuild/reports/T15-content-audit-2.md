# T15 第二次内容独立复核（返工后 2.0.0）：A09/A10/A11

- 报告结论：**主要问题已修复，无阻断/高发现；A09/A10/A11 仍为 PARTIAL，contentReadyFull 应保持 PARTIAL。** G2 可以先进入下一阶段（图义视觉、human_curator、真实 UI/流程、版次核对），但在修完 2 项中等问题前不能把“内容完整”当作已通过。
- 复核对象（只读；本次未改内容/工具/产品代码/锁）：
  - `education/content/biology-7a/pack.json` SHA-256 `42a7866591fd49e5a18f12755b12c5b1d87ec33afb570cd1685eb7a9ba67ae63`，包 `contentHash=bf2055b4a33b3ae1e791492be40d1237eb198c5dd066ecfe30e17eb2d943f17f`（`2.0.0`，`full_volume`/`complete`/`candidate`）
  - `source/source-refs.json` SHA-256 `6e119c43138d284c77cbc3a4eb0862b6d9475acd20ad34e9535c71240f36a59a`（279 条）
  - `coverage/coverage-manifest.json` SHA-256 `1444d095413e75240b6324e2f0b2f341911d667eb93b83693572f6988d6779cd`
  - `fragments/toc.json` SHA-256 `73c0a9e7…83e2`、`fragments/section-pages.json` SHA-256 `d4417487…1bab`（与首版相同，目录/页范围未变）
  - `coverage/review-report.md` SHA-256 `d6f121a246be6113212b7d4085cd24727ff81991e2f97ecf12e2a090b9bd3d90`
  - 同一 T03 OCR 基线（146 页、4454 块；`blocks.jsonl` `daf7aee2…21c5`、`page-map.json` `f2592fd0…cce29`）
- 时间/环境：2026-10-29 20:47–21:05 +08:00；Node v24.22.1；无网络/模型/图像/DSH 调用；未安装依赖。

## 1. 方法与样本（独立复算，不依赖作者 selfcheck）

| 项 | 做法 |
|---|---|
| AUD-01 关系 | 脚本数 basis（31 先修 = 5 explicit + 26 inference；related 5 全 explicit）；与首版 relations dump 对比得到 18 条改判；抽 8 条 inference 回原文页/看 rationale 是否明说“教材未声明先修、属教学推断”；逐条读剩余 5 条 explicit 的 rationale 与引用页文本，判断是否仍是“用编排顺序当依据” |
| AUD-02/03 | 读无脊椎/分类两概念的目标、解释、易错点、rubric 全部标准与 sourceRefs 页/块文本；确认 p85 软体/棘皮、p139 双名法 |
| AUD-05/06 新概念 | 与首版 35 概念按 id/title 做差集；逐条查新概念 placement/目标/解释/2 活动/rubric/出处页；从 OCR 目标块重列“与人类生活关系”目标节（9 节）并核对覆盖；查排除项 7 类是否含核心概念 |
| AUD-04 原文 | 自写 n-gram（不调用作者 selfcheck）：按节拼接 OCR 块（含跨块），对 explanations、misconceptions、活动 stem/选项、rubric 全部文本做 ≥18 字连续片段比对；另报 17/16/15 字命中用于说明阈值 |
| AUD-07/08/09/13 | 读真菌三件套一致性；统计 42 概念的活动类型（是否各有基础+迁移）；用“荒谬干扰项/正确项显著更长”启发式+人工读 7 道原问题；读植物组织 rubric 标准 |
| 来源/结构 | 以新 `contentHash` 为种子抽 15 条 + 离群页 4/5/18/24/62 最近页（共 19 条），核对 pdfPage/printedPage/bbox/blockId/块文本；全量 279 条做 printedPage↔page-map、blockId 存在性、页码范围核对；`validate-pack` 验先修 DAG/related 排序 |
| 限制 | 无视觉证据（图义核对仍未做）；OCR 噪声；无真实 UI/学习流程；作者证据仅作线索，结论均来自上述独立脚本/命令 |

复算命令（只读）：

```powershell
node education/packages/knowledge/bin/validate-pack.mjs education/content/biology-7a  # 0
node education/content/biology-7a/tools/selfcheck.mjs                                 # 0（46/46，作旁证）
# 独立脚本读取 pack/source-refs/coverage/fragments + T03 blocks/page-map；
# 脚本与中间 JSON 在系统临时目录（%TEMP%\t15-audit），未进 Git（写入范围仅本报告）。
```

## 2. AUD-01~13 逐条复核结论

| ID | 结论 | 复核证据（实测/静态核对） |
|---|---|---|
| AUD-01（先修 basis） | **部分修复** | 18/18 条原 explicit 边已改判 `pedagogical_inference`，抽 8 条（`order-variation`、`full.01/05/10/15/19/23/26`）rationale 均明写“教材未明说/未声明先修/属教学推断”，并有原页引用；但实存 **5 条 explicit 先修**，其中 **4 条仍是“教材先…随后…”的编排顺序**（见 AUD2-01）；T14 报告称“仅保留 1 条”与实物 5 条不符 |
| AUD-02（软体/棘皮） | **已修** | 无脊椎概念目标第 3 条、解释、易错点均含软体/棘皮；rubric 3 条标准，要求“至少五类且必须包含软体与棘皮”并给识别特征；sourceRefs `groups-extra`/`echinoderm` 落 p85，块文本分别为“类群还有软体动物、棘皮动物等。软体动物身体柔软，”“棘皮动物生活在海洋中，因体表有棘而…” |
| AUD-03（双名法） | **已修** | 目标第 3 条、解释、易错点、rubric 第 3 条均含双名法（属名+种加词/大小写/命名者）；`sec.u2ch4s2.binomial` 落 p139，块文本“双名法是瑞典植物学家林奈建立的…” |
| AUD-04（原文混入） | **已修** | 独立 n-gram（含 misconceptions/选项/rubric、按节拼接跨块）：**≥18 字命中 0**；仅 3 处在 15–17 字（“细胞是生物体结构和功能的基本单位”等常见定义短语，低于阈值，见 AUD2-05） |
| AUD-05/06（人类关系口径） | **部分修复** | 新增 7 概念（单细胞/鱼/两栖爬行/鸟兽/细菌/真菌/病毒），各 2 活动（choice+transfer）、2 条 rubric、出处页均在本节；删除“与人类生活关系”排除项（8→7）。但 OCR 目标块显示 **9 节**有“与人类生活关系”目标：7 新概念 + 既有藻类 = 覆盖 8；**“无脊椎动物与人类生活”仍无概念/活动/rubric**（只有解释中一句泛化）→ AUD2-02 |
| AUD-07（真菌目标） | **已修** | 真菌概念目标/解释/rubric 已对齐为“结构+繁殖”；人类关系移入 `fungi-human`（目标/解释/rubric/出处 p121 齐全） |
| AUD-08（缺变式） | **已修** | 42/42 概念均含 transfer；`order-record`（diagram_label+choice+transfer）与 `variation`（relation+explain+transfer）各补 1 个迁移活动；42 个 transfer 活动 |
| AUD-09（可猜题） | **已修** | 7 道原问题干扰项已改写（荒谬词/正确项过长启发式 **0 命中**）；人工抽查 7 道：干扰项为常见误解或合理选项，答案唯一且与解释一致 |
| AUD-10（短片段锚点） | **已修** | 文本 ≤3 字锚点由 15→**9**；9 条全部是真实短标题（封面年级/学科/册次、目录、5 个“第X章”页眉），不是 OCR 截断；6 条目标截断片段已改指完整块 |
| AUD-11（报告数字） | **部分** | 返工节已给出正确 42/86/42/36/279 与 basis 5/26；但报告前文（行 19–24、33–37）仍保留首版 35/70/8 类/24+7 等旧数字，内部不一致（低） |
| AUD-12（ledger scope） | **未完全** | pack 级 ledger 两条 scope 仍写“42 概念 / **84 活动** / 42 rubric / 36 关系 / 279”，实际 86 活动（其余 206 条按实体登记正确）；报告称已更新为 86，与实物不符（低） |
| AUD-13（植物组织 rubric） | **已修** | 新增第 3 条标准“能区分机械组织、薄壁组织等植物组织”，含反例/迁移题 |
| AUD-14（图义视觉） | **保留待办** | 无视觉证据；65 图注+8 插图仍未逐图核对（作者声明保留，属 G2 缺口，不计回归） |

## 3. 发现表（第二轮）

| ID | 严重度 | 位置 | 问题 | 证据 | 建议 |
|---|---|---|---|---|---|
| AUD2-01 | **中** | `pack.json` relations：`prereq.meaning-purpose`、`prereq.purpose-order`、`prereq.meaning-question`、`prereq.purpose-comparison`（均 T05 首节内） | 仍以“教材先/随后/按…顺序展开”作 `explicit_source` 的依据；教材未声明这 4 条先修依赖。同类第 5 条 `full.09`（组织→器官→系统）确为正文结构层次，可保留。T14 报告称“仅保留 1 条”与实物 5 条不符 | 实测：rationale 原文；“purpose-order”直接写“教材按…顺序展开方法”；引用页 12/14 为方法叙述与“积极思考/发现问题”，非依赖声明；basis 计数 5 explicit/26 inference | 4 条改判 `pedagogical_inference`（保留教学理由）或删除；若保留 explicit，必须引用教材明确表达依赖的原句；同步更正 T14 报告说法 |
| AUD2-02 | **中** | `concept.bio7a.u2ch2s1.invertebrate-groups`；OCR 目标 p82 | 正文目标“它们与人类生活有什么关系”仍无概念/活动/rubric；解释只有一句“与人类生活关系密切，既有益也有害”，不可评估；7 个新人类关系概念未覆盖该节，口径仍差 1 节 | 实测：OCR p82 目标块；该概念目标 3 条均无人类关系；2 个活动分别为分类/识别类；无 `invertebrate-human` 概念 | 补 1 个“无脊椎动物与人类生活”概念（同 7 个新概念格式：2 活动+rubric+出处 p83/86），或在覆盖台账逐节点明“为何不单列”；同步 ledger/report 的“8 节”表述（实为 9 节目标、8 节覆盖） |
| AUD2-03 | 低 | 7 个新概念（`*-human` / `unicellular-human` 等） | 7 个新概念与任何既有概念/关系无边（36 条关系未增），在地图局部图中是孤立节点，无法表达“与主概念相关” | 实测：`relations` 中 from/to 命中新概念 id 的条数 = 0 | 为每个新概念加 1 条 `related`（端点排序、rationale 说明）或明确“独立应用概念，不连边”的设计决定 |
| AUD2-04 | 低 | `pack.json` reviewLedger 的 2 条 content_pack 条目 | scope 仍写“84 活动”，实际 86（AUD-12 残留；其余计数 42/42/36/279 正确） | 实测：ledger scope 文本 vs pack.activities.length=86 | T14 重生成 ledger，或在 build 时用实际计数生成 |
| AUD2-05 | 低 | 3 处自写字段与教材常见定义短语重合（15–17 字，低于 18 字阈值）：`animal-cell-difference` explanation、`invertebrate-groups` explanation、`microbe-groups` explanation | 不构成 18 字阈值违规，但属“定义句高度接近教材”的边界情况；已由独立扫描列出，供人工判断是否需要改写 | 实测：15 字命中 3、16 字 3、17 字 1、18 字 0；命中片段如“细胞是生物体结构和功能的基本单位”（16 字） | 可选：改写为更口语的自写定义；至少保留独立扫描记录（若后续降低阈值需复审） |
| AUD2-06 | 低 | `docs/rebuild/reports/T14.md` 正文（行 19–24、33–37） | 仍保留首版 35 概念/70 活动/8 类排除/24+7 basis 等旧数字，与返工节 42/86/7 类/5+26 并存（AUD-11 残留） | 实测：报告两次读取 | 统一正文为返工后数字，或明确“本报告前文为首版历史，返工节为准” |
| AUD2-07 | 低 | `concept.bio7a.u1ch2s2.slide-types` 与 p27 目标“植物细胞临时装片是如何制作的？” | 该显式目标仍只由“实验·探究操作步骤”排除项承接，无概念/活动；与首版审查一致，非本次回归 | 静态核对：概念/活动/rubric 无“制作临时装片”内容；排除项第 7 类有声明 | 在覆盖台账按本节注明“技能类目标，按实验步骤排除”，或补 1 个操作型活动（若产品决定纳入） |

> 计数：**阻断 0 / 高 0 / 中 2 / 低 5**（合计 7）。相较首轮：阻断 0→0、高 3→0、中 6→2、低 5→5；旧低问题中 AUD-10/AUD-13 已修，AUD-11/AUD-12 仍残留、AUD-14 保留待办，另加 AUD2-03/05 与旧观察 AUD2-07。

## 4. 未变部分抽样与结构

- 来源：279 条全部通过 `pdfPage∈1..146`、`printedPage`↔T03 page-map、blockId 存在/页一致、bbox 一致（0 不符）；抽 19 条（15 条 hash 种子 + 离群页 4/5/18/24/62 最近页，页 3、7、12、15、19、22、27、32、47、55、60、67、74、77、82、119、131 等）**0 条不符**；9 条短标题锚点为合法（见 AUD-10）。
- 结构：`validate-pack` 退出 0（先修无环、related 端点排序、覆盖/发布门通过）；`selfcheck` 46/46（旁证）。
- 覆盖台账：totals 42 概念/86 活动/42 rubric/36 关系/279 来源/22 目标节/22 covered；42 个概念全部在且只在 1 个节级 coverage section 条目中，无重复/无漏登；概念 placements 全部落在 22 个 target 节内；排除项 7 类，未删分母、无核心概念被排除（项目/小结/插图/练习原题/栏目/实验步骤/非 section 页）。
- 分布：22 节 / 42 概念（平均 1.91）；首节 8 概念，9 节仍只有 1 概念（首版 15 节）；无 0 概念节。
- 新概念：7 个均 2 活动（14 个全部 choice+transfer）、2 条 rubric、出处页在各自节内；与既有概念无同 id/同题重复；领域内容（赤潮、保护鱼类、湿地、疫苗、发酵/抗生素）答案键抽查正确。

## 5. 结论

| AC | 第二轮独立结论 | 理由 |
|---|---|---|
| **A09** 目录/覆盖/分母 | **PARTIAL** | 目录/页范围/来源/覆盖台账全一致，22/22 结构可学、无删分母；但 1 个显式目标（无脊椎与人类生活）仍无概念/活动，概念粒度仍不均（9 节单概念、首节 8），不能宣称“全册概念清单完整” |
| **A10** 概念/活动/rubric/图示 | **PARTIAL** | 首轮关键质量问题已修：原文 ≥18 字 0、全概念基础+迁移、7 题干扰项、真菌目标、植物组织 rubric、答案键抽查正确；但新人类关系概念为 AI 自写需教师复核、仍缺 1 个目标、无图义视觉证据 |
| **A11** 关系依据/不硬推 | **PARTIAL** | 18/18 改判后 inference rationale 诚实（明说未声明/教学推断）、DAG 无环、related 排序通过；但 4 条 explicit 仍以编排顺序为据（AUD2-01），且 7 个新概念无关系边（AUD2-03） |
| **contentReadyFull** | **PARTIAL（与作者一致；G2 不放行）** | 无阻断/高发现，内容正确性大幅改善；剩余 2 项中等问题（A11 关系 basis 4 条、A09 无脊椎人类关系目标）修完 + 人工/图义/UI 补验后才应升级 |

**是否还有阻断问题：没有。** 不存在编造页码/来源、冒充专家审核、AI 自签发布（T04 H-03 已修）、先修环、来源悬空或口径崩塌；剩余为中低质量问题与 G2 证据缺口。

### G2 剩余缺口（按责任方）

1. **内容修正（T14）**：AUD2-01（4 条 explicit 改判）、AUD2-02（无脊椎人类关系概念或逐节点明排除）、AUD2-04/06（ledger/报告数字）、可选 AUD2-03（新概念加 related）与 AUD2-05（3 处 15–17 字改写）。
2. **图义视觉核对（T11/T15）**：65 条图注 + 8 条首节插图逐图核对（AUD-14 保留；当前无视觉证据）。
3. **human_curator / 教师审校与 published 决策**：当前 208 条 ledger 全部 `ai_static_reviewer → machine_checked`，无 human/published；T04 H-03 已强制发布必须 human 链。
4. **真实 UI/学习流程（T13/T15）**：地图/工作区/记录/复习全链路、候选/证据过期/自评显示、A18 实时更新。
5. **人工版次/印次/ISBN/印刷页总数核对**；A11 关系在修正后的再次独立复核（T14/T15）。

## 6. 未测项与证据说明

- 未做：图义视觉核对（无视觉证据）、真实 UI/学习流程、真实模型/图像、打包产物、教育效果实验；本报告不声称这些通过。
- 本次分析脚本与中间 JSON 在 `%TEMP%\t15-audit`（非交付、未进 Git）；报告只引用公开输入与可复算命令。作者 selfcheck/evidence 仅作旁证，所有结论来自独立读取 pack/refs/coverage/fragments 与 T03 基线。
- 未改 `education/content/biology-7a/**`、未改 T04/domain/锁/contract-lock、未 install；pack 与来源 hash 与 T14 返工报告一致（`42a78665…` / `6e119c43…`）。
