# 项目进度（PROGRESS.md）—— 唯一事实来源

> **2026-11-04 起，仓库只有一条产品线：`education/`。**
> 旧 Electron + Vue 线（v0.1–v0.2）已归档到 `docs/history/`，只读；不再开发、不再维护。
> 每次会话结束前必须更新本文件（改了什么 / 怎么验证的 / 下一步）。**没更新 = 这次会话不算结束。**

---

## 1. 一句话现状

**v0.4.0（2026-11-04）已发布**：运行在真实 DSH 内核上的教育 Agent，带本地优先的七上生物内容包（2 单元 / 7 章 / 22 节 / 43 概念）、本机事件日志与 Windows 学生包。
当前状态：工作区已收拢到单线；界面 A+B 重构与文案复检已完成；v0.4.0 版本号、README、封面与发布说明已更新。

---

## 2. 怎么跑

```powershell
pnpm --dir education install     # 首次（只有 education 有依赖）
pnpm dev                         # 本机 DSH web + Edge 应用窗口
```

- 模型 Key 在应用「设置」里配置（宿主侧加密），不写 `.env`；无 Key 时可离线读教材、看记录。
- 日常检查：`pnpm typecheck && pnpm test`；内容/契约改动追加 `pnpm content:validate && pnpm contract:lock:verify`。
- 界面改动：三档截图走查（1440×900 / 1280×800 / 1024×768），见 `docs/CONVENTIONS.md`。

---

## 3. 当前能力（与代码/实测对应）

| 能力 | 状态 | 证据 / 说明 |
|---|---|---|
| DSH 真实内核 + 教育 Agent 会话 | ✅ | `education/runtime/`（host/client 插件、G1 服务、适配器）；v0.3.1 真机实测 |
| 七上内容包（概念/活动/评分/关系/出处） | ✅ | `education/content/biology-7a/`；`pnpm content:validate` 通过 |
| 目录树 + 概念关系图 | ✅ | `client/map`；关系只来自内容包，不按章节顺序生成 |
| 学习 / 复习 / 短诊断 | ✅ | `client/study` + `packages/tutor`；12 类教学回归见 `docs/optimize/02-teaching-dialogue.md` |
| 图片作答（识别与批改分步） | ✅ | `client/visuals/image-flow.ts`；v0.3.1 之前实测过真实图片 |
| 本机事件日志 / 快照 / 崩溃恢复 / 导出删除 | ✅ | `packages/storage`；JSONL 追加日志 |
| 首用引导与模型 Key 设置 | ✅ | `client/shell/pages/first-run.ts`、`account.ts`；Key 不回显 |
| Windows 学生包（安装版 + 便携版） | ✅ | v0.3.1 产物；`education/desktop/`；未签名 |
| **学生界面可用性** | ✅（代码完成，待人工走查） | A+B 重构完成：今天 / 学习台 / 两级知识地图 / 进展 / 设置 / 我的课本；705 个测试全绿 + 三档截图；见 §5 |

**门状态（沿用 v0.3.1 发布说明，未变）**：G1 首节闭环 PARTIAL · G2 全册与教学 FAIL/PARTIAL · G3 Windows 产物 PARTIAL · 最终验收未达成。

---

## 4. 2026-11-04：工作区收拢（本次）

**做了什么**

- 删除旧 Electron 线的代码、测试、评测脚本、构建产物与发布脚本（`src/`、`tests/`、`evals/`、`scripts/`、`tools/`、`publish/`、`release/` 等，共约 95 个跟踪文件 + 432MB 旧产物）。
- 旧线文档、工具与评测数据移入 `docs/history/`（含 `PROGRESS/ARCHITECTURE/CONVENTIONS/AGENTS` 的旧版本副本）。
- 根目录改为**薄入口**：`package.json` 的 `dev/test/typecheck/build/...` 全部转发到 `education/`。
- CI 从"跑旧线 `src`"改为 **windows-latest + education 全量 typecheck/test**。
- 统一版本来源（`education/package.json`）与产品名（应用根标题改为「芽问」）。
- 重写 `AGENTS.md` / `ARCHITECTURE.md` / `CONVENTIONS.md` / 根 `README` 的开发说明 / `dev-dashboard` 四份看板。
- 安全网：tag `pre-cleanup-2026-11-04`；恢复方式见 `docs/history/README.md`。

**怎么验证的**

- `pnpm typecheck`：education 14 个 TS 项目全绿。
- `pnpm test`：14 个 vitest 项目、**663 个用例全绿**（改前基线，2026-11-04 本机实测）。
- `git grep` 旧路径 0 命中；根目录树只剩 `education/`、`docs/`、`content/`、`dev-dashboard/` 等。
- `pnpm dev` 起本机服务 → 无头 Edge 逐页截图核对（截图在 `output/uishot/`，不入库）。

**未做 / 未验证**

- CI 尚未在 GitHub 上真实跑过（本次仅改配置，等推送后看首跑结果）。
- 未重跑打包与干净机验证（本次没动 `education/` 业务代码）。



### 2026-11-04：v0.4.0 发布准备

- 版本号统一升到 **0.4.0**（根 `package.json` 与 `education/package.json`，打包脚本自动跟随）。
- 按 GitHub 呈现规范重写 `README.md` / `README.zh.md`：新封面、真实徽章、安装/使用/配置/结构/限制，配 3 张真实界面截图；重画 `docs/images/cover.png`。
- 新增双语发布说明 `docs/releases/v0.4.0.md`（新增 3 · 优化 7 · 修复 5），更新看板与进度。
- 产物（本机构建，未上传）：`education/dist/SproutAsk-Setup-0.4.0-x64.exe`（59,436,226 B，FileVersion 0.4.0）、`SproutAsk-0.4.0-x64-portable.zip`（123,134,766 B）、`SHA256SUMS-v0.4.0.txt`；payload `version.txt` 为 0.4.0。
- 验证：`pnpm typecheck` 全绿；`pnpm test` **705 个用例全绿**；makensis 构建成功；zip 根目录含 `launcher.cmd` 与 `version.txt`。
- **已发布**：提交 `ad9e6fd`（合并远端历史后为 `817fb15`），tag `v0.4.0` 已推送；GitHub Release：<https://github.com/HaoyanZhang123/sproutask/releases/tag/v0.4.0>，附安装版、便携版与 `SHA256SUMS`。
- **未做**：干净机安装/启动验证。

---

## 5. 界面重构 A+B（已拍板，进行中）

**目标**：把"写给验收和 AI 看"的界面改成"学生能直接用"的界面；功能与数据契约不变。

**已确认的方向**

- A 期：设计 token、顶栏、文案减法、空态/按钮/窄屏等表现层。
- B 期：主旅程重排——今天 / 学习 / 进展 + 设置；教材库、地图降为二级但一次点击可达。
- 学习页：**一张摊开的学习台**（左页课本、右页练习，反馈原地展开，小芽改为右下浮起按钮）。
- 地图：**两级**——全册章节地图（单元→章→概念胶囊）+ 章级分层关系图（先学→再学→连起来），带列表等价视图。
- 文案：学生话，禁词自动扫描（`activity.*`、内容包、三轴、证据候选、回环、rem 等）。

**设计稿**：`output/uishot/mockups/`（临时目录，不入库；定稿后截图归档到 `docs/images/ui/`）。
**方案与实施记录**：`docs/rebuild/11-ui-redesign.md`（随实施创建）。

**进度（2026-11-04）**：A+B 已实现并合入工作区，随后按用户逐条确认完成文案减法。

- 外壳：顶栏「芽问 · 今天 / 学习 / 进展 + 设置」；移除侧栏、调试状态条、服务状态卡。
- 今天：主卡「接着上次」+ 右栏四件事 + 三个数字进度条（与进展页同口径）。
- 学习台：对开两页（课本 / 练习），提交后原地出反馈；小芽改为右下浮起按钮 + 侧层；<1100px 单页 + 课本抽屉。
- 知识地图：全册章节总览（单元→章→概念胶囊，四态文字+颜色+形状）+ 章级分层关系图（先修分层、不重叠、箭头/虚线、详情卡、列表等价）。
- 进展：三个数字 + 按日期时间线 + 展开证据/出处/自评 + 底部导出删除。
- 我的课本 / 设置 / 首次使用：单卡 + 折叠来源；Key、字号、关于；三步引导。
- 文案：新增禁词守卫测试（`copy-guard` 与各包文案测试）；误差码不再显示给学生；错误统一为中文修复建议。
- 文案复检（2026-11-04 晚）：按用户逐条确认，删除/压缩 30 处小字解释（版式说明书、系统自证/兜底、重复隐私、冗长确认框、重复计数）；移除全站页脚；705 个测试仍全绿，三档截图已更新。

**验证**：`pnpm typecheck` 全绿；`pnpm test` **705 个用例全绿**（2026-11-04 实测）；真实模型跑通一轮“开始学习 → 提交 → 原地反馈”（15s，反馈无重复/无内部词，出处按页去重）；三档截图归档 `docs/images/ui/`。

**已知缺口（后续）**：
- live 数据源忽略 `activityId`，「下一题」在真机下可能换不到题（UI 已诚实降级为“再答一次/暂时换不到下一道题”）。
- shell 侧暂无 `saveSelfReport`，学习台自评只在本页内存；进展页自评同。
- 进展页的章节 chip 因 payload 无章节标题而留空（不解析内部 id）；真实 `sourceRefs` 是片段 id，出处页在真机可能显示不完整。

---

## 6. 已知限制（诚实清单）

- 安装包**未签名**，Windows 会提示"未知发布者"。
- 未做干净机验证、未做学习效果实验——不声称提升理解或成绩。
- 图义视觉核对只完成抽样（8/73）；版次/印次/ISBN 行仍为 `unverified`。
- 当前界面只有 DOM 级断言，没有真实浏览器视觉走查（重构中补三档截图）。
- 学生包里裁掉了 `sharp`（图片附件走教育自有管线）、LibreOffice、语音、PTY。

---

## 7. 下一步（按顺序）

1. 按 `docs/optimize/04-manual-test.md` 做人工走查并收集反馈。
2. 用户按 `docs/optimize/04-manual-test.md` 走查并反馈。
3. 后续补 live `activityId` 取下一题、self-report 持久化（需 host/契约变更，另行评估）。

---

## 8. 文档地图

| 想知道什么 | 看哪里 |
|---|---|
| 当前状态 / 上次做了什么 / 下一步 | **本文件** |
| 架构、目录、分层、数据流 | `docs/ARCHITECTURE.md` |
| 命令、UI 规范、测试、Git 流程 | `docs/CONVENTIONS.md` |
| 产品目标 / 用户流程 / 公共契约 / 验收 | `docs/rebuild/01`–`07` |
| 任务卡与自动执行协议 | `docs/rebuild/tasks/`、`docs/rebuild/08-execution.md` |
| 界面重构方案与记录 | `docs/rebuild/11-ui-redesign.md` |
| 发布说明 / 调优记录 | `docs/releases/`、`docs/optimize/` |
| 研习设计、问卷材料 | `docs/研习设计.md`、`docs/研习材料/` |
| 旧 Electron 线的一切 | `docs/history/`（只读） |
