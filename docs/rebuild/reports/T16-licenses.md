# T16 — A2 第三方许可 NOTICE 与缺失文本补全

- 报告结论：**A2 完成（工程归因材料，非法务意见）**。558 包闭包已生成分类 NOTICE 与去重许可全文索引；18 个缺文本包逐条处理：**1 个补全（type-fest 的 MIT+CC0 文本）、17 个上游 tarball 确无文本**（已记录来源 URL/版本，未编造）；5A 裁剪的 22 个近似闭包包已标注“裁剪后不随包”并写明恢复义务；Node.js/字体/原生二进制声明已生成；payload 扫描脚本与自检通过。仍有 2 项需人工确认（商标署名口径、OFL 保留字体名/KaTeX 版本），且 17 包在取得上游文本前不得声称“许可全文已随包”。
- 当前工作目录：`E:\DSH\workspaces\ai4edu`；日期时间 2026-10-30 02:21 +08:00（Asia/Shanghai）。
- 改动范围：新增 `education/licenses/**`、`education/scripts/packaging/scan-payload.mjs`、`education/.local/evidence/T16/**`、本报告；**未改**产品代码/内容/运行时/client/锁/contract-lock/PROGRESS。下载的 tarball 仅在 `education/.local/cache/T16/tarballs`（git-ignored，未入库）。

## 1. 输入与事实基线

- T00 许可盘点：`education/.local/evidence/T00/run-01/40-licenses/license-inventory.json`（SHA-256 见 summary）与 `license-summary.json`：**558 包**（306 官方 / 252 第三方），**580 个** LICENSE/NOTICE/COPYING 文件，**18 个包无任何许可文本文件**。
- T16 全量闭包：`education/.local/cache/T16/hoisted-test/node_modules`（与 T00 同 lock 的 558 包，无符号链接）。
- Node.js：桌面运行时同版本 Node `24.21.0` 的 LICENSE（`E:\DSH-desktop\resources\runtime\primary-runtime\dependencies\node\LICENSE`，160,555 B，SHA-256 `ed34dd8e…f8e9`）；对应 `node.exe` 93,580,104 B，SHA-256 `ba4e6d11…6c32`。
- 5A 裁剪：用户已批准去掉 `@deepseek-ai/libreoffice-kit`、`libreoffice-kit-win32-x64`、`sharp`/`@img/sharp-win32-x64`、`sherpa-onnx-node`/`sherpa-onnx-win-x64`、`node-pty`。

## 2. 18 个缺许可文本包的处理结果（逐条）

方法：按精确版本从 npm registry 下载 tarball 到 `.local/cache/T16/tarballs`，解包遍历（跳过嵌套 `node_modules`）查找 `LICENSE/COPYING/NOTICE/UNLICENSE` 文本；不复制其他项目的文本，不把 SPDX 标识冒充全文。

| 包 | 版本 | license 字段 | tarball 内文本 | 结果 |
|---|---|---|---|---|
| `@aws-sdk/credential-provider-http` | 3.972.79 | Apache-2.0 | 无 | 上游未提供文本 |
| `@aws-sdk/credential-provider-login` | 3.972.84 | Apache-2.0 | 无 | 上游未提供文本 |
| `@aws-sdk/nested-clients` | 3.997.51 | Apache-2.0 | 无 | 上游未提供文本 |
| `@earendil-works/pi-ai` | 1.4.0 | MIT | 无 | 上游未提供文本 |
| `@earendil-works/pi-telemetry` | 1.4.0 | MIT | 无 | 上游未提供文本 |
| `@koromix/koffi-win32-x64` | 3.1.1 | MIT | 无（根包 `koffi` 有 LICENSE，平台包无） | 上游未提供文本 |
| `@xterm/addon-serialize` | 0.14.0 | MIT | 无 | 上游未提供文本 |
| `@xterm/headless` | 6.0.0 | MIT | 无 | 上游未提供文本 |
| `brotli` | 1.3.3 | MIT | 无 | 上游未提供文本 |
| `data-uri-to-buffer` | 4.0.1 | MIT | 无 | 上游未提供文本 |
| `dfa` | 1.2.0 | MIT | 无 | 上游未提供文本 |
| `fontkit` | 2.0.4 | MIT | 无 | 上游未提供文本 |
| `proxy-agent-negotiate` | 1.1.0 | MIT | 无 | 上游未提供文本 |
| `saxes` | 6.0.0 | ISC | 无 | 上游未提供文本 |
| `sherpa-onnx-node` | 1.13.8 | Apache-2.0 | 无 | 上游未提供文本（且已被 5A 裁剪） |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | 无 | 上游未提供文本（且已被 5A 裁剪） |
| `standardwebhooks` | 1.1.1 | MIT | 无 | 上游未提供文本 |
| `type-fest` | 4.41.0 | (MIT OR CC0-1.0) | `license-mit`、`license-cc0` | **已补全**（两份文本按字节收录） |

补充：KaTeX 字体随 `@deepseek-ai/dsh-web-frontend` 打包但闭包无 `katex` 包；已额外从 npm 取 KaTeX `0.19.1` 的 MIT 文本（`texts/supplemented/katex@0.19.1/package/LICENSE`），并在 `FONTS-NOTICE.md` 标注“构建版本未记录”。

**剩余许可义务**：17 个“上游未提供文本”的包在分发前必须：①向上游仓库取得该版本 LICENSE 全文；或②替换该依赖；③取得文本前不得在 NOTICE/产品页声称“许可全文已随包”。本 NOTICE 已逐条记录 npm 来源 URL 与版本，便于补齐。

## 3. 生成物（education/licenses/）

| 文件 | 说明 | SHA-256 |
|---|---|---|
| `NOTICE.md` | 按许可分组的 558 包清单（版权行/随包状态/文本链接）+ 18 包处理结果 + 分发义务摘要 | `7594B3FBC0F23C6659242D0F5AC2940F28A5C4736A069786950D6D7B6627CC87` |
| `THIRD-PARTY-LICENSES.md` | 168 份去重许可全文索引 + 包→文本映射 | `2C0B572979CFEBD81433B4906C5910DF067CE65DC15B6B8A4C7CECF959A57DB1` |
| `texts/` | 168 份去重文本 + `nodejs-LICENSE.txt` + `supplemented/`（18 包补全中实际取得的文本） | 逐文件 hash 见 `summary.json` |
| `NODEJS-NOTICE.md` | Node.js LICENSE（已按字节收录全文）+ 版本/hash + 分发注意 | `11351A57D330198ADA6B4F04ACF30673AFB02FFA3963378987F7619D4E5E6A44` |
| `FONTS-NOTICE.md` | Montserrat OFL-1.1 全文/字体名说明 + KaTeX MIT 全文 + 25 个字体文件 hash | `B4CB63155882296AEF043C7107A60BE4D329867492E7505FCD45341D24BAF98F` |
| `NATIVE-BINARIES.md` | 7 个原生二进制包（含已裁剪）文件/字节/hash + VC++ 运行库说明 | `9A57C3ED3311390415E926F71721497579756A14828C3ECE349DC1CD37803B67` |
| `EXCLUDED.md` | 5A 直接裁剪 7 根包 + 近似闭包 22 包 + 恢复义务 | `2FE07E1DC83804A381C6D0478CBBC0FB9216C401934EF2C77B2F631B8190BD7E` |
| `README.md` | 更新命令、文件说明、“不是法律意见”、人工确认项 | `9C18C643BF6F5819B34C9D5A2A7AA303FAD02F4F07263D4D31F8C6EB0BF524BD` |
| `data/license-manifest.json` | 机器可读清单（包数/文本数/裁剪闭包/Node/字体/二进制） | `D3F8E1A630537EEE88D6911F32343933A5AB969D5AB8CE137ADF4450118D24AB` |
| `data/missing-licenses.json` | 18 包逐条结果 + tarball URL/版本/hash | `53EDA3AF01A076BA0B860CD17673D99D0D9C433075A511BEEE8084E6CC78D069` |
| `data/license-text-index.json` | 168 份文本 → 来源路径/哈希/包引用 | `AFC622A66DE148FDB7B163C12797FFA020D7ECE93C056B354A1153F7BF5AFDEB` |

生成工具（可复跑）：`licenses/tools/fetch-missing-licenses.mjs`（下载/解包/补全）、`build-notice.mjs`（生成文档）、`verify-licenses.mjs`（独立校验）、`selftest-scan.mjs`（扫描器自检）、`build-evidence-summary.mjs`（证据汇总）。

## 4. 5A 裁剪后的许可形态

- `NOTICE.md` 每行 `随包` 列：`yes` / `no (5A trim)`；裁剪近似闭包 **22 包**（7 个根包 + 15 个仅被裁剪组件使用的传递依赖；共享依赖保留）。**最终 payload 以 T16 打包清单与 `scan-payload` 为准**。
- 裁剪后不再随学生包：MPL-2.0 两包、LGPL-3.0 libvips/sharp、sherpa-onnx 两包、node-pty 及其独有依赖。
- 恢复义务已写入 `EXCLUDED.md`：MPL 全文+NOTICE+源码获取；LGPL 全文+可替换 DLL+源码；Apache NOTICE；node-pty 的 MIT/ConPTY 声明；恢复后必须重跑扫描与重生成 NOTICE。

## 5. Payload 扫描

- 脚本：`education/scripts/packaging/scan-payload.mjs`（SHA-256 `6D90AC0FFC197176C0AD73C1301B461323E2DAAF54E1CCDBBE13AF5D9902B088`）。
- 拒绝项：`PDF_FILE`、`PAGE_IMAGE`（>256 KiB 或路径/文件名像页扫描）、`ENV_FILE`、`SECRET_FILE`、`JOURNAL_FILE`、`PRIVATE_DIR`、`FORBIDDEN_PATH`（secrets/learner-data/journal/docs/src/.git 等）、`LOG_FILE`、`BUILD_CACHE`、`SOURCE_FILE`、`SYMLINK`、`UNREADABLE`。
- 自检（`scan-selftest.json`）：干净合成 payload 退出 **0**；脏 payload 退出 **1**，命中 `BUILD_CACHE/ENV_FILE/FORBIDDEN_PATH/JOURNAL_FILE/LOG_FILE/PAGE_IMAGE/PDF_FILE/SECRET_FILE/SOURCE_FILE` 9 类，`pass=true`。
- 实际扫描：`education/licenses`（187 文件）与 `education/content/biology-7a`（37 文件）均 `ok=true, violations=0`。

## 6. 验证命令与退出码（2026-10-30 02:21 +08:00）

| # | 命令 | 退出码 | 日志/证据 |
|---|---|---|---|
| 1 | `node education/licenses/tools/fetch-missing-licenses.mjs` | **0**（18 包：1 补全 / 17 上游无文本 / 0 错误） | `education/.local/evidence/T16/run-20261030T022116+0800/fetch-missing.log` |
| 2 | `node education/licenses/tools/build-notice.mjs` | **0**（558 包 / 168 文本 / 22 裁剪包） | `.../build-notice.log` |
| 3 | `node education/licenses/tools/verify-licenses.mjs <run>` | **0**（4 项检查全 PASS，168 文本全部匹配上游 hash） | `.../license-verification.json`（`7652BC4F…C055`） |
| 4 | `node education/licenses/tools/selftest-scan.mjs <run>` | **0**（clean=0 / dirty=1 / 9 类命中） | `.../scan-selftest.json`（`247E0C77…B9C0`）、`scan-clean.json`、`scan-bad.json` |
| 5 | `node education/scripts/packaging/scan-payload.mjs education/licenses --json` | **0**（187 文件，0 违规） | `.../scan-licenses.json`（`7754DFC3…52EA`） |
| 6 | `node education/scripts/packaging/scan-payload.mjs education/content/biology-7a --json` | **0**（37 文件，0 违规） | `.../scan-content.json`（`22D3CAD5…40F0`） |
| 7 | `node education/licenses/tools/build-evidence-summary.mjs <run>` | **0** | `.../summary.json`（`196BFDAF…B972F`） |

证据根：`education/.local/evidence/T16/run-20261030T022116+0800/`；`summary.json` SHA-256 `196BFDAF9BA376BC406C2C6386F674FC08FD19B85F15F709A7559969AECB972F`（含 15 个 license 文档、172 个文本文件、证据文件 hash 清单）。

## 7. 仍需人工确认（2 项）

1. **商标/署名口径**：DeepSeek、DSH、Node.js、教材出版方等名称/标识的使用不由 MIT/OFL 授予；产品名、About 页、安装器署名与“基于 DSH”表述需产品负责人确认（本任务不做法律判断）。
2. **Montserrat OFL 保留字体名 / KaTeX 版本**：闭包内 Montserrat `OFL.txt` 的版权行为 “Copyright 2024 The Montserrat.Git Project Authors”，**未声明 Reserved Font Name**；仍建议与上游版本核对。KaTeX 字体随 DSH 前端构建嵌入，**构建时的精确 KaTeX 版本未记录**；`FONTS-NOTICE.md` 使用 npm 最新版 MIT 文本，严格版本对应需向 DSH 发布方确认。

## 8. 数据/安全/许可边界

- 未安装系统软件、未新增运行期依赖；下载仅到 `.local/cache/T16/`，tarball 未入 Git。
- 未修改产品代码、内容包、runtime/client、锁文件、contract-lock、PROGRESS。
- 许可文本只按字节复制自上游文件或 Node.js 官方发行包；17 包缺文本已如实记录，没有编造或挪用其他项目文本。
- `verify-licenses.mjs` 独立校验：168 份文本 hash 均匹配 inventory/补全来源（`unmatched=0`）；NOTICE 包行数 = 558；18 包状态 = 1 补全 + 17 缺失。
- 扫描器自检覆盖 9 类禁止项；对真实 licenses/content 目录扫描 0 违规；最终 Windows payload 的扫描必须在 T16 打包产物上再跑一次（本次未打包）。

## 9. 阶段就绪与后继

| 项目 | 状态 | 说明 |
|---|---|---|
| A2 许可 NOTICE/文本补全 | **完成（工程材料）** | 558 包 NOTICE、168 文本、18 包逐条、5A 裁剪记录、Node/字体/原生二进制声明 |
| A32 包内容扫描（贡献） | **PARTIAL** | 扫描器 + 自检 + licenses/content 扫描通过；最终 exe/便携 payload 扫描依赖 T16 实际打包 |
| 分发放行 | **条件满足但未放行** | 17 包缺上游文本；2 项人工确认；最终 payload 未扫描/未打包 |
| 后继 | T16 打包负责人 | ①在最终 payload 上跑 `scan-payload`；②从最终 node.exe 同目录重取 LICENSE 并重算 hash；③决定 17 包“补文本/替换/接受风险”的处置并更新 NOTICE；④完成商标/OFL/KaTeX 人工确认 |

---

## § 生成器重写与文案一致性（2026-10-31）

### 1. 损坏诊断（不是"猜"，是 `node --check` 实测）

- `education/licenses/tools/build-notice.mjs` 在 2026-10-30 05:00 被 PowerShell 文本往返损坏：**文件首字节是 UTF-8 BOM**（`﻿#!/usr/bin/env node`），且正文中文注释全部变成 GBK 误解码的乱码（`鈥?`）；`node --check` 直接报 `SyntaxError: Invalid or unexpected token`（第 1 行），**任何调用都会失败**。
- 处置：原文件改名为 `education/licenses/tools/build-notice.mjs.broken` 保留证据（31,988 字节，sha256 `518befa5923a6a14cb3c0023de83705c72bff0b2dac1803b65dd64f7fa858189`），不做"修修补补"——重写更可靠。

### 2. 新生成器：`education/licenses/tools/build-notice-v2.mjs`

| 项 | 做法 |
|---|---|
| 包清单 | 读 `data/license-manifest.json` 指向的 T00 inventory（558 包），并**校验 inventory 的 sha256 与 manifest 记录一致**，不一致直接退出 |
| 随包状态 | **以实物 payload 为准**：逐包检查 `education/dist/student/app/node_modules/<name>/` 是否存在；不看任何"近似闭包"或旧 trim 清单 |
| 缺文本处理 | 读 `data/missing-licenses.json`（18 包：1 已补齐 / 17 上游未提供），不编造文本 |
| 许可全文 | 读 `texts/**`，按字节原样链接，文件名 = sha256 前 16 位 |
| 裁剪声明 | `TRIM_GROUPS` 5 组（office / office 技能 / 语音 / sherpa 原生库 / PTY），每组写清裁剪原因与恢复义务 |
| 硬断言（防止再矛盾） | ① payload 缺失但未声明裁剪的包 → 报错退出；② `sharp`/`@img/sharp-win32-x64` 必须**在** payload 内且不在裁剪组，否则报错；③ LGPL 全文文件必须仍含 `GNU LESSER GENERAL PUBLIC LICENSE` + `Version 3` |
| 幂等 | 不写时间戳、按包名排序、LF 换行；`--check` 模式只比对不写盘 |

生成物（同时写 `data/license-status.json` 作为机器可读口径）：

| 文件 | 字节 | sha256 |
|---|---|---|
| `licenses/NOTICE.md` | 97,418 | `15f09b096e6590057097f8f76438c9ca1a6397369bbe1f5f3a6b5e69b18dfea2` |
| `licenses/THIRD-PARTY-LICENSES.md` | 28,311 | `11f960f2ce9762059dd6bc5229506ffc1b7caa77d2044a441adc28bf38c0c42a` |
| `licenses/EXCLUDED.md` | 5,043 | `ccb27883d4e432383c19dcb6265bb0737fa93fad5fa18e7fd05b36ce86709046` |
| `licenses/data/license-status.json` | 2,472 | `51ad4c8b32369b81c64e10860268bf8f708c753808265b5d7f1dfbb47190ad0b` |

**可重复运行证据（实测）**：连续跑两次 `build-notice-v2.mjs`，四个文件的 sha256 与上表**逐字节相同**；再跑 `--check` 返回 `{"ok": true}` 且 hash 不变。`--check` 在文件被手改后会以非零码退出（契约：`exit 1` + "is stale"）。

### 3. 修掉的文案矛盾（F-08 的具体清单）

| # | 位置 | 旧文案（矛盾点） | 新口径 |
|---|---|---|---|
| 1 | `NOTICE.md` 开头 | "用户已批准去掉 office / speech / PTY / **sharp** 组件"、"`no (5A trim)` = 裁剪后不随学生包分发"（而 sharp 行写 yes） | 删掉 sharp；改为"随包 = payload 实测存在"，并单列 §0 状态总览（546 yes / 12 no） |
| 2 | `NOTICE.md` §3 结尾 | "LGPL-3.0-or-later（sharp/libvips，**已裁剪**）：如恢复分发…" | 改为 §3.1「LGPL-3.0-or-later（`@img/sharp-win32-x64` 内的 libvips，**随包**）」，写全 LGPL 全文位置 + libvips 源码获取 + DLL 可替换 + 未修改声明 |
| 3 | `NOTICE.md` 包行 | `@deepseek-ai/dsh-office-to-pdf`、`@deepseek-ai/dsh-skill-office` 标 `yes`（实物不在 payload） | 标 `no (5A trim)`，并在 §0.1 列明 12 个裁剪包（另新增语音/voice 5 包，旧版漏列） |
| 4 | `EXCLUDED.md` | "直接裁剪的裁剪根"含 `sharp`、`@img/sharp-win32-x64`；另有"近似裁剪闭包 22 包"含 `brotli`/`fontkit`/`saxes` 等**实际随包**的包 | 只列 payload 实测缺失的 12 包（office 2、office 技能 2、语音 5、sherpa 2、PTY 1）；删除近似闭包整节；新增"sharp/@img 明确不在本清单" |
| 5 | `EXCLUDED.md` 文末 | "生成器已损坏，暂无自动重生成能力" | 改为 v2 生成器用法 + `--check` |
| 6 | `NATIVE-BINARIES.md` | `@img/sharp-win32-x64` 三行标 `no (5A trim)`、文末"sharp/libvips（已裁剪）" | 三行改 `yes`，文末改为"随包，须满足 LGPL 全文/源码/可替换义务（见 NOTICE §3.1）"；表头补一句状态变更说明 |
| 7 | `README.md` | 更新步骤指向 `build-notice.mjs`；"`EXCLUDED.md` 的闭包为近似值" | 指向 `build-notice-v2.mjs`（含 `--check`）；改为"由生成器对 payload 实测得出" |

`data/license-manifest.json#trimRoots` 仍是旧值（含 sharp/@img），本轮**没有手改数据文件**，而是在 `license-status.json` 的 `staleInputs` 里注明它已过期、生成器不采用它——避免"改证据"。

### 4. 校验结果（实测）

```text
node education/licenses/tools/verify-licenses.mjs education/.local/evidence/T16/license-verify
{ "pass": true,
  "checks": { "all license texts match an upstream file hash": true,
              "NOTICE package rows equal inventory count": true,
              "18 missing packages = 1 supplemented + 17 absent": true,
              "required files present and non-empty": true },
  "unmatched": 0, "noticeRows": 558 }
```

- NOTICE 内 `no (5A trim)` 出现 13 次 = 12 个包行 + 1 处口径说明；`sharp`、`@img/sharp-win32-x64` 两行均为 `yes`。全文里唯一同时出现 "sharp" 与 "已裁剪" 的句子是 §0.2 的禁止性说明（"sharp/@img 不属于 5A 裁剪项，不得写成'已裁剪'"），**没有任何一处陈述把 sharp 当作已裁剪**（用脚本 `education/.local/evidence/T16/check-notice-claims.mjs` 复核）。
- LGPL 全文：`texts/9a7e34fbf3903507.txt`（316,506 字节，sha256 `9a7e34fbf3903507665e3ec7ca8b3d0c11f73bf2d5a0d754a079ab9f505bafef`），NOTICE §3.1 与 THIRD-PARTY-LICENSES 头部都指向它；libvips 源码获取写的是 libvips 上游仓库 + lovell/sharp 的构建脚本，并声明"未修改 libvips、DLL 可替换"。
- 说明：该 LGPL 全文文件来自上游 LibreOffice 许可汇编（按字节保留），因为 `@img/sharp-win32-x64` 自带的 `LICENSE` 只有 Apache-2.0 正文；这一点已在 NOTICE §3.1 明写，不冒充"sharp 包内自带 LGPL 文本"。

### 5. 复跑步骤

```powershell
# 生成（覆盖 NOTICE.md / THIRD-PARTY-LICENSES.md / EXCLUDED.md / data/license-status.json）
node education/licenses/tools/build-notice-v2.mjs
# 只校验（CI/回归用，不写盘，落后即 exit 1）
node education/licenses/tools/build-notice-v2.mjs --check
# 独立复核（558 行、文本哈希、18 缺文本包、必备文件）
node education/licenses/tools/verify-licenses.mjs education/.local/evidence/T16/license-verify
```

顺序约束（否则状态会失真）：**先重打 payload，再跑生成器**。生成器的"随包"读的是 `education/dist/student/app/node_modules`；payload 变了（例如去掉 `--keep-sharp`）而没重跑生成器，`--check` 会立刻报 stale。

### 6. 与 v14 打包的衔接（实测）

- payload：`build-student-payload.mjs --keep-sharp --clean` → 34,494 文件 / 408,540,451 字节；`licenses/` 已随 payload 复制 189 个文件，payload 内 `licenses/NOTICE.md|EXCLUDED.md|THIRD-PARTY-LICENSES.md` 与 `licenses/` 源文件 **sha256 完全一致**。
- `scan-payload.mjs education/dist/student` → `OK (34494 files, 408540451 bytes, no forbidden payload material)`；payload 内 `.vbs` 文件 **0 个**。
- 安装包：`education/dist/SproutAsk-Setup-x64.exe`，**59,434,319 字节**，sha256 `0fc5df1828265d0ed74e20f89cc7ddc0d3c55f5ac83e6de3df39a2e042d9c014`，内嵌 build id `a8822e8+dirty@2026-10-30T17:58:29.752Z`（`version.txt` 的 `builtAt` 是 UTC，对应本地 2026-10-31 01:58）。
- 未跑全量 gate（按本轮分工由主控统一跑）；本轮只跑了 `scan-payload` 与 `verify-licenses`。
