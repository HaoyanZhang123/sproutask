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
| 构建配置 | `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`electron.vite.config.ts`、`electron-builder.yml`、`tsconfig*.json`、`vitest.config.ts`、`.npmrc`、`.gitattributes`、`.env.example` |
| **架构文档** | `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`（**手工裁剪的公开版**）、`docs/adr/ADR-0001~0004` + `docs/adr/README.md` |
| 生成文件 | `README.md`、`LICENSE`(MIT)、`.gitignore`（取自 `publish/public/`） |

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
2. **ADR**：从内部 ADR **派生并按下表显式替换**（规则写在脚本 `$adrRewrites`，可审计）：

| 内部表述 | 公开版替换为 |
|---|---|
| 研习数据以问卷为主渠道（M6） | 学习数据的本地留存与匿名化导出（M6） |
| 研习对比实验 | 教学对比实验 |
| 研习数据 | 学习数据 |
| 研习 | 教学研究 |
| `` `notes/reference/markdown-reader-flutter-借鉴.md`「教材就是 Markdown」一节 —— 该项目的折叠块 `` | 参考项目分析（不随本仓库分发）：该项目的折叠块 |

**新增替换规则时，请同步更新本表**（规则与文档同一落点）。

## 防漂移检查

脚本会比较 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md` 与公开版的**修改时间**：
内部比公开版新 → 默认中止并提示（`-AllowStale` 可强制）。**改了内部文档请同步更新公开版。**

## 发布前检查清单

- [ ] **M3 完成**（Agent 循环 + 最小对话界面，本地能走完"选模式 → 对话 → 引用出处"）
- [ ] 主仓库质量门：`pnpm typecheck && pnpm test`
- [ ] 导出目录质量门（在导出目录实跑一次 `pnpm install --ignore-scripts && pnpm typecheck && pnpm test`）
- [ ] 安全扫描通过（校名 / 邮箱 / 密钥 / 研究语境 / 内部路径）
- [ ] 防漂移检查通过
- [ ] 人工确认 LICENSE 持有人写法与仓库可见性

## 已验证（2026-09-22 实测）

- 导出 **63 个文件**；顶层只有软件文件、配置与 `docs/`
- 导出目录内 `pnpm install --ignore-scripts` → `pnpm typecheck`（0 错）→ `pnpm test`（44/44 通过）
- 安全扫描通过；复扫无敏感内容；ADR 清洗 4 份中 2 份发生替换
- `git init` + 单次提交成功，作者为指定的 noreply 邮箱，**不含现有历史**
