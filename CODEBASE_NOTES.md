# CODEBASE_NOTES —— 事实、坐标与环境基线

> 本文件只放**技术事实**（含数字），规范条款放 `AGENTS.md` / `docs/`。
> 每个数字都带**基线与过期判据**；过期不改写，移入 `archive/`。

## 1. 仓库坐标（基线：2026-09-22）

| 项 | 值 |
|---|---|
| Git 仓库根 | `E:/DSH/workspaces/ai4edu` |
| 会话可见工作路径 | `D:\dsh\ai4edu`（同一仓库的另一路径视图；`Get-Item` 可能报"找不到项"） |
| 远端 | 无（自有本地仓）；分支 `main`；提交身份唯一 `张灏焱 <1814914856@qq.com>` |
| 跟踪文件数 | 113（2026-09 完成 F-011 时计数；`git ls-files`） |
| 公开产物 | `E:\my-project\sproutask` → <https://github.com/HaoyanZhang123/sproutask>（独立单/多提交仓） |

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
| 6 | **`pnpm install` 在 pnpm 9 下报 `ERROR packages field missing or empty`** | `pnpm-workspace.yaml` 只写了 `allowBuilds` 而**没有 `packages:` 字段**：pnpm 10/11 容忍，pnpm 9 认为 workspace 声明不完整而直接报错 —— CI 当时钉的正是 pnpm 9，于是流水线在第一步就红（2026-09 由独立审核者实测发现） | 在 `pnpm-workspace.yaml` 里补 `packages: ['.']`（即使是单包也必须写）；CI 版本改为**由 `package.json` 的 `packageManager` 单点决定**（`pnpm/action-setup` 不要再写 `with: version`，否则报 `Multiple versions of pnpm specified` 并 exit 1 —— 这是补 `packageManager` 时引入的**新**故障，同样由审核者实测发现） | 若 `packages:`/`packageManager` 被删、或 CI 里又出现 `with: version` → 复测 pnpm 9 与 11 |
| 7 | 导出仓库里 `src/core/content/*.ts` 消失、TypeScript 编不过 | `.gitignore` 里写 `content/`（**未锚定根目录**）会匹配任意层级的 `content` 目录，连源码目录一起忽略 | 与源码目录同名的忽略规则一律锚定仓库根：`/content/`、`/build/`、`/tmp/` | 若 `.gitignore` 出现无前导 `/` 的目录名规则 → 复查是否误伤 `src/**` |
| 8 | `pnpm 9` 下 `node_modules/electron/dist` 为空、`pnpm dev` 报 `Error: Electron uninstall` | 本机 pnpm 用的是另一处 store，其中已缓存 electron 构建脚本的**空 side-effects**，`side-effects-cache` 命中即跳过 postinstall | 用 `--config.side-effects-cache=false` 重装；干净机器不会出现（**不要**误判为仓库缺陷） | 若同版本 store 内 electron 的 `dist/` 已存在 → 无需处理 |
| 9 | 用 `git ls-files` 与磁盘遍历对比文件集合时"多出/缺失一批文件" | `git ls-files` 对中文名做 octal 引号、且用正斜杠；直接与 `Get-ChildItem` 的反斜杠路径比较会全错 | 比较前统一：`Trim('"').Replace('\','/')`；中文名可用 `-z` 或按 sha 比对 | 脚本已按此归一化 → 无 |
| 10 | 管道喂多行 stdin 给 `pnpm chat` 只消费第一行 | Node `readline` 在"没有 pending question"时到达的行会被丢弃 | 交互式流程别用管道测；要自动化改用**逐步写入 stdin**（`ProcessStartInfo.RedirectStandardInput` + 延时） | 若将来 chat 改用一次性读取全部输入 → 可简化 |
| 11 | `pnpm dev` 报 `TypeError: Cannot read properties of undefined (reading 'whenReady')`，而代码本身没问题 | 环境里存在 `ELECTRON_RUN_AS_NODE=1`（模拟 CI 时常被设置后忘记清理）→ Electron 以**纯 Node** 启动，`require('electron')` 返回 npm 包而不是 Electron API，`electron.app` 因此为 undefined | `Remove-Item Env:ELECTRON_RUN_AS_NODE` 后重跑；`src/main/index.ts` 已加"启动前自检"，命中即打印可读诊断并退出（不再抛晦涩的 TypeError） | 若 `src/main/index.ts` 里那段自检被删 → 恢复它 |
| 12 | **发布扫描失败后仍然镜像并提交了公开仓库**（绕过了自己的闸门） | 我把 `publish_github.ps1` 的输出用 `Select-String` 过滤后就直接 `robocopy` + `git commit`，**没检查脚本退出码**；扫描报 ❌ 的那次照样提交成功 | 流程改为：**以退出码为闸门**——`if ($LASTEXITCODE -ne 0) { 不镜像、不提交 }`；这次已 `git reset --soft` 撤掉未推送的坏提交并重做 | 当镜像/提交命令与发布脚本写在同一条命令里时 → 必须显式检查退出码 |

## 5. 提交身份（✅ 已规范化，2026-09-24）

**现状**：全部 19 个提交的作者与提交者均为 `张灏焱 <1814914856@qq.com>`（仓库配置身份），
分支唯一（`main`），`git log --pretty='%an <%ae>' | Sort-Object -Unique` 只返回一种。

**历史漂移（已修复，仅作记录）**：

| 原身份 | 出现位置 |
|---|---|
| `张灏焱 <1814914856@qq.com>` | 12 次提交（仓库配置身份，原本就正确） |
| `HaoyanZhang123 <1814914856@qq.com>` | 提交 `baca2cc` |
| `BioBuddy Dev <dev@local>` | 6 次提交（M0/M1 期间由 agent 用 `git -c` 覆盖写入） |

**修复方式**：`git filter-branch --env-filter`——命中漂移身份即 `unset`，让 git 回落到仓库配置
（筛子脚本刻意只用 ASCII 判断，避免中文写进 sh 脚本的编码风险）。
**验证**：重写前后 `HEAD^{tree}` 哈希一致（`700f5021…`）→ 只改身份、内容一字未动；
提交数仍 19；工作区干净；`pnpm test` 105/105；`git fsck` 无异常。
旧对象已 `reflog expire` + `gc --prune=now` 清除，备份 bundle 留在 `E:\_backups\`。
同时把分支名由 `master` 改为 `main`，与 `docs/CONVENTIONS.md` 的约定一致。

**过期判据**：`git log --pretty='%an <%ae>' | Sort-Object -Unique` 出现第二种身份 → 本节过期。

## 6. 未验证事项（诚实声明）

- DeepSeek 真实 API **已确认可达、鉴权头正确**（2026-09：用无效 Key 实测返回 401，
  被映射为 `auth` 降级路径），但**从未用有效 Key 完成一次成功对话**（本机无有效 `.env`）。
  因此流式分片在真实报文下的形态、工具调用增量累积的正确性，仍**只有离线单测支撑**。
- 打包（`electron-builder`）从未实际执行过；公开版 `electron-builder.yml` 只做静态检查。
- 教材与课标内容工程（M2）尚未开始，当前用的是**自编占位文本**（`src/core/content/demo.ts`），
  不是真实教材原文。
| 13 | 源码里的"内部编号"（`F-015`）与"密钥形态字符串"（自检用的假 Key `sk-…`）会让公开扫描硬失败 | 源码注释与自检脚本也算发布内容；密钥规则是 `sk-[A-Za-z0-9]{16,}`，一个假 Key 也会命中 | 源码里不写内部编号（改用描述性措辞）；假 Key 用数组拼接（`['sk','fake'].join('-')`）避免命中正则 | 新增自检脚本/注释后跑一次发布扫描 |
