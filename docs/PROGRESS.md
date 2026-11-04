# 项目进度（PROGRESS.md）—— 唯一事实来源

> **2026-11-04 起，仓库只有一条产品线：`education/`。**
> 旧 Electron + Vue 线（v0.1–v0.2）已归档到 `docs/history/`，只读；不再开发、不再维护。
> 每次会话结束前必须更新本文件（改了什么 / 怎么验证的 / 下一步）。**没更新 = 这次会话不算结束。**

---

## 1. 一句话现状

**v0.3.1（2026-11-03）已发布**：运行在真实 DSH 内核上的教育 Agent，带本地优先的七上生物内容包（2 单元 / 7 章 / 22 节 / 43 概念）、本机事件日志与 Windows 学生包。
当前做两件事：**工作区收拢到单线**（2026-11-04，已完成待提交）和**界面重构 A+B**（进行中）。

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
| **学生界面可用性** | 🚧 | 当前是工程版界面；A+B 重构进行中（见 §5） |

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

**进度**：清理已完成；界面代码尚未开始。

---

## 6. 已知限制（诚实清单）

- 安装包**未签名**，Windows 会提示"未知发布者"。
- 未做干净机验证、未做学习效果实验——不声称提升理解或成绩。
- 图义视觉核对只完成抽样（8/73）；版次/印次/ISBN 行仍为 `unverified`。
- 当前界面只有 DOM 级断言，没有真实浏览器视觉走查（重构中补三档截图）。
- 学生包里裁掉了 `sharp`（图片附件走教育自有管线）、LibreOffice、语音、PTY。

---

## 7. 下一步（按顺序）

1. 提交工作区收拢（单个 commit）。
2. A 期：tokens / 外壳 / 顶栏 / 文案扫描守卫。
3. 今天页 + 设置页。
4. 学习台（材料 / 题目 / 反馈 / 小芽浮层）。
5. 知识地图两级 + 列表等价。
6. 进展页 + 我的课本 + 首次使用。
7. 测试改写、三档截图、人工走查、文档同步。
8. 视用户决定发布 v0.4.0。

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
