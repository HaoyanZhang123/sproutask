# AGENTS.md

> 芽问 SproutAsk —— 运行在 DSH 内核上、本地优先的初中生物学习 Agent。
> 仓库只有一条产品线：`education/`。旧 Electron + Vue 线已归档到 `docs/history/`，**只读，不再开发**。
> 本文件只做**开工仪式 + 命令 + 质量门 + 红线 + 路由**，细节在 `docs/`，不在这里复制。

## 开工仪式（每次新会话必须做，顺序不能变）

1. **先读三份**：`docs/PROGRESS.md`（当前状态）+ `docs/ARCHITECTURE.md` + `docs/CONVENTIONS.md`。
   涉及教学、内容包、验收时再读 `docs/rebuild/` 对应的 01–10。
2. **用一段话向用户复述**："我理解的项目现状是……本次要做的是……"
3. **等用户确认**，确认后才动手。
4. 动手前先给**验收标准**（做完什么算完成），**再等确认**。
5. **一次只做一件事**；质量门全绿才能进下一件。
6. **会话结束前更新 `docs/PROGRESS.md`**（本次改了什么 / 怎么验证的 / 下一步）——没更新，这次会话不算结束。

## 命令（根目录是薄入口，全部转发到 education）

```powershell
pnpm --dir education install     # 只有 education 有依赖
pnpm dev                         # 本机 DSH web + Edge 应用窗口
pnpm build                       # 构建 host/client 插件（产物 runtime/*/lib 已提交）
pnpm build:win                   # 一条龙：插件 + 原生桌面壳 + payload + NSIS 安装包
pnpm typecheck                   # 全 workspace 类型检查
pnpm test                        # 全 workspace 单元测试
pnpm test:task T08               # 单个任务卡的检查
pnpm check:tracked               # education/ 下文件是否全部被 git 跟踪
pnpm content:validate            # 内容包校验
pnpm contract:lock:generate      # 契约变更后重建锁（与 verify 成对）
pnpm contract:lock:verify        # 公共契约锁校验
```

- 模型 Key 在应用内「设置」里配置（宿主侧加密保存），**不要写进 `.env`、不要打印、不要截图**。
- 本机教材原文在 `content/textbook/`（不进 git、不随包）；产品内容在 `education/content/biology-7a/`。

## 质量门（"完成"的定义）

| 改动类型 | 必须通过 |
|---|---|
| 任何改动 | `pnpm typecheck && pnpm test` 全绿，不带红测试进下一件事 |
| 新增/删除/移动文件 | 追加 `pnpm check:tracked`（防 `.gitignore` 误伤源文件） |
| 内容包 / 公共契约 | 追加 `pnpm content:validate && pnpm contract:lock:verify`；改契约后先 `pnpm contract:lock:generate` 并一起提交 |
| DSH 插件源码 | 追加 `pnpm build`，把 `runtime/*/lib` 的更新一起提交 |
| 界面 | 追加三档截图走查（1440×900 / 1280×800 / 1024×768）+ 学生文案禁词扫描 |

- 结论要**区分"实测"与"推断"**；没验证的必须明说，不允许拿"代码看起来对"冒充验证过。

## 未经用户明确同意，禁止

1. **新增依赖**（`education/package.json` 的 dependencies/devDependencies）。
2. **改公共契约**（`education/packages/domain`、`docs/rebuild/05-data-contracts.md`、契约锁）。
3. **改 DSH 安装 / 当前 GUI / 用户数据**（`E:\DSH-desktop` 下的安装只作只读参考）。
4. 做**教师端**（班级聚合、教师查看学生对话）或收集学生姓名等非必要信息。

## 红线

1. 密钥（`.env`、API Key）**不进 git、不进日志、不进截图**；已提交过 = 已泄漏 → 轮换。
2. **教材原文与课标原文不进 git、不随包、不进公开仓库**；仓库只放我们编写的结构与短引用。
3. **学生界面不出现内部标识与开发术语**：`activity.*` / `source.*` / `step-*`、内容包版本、三轴、证据候选、回环、rem、工具调用等一律不许出现在文案里；一律用学生话（详见 `docs/CONVENTIONS.md` 的 UI 规范）。
4. **不做教师端**；学生只用编号（`learner.local.*`），研习数据以问卷为主渠道。
5. **验证，而不是断言**：结论追到代码 / 命令输出 / 真实截图；没验证的诚实声明。
6. **一处进度**：进度只写 `docs/PROGRESS.md`；其他文档不要各写一份状态表。

## 路由

| 你要做什么 | 读哪里 |
|---|---|
| 当前状态、上次做了什么、下一步 | **`docs/PROGRESS.md`（唯一进度源）** |
| 架构、目录、分层、数据流 | `docs/ARCHITECTURE.md` |
| 写代码、命令、UI 规范、Git 流程 | `docs/CONVENTIONS.md` |
| 产品目标、用户流程、公共契约、验收 | `docs/rebuild/01`–`07`；任务卡在 `docs/rebuild/tasks/` |
| 自动调度与写入范围 | `docs/rebuild/08-execution.md` |
| 发布说明与调优记录 | `docs/releases/`、`docs/optimize/` |
| 设计稿与界面改造方案 | `docs/rebuild/11-ui-redesign.md`（界面重构期间有效） |
| 研习报告、理论依据、研究方法 | `docs/研习设计.md`、`docs/研习材料/` |
| 旧 Electron 线的历史 | `docs/history/`（只读） |

**整体开发规范**（全局规则与教材）在 `E:\DSH\整体开发规范\`，按需读其 `INDEX.md`。
