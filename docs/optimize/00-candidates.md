# 优化候选清单（阶段 0 交付物）

- 日期：2026-11-02
- 基线：`education/` 源码构建（`pnpm --dir education dev`），DSH `0.2.1-rc.3`，内容包 `pack.biology-7a` 2.0.0 `published`，43 概念
- 实测环境：本机 Windows，1366×900 视口 @DPR 2，headless Chrome CDP 截图；**只看页面，未触发任何模型回合**
- 质量门：`typecheck` exit 0 / `test` 全部包 exit 0（2026-11-02 实跑）
- 证据目录：`education/.local/evidence/optimize-2026-11-02/screens/`
  （`01-home` `02-library` `03-map` `04-workspace` `05-records` `06-account` `10-map-concept-selected` `11-workspace-learn`）

> 结论先行：**产品功能是通的，问题几乎全在"说给谁听"**——当前界面文案和元数据是写给评审/工程看的，不是给七年级学生看的。这类改造成本低、可截图验收、不花模型费，所以排在第一批。

---

## A. 学生语言与信息架构（P0，改文案/删元素，零模型费）

| ID | 现象（实测） | 证据 | 影响 | 成本 |
|---|---|---|---|---|
| A1 | **每页出现两条一模一样的上下文条**：顶部一条，页面正文里又一条；`记录`页两条的"返回位置"还不一致（顶部"工作区"、正文"首页"） | 截图 `01-home`/`05-records`；`client/shell/src/shell.ts` `renderContext()` + 各页 `renderContextBar()` | 占屏、重复信息、自相矛盾 | 低 |
| A2 | 页面导语是设计说明，不是学生话术：「材料在左，当前活动在中，学习助手与反馈在右；顶部保留教材、内容包、概念、模式、保存状态与返回位置。」 | 截图 `04-workspace`；`client/shell/src/pages/workspace.ts:37`；`client/study/src/page.ts`；`records`/`library` 导语同类 | 学生读到的是规格书 | 低 |
| A3 | 侧边栏只有 教材库/地图/工作区/记录，**没有"首页"**；回首页只能点左上角 logo | `client/shell/src/shell.ts:95-100` `NAV_ITEMS` | 迷路 | 低 |
| A4 | 账户页向学生展示项目决策：「本产品线不使用平台账户授权（用户已明确该路线不允许）」「学生权限不包含系统级文件、命令……」 | 截图 `06-account`；`client/shell/src/pages/account.ts` | 叙事错位 | 低 |
| A5 | 页脚两条常驻政策说明：「学生权限只包含学习相关能力；系统级文件与命令能力不由客户端授予。」 | 截图全页底部；`shell.ts` footer | 噪音 | 低 |
| A6 | 技术/英文标签外露：`Biology grade 7 · 内容包 2.0.0 · 学习`、`选择 · 版本 1`、`learner.local.default`、`文件指纹 33eed60ce56a…e59F`、`source block · PDF page 11` | 截图 `04-workspace` `11-workspace-learn` `02-library` `06-account` | 学生看不懂 | 低 |
| A7 | 地图详情用学术长句解释关系：「教学推断（非教材原文）· 理由：理解观察的含义有助于设计有目的观察，但教材并未把'含义'写成'目的与对象'的先修条件；此依赖为教学推断。」 | 截图 `03-map` | 信息过载 | 中 |

## B. 阅读与操作体验（P0，改排版/交互，零模型费）

| ID | 现象（实测） | 证据（根因已定位） | 影响 | 成本 |
|---|---|---|---|---|
| B1 | **活动题干重复两次** | 截图 `11-workspace-learn`；`client/study/src/controller.ts:1320` 渲染 `edu-study-stem`，`client/visuals/src/answer-forms.ts:51` 又把同一 stem 写成表单标题 | 重复、挤占屏幕 | 低 |
| B2 | **选项挤成一段**：`○只要睁开眼睛看见，就是观察 ○观察是有目的… ○观察就是用仪器… ○观察就是…` 全在一行 | `client/visuals/src/answer-forms.ts:66` 用 `.edu-visual-option`，**全仓库没有该 class 的任何 CSS**（`label` 默认 inline） | 无法阅读/选择，直接伤及作答 | 低 |
| B3 | 每页标题带橙色焦点框，像报错 | `pageHeading` 的 `tabindex=-1` + `client/shell/src/styles.ts:73` 的 `[tabindex]:focus-visible` | 观感 | 低 |
| B4 | 学习助手还没开始对话，先给 5 个按钮（给我提示/解释一下/看个示范/分步示范/直接看答案） | 截图 `04-workspace` | 认知负担、主次不分 | 低-中 |
| B5 | 工作区主按钮是「结束本轮」，「提交作答」是次按钮；另有「跳过本题/暂不完成/改用图片作答」同级并列 | 截图 `11-workspace-learn`；`client/study/src/controller.ts` 活动操作区 | 误操作风险 | 低 |
| B6 | 教材库整页是 30+ 行结构相同的 `source block · PDF page 11 · PDF 第 11 页 · 课本第 2 页 · 来源:机器匹配`，每行一个「打开来源」 | 截图 `02-library` | 页面失去意义 | 中 |

## C. 功能缺陷（需要改代码；P1）

| ID | 现象 | 根因（已读代码确认） | 影响 | 成本 |
|---|---|---|---|---|
| C1 | 地图详情永远显示「该概念还没有登记出处。」，但该概念实际有 6 条 `sourceRefs`，工作区里同概念能显示 5 个出处 | `runtime/client-plugin/src/live-sources.ts:221` **硬编码 `sources: []`**；payload 里 `sources` 目录是有的 | 自相矛盾，学生以为无出处 | 中 |
| C2 | 地图详情的目录归属显示 toc 原始 id（`title: tocNodeId`） | `live-sources.ts:223-227` | 学生看到 `toc.bio7a.u1.ch1.s1` | 低 |
| C3 | 直接访问/刷新子页面 404（`GET /workspace` → 404，`GET /library` → 404） | SPA 路由只在内存（`shell.navigate` 不写 URL）；host 无 SPA fallback | 当前不触发（产品从 `/` 进入）；一旦上历史路由就踩坑 | 中 |
| C4 | 同一出处重复列出 5 次（PDF 11/11/12/12/14），全是 `source block · PDF page N` | 工作区出处区按 activity/concept 逐条列出，未去重、未人话化 | 噪音 | 低-中 |

## D. 教学对话质量（阶段 2，需要模型预算）

| ID | 现象 | 证据 | 建议 |
|---|---|---|---|
| D1 | 模型对**内容包里明明有**的概念说「可能不在内容包/暂无来源」，学生要求完整解释时推脱 | [T15 报告](../../docs/rebuild/reports/T15.md) B03-R2 / B05-R2 = FAIL，B06-R2 / B08-R2 = PARTIAL（24 回合 17 PASS / 5 PARTIAL / 2 FAIL） | 系统指令注入「本包覆盖目录」+ 明确"目录里有的必须直接答，只有真不在目录里的才说没有" |
| D2 | 上述改动需要真实模型回归 | 预算：193/194 已用满 | 用户已追加 60 次 / ≤¥3，先放 20 次跑一轮 |

## E. 文档与看板（P2）

| ID | 现象 | 建议 |
|---|---|---|
| E1 | `dev-dashboard/` 停留在 2026-10-11 的 Electron 时代，与 v0.3.0（DSH 内核）严重脱节 | 本轮改完后同步一次 |
| E2 | `docs/PROGRESS.md` §15.4 的"下一步优先级"需按本轮结果重写 | 会话结束前更新 |

---

## 建议批次

### 批次 1（P0，本轮先做，不花模型费）
A1、A2、A3、A5、A6、B1、B2、B3、C2
- 共同点：都是"删重复 / 改文案 / 补样式 / 换标签"，不改领域契约、不加依赖、不动数据。
- 预计：半天内可完成并出对比截图。

### 批次 2（P1）
A4、A7、B4、B5、B6、C1、C4
- 需要重新组织组件结构（上下文条收成"详情"、出处折叠、按钮分层、教材库重排）。

### 批次 3（P2 / 可选）
C3（host 加 SPA fallback + 历史路由）、E1、E2

### 阶段 2（用预算）
D1 → D2：改系统指令 → T15 24 回合回归 → 目标 0 FAIL、PASS ≥ 21/24。

---

## 验收口径（批次 1 与批次 2 通用）

1. `pnpm --dir education typecheck` = 0，`pnpm --dir education test` = 0（现有 happy-dom 断言同步更新，不许删断言凑绿）。
2. 同一视角（1366×900 @DPR2）前后截图对比，逐页交付。
3. 不新增依赖、不改 `packages/domain` 契约、不新建顶层目录、不动 `.local` 以外的东西。
4. 不出现新的技术 id / 英文标签进学生界面（列表逐条核对）。
5. 教学对话相关改动（阶段 2）必须附真实模型回归结果，不许用"推断有效"结账。

## 明确不做

- 不重做整体视觉设计（配色/字体/品牌）——本轮只清噪音与层级。
- 不动内容包（图义 65/73、版次核对属内容工作线）。
- 不动 DSH 内核、不改打包/发布流程。
- 不为通过验收而放宽测试断言。
