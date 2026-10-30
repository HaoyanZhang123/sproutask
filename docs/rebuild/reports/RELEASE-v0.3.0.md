# v0.3.0 源码发布报告（RELEASE-v0.3.0）

> 时间：2026-10-31（Asia/Shanghai）。
> 结论：**发布成功** —— 单次 root commit 的新分支、annotated tag 与 GitHub Release（含两个 Windows 产物）均已上线；默认分支 `main` 未被触碰；全程未使用 `--force`。
> 本文件是**对外版本**：不含个人邮箱与本机绝对路径，也不含只对内部有意义的操作细节。

## 一、结果摘要

| 项目 | 结果 |
|---|---|
| 目标仓库 | `HaoyanZhang123/sproutask`（公开） |
| 分支 | `education-v0.3.0` |
| 历史 | **1 个 root commit**（发布快照），不带入任何既有历史 |
| tag | `v0.3.0`（annotated tag），指向该提交 |
| 提交身份 | GitHub noreply 身份（不暴露个人邮箱） |
| GitHub Release | <https://github.com/HaoyanZhang123/sproutask/releases/tag/v0.3.0> |
| Release 正文 | 本仓库 `docs/releases/v0.3.0.md`（完整中文段 + 完整英文段） |
| 发布文件数 | **697**（≤ 4000） |
| 默认分支 `main` | `89ebf89093e0a0adc01ea3fa743cb2d0ffde590b`（未被改动） |
| 许可证 | MIT（根 `LICENSE` 与 `education/package.json` 口径一致） |

## 二、发布内容构成（697 个文件）

| 路径 | 文件数 | 说明 |
|---|---:|---|
| `README.md`、`README.zh.md` | 2 | 双语仓库首页，互链；含已知限制与许可证说明 |
| `LICENSE` | 1 | MIT 许可证全文 |
| `.gitignore` | 1 | 仓库根忽略规则（依赖、构建产物、教材 PDF、`.env`、日志） |
| `docs/images/cover.png` | 1 | 2:1 抽象封面（1600×800，设计示意图，不是产品截图） |
| `docs/releases/v0.3.0.md` | 1 | 发布说明（Release 正文来源） |
| `docs/rebuild/reports/` | 3 | 独立最终审计、最新交付口径、本报告 |
| `education/packages/` | 258 | 7 个领域包（domain / importer / knowledge / learner / storage / tutor / visuals）及其测试 |
| `education/client/` | 120 | 5 个界面包（shell / library / map / study / visuals） |
| `education/runtime/` | 36 | DSH host/client 插件与运行时装配 |
| `education/scripts/` | 20 | 质量门与跑批脚本 |
| `education/content/biology-7a/` | 36 | 内容包（JSON + 审校工具） |
| `education/licenses/` | 189 | 第三方许可清单与去重后的许可全文 |
| `education/probes/runtime/` | 16 | DSH 运行时探针 |
| `education/config/`、`education/skills/` | 7 | 命令契约与生物技能说明书 |
| `education/` 根配置 | 6 | `package.json`、两个 `tsconfig`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.gitignore` |

导出的目录树保持仓库相对路径（`education/` 前缀 + 根 `docs/`），因此 `education/scripts` 里基于“工作区根 / 教育根”两级路径的脚本在分支上仍然成立。

## 三、自检与复核

| # | 检查 | 方法 | 结果 |
|---|---|---|---|
| 1 | 密钥 | 以字节级全文检索遍历全部待提交文件；密钥只读入内存，不写盘、不进命令行、不落日志 | **0 命中** |
| 2 | 禁止类型 | 枚举扩展名 | `.pdf` / `.docx` / `.xlsx` / `.pptx` / `.env` 均 **0** |
| 3 | 禁止目录 | 路径段匹配 `.local` / `dist` / `node_modules` / `.vite` / `.pnpm` / `.git` | **0**（仓库自身的版本库目录不属于发布内容） |
| 4 | 个人邮箱 | 项目自身文件全文检索 | **0**；`education/licenses/` 下第三方许可原文保留其版权声明中的上游联系方式，属许可证义务，不是项目成员信息 |
| 5 | 本机路径 | 用户目录、本项目工作区等绝对路径全文检索（含二进制） | **0**；发布副本中的路径已改为相对路径或占位符 |
| 6 | 许可证字段 | 根 `LICENSE`、全部 `package.json`、`materials.ts` | 均为 **MIT** |
| 7 | 数量 | 递归计数 | **697** ≤ 4000 |

## 四、Release 资产

| 资产 | 字节数 | SHA-256 |
|---|---:|---|
| `SproutAsk-Setup-0.3.0-x64.exe` | 59,434,319 | `0fc5df1828265d0ed74e20f89cc7ddc0d3c55f5ac83e6de3df39a2e042d9c014` |
| `SproutAsk-0.3.0-x64-portable.zip` | 123,117,851 | `6a0852cd186e27db861d1fc80cdc9c19800e76ce186fbf750397ec9df9bfaa7b` |

两个资产均为 `state=uploaded`，正文取自 `docs/releases/v0.3.0.md`。

## 五、两条线的关系

- `main`：v0.2.0 的 Electron 线（旧应用，MIT）。本次**未推送、未改动**。
- `education-v0.3.0`：v0.3.0 的 DSH 内核重构线（本分支）。两条线没有共同祖先，不做 merge、不开 PR、不 cherry-pick，各自独立发布。

## 六、已知限制

产品与内容侧的已知限制写在 `README`（两种语言）的 Known Limitations 一节，以及 `T17-v2.md` / `FINAL-UPDATE-3-2026-10-31.md` 两份报告里。核心几条：产物未做代码签名（SmartScreen 会提示未知发布者）；图义视觉核对只抽样 8/73；版次/印次/定价/开本未核实；没有第二台 Windows 机器做干净机验证；没有真实界面截图；手机拍照路径未在真机验证；未做学习效果实验，因此不声称提升理解或成绩；门状态为 G1=PARTIAL、G2=FAIL/PARTIAL、G3=PARTIAL，`finalAccepted` 不可达。

## 七、这份报告本身

- 本报告在分支上是对外版本；包含远端操作回执、临时目录清理等细节的内部执行日志，只保留在项目内部仓库。
- 如果后续需要变更本报告以外的内容，走**普通 follow-up 提交 + 普通 push** 即可，不需要 `--force`，也不需要重建 tag。
