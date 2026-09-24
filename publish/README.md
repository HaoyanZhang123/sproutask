# 公开发布（publish/）

> **内部工具，不上传**。用于把本仓库中"**属于 芽问 软件本身**"的部分导出成一个干净仓库。
> 决策依据见 `docs/adr/ADR-0005-公开范围与许可.md`。

## 一条命令（可直接复制）

```powershell
pwsh publish/publish_github.ps1 `
  -TargetDir E:\my-project\sproutask `
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

## 安全扫描（多轮独立审核后逐层加固）

扫描**不是**只匹配第一轮命中过的那几个词，而是五个维度都过一遍（命中即中止）：

| 维度 | 做法 | 为什么需要 |
|---|---|---|
| ① 范围 | **黑名单**：默认扫全部文件（含隐藏文件、无扩展名文件、`.vue`），只排除 `node_modules/`、`.git/` | 旧版用扩展名**白名单**却**漏了 `.vue`**，`App.vue` 里的内部引用从未被扫到 |
| ② 文件名 | 相对路径也参与所有规则匹配 | 只看内容的话，`三帆中学-研习记录.md` 这类**把 PII 写进文件名**的情况会被静默放行 |
| ③ 二进制 | 一旦出现二进制文件**直接判失败**（不去扫内容） | 白名单从不复制二进制，出现即说明出了问题；而截图/PDF 的 EXIF 本来也扫不到 |
| ④ 内容 | 规则做了**泛化**：机构词（中学/学院/大学/师范…）、手机号、身份证号、通用邮箱、各盘符本机路径（`C:\Users`、`E:\DSH`、`D:\dsh`、`/Users/`）、内部编号 | 只列"第一轮命中过的串"能防旧泄漏复发，**防不住新泄漏引入** |
| ⑤ lockfile | `pnpm-lock.yaml` **在发布范围内**，因此纳入检查：跑 always 级规则 + 校验依赖来源只允许公共 npm registry、禁止 `file:./`/`link:`/`git+ssh`/`localhost` 与本机路径 | lockfile 恰是私有 registry、本地路径最易夹带之处，而它又是要发布的文件 |

> 少数规则标注 `Scope = text`（宽泛邮箱、手机号、内部编号）：它们在 lockfile 的 base64
> 完整性串里会产生假阳性，故只作用于文本文件，lockfile 由 ⑤ 兜底。
> **这几条边界是独立审核员用对抗探针测出来的**，不是作者想当然。

## 防漂移检查

脚本会比较 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md` 与公开版的**修改时间**：
内部比公开版新 → 默认中止并提示（`-AllowStale` 可强制）。**改了内部文档请同步更新公开版。**

## 发布前检查清单

- [ ] 主仓库质量门：`pnpm typecheck && pnpm test`
- [ ] 导出目录质量门：`pnpm install --frozen-lockfile && pnpm typecheck && pnpm test`
- [ ] **用 CI 当前版本再装一次**（`.github/workflows/ci.yml` 与 `package.json` 的 `packageManager` 已对齐 pnpm 11；
      另用 **pnpm 9** 做一次回归——旧 CI 用 9，曾因 `pnpm-workspace.yaml` 缺 `packages:` 而必然失败）
- [ ] 导出目录内跑一次界面自检：`$env:SPROUTASK_SELFTEST="1"; pnpm dev`（**有 Key / 无 Key 两种环境都要通过**）
- [ ] 安全扫描通过（五个维度见上）
- [ ] 防漂移检查通过
- [ ] 独立审核（派**不知情**的审核者按"隐私 / 内部信息 / 可运行性"三个视角各审一遍）
- [ ] 人工确认 LICENSE 持有人写法与仓库可见性

## 已验证（2026-09 实测）

**产物规模**：导出 **77 个文件**；`git ls-files` 与磁盘文件集合**完全一致**（曾因 `.gitignore` 未锚定而丢过 2 个源文件，见下）。

**质量门（均在导出目录的临时副本中实测）**

| 验证 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile`（pnpm 11.21.0，与 `packageManager` 一致） | 0 |
| `pnpm install --frozen-lockfile`（**pnpm 9.15.9**，CI 曾用版本，回归） | 0（修复前为 `ERROR packages field missing or empty`） |
| `pnpm typecheck` | 0 错 |
| `pnpm test` | **105/105 通过**（9 个文件） |
| 界面自检（无 Key） | **17/17 通过** |
| 界面自检（有 Key，无效 Key 走 401） | **17/17 通过**（修复前此环境必然失败） |
| 安全扫描（正常产物） | 通过 |
| **安全扫描（对抗探针）** | 在"假内部仓库"里注入 4 类违规 → **全部拦下**：文件名 PII（`src\三帆中学-研习记录.md`）、二进制（`src\screenshot.png`）、泛化 PII（校名/手机号/身份证/`C:\Users`/通用邮箱）、lockfile 内网 registry（`npm.internal.corp`） |
| 防漂移检查 | 通过 |
| git | 单次提交，作者为指定 noreply 邮箱，**不含现有历史** |

**独立审核（两轮，均由不知情的审核者独立取证）**

| 轮次 | 视角 | 判决 | 关键发现 |
|---|---|---|---|
| 第一轮 | 隐私与身份 | 可安全公开 | 无 PII；指出扫描器盲区（`.vue` 未扫描） |
| 第一轮 | 凭据与内部信息 | 有风险 → 已清理 | 凭据全净；36 处内部编号残留、README 过度宣称 |
| 第一轮 | 可运行性 | **有阻塞问题** | ① CI 因 pnpm 9 + 缺 `packages:` 必然失败 ② 自检在配好 Key 的环境必然失败 |
| 第二轮 | 隐私与扫描器 | 内容可公开；**闸门仍有 4 处洞** | 只看内容不看文件名、lockfile 被排除却发布、二进制被跳过、PII 规则未泛化；`.gitignore` 丢了内容规则 |
| 第二轮 | 文档自洽性 | **需修订** | 多处"未实现写成已实现"、首屏语病「加严重生成」、ADR 指代失去先行词、概念性内部残留（需求号/spec） |
| 第二轮 | 可运行性 | **仍有阻塞** | ① CI 改在更早的 action-setup 步骤就红（`version: 11` 与 `packageManager` 冲突）② 分层把关漏模板字符串写法 |

> 三轮审核者都**没有**被告知"已经自检过"，各自独立取证。他们找到的问题（CI 两次必挂、
> 自检与 README 互斥、扫描器四处盲区、`.gitignore` 误伤源码）**全部是作者自检没覆盖到的**——
> 这就是"独立审核"的价值，也是为什么每次修完都要再让人审一遍。

## 踩过的坑（留给以后）

| 坑 | 症状 | 修法 |
|---|---|---|
| 扫描白名单漏扩展名 | `.vue` 里的内部引用漏网 | 改成黑名单：默认全扫 |
| 只看内容不看文件名 | `三帆中学-…md` 这类文件名静默通过 | 相对路径也参与匹配 |
| 二进制被"跳过扫描" | 截图/PDF 的 EXIF 扫不到，且它本就在发布范围 | 出现二进制即判失败 |
| lockfile 被排除却要发布 | 私有 registry / 本地路径夹带的通道 | 纳入扫描 + 校验依赖来源 |
| PII 规则只列"上轮命中串" | 能防复发，防不住新泄漏 | 规则泛化（机构/手机/身份证/邮箱/各盘符） |
| `.gitignore` 写 `content/` 未锚定 | 连 `src/core/content/` 一起忽略 → 导出缺源码、编不过 | 与源码目录同名的规则一律写 `/content/` |
| `pnpm/action-setup` 写 `with: version` 且 `packageManager` 为完整版本 | CI 在 action 步骤报 `Multiple versions of pnpm specified` | 删掉 `with: version`，让 action 读 `packageManager` |
