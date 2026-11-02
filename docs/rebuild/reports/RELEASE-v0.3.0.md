# v0.3.0 发布执行报告（RELEASE-v0.3.0）

> 执行者：发布子智能体（DSH）。时间：2026-10-31 02:55–03:15（Asia/Shanghai）。
> 方案：**白名单导出 → 独立仓库单次提交 → 推新分支 + tag**。默认分支 `main` 不参与，全程无 `--force`。
> 本文件在推送前定稿，因此只写与远端无关的事实（分支名、tag 名、导出清单、自检证据、命令与意图）。推送与 Release 的实际返回原文记在**内部仓库**同一路径文件的第 8 节，该节不随分支发布。

## 一、这次发布做了什么

| 项目 | 值 |
|---|---|
| 目标仓库 | `HaoyanZhang123/sproutask`（原仓库，公开） |
| 目标分支 | **`education-v0.3.0`**（新分支；`main` 保持 v0.2.0 白名单导出线，不被触碰） |
| tag | `v0.3.0`，指向该分支的唯一提交 |
| 历史 | 导出目录内 `git init` 新建仓库，**1 个 root commit**，不含本仓库任何既有历史与作者信息 |
| 提交身份 | `HaoyanZhang123 <195906259+HaoyanZhang123@users.noreply.github.com>`（GitHub noreply，不暴露真实邮箱） |
| 导出目录 | 工作区内 `education/.local/publish/v0.3.0`（`.local/` 被 `.gitignore` 排除，不进入任何会被提交的位置） |
| Release | `v0.3.0`，两个 Windows 产物（安装包 + 便携包），正文取自 `docs/releases/v0.3.0.md` |

## 二、导出清单（695 个文件 / 8,934,330 字节）

| 路径 | 文件数 | 说明 |
|---|---:|---|
| `README.md`、`README.zh.md` | 2 | 双语仓库首页，互链 |
| `docs/images/cover.png` | 1 | 2:1 抽象封面（1600×800，无虚构界面） |
| `docs/releases/v0.3.0.md` | 1 | 发布说明（完整中文段 + 完整英文段） |
| `docs/rebuild/reports/` | 3 | 仅 `T17-v2.md`（独立最终审计）、`FINAL-UPDATE-3-2026-10-31.md`（最新口径）、本文件 |
| `education/packages/` | 258 | 7 个领域包（domain / importer / knowledge / learner / storage / tutor / visuals）及其测试 |
| `education/client/` | 120 | 5 个界面包（shell / library / map / study / visuals） |
| `education/runtime/` | 36 | DSH host/client 插件与运行时装配 |
| `education/scripts/` | 20 | 质量门与跑批脚本 |
| `education/content/biology-7a/` | 36 | 内容包（JSON + 审校工具） |
| `education/licenses/` | 189 | 第三方许可清单与去重后的许可全文 |
| `education/probes/runtime/` | 16 | DSH 运行时探针 |
| `education/config/`、`education/skills/` | 7 | 命令契约与生物技能说明书 |
| 根配置 | 6 | `package.json`、`tsconfig.base.json`、`tsconfig.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.gitignore` |

> 导出的目录树保持仓库相对路径（`education/` 前缀 + 根 `docs/`），与 `README` 里的 `cd education` 一致；
> 这样 `education/scripts` 里基于"工作区/教育根"两级路径的脚本在原位仍然成立。

## 三、自检（4 项，全部 PASS）

| # | 检查 | 方法 | 结果 |
|---|---|---|---|
| 1 | 密钥 | 把 `education/.local/secrets/deepseek.key` **仅读入内存**（不写盘、不进命令行、不进日志），按字节级全文检索导出目录**全部 695 个文件**（含 PNG 等二进制） | **0 命中**；把搜索串截到前 12 字符再搜一次，仍 0 |
| 2 | 禁止类型 | 枚举全部文件扩展名 | `.pdf` / `.docx` / `.xlsx` / `.pptx` / `.env` 均 **0** |
| 3 | 禁止目录 | 导出脚本内置断言：任一路径段命中 `.local` / `dist` / `node_modules` / `.vite` / `.pnpm` / `.git` 即整批中止 | **0**，断言通过；`docs/` 下的研究材料目录不存在 |
| 4 | 数量 | 递归计数 | **695** ≤ 4000 |

补充扫描（方案未要求，为守住"不许上传内部资料"加做）：

| 规则 | 命中 | 处理 |
|---|---|---|
| `sk-[A-Za-z0-9]{16,}` | 0 | — |
| 机构名 / 校名 | 0 | — |
| 手机号 / 身份证号 | 0 | — |
| 项目成员个人邮箱 | 0 | `education/licenses/` 下第三方许可原文里的作者邮箱（gmail/qq 等）保留 —— 那是许可义务，与项目成员无关；项目自身文件零命中 |
| `E:\DSH…` 本机路径 | 4 处 | 3 处为 `education/` 源码注释与 `probes/runtime/README.md` 的说明文字（"不会触碰本机 DSH 目录"这类描述），1 处为本表自述；无凭据、无研究材料。因为 `education/**` 被内部 contract-lock 全量哈希，改写会破坏"分支源码与受测源码逐字节一致"，故保留并在此登记 |
| `docs/rebuild/…` 报告名 | 162 处 | `pack.json` 的 provenance 字段 132 处，其余为三份结论文档与两个脚本内的自引用；均属**路径字符串**，不含报告内容；同样是已发布内容包哈希的一部分，未改写 |
| 教材原文 / 页图 | 0 | 内容包只含定位数据（页码 / blockId / bbox / 文本指纹），`*.pdf` 与页图从未进入导出 |

## 四、被排除的东西（按排除表逐项核对）

`.local/`、`dist/`、`node_modules/`、任何 `*.pdf`（含工作区根的教材 PDF，40 MB）、`.env`、`docs/` 下的研究材料目录、`publish/`、旧线 `src/` `build/` `release/` `out/` `dev-dashboard/` `notes/` `evals/`、旧线 `tests/`、`content/textbook/`、`content/units/`、`tools/`、`TASKS.md`、`CODEBASE_NOTES.md`、`AGENTS.md`。

`AGENTS.md` 被排除而不是裁剪：它含内部路由、内部报告链接与本机规范路径，删改后已不剩对公开读者有用的内容。

## 五、发布命令（逐条，含"为什么"）

```powershell
# 1. 在导出目录内新建仓库（不复制任何既有 .git，避免带出内部历史）
git init
git config core.autocrlf false            # 按字节提交，防止 CRLF 归一化改写源码
git config user.name  "HaoyanZhang123"
git config user.email "195906259+HaoyanZhang123@users.noreply.github.com"

# 2. 单次提交 + 打 tag
git add -A
git commit -m "release: v0.3.0 (DSH education rebuild line)"
git tag v0.3.0

# 3. 只推新分支与 tag（不推 main、不加 --force）
git remote add origin https://github.com/HaoyanZhang123/sproutask.git
git push origin HEAD:refs/heads/education-v0.3.0
git push origin v0.3.0
```

为什么这样选：本工作区与远端**没有共同祖先**（远端 `main` 是另一条线的白名单导出，历史被重建过），直接推 `main` 会被拒或需要 `--force`；把新线放到独立分支 + 独立 root commit，既保住 `main` 的既有 3 个提交，也让这次发布**不可能**覆盖任何既有引用。

## 六、两条线的关系（给读者的一句话）

- `main`：v0.2.0 的 Electron 线（旧应用，白名单导出，MIT `LICENSE`）。本次**未推送、未改动**。
- `education-v0.3.0`：v0.3.0 的 DSH 内核重构线（本分支）。两条线**没有共同祖先**，不做 merge、不开 PR；分支之间以"独立发布"相处，不做 cherry-pick。
- 因此本分支不含 `LICENSE` 文件，`README` 的 License 一节写明"尚未声明"，并说明 `main` 上的 MIT 授权是否延伸到本分支尚未决定。

## 七、已知缺口（需人拍板，本次没有擅自处理）

1. **没有 LICENSE 文件**。`education/package.json` 仍是 `"license": "UNLICENSED"`，`README` 两种语言都写明"尚未声明"。若要把本分支也纳入 MIT，需要在根目录加 `LICENSE` 并同步改这两处文案。
2. **根目录没有 `.gitignore`**（不在白名单）。`education/.gitignore` 在，所以 `education/` 内忽略规则完整；但从仓库根跑 `pnpm install` 时根级 `node_modules` 不会自动被忽略。
3. **`education/tests/**`（29 个文件）与 `education/desktop/**`（4 个文件）不在白名单**，因此分支上 `pnpm test:integration`（集成/e2e 跑批）不可用；`pnpm test` / `pnpm typecheck` / `pnpm content:validate` 不依赖它们，仍可用。
4. **`education/licenses/NOTICE.md` 引用了内部证据路径**（生成器产物，文件头写明"请勿手改"）。手改会破坏"同一输入两次生成字节相同"的可重复性声明，故保留，在此登记。
5. **本文件是推送前的定稿版**：第 8 节的推送原文、commit/tag SHA 只记录在内部仓库的同一路径文件中，不在分支上。

## 八、结论

导出白名单 695 文件通过四项自检（密钥 0 命中、禁止类型 0、禁止目录 0、数量 695 ≤ 4000）；发布方式为"新分支 + 单次 root commit + tag"，不触碰 `main`、不使用 `--force`。上述七项缺口均已在 `README` 的 Known Limitations 或本节中如实登记，没有把未做到的说成做到。

## 九、后续修正（2026-10-31）

> 执行：发布子智能体（DSH），2026-10-31 03:10–03:17（Asia/Shanghai）。方式是**普通 follow-up**：临时克隆 `-b education-v0.3.0` → 只改下面 5 个文件 → 单次提交 → **普通 `git push`（无 `--force`，无 `--force-with-lease`）**。
> 结论：**FOLLOWUP_READY**。tag 与 Release 都没动。

### 9.1 结果

| 项目 | 值 |
|---|---|
| follow-up commit | `e003f3d04222a383097ef2e70eca2b3187c9e099`（父提交 `602e0e0`）|
| 提交信息 | `docs: align license text, add root .gitignore, sync release report` |
| 远端分支新 HEAD | `education-v0.3.0` = `e003f3d04222a383097ef2e70eca2b3187c9e099` |
| 推送原文 | `602e0e0..e003f3d  HEAD -> education-v0.3.0`（fast-forward；无 `+`、无 `forced update`）|
| 改动规模 | 5 个文件，+151 / −114 |
| 分支文件总数 | **725**（原 724 + 根 `.gitignore`）|
| tag `v0.3.0` | 未动，仍 → `602e0e0`（tag 对象 `efb4b6c8ad514dbebc0e56efe34c0935e8acb786`）|
| GitHub Release | **URL 不变**：<https://github.com/HaoyanZhang123/sproutask/releases/tag/v0.3.0>（两个资产 `state=uploaded`，未重传）|
| 远端 `main` | 未动，`89ebf89093e0a0adc01ea3fa743cb2d0ffde590b` |
| 临时克隆 | 已删除（删前 `Resolve-Path` 断言 = `E:\DSH\workspaces\ai4edu\education\.local\publish\followup` 且 `.git` 存在；删后 `Test-Path` = False）|

### 9.2 四项改动逐条

1. **README 许可证章节 → MIT**（`README.md` 与 `README.zh.md` 同改）：正文指向仓库根 `LICENSE`，写明 `MIT License, Copyright (c) 2026 HaoyanZhang123`，并说明 `education/package.json` 标注 `"license": "MIT"`、第三方依赖各自保留许可（原文在 `education/licenses/texts/`）。两版仍保持**同序**（`License` / `许可证` 都是最后一节）与**互链**（`README.zh.md` ↔ `README.md` 的顶部语言链接未动）。
2. **根 `.gitignore` 新增**：至少覆盖 `node_modules/`、`education/.local/`、`education/dist/`、`*.pdf`、`.env`、`*.log`；另加 `education/coverage/`、`*.tsbuildinfo`、`.env.local`、`.env.*.local`、`.vscode/*`、`.idea/`、`.DS_Store`、`Thumbs.db`。
3. **`education/package.json`：`"license": "UNLICENSED"` → `"MIT"`**（**只改分支副本**；工作区内部仓库仍是 `UNLICENSED`，见 9.3）。
4. **分支报告同步**：分支上那份 `RELEASE_BLOCKED`（8,034 B）被替换为含 `PUBLISH_READY` 结论的终版（12,035 B）。

### 9.3 两处必须由主控拍板的口径问题

**（a）本文件 §1–§8 已被现实超越。** 本节之前是"推送前定稿版"（695 文件、导出目录 `git init`、`本分支不含 LICENSE`）。实际发布走的是"临时克隆 + 孤儿分支"（724 文件，root commit `602e0e0`）。自 `e003f3d` 起，分支根目录**有** MIT `LICENSE`，`education/package.json` 为 MIT，`education/tests/**` 与 `education/desktop/**` 也确实在分支上。因此 §2 的 695 文件、§6 最后一条、§7 第 1–3 条、§8 的 695 文件结论**均已过期**；现行事实以本节为准，我没有去改上面的正文（避免与并发写入者互相覆盖）。

**（b）报告的"详细版/脱敏版"分工现在是反的。** 我 03:13 推上分支的是 12,035 B 的 `PUBLISH_READY` 详细版（含推送原文、内部路径）；03:14–03:15 另一个进程把工作区这份改写成 8,543 B 的脱敏版（并刷新了 `education/.local/publish/v0.3.0/`、新增 `verify-export.ps1`）。也就是说：**公开分支拿到的是详细版，内部工作区留下的是脱敏版**，与本节之前文档自称的分工相反。若要纠正，两条路都只需普通 push：
- 把脱敏版推上分支替换 `e003f3d` 中的详细版（公开面更干净，但脱敏版含 695 文件、`git init`、"无 LICENSE" 等过期表述，推之前应先按 9.2 更新）；
- 或把详细版取回工作区（`git show e003f3d:docs/rebuild/reports/RELEASE-v0.3.0.md`）作为内部记录，分支保留脱敏版。

### 9.4 自检证据（提交前，针对暂存区）

```
$ git diff --cached --name-only
.gitignore
README.md
README.zh.md
docs/rebuild/reports/RELEASE-v0.3.0.md
education/package.json                       → 5 条，与预期完全一致

$ ... | Select-String '\.env|\.pdf|\.docx|\.local|dist/|node_modules|研习材料'
（无输出）→ PASS: 0 hits（无未跟踪残留：`git status --short` 无 `??`）

$ git grep --cached -F -f <education/.local/secrets/deepseek.key>
exit=1 → PASS: 0 matches（pattern 由 -f 从密钥文件读取，密钥未进命令行、未进日志）

$ git diff --cached | Select-String 'sk-[A-Za-z0-9]{10,}|DEEPSEEK_API_KEY\s*=\s*\S+|gho_[A-Za-z0-9]{10,}'
（无输出）→ PASS: 0 hits
```

推送后核验（`git fetch` + `git ls-tree`，非仅看 `gh api`）：远端 `education-v0.3.0` 根有 `.gitignore`、`LICENSE`、`README.md`、`README.zh.md`、`docs/`、`education/`；5 个改动文件的 blob 与本地提交逐一相等；远端全树 725 个文件，禁止路径匹配 **0**。

### 9.5 仍开着的事

- 分支报告含内部信息（工作区绝对路径、`main` 线诊断、"哪些类别不该上传"的清单）。按用户给的白名单它已公开；是否回收属内容决定，未擅自处理。
- 工作区内部仓库的 README 仍是"尚未声明许可证 / 保留所有权利"的旧口径，`education/package.json` 仍是 `UNLICENSED`。这是**按指示有意保留**的差异，代价是每次从工作区导出都要重新套用 9.2 的文案改动。

