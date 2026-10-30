# biology-7a — 人教版生物学七年级上册全册内容包（T14）

本目录是 **全册候选内容包**（AI 静态检查，非教师/专家审校），由 T05 首节包扩展而来。

- 冻结范围：**2 单元 / 7 章 / 22 节**，PDF 11–141（逐节页范围见 `coverage/coverage-manifest.json`）
- 真实教材：`义务教育教科书·生物学·七年级·上册.pdf`（本机只读原件）
  - SHA-256 `33eed60ce56aa402ae683b9c3a573f2fd780b766d635b04580d604928a23e59f`，146 页，扫描版无文本层
  - 版本事实来自封面/版权页/目录与正文标题块，见 `source/source-verification.json`
- 包：`pack.biology-7a.observation@2.0.0`，`scope=full_volume`、`coverageStatus=complete`、`status=candidate`
  - `contentHash` 由 `tools/build-pack.mjs` 按 canonical content 计算；`pack.json` 是唯一顶层 JSON
  - 首次 **AI 静态检查（非教师专家审核）**：`coverage/review-report.md`、`review/review-ledger.json`
  - AI 不能自行发布为 `published`；正式基准/学习消费前需 human_curator 审阅与发布决策
- 规模：**43 概念 / 88 活动（每概念 2 类）/ 43 rubric / 44 关系 / 281 条来源定位 / 22 个 covered target section**
  - T05 首节 8 概念保持稳定 id；T14 新增其余 21 节 27 概念；2026-10-29 T15 两轮审查返工新增 8 个“与人类生活”概念（含无脊椎动物）

## 目录结构

```
biology-7a/
  pack.json                      # 唯一顶层 pack（ContentPack v1，含 contentHash 与 reviewLedger）
  README.md
  fragments/                     # pack 的单一事实源（build-pack 从这里组装）
    pack-meta.json               # id/version/scope/status/generatedAt
    toc.json                     # 全册目录：2 单元 / 7 章 / 22 节
    concepts.json                # T05 首节 8 个 Concept
    activities.json              # T05 首节 16 个活动
    rubrics.json                 # T05 首节 8 个 rubric
    relations.json               # T05 首节 9 条关系
    relations-full.json          # T14 跨节 27 条关系（basis + rationale）
    specs/                       # 逐章紧凑概念规格（u1ch1s2/u1ch2/u1ch3/u2ch1/u2ch2/u2ch3/u2ch4）
    coverage.json                # 全册 target 22 节 + 8 类排除项
    section-pages.json           # 逐节/章/单元 PDF 页范围（正文标题页核对，不按偏移）
    review-notes.json            # 审校发现、修订、待人工复核 + pack 级 ledger 条目
  concepts/concepts.json         # 审阅视图：35 概念 + 展开的页/区域出处 + 活动/rubric
  source/
    source-verification.json     # 版本核实 + 全册目录（含第四章更正）+ 未知项 + 与旧文档差异
    course-edition.json          # CourseEdition + BookInstance
    source-refs.json             # 269 条 SourceRef（pdfPage/printedPage/bbox/blockId/verification）
    block-index.json             # blockId -> 页/区域/类型/文本 SHA-256（不含原文）
    page-labels.json             # 146 页的页脚印刷页标签快照（null=无标签，禁止推算）
    block-selection.json         # 来源锚点选点表（本地重建 source-refs 用）
    figure-usage.json            # 首节 8 处短标签插图的使用/排除理由
    figure-usage-full.json       # 全册 65 条“图X-X”图注候选的逐条处置（页图不分发）
  coverage/
    coverage-manifest.json       # 全册章级/节级覆盖台账 + 页范围 + 排除项 + 待人工复核
    review-report.md             # 全册首次 AI 静态检查记录（非专家审核）
  review/review-ledger.json      # ledger 视图：审校方法/范围/发现/修订/条目
  tools/
    link-baseline.mjs            # 本地重建 source-refs/block-index（需 T03 基线；非本机不可复跑）
    spec-expand.mjs              # 紧凑概念规格 -> domain Concept/Activity/Rubric
    build-pack.mjs               # 组装 pack.json + 审阅视图；--check 检漂移
    selfcheck.mjs                # 45 项独立自检
    tsconfig.json                # 只类型检查 tools/*.mjs（顶层不放 tsconfig，见下）
```

## 校验

```powershell
# 1) 官方内容校验（目录模式只读顶层 *.json，因此顶层只有 pack.json）
node education/packages/knowledge/bin/validate-pack.mjs education/content/biology-7a
#   期望：退出 0；candidate 包显示 “publication not ready: 1 gate issue”（未 published，预期）

# 2) 独立自检（有 T03 本机基线时 45/45；无基线时出处结构仍检，跨基线项标 NOT_RUN）
node education/content/biology-7a/tools/selfcheck.mjs

# 3) 生成物是否与 fragments 一致
node education/content/biology-7a/tools/build-pack.mjs --check

# 4) 重建 pack（改 fragments/specs 后）
node education/content/biology-7a/tools/build-pack.mjs

# 5) 只在有 T03 基线的本机可复跑：重建来源定位
node education/content/biology-7a/tools/link-baseline.mjs --baseline <T03 run 目录> --checked-at <RFC3339 UTC>

# 6) tools 脚本类型检查（T01 的 typecheck:task T14 需要 content/biology-7a/tsconfig.json，
#    该文件会与 validate-pack 的目录模式冲突；见 docs/rebuild/requests/T05.md / T14.md）
education/node_modules/.bin/tsc -p education/content/biology-7a/tools
```

## 数据与边界

- **不复制教材正文/页图进 Git**：解释、题干、选项、rubric 均为自写中文；`source/` 只有定位、短标题与文本指纹；原图/原文/逐页 OCR 文本在 `education/.local/evidence/T03/…`（gitignore）。
- **页码**：`pdfPage` 为 PDF 页序（1 基），`printedPage` 为页脚标签；无标签为 `null`，不推算偏移。逐节页范围见 `fragments/section-pages.json` 与 `coverage/coverage-manifest.json`。
- **版本**：书名/学科/年级册次/出版社已核实；版次/印次/ISBN/定价未读清，保持 `null`+`unverified`，不写“2024 版”等未证实结论。
- **目录**：目录页 OCR 只作线索，正文标题块为准；第二单元第四章按正文更正为 2 节。
- **关系**：不从目录顺序批量生成先修；`explicit_source` 有教材依据，`pedagogical_inference` 写 rationale，`related` 不是先修。
- **图示**：只使用受控静态 `DiagramSpec`；结构图是教学示意，不是教材原图；图义视觉核对未做。
- **状态**：candidate + machine_checked；没有专家审核、没有学习实验、没有真实 UI/模型调用。

## 给 T15 / G2 的复核建议

1. 独立比较实际目录与 `toc.json`（尤其第二单元第四章 2 节、第二单元章号），确认分母 22 节无增删。
2. 抽查每章至少 2 个概念的来源页与印刷页（`source/source-refs.json` + `source/block-index.json`），核对 `pdfPage`/`printedPage`/bbox。
3. 做逐图视觉核对（`source/figure-usage-full.json` 的 65 条 + 首节 8 条），确认图义与文字一致；当前只有图注级证据。
4. 复核 36 条关系的 basis：`pedagogical_inference` 是否仍是合理教学推断，`related` 不得被当作先修。
5. 人工核对版次/印次/ISBN/全书印刷页数；确认后再考虑 `published`（需 human_curator 决策）。
6. G2 通过后，T13/T15 才能宣称全册内容就绪；本包不宣称教育收益。
