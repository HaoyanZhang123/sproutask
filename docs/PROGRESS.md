# 项目进度（PROGRESS.md）—— 唯一事实来源

> **2026-11-04 起，仓库只有一条产品线：`education/`。**
> 旧 Electron + Vue 线（v0.1–v0.2）已归档到 `docs/history/`，只读；不再开发、不再维护。
> 每次会话结束前必须更新本文件（改了什么 / 怎么验证的 / 下一步）。**没更新 = 这次会话不算结束。**

---

## 1. 一句话现状

**v0.4.0（2026-11-04）已发布**：运行在真实 DSH 内核上的教育 Agent，带本地优先的七上生物内容包（2 单元 / 7 章 / 22 节 / 43 概念）、本机事件日志与 Windows 学生包。
当前状态（2026-11-05）：**v0.4.1 已可用**——原生桌面壳 `SproutAsk.exe`（Rust + WebView2）替代 Edge 窗口，会话卡死与安装器问题已修；工作区已清理（8,456MB → 873MB）；干净克隆可构建、CI 有三道守卫；契约锁已重建。本机已覆盖安装 0.4.1 并实测通过；下一步是人工走查。

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

### 2026-11-05：清理与收口（本次）

**做了什么**

- **仓库 P0（丢文件）**：根 `.gitignore` 的 `data/` 是全局模式，把 `education/client/shell/src/data/`（`types.ts` + `fixture-data.ts`，被 contracts/shell-state/index 直接 import）和 `education/licenses/data/`（4 个许可证清单 JSON，被已跟踪的 licenses 工具读取）一起忽略了。v0.3.1 tag 里这两个目录还在，v0.4.0 线整条丢失 → main 干净克隆 typecheck 必红、CI 红、许可证流程 ENOENT。修复：`data/`→`/data/`、`notes/`→`/notes/`、`output/`→`/output/`，`education/.gitignore` 补 `output/`，同一提交补回 6 个文件（commit `e124a64`）。
- **CI P0（环境差异）**：GitHub Actions Windows runner 的 TEMP 是 8.3 短名（`C:\Users\RUNNER~1\...`）。importer 的 `verifyManagedAsset` 用 `realpath` 得到长名候选，再与 `path.resolve` 的 `allowedRoots`（短名）比较 → 被判根外（`INVALID_INPUT`），CI 上 22 个用例失败。修复：比较前把 allowed roots 也 `realpath` 规范化，解析失败回退原值（commit `b3b4de9`）。本机把 TEMP 指向短名目录可稳定复现（修复前 failure-modes 6 failed/4 passed，与 CI 一致；修复后 importer 44 用例全绿）。
- **工作区瘦身**：删 `output/`、`education/.local/cache`（保留 `T16/tools` 9MB NSIS）、`.local/evidence`、`.local/publish`、`dist/student`、`dist` 旧版本与重复 exe、`education/output`、`.tmp`。8,456.11MB / 287,698 文件 → **872.58MB / 36,879 文件（−89.7%）**，回收 7,583MB / 250,825 文件。保留：v0.4.0 三件套（与 Release 资产 SHA256 一致）、`.local/secrets`、`education/node_modules`、`probes/runtime/node_modules`、源码/docs/内容包/教材 PDF。
- **本机收口**：停掉 11-04 遗留的开发服务（PID 41876 / 端口 30574）；卸载旧 Electron 0.2.0 与 education 0.3.0（0.3.0 数据根原本为空）；删 `%APPDATA%\SproutAsk`（13 条旧会话+旧配置，按用户决定不保留）、`sproutask-updater`、`E:\Downloads` 旧安装包、191 个空临时目录；静默干净安装 0.4.0（`%LOCALAPPDATA%\SproutAsk\current`，version=0.4.0）。快捷方式收口为 2 个（桌面 + 开始菜单，同指 launcher.cmd）。
- **文档**：dev-dashboard 的 NOW / PRODUCT / FEATURES 与 PROGRESS 对齐（此前 NOW 写"待拍板"、PRODUCT 停在 v0.3.1）。

**怎么验证的**

- 干净克隆（GitHub 全新 clone）→ `pnpm --dir education install --frozen-lockfile` → `pnpm typecheck` / `pnpm test` / `pnpm content:validate` 全绿。
- 本仓 `pnpm typecheck && pnpm test` 全绿（705 用例）；`pnpm dev` 构建并起服务，HTTP 200（12,522 B）。
- GitHub Actions：`e124a64` 上 typecheck 通过、test 因 8.3 短名失败（importer 22 用例）；`b3b4de9`（修复）对应 run 41999686580 全绿；`7469306`（文档）对应 run 41999969745 全绿。
- 安装版无头冒烟：`--no-edge` 启动，HTTP 200、`status.ok=true`、`status=degraded`（无 Key，预期）、pack biology-7a@2.0.0、43 概念。
- 工作区保留项逐项核对存在；`git status` 干净；tracked 924 → 930。

**未做 / 未验证**

- 安装版尚未重新填 API Key → 真实模型对话/工具调用未实测（无头冒烟只到 HTTP 与内容绑定）。
- 契约锁问题已在同一会话后段解决（见 §4.2）。
- 未做"另一台干净机"验证；未做学习效果实验。



### 2026-11-05：契约锁重建 + CI 加固（新一轮第 1 件）

**做了什么**

- **契约锁重建**：`pnpm contract:lock:verify` 之前报 100 处漂移——v0.4.0 改了 `map`/`study`/`shell` 的源码与测试后没有重生成锁。重建后 `docs/rebuild/contract-lock.json`：files 456 → 467（+13 个新文件、−3 个改名、84 个哈希更新）；`contract` / `workspace` / `packages` / `dependencyDirection` / `commands` / `dependencies` 六段逐字节未变（契约版本仍 1.0.0），属于纯基线更新。
- **行尾坑（CI 首跑暴露）**：本机有 57 个文件的工作区副本是 CRLF（旧克隆早于 `.gitattributes` 的 `eol=lf`），第一次重建把 CRLF 字节算进了锁；CI 全新检出是 LF → Contract lock 步骤 33 处 hash mismatch（run `42001511682`）。处理：把工作区 57 个文件的行尾一次性归一到 LF（与 `.gitattributes`、git 索引一致），再重建锁（`5f6e71d`，仅 33 个哈希与 generatedAt 变化），并在本地全新 clone 里先预验。
- **锁生成器加固**：`education/scripts/lib/lock.mjs` 跳过 `output/` 与 `*.tsbuildinfo` / `*.log`，避免本机生成物被算进锁、换机器 verify 变红。
- **tracked 守卫**：新增 `education/scripts/check-tracked-sources.mjs` 与 `pnpm check:tracked`；遍历 `education/`、跳过生成物目录与日志，任何未进 git 的文件即失败（背景：2026-11-05 根 `.gitignore` 全局 `data/` 误伤 `client/shell/src/data/`）。
- **CI 加固**：`.github/workflows/ci.yml` 升到 `actions/checkout@v7` / `actions/setup-node@v7` / `pnpm/action-setup@v6`（消掉 Node 20 弃用告警）；新增四步：Tracked sources guard、Contract lock、Content pack、Build 后"构建产物必须与已提交文件一致"。
- 根 `package.json` 补 `check:tracked` 与 `contract:lock:generate` 两个薄入口；`AGENTS.md` / `CONVENTIONS.md` 的命令与质量门同步。

**怎么验证的**

- 本机：`pnpm check:tracked` OK（733 个文件全部被跟踪）；`pnpm contract:lock:verify` OK（files=467）；`pnpm content:validate` / `typecheck` / `test` 全绿；`pnpm build` 后 `git status --porcelain --untracked-files=no` 为空（产物可复现）。
- 守卫自检：未 `git add` 新脚本时，`check:tracked` 报 1 个未跟踪文件并退出 1；add 后转 OK。
- 模拟 CI 检出：本地全新 clone（LF 检出）→ `install` → `contract:lock:verify` OK、`check:tracked` OK。
- CI：`23b507c` 首跑在 Contract lock 失败（上述 CRLF 假哈希）；`e4b578a` 的 run `42002107337` **全绿**——Tracked sources guard / Contract lock / Content pack / Typecheck / Test / Build / Build output matches committed files 七步全部通过。

**未做 / 未验证**

- "Build 输出零漂移"依赖 esbuild 输出稳定（版本固定 0.28.2）；若将来升 esbuild，需要重跑 `pnpm build` 并提交 `runtime/*/lib`。
- 未做另一台干净机验证（CI 的 windows-latest 已是最接近的替代）。




---

### 2026-11-05：v0.4.1 原生桌面壳（方案 B）与卡死修复

**做了什么**

- **原生桌面壳**：新增 `education/desktop/host/`（Rust + WebView2，~900 行）：单实例互斥量 + 聚焦已有窗口、首启初始化、隐藏启动 node 服务（`--no-edge`）、WebView2 原生窗口、窗口位置/大小记忆、关窗清理子进程、失败时中文 MessageBox。产物 `SproutAsk.exe` 997,888 B，版本 0.4.1（**版本唯一来源 `education/package.json`**），内嵌芽问图标（窗口/任务栏/安装器/快捷方式同一份）。
- **打包链**：新增 `pnpm build:win` 一条龙（插件 → 桌面壳 `cargo build --release` → payload → NSIS）；payload 根新增 `SproutAsk.exe`；NSIS 快捷方式、完成页「立即启动」、`DisplayIcon` 全部指向 `SproutAsk.exe`；安装包默认文件名带版本号。
- **会话卡死修复**：`tutor` 在**调用方给定 session id** 绑定失败时也会换新 id 重试一次（此前只在未指定 id 时重试；页面重载/重试会因 DSH restore TypeError 把整页替换成错误卡）；`CONFLICT` / `UNAVAILABLE` 文案改成学生话。
- **安装器修复**：完成页启动与「应用和功能」图标不再指向从未随包的 `launcher.vbs`。
- **本机收口**：覆盖安装 0.4.1 到 `E:\芽问\current`（旧 0.4.0 被替换），版本、快捷方式、卸载项、学习数据均已核对；`C:\Users\18149\AppData\Local\SproutAsk\current` 孤儿早前已删。

**怎么验证的**

- 本机静默安装 `SproutAsk-Setup-0.4.1-x64.exe`（59,820,103 B，`/S`，exit 0）→ `version.txt` 0.4.1、host exe FileVersion 0.4.1、桌面/开始菜单快捷方式指向 `SproutAsk.exe`、卸载项 `SproutAsk 生物学习 0.4.1`。
- 原生壳实跑：窗口标题「芽问」、无控制台黑窗；学生页 HTTP 200（12,291 B）；单实例（第二次启动 exit 0、宿主仍 1 个、node 不新增）；关窗后数秒内 node 全部退出；学习记录 `learner-data/journal/events.jsonl` 11,277 B 原样保留。
- 隔离根联调（`E:\DSH\tmp\host-test`，junction + 独立 SPROUTASK_DATA_ROOT）：单实例聚焦、失败路径中文 MessageBox、`window.json` 尺寸/位置恢复均实测；`cargo test --release` 2 passed。
- 本机 `pnpm typecheck` / `pnpm test` / `pnpm check:tracked` / `pnpm contract:lock:verify` 全绿。

**补记 2：学习台等待重试 + 宿主 Job Object（2026-11-06 00:1x）**

- 二次白屏：强杀桌面壳（`Stop-Process -Force` / 任务管理器）只杀了宿主，node 子进程成了孤儿并占着 `learner-data/journal/events.lock`；新实例拿不到写锁 → host 插件报 `journal is locked by pid …` → 404 → 白屏。清理孤儿后恢复正常。
- 修复：桌面壳创建 **Job Object**（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）并把 node 子进程放入；宿主无论正常退出、崩溃还是被强杀，node 都会随句柄关闭被杀，不再留孤儿。
- 学习台：打开/刷新时遇到「上一轮还在回答」（`CONFLICT: TURN_IN_PROGRESS`）不再整页报错，改为显示「小芽还在回答上一题，稍等…」并每 1.5s 自动重试（约 36s 后仍失败才显示错误卡）。
- 0.4.1 安装包用新 host + 新 client bundle 重新构建并重装验证（`cargo build --release` exit 0；host 999,936 B；安装包 59,816,899 B）。
- 实测：只 `/F` 杀宿主（不带 `/T`，模拟任务管理器/崩溃）→ 6 秒内 node 归零（job object 生效）；重启后 `statusHttp=200`、窗口正常。

**补记 3：小芽输出格式与等待体验（2026-11-06 00:5x）**

- 问题：聊天气泡把模型输出当纯文本渲染，`**加粗**`、标题、长段落原样露出；回复里还带「教材事实/来源」「我的解释」「还不确定的部分」「disclosure（答案披露）」这类标签和元信息；等待反馈时只有一句静态文案，没有进度感。
- 改动：
  - `tutor/skill`：输出要求改为学生话——1–3 个短段落、禁用 Markdown（`**`/`#`/表格/代码块）与上述标签、回答里不出现 disclosure/assisted/证据/内部标识等说法；引用只说「参考：课本第 N 页」。
  - `tutor/pedagogy`：删除长披露括号说明与「查看出处」式元信息，只保留一行可读引用；看过答案由界面徽标提示。
  - `client/study`：聊天气泡做最小 Markdown 渲染（段落、加粗、短列表）；等待页面与等待反馈显示「已等 N 秒」，超过 20 秒提示「比平时久一点」。
- 验证：`pnpm typecheck` / `pnpm test` 全绿；重建 client/host bundle 并部署；0.4.1 重装后 `statusHttp=200`、窗口正常。输出效果依赖真实对话走查（prompt 约束 + 客户端渲染双保险，待用户实测）。
- 另一台干净机安装验证（本机已装过 0.4.0，不是干净机）。
- 便携版 zip 未在 0.4.1 重新构建（安装版已验证）。

**补记：0.4.1 首次启动白屏（2026-11-05 23:45，已修复）**

- 现象：原生窗口打开后内容区一直白屏；服务日志 `statusHttp=404`，stderr 报 `Cannot find package '@edu/education-host'` / `@edu/client-root`。
- 根因：`%LOCALAPPDATA%\SproutAsk\data\dsh-home\profiles\edu-web` 是 17:01 用 **C 盘旧安装**生成的，profile 的 `node_modules/@edu/*` junction 与 `package.json` 依赖都指向 `C:\...\SproutAsk\current`；该旧安装在当天清理孤儿副本时被删，链接悬空 → host 插件与 client root 都加载失败。（此前进程能跑是因为模块已加载进内存；一旦重启就白屏。）
- 处理：删掉旧 profile（备份在 `E:\DSH\tmp\cleanup-2026-11-05\stale-profiles`），重启桌面壳；壳检测到 profile 缺失后重跑 setup，链接指向 `E:\芽问\current`。实测 `statusHttp=200`、`statusBody.ok=true`、stderr 无异常，页面正常渲染（截图 `output/capture/sproutask-native-0.4.1.png`）。
- **待加固**（下一版）：桌面壳每次启动前校验 profile 链接是否指向当前安装，失效则重建；`status != 200` 时直接弹错误而不是继续导航白屏。



---

## 5. 界面重构 A+B（已拍板并完成）

**目标**：把"写给验收和 AI 看"的界面改成"学生能直接用"的界面；功能与数据契约不变。

**已确认的方向**

- A 期：设计 token、顶栏、文案减法、空态/按钮/窄屏等表现层。
- B 期：主旅程重排——今天 / 学习 / 进展 + 设置；教材库、地图降为二级但一次点击可达。
- 学习页：**一张摊开的学习台**（左页课本、右页练习，反馈原地展开，小芽改为右下浮起按钮）。
- 地图：**两级**——全册章节地图（单元→章→概念胶囊）+ 章级分层关系图（先学→再学→连起来），带列表等价视图。
- 文案：学生话，禁词自动扫描（`activity.*`、内容包、三轴、证据候选、回环、rem 等）。

**设计稿**：`output/uishot/mockups/`（临时目录，不入库；2026-11-05 清理时已删除；定稿截图归档到 `docs/images/ui/`）。
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
- 未做另一台干净机验证、未做学习效果实验——不声称提升理解或成绩。
- 图义视觉核对只完成抽样（8/73）；版次/印次/ISBN 行仍为 `unverified`。
- 当前界面只有 DOM 级断言，没有真实浏览器视觉走查（三档截图在 `docs/images/ui/`，但不是连续走查）。
- 学生包里裁掉了 LibreOffice、语音、PTY；`sharp` 随包（`--keep-sharp`，libvips LGPL-3.0）。
- 原生桌面壳需要 **WebView2 Runtime**（Windows 11 自带；Windows 10 多数已随 Edge 安装）。
- 强杀桌面壳（任务管理器）可能留下孤儿 node；当前只在关窗时 `taskkill /T /F`，Job Object 兜底未做。
- 0.4.1 安装后真实对话走查尚未完成（Key 已配置）。

---

## 7. 下一步（按顺序）

1. 用桌面的「SproutAsk」启动 0.4.1，跑一轮真实对话（提交作答 → 反馈 → 下一题）。
2. 按 `docs/optimize/04-manual-test.md` 做 15 分钟人工走查并收集反馈。
3. 桌面壳加固：启动自检并重建失效 profile；`status != 200` 时给错误提示而不是白窗；Job Object 清理兜底。
4. 视情况补：便携版 zip、0.4.1 Release 发布。
5. 补 live `activityId` 取下一题、self-report 持久化、进展页页码映射（需 host/契约变更，另行评估）。
6. 补功能前先决定下一轮范围（内容核对 / 界面反馈 / 教学对话）。

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
