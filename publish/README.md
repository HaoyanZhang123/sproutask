# 公开发布（publish/）

> **内部工具，不上传**。用于把本仓库中"**只属于 BioBuddy 软件本身**"的部分导出成一个干净仓库。
> 决策依据见 `docs/adr/ADR-0005-公开范围与许可.md`。

## 一条命令

```powershell
pwsh publish/publish_github.ps1 `
  -TargetDir D:\dsh\biobuddy `
  -GitHubEmail "12345678+yourname@users.noreply.github.com" `
  -CopyrightHolder "your-handle" `
  -Force
```

需要你提供的两项（脚本会校验）：

| 参数 | 说明 |
|---|---|
| `-GitHubEmail` | **必须用 GitHub 的 noreply 邮箱**，否则公开后真实邮箱可见（脚本会警告） |
| `-CopyrightHolder` | LICENSE 里的版权持有人：真名或 GitHub 用户名，由你决定 |

脚本**不会**创建远端、**不会** push——出网与不可逆操作一律人工执行（见脚本末尾提示）。

## 会上传什么（白名单）

| 类别 | 内容 |
|---|---|
| 源码 | `src/`（主进程 / 预加载 / 渲染 / 纯领域核心） |
| 测试 | `tests/`、`evals/cases/` |
| 开发脚本 | `scripts/`（终端对话、评测跑批） |
| CI | `.github/workflows/ci.yml` |
| 构建配置 | `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`electron.vite.config.ts`、`electron-builder.yml`、`tsconfig*.json`、`vitest.config.ts`、`.npmrc`、`.gitattributes`、`.env.example` |
| 生成 | `README.md`、`LICENSE`(MIT)、`.gitignore`、`evals/README.md`（均取自 `publish/public/`，不含内部语境） |

## 绝不上传什么

| 排除项 | 原因 |
|---|---|
| `docs/`（含 `研习设计.md`、`研习材料/`、`specs/`、`adr/`、`tutorials/`） | 研究材料与内部文档 |
| `notes/` | 调研报告、学校信息、个人记录 |
| `TASKS.md`、`CODEBASE_NOTES.md`、`AGENTS.md` | 内部协作文件（含邮箱、内部路径） |
| `publish/`、`backend/`、`tools/`、`content/` | 内部工具与早期沙盒、教材工程（后续按需加白名单） |
| `.env` | 密钥 |

## 发布前检查清单

- [ ] **M3 完成**（Agent 循环 + 最小界面，本地能走完"选模式 → 对话 → 引用出处"）
- [ ] 主仓库质量门通过：`pnpm typecheck && pnpm test`
- [ ] 导出目录质量门通过（脚本已保证文件齐全，但仍需在导出目录实跑一次）
- [ ] 脚本的**安全扫描通过**（校名 / 邮箱 / 密钥 / 研究语境 / 内部路径）
- [ ] `-CopyrightHolder` 与 `-GitHubEmail` 是**你愿意公开**的
- [ ] 人工确认 LICENSE 持有人写法与仓库可见性

## 已验证（2026-09-22 实测）

- 导出 56 个文件；顶层只有软件相关文件与配置
- 导出目录内 `pnpm install --ignore-scripts` → `pnpm typecheck`（0 错）→ `pnpm test`（44/44 通过）
- 安全扫描通过；复扫无敏感内容
- `git init` + 单次提交成功，作者为指定的 noreply 邮箱，**不含现有历史**（现有历史里的个人信息不会被带出）
