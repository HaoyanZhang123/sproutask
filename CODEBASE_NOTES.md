# CODEBASE_NOTES —— 事实、坐标与环境基线

> 本文件只放**技术事实**（含数字），规范条款放 `AGENTS.md` / `docs/`。
> 每个数字都带**基线与过期判据**；过期不改写，移入 `archive/`。

## 1. 仓库坐标（基线：2026-09-22）

| 项 | 值 |
|---|---|
| Git 仓库根 | `E:/DSH/workspaces/ai4edu` |
| 会话可见工作路径 | `D:\dsh\ai4edu`（同一仓库的另一路径视图；`Get-Item` 可能报"找不到项"） |
| 远端 | 无（自有本地仓） |
| 跟踪文件数 | 51（M0 结束时，`git ls-files` 计数） |

**过期判据**：`git rev-parse --show-toplevel` 的输出与上表不符 → 本节过期。

## 2. 版本基线（基线日期：2026-09-22，`node -v` / `pnpm -v` / `python --version`）

| 工具 | 实测值 |
|---|---|
| Node | `v24.19.0` |
| pnpm | `11.21.0` |
| Python | `3.13.15` ⚠️ 同日另一次读到 `3.11.9` —— PATH 在多 shell 间不一致，**以现场实测为准** |
| Electron | `33.4.11`（`node_modules/electron/package.json`） |
| Vitest | `2.1.9`（测试输出） |
| 平台 | Windows（`pwsh`） |

**过期判据**：任一工具版本主号变化（如 pnpm 12、Node 26）→ 复测本节。

## 3. 常用命令坐标

| 目的 | 命令 |
|---|---|
| 跑应用 | `pnpm dev` |
| 终端对话 | `pnpm chat`（需 `.env` 的 `DEEPSEEK_API_KEY`） |
| 评测跑批 | `pnpm eval`（真实调用模型，产生费用） |
| 质量门 | `pnpm typecheck && pnpm test` |

## 4. 已知坑（均实测遇到并已解决）

| # | 现象 | 机制 | 处理 | 过期判据 |
|---|---|---|---|---|
| 1 | `ERR_PNPM_IGNORED_BUILDS: electron@…, esbuild@…` | pnpm 11 默认拦截依赖的构建脚本（供应链安全策略） | 白名单写在 `pnpm-workspace.yaml` 的 `allowBuilds`（**不是** `package.json` 的 `pnpm` 字段，后者已不被读取，会打印告警） | 若 pnpm 不再打印该错误或 `allowBuilds` 被拒 → 复测 |
| 2 | Electron 二进制下载失败（TCP 连接错误） | 默认从 GitHub Releases 拉取 | `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` 后 `cd node_modules/electron; node install.js` | `node_modules/electron/dist/electron.exe` 存在即已解决 |
| 3 | `.npmrc` 里 `electron_mirror=…` 报 `Unknown project config` | pnpm/npm 不再把任意配置键传给生命周期脚本 | 改用环境变量（见上）；`.npmrc` 保留仅作参考 | 若 pnpm 恢复支持该键 → 可简化 |
| 4 | `pnpm chat`/`pnpm eval` 报 `Top-level await is currently not supported with the "cjs" output format` | 仓库无 `"type": "module"`（Electron 主进程需 CJS 输出），tsx 按 CJS 转译脚本 | 脚本逻辑包进 `async function main()` 后 `void main()` | 若将来改为 ESM（`"type": "module"` + 调整 Electron 输出）→ 可恢复顶层 await |
| 5 | `vitest` 输出根路径为 `E:/DSH/workspaces/ai4edu` 而非 `D:\dsh\ai4edu` | 仓库根实际在 E:（见第 1 节） | 正常现象，不必修 | 同第 1 节 |

## 5. 提交身份（**存在漂移，待人工决定**）

| 身份 | 出现位置 |
|---|---|
| `张灏焱 <1814914856@qq.com>` | 仓库 `git config user.name/user.email`（当前配置） |
| `HaoyanZhang123 <1814914856@qq.com>` | 提交 `baca2cc`（docs: add AGENTS.md） |
| `BioBuddy Dev <dev@local>` | 提交 `fa77da4`、`082498e`、`3c91af6`、`042bd14`、`67a6b6a`、`d46934c`（M0/M1 期间由 agent 用 `git -c` 覆盖写入） |

**规范要求**：提交身份必须固定、不许漂移。**现状不符**。
规范化历史（重写 author）属破坏性操作，需人工授权；未授权前，新提交一律使用仓库配置身份。

**过期判据**：`git log --pretty=%an` 只出现单一名字 → 本节过期。

## 6. 未验证事项（诚实声明）

- DeepSeek 真实 API 调用**从未成功联调过**（本机无 `.env`）。`pnpm chat` 的联网路径、
  流式分片在真实报文下的形态、工具调用增量累积的正确性均**只有离线单测支撑**。
- 打包（`electron-builder`）从未实际执行过。
- 教材与课标内容工程（M2）尚未开始，当前 `scripts/demo-scope.ts` 用的是**自编占位文本**，
  不是真实教材原文。
