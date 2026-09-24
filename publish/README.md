# 公开发布（publish/）

> **内部工具，不上传**。用于把本仓库中"**属于 BioBuddy 软件本身**"的部分导出成一个干净仓库。
> 决策依据见 `docs/adr/ADR-0005-公开范围与许可.md`。

## 一条命令（可直接复制）

```powershell
pwsh publish/publish_github.ps1 `
  -TargetDir D:\dsh\biobuddy `
  -GitHubEmail "195906259+HaoyanZhang123@users.noreply.github.com" `
  -GitHubName "HaoyanZhang123" `
  -CopyrightHolder "HaoyanZhang123" `
  -Force
```

| 参数 | 当前取值与说明 |
|---|---|
| `-GitHubEmail` | `195906259+HaoyanZhang123@users.noreply.github.com`（GitHub noreply，不暴露真实邮箱） |
| `-GitHubName` | `HaoyanZhang123`（提交与 `package.json` 的 author） |
| `-CopyrightHolder` | `HaoyanZhang123`；若想用真名可改为 `张灏焱`（主页已公开显示该名） |
| `-AllowStale` | 仅在明确知道公开版文档落后但仍要发布时使用 |

脚本**不会**创建远端、**不会** push——出网与不可逆操作一律人工执行（见脚本末尾提示）。

## 会上传什么

| 类别 | 内容 |
|---|---|
| 源码 | `src/`（主进程 / 预加载 / 渲染 / 纯领域核心） |
| 测试与评测 | `tests/`、`evals/cases/`（+ 公开版 `evals/README.md`） |
| 开发脚本 | `scripts/`（终端对话、评测跑批） |
| CI | `.github/workflows/ci.yml` |
| 构建配置 | `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`electron.vite.config.ts`、`tsconfig*.json`、`vitest.config.ts`、`.npmrc`、`.gitattributes`、`.env.example` |
| **架构文档** | `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`（**手工裁剪的公开版**）、`docs/adr/ADR-0001~0004` + `docs/adr/README.md` |
| **生成文件** | `README.md`、`LICENSE`(MIT)、`.gitignore`、`evals/README.md`、**`electron-builder.yml`（公开版）**（均取自 `publish/public/`） |

> `electron-builder.yml` 不直接复制内部版：内部版含 `build/` 资源目录与 `content/`（教材随包分发）
> 指向，这两者都不随仓库分发，直接复制会让打包报错或产物残缺。

## 绝不上传什么

| 排除项 | 原因 |
|---|---|
| `docs/研习设计.md`、`docs/研习材料/`（含 .docx） | 研究材料 |
| `docs/ROADMAP.md`、`docs/specs/`、`docs/tutorials/` | 内部项目管理与教学材料 |
| `docs/adr/ADR-0005`（公开范围与许可） | 描述内部分仓策略 |
| `notes/` | 调研报告、学校信息、个人记录 |
| `TASKS.md`、`CODEBASE_NOTES.md`、`AGENTS.md` | 内部协作文件（含邮箱、内部路径） |
| `publish/`、`backend/`、`tools/`、`content/` | 内部工具与早期沙盒、教材工程 |
| `.env` | 密钥 |

## 文档怎么处理（两层机制）

1. **架构与规范**：`publish/public/docs/` 下是**手工裁剪的公开版**——内容是真架构，
   但移除了与研究组织相关的段落（如"问卷与数据收集"整节、`notes/` 目录说明），
   并且描述的是**公开仓库**的布局。
2. **ADR**：从内部 ADR **派生并按下表显式替换**（规则写在脚本 `$adrRewrites`，可审计）。
   顺序敏感：长句/具体表述在前，泛化规则在后。

| 内部表述 | 公开版替换为 |
|---|---|
| 研习对比实验 | 教学对比实验 |
| 研习数据 | 学习数据 |
| 研习 | 教学研究 |
| `` `notes/reference/markdown-reader-flutter-借鉴.md`「教材就是 Markdown」一节 —— 该项目的折叠块 `` | 同类开源阅读器项目的实践：该项目的折叠块 |

> **编号（`F-0NN` / `M#` / `Q#`）不靠替换，而是让内部 ADR 本身就不带编号**——
> 替换表对编号很脆弱（句子会读不通），不如从源头写清。

**新增替换规则时，请同步更新本表**（规则与文档同一落点）。

## 安全扫描（2026-09 加固）

**扫描范围用黑名单，不用白名单**：默认扫描目标目录下**所有**文件（含隐藏文件与无扩展名文件），
只排除 `node_modules/`、`.git/`、`pnpm-lock.yaml` 与已知二进制扩展名。

> 教训：旧版用扩展名**白名单**（`.ts/.md/.json/...`）却**漏了 `.vue`**，
> 于是 `App.vue` 里的内部引用（`docs/specs/F-009`）从未被扫描就发布出去了。
> 漏一个扩展名 = 闸门有洞，所以改成"默认全扫"。

禁止出现的模式（命中即中止）：校名/学区、个人邮箱、他人姓名、密钥、
研究语境（研习/问卷/知情同意…）、内部路径（`docs/specs`、`TASKS.md`、`notes/`、本机盘符…）、
**内部编号（`F-\d{3}`、`M0-M6`、`Q1-Q9`）**。

## 防漂移检查

脚本会比较 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md` 与公开版的**修改时间**：
内部比公开版新 → 默认中止并提示（`-AllowStale` 可强制）。**改了内部文档请同步更新公开版。**

## 发布前检查清单

- [ ] 主仓库质量门：`pnpm typecheck && pnpm test`
- [ ] 导出目录质量门：`pnpm install --frozen-lockfile && pnpm typecheck && pnpm test`
- [ ] **用 CI 同款 pnpm 版本再装一次**（pnpm 9 与 11 行为不同，见下）
- [ ] 导出目录内跑一次界面自检：`$env:BIOBUDDY_SELFTEST="1"; pnpm dev`（**有 Key / 无 Key 两种环境都要通过**）
- [ ] 安全扫描通过（含 `.vue` 与无扩展名文件在扫描范围内）
- [ ] 防漂移检查通过
- [ ] 独立审核（建议派不知情的审核者按"隐私 / 内部信息 / 可运行性"三个视角各审一遍）
- [ ] 人工确认 LICENSE 持有人写法与仓库可见性

## 已验证（2026-09 实测）

**产物规模**：导出 **77 个文件**；顶层只有软件文件、配置与 `docs/`（无二进制、无 `.env`）。

**质量门（均在导出目录的临时副本中实测）**

| 验证 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile`（pnpm 11.21.0） | 退出码 0 |
| `pnpm install --frozen-lockfile`（**pnpm 9.15.9，CI 同款**） | 退出码 0（修复前为 `ERROR packages field missing or empty`） |
| `pnpm typecheck` | 0 错 |
| `pnpm test` | **99/99 通过**（9 个文件） |
| `pnpm build` | 三入口产物齐（`out/main`、`out/preload`、`out/renderer`） |
| 界面自检（无 Key 环境） | **17/17 通过**，输出截图 |
| 界面自检（有 Key 环境） | **17/17 通过**（修复前此环境必然失败） |
| 安全扫描 | 通过（扫描 76 个文件，含 `.vue` 与无扩展名文件） |
| 防漂移检查 | 通过 |
| git | 单次提交，作者为指定 noreply 邮箱，**不含现有历史** |

**独立审核（两轮，均由不知情的审核者独立取证）**

| 轮次 | 视角 | 判决 | 关键发现 |
|---|---|---|---|
| 第一轮 | 隐私与身份 | 可安全公开 | 无 PII；但指出扫描器盲区（`.vue` 未扫描） |
| 第一轮 | 凭据与内部信息 | 有风险 → 已清理 | 凭据全净；36 处内部编号残留、README 过度宣称 |
| 第一轮 | 可运行性 | **有阻塞问题** | ① CI 因 pnpm 9 + 缺 `packages:` 必然失败 ② 自检在配好 Key 的环境必然失败 |
| 第二轮 | 隐私 / 文档 / 可运行性 | 见 `TASKS.md` 的 F-017 记录 | 复核上述修复 |

> 第一轮的三位审核者都**没有**被告知"已经自检过"，各自独立取证；
> 他们找到的两个阻断项是作者自检没覆盖到的——这正是"独立审核"的价值。
