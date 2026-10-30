# T16 可行性侦察与依赖许可清单（只读）

- 结论：**便携版 = 有条件可做；安装版 = 当前不引入新工具则不可做（有条件可做的替代路线需用户批准工具与签名证书）；原生 Electron 桌面壳 = BLOCKED（官方 `@deepseek-ai/dsh-desktop` 不在 npm，品牌/账户未授权）。G3 整体仍 BLOCKED**，主要不是打包技术，而是 T15/G2 未通过、T13 UI live data source 与 host auth 未完成、产品/品牌/签名决策未给。
- 侦察方式：只读源码/配置/证据 + 在 `.local/cache/T16` 做隔离测量（hoisted 安装、冷启动、7z 体积），**未构建产品 exe/安装包、未改产品代码、未 install 产品依赖、未联网下载工具**。
- 日期：2026-10-29 21:02 +08:00（Asia/Shanghai）；工作目录 `E:\DSH\workspaces\ai4edu`；OS：Windows 11 家庭版 10.0.26200 x64，当前 shell 非管理员。
- 依据：`docs/rebuild/runtime-lock.json`（`0cdb8da8…2e19`）、`docs/rebuild/reports/T00.md`、`education/probes/runtime/scripts/license-inventory.mjs`、`education/runtime/**`、`education/.local/evidence/T00/run-01/40-licenses/license-{inventory,summary}.json`、`docs/rebuild/07-acceptance.md`、`docs/rebuild/tasks/T16-desktop.md`、T01/T12/T15 报告。

## 0. 事实基线（先看这一节）

| 事实 | 值 | 证据等级 |
|---|---|---|
| 固定 DSH 版本 | `@deepseek-ai/dsh@0.2.1-rc.3`，tarball SHA-256 `9a8f9493…7141`，integrity/lockfile 见 runtime-lock | 静态（T00 已接受） |
| DSH npm 闭包（pnpm 符号链接布局） | **483.2 MB / 29,516 files / 558 packages**（`education/probes/runtime/node_modules`） | 实测 |
| 闭包中的符号链接 | **2,862 个 reparse point（SymbolicLink）**；`pnpm install --node-linker=hoisted` 后 **0 个** | 实测 |
| hoisted（无符号链接）安装树 | **527.8 MB / 35,264 files / 0 reparse points** | 实测 |
| Node 运行时（桌面版同版本） | `node.exe` v24.21.0，93,580,104 B（89.2 MB），SHA-256 `ba4e6d11…6c32`；同目录 `LICENSE` 160,555 B | 实测 |
| 教育 host/client 产物 | `runtime/host-plugin/lib/index.js` 541,558 B；`runtime/client-plugin/lib/client.js` 293,133 B | 静态 |
| 内容包（可随包） | `education/content/biology-7a` 1.78 MB / 36 files；pack `2.0.0`，当前 `contentHash=7b5f055c…ea68`；T14/T15 仍在返工，**打包必须绑定冻结后的 hash** | 实测 + 报告 |
| 当前产品形态 | `education/package.json` 的 `build:win`/`smoke:packaged` 仍是 `not-implemented`；`education/dist`、`education/desktop`、`runtime/launcher`、`licenses/` 均不存在 | 实测 |
| 官方桌面壳 | `@deepseek-ai/dsh-desktop` **npm registry 404**（`npm view …` 实测）；已安装 `app.asar` 只能作指纹，禁止作构建输入 | 实测 + 静态 |
| 当前集成状态 | T13 已交回 **PARTIAL**：后端 G1 `/edu/api/g1/*` 真实链路 PASS@L2，但 UI live data source 未接线（client root 仍 `createFixtureShellDataSource()`），且 G1 host routes 尚无 auth 中间件；T15/G2 两轮审计仍 **PARTIAL**（3 高 6 中未修） | 静态 + 报告 |

## 1. Windows 交付形态：便携版

### 1.1 结论与可行路径

**有条件可做**：用 **官方 npm 固定闭包 + hoisted（无符号链接）node_modules + 自带 node.exe + 教育 host/client 构建产物 + 内容包 + 独立 DSH_HOME + 浏览器窗口**，不依赖用户已装 DSH/Node/Python/pnpm。已在本机 `.local/cache/T16` 完成同构冷启动验证（见 1.4）。

不建议直接打包 `education/probes/runtime/node_modules` 的 pnpm 布局：其中 2,862 个 **符号链接**，Windows 标准用户默认无权限创建 symlink（本机实测 `SymbolicLink` 创建失败、`Junction` 成功），Explorer 解压 ZIP 也不可靠保留链接；hoisted 树虽大 44 MB，但 0 链接、可普通解压/复制。

### 1.2 目录结构草案

```
SproutAsk-<ver>-win-x64/
  SproutAsk.exe | start.cmd            # 启动器（二选一，见 1.5）
  app/
    node/
      node.exe
      LICENSE                          # Node.js 及其第三方声明
    dsh/
      node_modules/                    # hoisted DSH 闭包（558 包，无 symlink）
      ...
    runtime/
      host-plugin/lib/index.js         # @edu/education-host
      client-plugin/lib/index.js
      client-plugin/lib/client.js      # @edu/client-root
    content/biology-7a/
      pack.json
      source/source-refs.json
      source/course-edition.json
      source/block-index.json
    launcher/
      setup-home.mjs                   # 首次运行生成 DSH_HOME profiles（junction 链接插件）
      start.mjs / stop.mjs             # 启动/停止 DSH web，等待 URL，打开默认浏览器
  licenses/
    THIRD-PARTY-NOTICES.md
    <package>@<version>/LICENSE…       # 580 个许可文本按包归档
  README.txt / 使用说明.txt
```

不建议随包：`source-verification.json`（含本机绝对路径）、`block-selection.json`、`figure-usage*.json`、`coverage/`、`concepts/`、`review/`、`fragments/`、`tools/`、`README.md`（内容包审阅视图）——运行期只需要上述 4 个 JSON。

### 1.3 启动命令草案

首次运行由 `launcher/setup-home.mjs` 生成 DSH_HOME（复用 `education/runtime/scripts/setup-education-home.mjs` 的逻辑，但去掉 probe 路径）：

```text
set DSH_HOME=%LOCALAPPDATA%\SproutAsk\dsh-home
set EDU_DATA_ROOT=%LOCALAPPDATA%\SproutAsk\learner-data
set EDU_RUNTIME_LOG=%LOCALAPPDATA%\SproutAsk\logs\runtime.jsonl
set DSH_DISABLE_UPDATE_CHECK=1
set DEEPSEEK_API_KEY=
"%APP%\node\node.exe" "%APP%\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" ^
  --profile edu-web --no-open --port <随机或固定未排除端口>
```

启动器读取 stdout 的 `dsh web: http://127.0.0.1:<port>/?token=…`，用默认浏览器打开；停止时按 PID 树终止。首次运行必须把 `EDU_DATA_ROOT`/`EDU_RUNTIME_LOG` 指到可写 userData，否则 host plugin 默认写到 `<workspaceRoot>/.local/cache/T01/…`（安装到 Program Files 时会写失败）。`DSH_HOME` 不能复用用户现有 `E:\DSH\.dsh`。

注意：现有 `education/runtime/scripts/start-education-web.mjs` 硬编码 `education/probes/runtime/node_modules/.../dsh` 和 `.local/secrets/deepseek.key`，**不能直接作为产品启动器**，需要 T16 新写薄启动器（本卡未写）。

### 1.4 体积与冷启动实测

| 项 | 值 | 说明 |
|---|---:|---|
| hoisted node_modules | 527.8 MB（35,264 files） | `pnpm install --prod --frozen-lockfile --ignore-workspace --node-linker=hoisted --offline` 在本机 17.4s 完成 558 包；exit=1 仅因 `ERR_PNPM_IGNORED_BUILDS`（5 个包有 install 脚本，与 T00 相同） |
| + node.exe | 89.2 MB | v24.21.0 |
| + 内容包/插件/启动器/许可 | 约 3–6 MB | 内容 1.78 + 插件 0.81 + 文本 |
| **未压缩合计** | **≈ 620 MB（±5 MB）** | 35.3k 文件 |
| 7z `-mx=1` 实测：node_modules | **118.7 MB**（124,486,354 B） | 46.4s；`hoisted-node_modules.7z` SHA-256 `c706a547…9c2` |
| 7z `-mx=1` 实测：node.exe | **26.3 MB**（27,625,240 B） | `node-exe.7z` SHA-256 `b1e7cb45…a2bf` |
| **压缩后载荷估计** | **≈ 147 MB（7z）** | 118.7+26.3+约 1–2 MB；ZIP deflate 预计 160–180 MB（**推断**，未实测整包 ZIP） |

冷启动实测（**workspace 布局**：hoisted DSH 树 + `education/runtime/host-plugin/lib` + `education/content/biology-7a` + 隔离 home + 无 Key；产品 `app/` 布局的 host plugin 相对路径与内容路径关系相同，但**未复制成独立 app 目录单独实测**）：

- 命令：`node hoisted-test/node_modules/@deepseek-ai/dsh/lib/bin.js --profile edu-web --no-open --port 41234`，环境 `DSH_HOME=<cache>/home`、`EDU_DATA_ROOT=<cache>/data`、`EDU_RUNTIME_LOG=<cache>/logs/runtime.jsonl`、`DSH_DISABLE_UPDATE_CHECK=1`、`DEEPSEEK_API_KEY=''`。
- 结果：**1.69s** 输出 `dsh web: http://127.0.0.1:41234/?token=…`；token URL 返回 303 并下发 cookie；`GET /edu/api/status` 返回 **200**，body 显示 `dsh.bound=true/version=0.2.1-rc.3`、`pack.packVersion=2.0.0`、6 个教育工具、home/library/… pages、`network=loopback_only`、`status=degraded`（原因 `DEEPSEEK_API_KEY is not present`，无 Key 预期）。
- 证据：`education/.local/cache/T16/logs/cold-start.result.jsonl` SHA-256 `22e6dcbe…4462`（token 已脱敏）；stdout/stderr 日志同目录（stdout 含本地一次性 token，仅 .local，不提交）。

这说明：**hoisted 无符号链接树 + 隔离 DSH_HOME + 教育 host/client root 可以冷启动并加载内容包**；尚未做真实浏览器渲染、PDF 导入、模型调用。

### 1.5 冷启动前置与启动器选项

- 必须自带 `node.exe`（目标学生机不保证 Node；桌面版同版本 24.21.0）；不需要 Python（probe/T00 web 路径无 Python；Office/语音工具如保留才涉及 LibreOffice/onnx 二进制）。
- 不需要运行期 pnpm：profiles 由启动器生成，插件以 **junction** 链接（标准用户实测可行；symlink 不可行）。
- 需要 profile 首次生成（不能随包附带绝对路径 junction）。
- 需要浏览器（Windows 11 默认 Edge；也可后续用 WebView2 自绘窗口）。\n- **端口**：Windows 存在 excludedportrange（本机含 43576–43675 等）；首次随机端口 43579 绑定返回 EACCES，复测 41234 成功。启动器必须做端口探测/重试（或让 DSH 绑定 0 后读实际端口），不能假定随机端口可用。
- VC++ 运行库：node-pty/koffi/sharp 等原生模块可能依赖 VC++ 2015-2022；本机已具备，目标机未验证——**打包前需确认或随包带 VC redist（许可+体积）**。
- 长路径：本机 `LongPathsEnabled=1`，hoisted 树最长全路径 239 字符；安装到深目录可能超 260，需固定短安装根或启用长路径（后者不能要求管理员）。
- 启动器 exe 选项：
  1. **Node SEA**：`SproutAsk.exe`（node.exe + 嵌入式 launcher blob），无新运行期依赖；构建期需要注入工具（如 `postject`，MIT）——属新增 build-time 依赖，需批准。
  2. **7z SFX**：本机有 `7z.sfx`/`7zCon.sfx`，可做自解压 exe 并运行 launcher；无需新依赖，但不是标准安装器（无 ARP/卸载/快捷方式需自写脚本）。
  3. **Electron**：见 §2，不推荐（新增依赖 + 官方壳不可得 + 体积/许可）。
  4. 仅 `start.cmd`：最简单，但 G3 要求“运行要交付的 exe 本身”，不满足 exe 形态。

## 2. 安装版（NSIS/MSI/MSIX）

### 2.1 工具盘点（本机实测）

| 工具 | 状态 |
|---|---|
| `7z.exe` | **存在**（`C:\Program Files\7-Zip\7z.exe`；SFX 模块存在） |
| `makensis` / `iscc` | **不存在** |
| `electron-builder` | **不存在**（项目/全局均无） |
| WiX（candle/light/wix） | **不存在** |
| `dotnet` | 仅 runtime，**无 SDK**（`dotnet --list-sdks` 为空） |
| `winget` | 存在（可安装外部工具，但需用户批准、可能联网/UAC） |
| Windows SDK `makeappx.exe` / `signtool.exe` | **存在**（`C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64`，未在 PATH） |
| 代码签名证书 | 本轮未提供/未检查个人证书库；无 CA 证书证据 |

### 2.2 可行方案比较

| 方案 | 不新增工具能否做 | 需要新增/外部输入 | 结论 |
|---|---|---|---|
| 便携 7z/SFX 自解压 exe | **能**（7-Zip 已装） | 无；但无 ARP/卸载/自动更新；SFX 运行/解压策略要自写 | 技术可行，非标准安装版 |
| NSIS 安装器 | **不能**（makensis 不在） | 安装 NSIS（winget/官方包，需批准）+ `.nsi` 脚本 + 签名证书 | **有条件可做** |
| WiX MSI | **不能**（无 WiX、无 .NET SDK） | 安装 WiX/`.NET SDK`（winget）+ MSI 定义 + 签名证书 | **有条件可做**，工作量更大 |
| MSIX（makeappx + signtool） | **工具已在**，但安装需要受信任签名/侧载策略 | CA 代码签名证书；全信任桌面扩展/侧载决策；manifest 与启动参数 | **有条件可做**（证书与策略是硬缺口） |
| Electron 原生壳 + electron-builder | **不能**（无 electron/electron-builder，官方桌面壳不在 npm） | `electron` + builder devDependencies；自定义壳代码；Chromium 许可；品牌/账户授权 | **BLOCKED/不推荐本期** |

- `pnpm dlx electron-builder` 不能解决“没有 Electron 应用”的问题；它要求 Electron app 结构，且会下载 app-builder/NSIS 二进制，仍是新增构建依赖。
- 若只求“标准用户可安装+卸载+保留数据”：**NSIS 每用户安装（RequestExecutionLevel user）**是当前最小增量；安装到 `%LOCALAPPDATA%\Programs\SproutAsk`，数据在 `%LOCALAPPDATA%\SproutAsk`，卸载询问保留/删除数据。
- MSIX 的问题不是工具而是 **签名证书与侧载/全信任策略**；无证书只能自签 + 目标机手动信任（需管理员），不适合学生标准用户。
- 代码签名证书（OV/EV）是**购买/授权外部输入**；无证书仍可安装运行，但 SmartScreen 会提示“未知发布者”，不能宣称官方签名。

### 2.3 最小增量建议

若用户批准“标准安装版”：
1. 采用 **NSIS per-user**（winget 安装 NSIS 或使用官方 zip；不加入产品 dependencies），写 `education/scripts/packaging/installer.nsi`；
2. 购买/提供 **代码签名证书**，用已存在的 `signtool.exe` 签名 launcher/installer；
3. 安装器只解压便携布局 + 创建开始菜单/桌面快捷方式 + 写 ARP 卸载项 + 卸载时询问数据保留；
4. 若坚持 MSIX：用已存在的 `makeappx` 打包 + CA 证书签名，并确认全信任/侧载策略。

## 3. 许可与 NOTICE 清单

### 3.1 清单事实（T00 `license-inventory.json`，558 包）

| 项 | 值 |
|---|---|
| 包总数 | 558（官方 `@deepseek-ai/*` 306，第三方 252） |
| 许可分布 | MIT 472；Apache-2.0 53；BSD-3-Clause 14；ISC 10；BSD-2-Clause 2；MPL-2.0 2；`Apache-2.0 AND LGPL-3.0-or-later` 1；Python-2.0 1；Unlicense 1；0BSD 1；`(MIT OR CC0-1.0)` 1 |
| 许可文本文件 | 580 个 LICENSE/NOTICE/COPYING 变体；**18 个包无任何许可文本文件**（license 字段存在，全部为第三方） |
| NOTICE 文件（真正许可 NOTICE） | `@deepseek-ai/libreoffice-kit@0.1.5`、`@deepseek-ai/libreoffice-kit-win32-x64@0.1.5`（`dsh-spill-policy` 的 `notice.js/.d.ts` 是代码文件，不算） |
| 原生二进制包 | 7：libreoffice-kit-win32-x64（1 exe）、sharp-win32-x64（libvips DLL+node）、koffi-win32-x64、ripgrep-win32-x64、node-addon-require-builtin-win32-x64-msvc、node-pty（16 prebuilds）、sherpa-onnx-win-x64（5 DLL） |
| 字体资产包 | 3：`dsh-client-ui-theme`（3）、`dsh-web-frontend`（22）、`libreoffice-kit-win32-x64`（2）；Montserrat `OFL.txt` 随主题/frontend 存在，KaTeX 字体随 MIT 包 |
| 官方包许可 | MIT / MPL-2.0 / BSD-3-Clause（**不是全 MIT**） |

18 个缺文本包：`@aws-sdk/credential-provider-http`、`@aws-sdk/credential-provider-login`、`@aws-sdk/nested-clients`、`@earendil-works/pi-ai`、`@earendil-works/pi-telemetry`、`@koromix/koffi-win32-x64`、`@xterm/addon-serialize`、`@xterm/headless`、`brotli`、`data-uri-to-buffer`、`dfa`、`fontkit`、`proxy-agent-negotiate`、`saxes`、`sherpa-onnx-node`、`sherpa-onnx-win-x64`、`standardwebhooks`、`type-fest`。

### 3.2 分发义务（草案）

- **MIT/ISC/BSD-2/BSD-3/0BSD/Unlicense/CC0**：保留版权声明与许可全文；BSD-3 另含“不得以作者/机构名义背书”条款。
- **Apache-2.0（53+1 包）**：附 LICENSE；若包内有 NOTICE，保留 NOTICE 内容；修改文件需标注。
- **MPL-2.0（libreoffice-kit、libreoffice-kit-win32-x64）**：附 MPL 全文与 NOTICE/`program/license.txt`；MPL 覆盖文件需提供 source code offer（未修改也要能取得对应源码）；不得把 MPL 代码改成专有再分发。
- **LGPL-3.0-or-later（sharp-win32-x64 的 libvips DLL）**：动态链接可保留专有主程序，但必须允许用户替换 LGPL 库、提供 LGPL 文本与 libvips 源码获取方式；`Apache-2.0 AND LGPL` 两个许可都要满足。
- **Python-2.0（argparse）**、**字体（Montserrat OFL-1.1 / KaTeX MIT / LibreOffice 字体）**：附对应文本与字体名；OFL 禁止单独售卖字体、保留名称限制需核对。
- **Node.js**：随 `node.exe` 附 Node LICENSE（含 V8/OpenSSL 等 bundled notices），保留版权。
- **7-Zip**（若使用 SFX/7z 解压）：附 7-Zip license（LGPL + unRAR 限制）与 SFX 声明。
- **DSH 本身**：MIT；附 LICENSE 与版本/来源；**商标与模型服务条款不由 MIT 授予**。
- **本项目自有代码**：当前 `UNLICENSED`/私有；产品化由用户决定许可与版权归属（本报告不替代法律意见）。

### 3.3 `THIRD-PARTY-NOTICES.md` 结构草案

1. 产品名称/版本/构建日期；本包不含教材 PDF/页图/OCR 全文/个人 journal/密钥。
2. DSH runtime：`@deepseek-ai/dsh@0.2.1-rc.3`（MIT，来源 npm tarball SHA-256 + integrity）。
3. 第三方包表：`name@version | license | copyright | source URL`（按许可分组，机器生成，逐包可追溯）。
4. MPL-2.0 专节：libreoffice-kit 两包 + 源码获取/提供方式 + `program/license.txt`/`NOTICE`。
5. LGPL-3.0 专节：libvips DLL、动态链接说明、替换方法、源码获取方式。
6. BSD-3 专节（14 包）：版权声明与“不得背书”条款。
7. Apache-2.0 专节（53+1）：LICENSE 与 NOTICE 保留。
8. MIT/ISC/BSD-2/0BSD/Unlicense/Python-2.0/CC0 各节。
9. 字体专节：Montserrat OFL-1.1 全文、KaTeX MIT、LibreOffice 字体；字体文件清单与 SHA-256。
10. 原生二进制清单：包/文件/SHA-256/许可/来源。
11. Node.js：完整 LICENSE 与 bundled notices。
12. 构建工具（若随包/若使用 SFX）：7-Zip、Node SEA/postject 等。
13. 品牌与账户声明：无 DeepSeek/DSH 商标授权；账户 PKCE 路线用户明确不允许；仅 API Key（待 Key 政策）。
14. 构建可复现信息：DSH 版本/lock hash、package 清单 hash、内容包 `2.0.0`/hash、生成脚本。

### 3.4 缺口清单（按处理方）

| 缺口 | 数量/对象 | 处理 |
|---|---|---|
| 无许可文本的包 | **18**（全部第三方） | 从上游仓库/发布页收集 LICENSE/NOTICE 全文并纳入；无法取得则**不得分发该包**或替换 |
| MPL source offer | 2 包（libreoffice-kit + win32-x64） | 附 MPL 文本 + 源码获取方式/提供源；确认是否修改 |
| LGPL source/replacement | 1 包（sharp-win32-x64 / libvips DLL） | 附 LGPL 文本 + 源码/替换说明；不得静态限制替换 |
| 字体归因 | Montserrat OFL 已随包；KaTeX/MIT；LibreOffice 字体 | 纳入字体清单/OFL 全文与名称限制核对 |
| 原生二进制 | 7 包（1 exe、DLL、node、prebuilds） | 逐文件 hash + license + 来源；确认 VC++ 运行库 |
| 品牌/商标 | DSH/DeepSeek 名称、图标、`ui-brand-official` | **未授权**；产品名/图标由用户决定；保留事实性 attribution，不冒充官方 |
| 账户/平台条款 | PKCE 账户路线 | 用户已决定 **不允许**；只走 API Key（Key 存储/分发政策仍待 T01/T16） |
| 安装签名 | 无 CA 证书 | 购买/授权证书；否则 SmartScreen 未知发布者 |

## 4. 数据边界

### 4.1 运行期路径

| 数据 | 位置 | 说明 |
|---|---|---|
| DSH_HOME | `%LOCALAPPDATA%\SproutAsk\dsh-home`（安装版）或 `<portable>\data\dsh-home`（用户可选） | 绝不复用 `E:\DSH\.dsh`；首次运行生成 profiles（junction 链接产品插件） |
| 学习事件/快照 | `EDU_DATA_ROOT` = `%LOCALAPPDATA%\SproutAsk\learner-data` | 由 host plugin 传给 `@edu/storage`；不得写安装目录 |
| 运行日志 | `EDU_RUNTIME_LOG` = `%LOCALAPPDATA%\SproutAsk\logs\runtime.jsonl` | 不含密钥；可关闭/轮转 |
| 模型 Key | 不入包；由用户在设置/环境提供（策略待 T01/T16） | 无 `.env`；不写日志/截图；账户路线不可用 |
| 教材 PDF/OCR 页图 | 由用户显式导入；源文件留在用户选择位置 | 不进安装包、不复制到只读安装目录 |

### 4.2 打包白名单草案

只允许：`app/node/{node.exe,LICENSE}`、`app/dsh/node_modules/**`（hoisted、无 symlink、只 production 包）、`app/runtime/host-plugin/lib/index.js`、`app/runtime/client-plugin/lib/{index.js,client.js}`、`app/content/biology-7a/{pack.json,source/source-refs.json,source/course-edition.json,source/block-index.json}`、`app/launcher/**`、`licenses/**`、启动器 exe/脚本、`README.txt`。

### 4.3 必须显式排除（打包扫描阻断）

- 工作区根 `.env`、`义务教育教科书·生物学·七年级·上册.pdf`、`docs/**`、`src/**`、`TASKS.md`、`AGENTS.md`、`.git/**`、根 `node_modules`、旧样例 `content/units/u-cell-basic-unit/**`。
- `education/.local/**`：`secrets/deepseek.key`、`evidence/T00|T03|T05|T14/**`（页图/OCR 全文/PDF 派生）、`cache/T01|T13|T16/**`、`learner-data/**`、`runtime.log`。
- `education/probes/**`（探针 home/work、参考解包、凭据/锁）。
- `education/client/**/src|test`、`education/packages/**/src|test`、`education/runtime/src|test`、`education/scripts/**`（产品仅保留构建后的 lib 与产品启动器）、`education/config/**`、`education/tests/**`、`education/pnpm-lock.yaml`/`package.json`（可另附清单，不随运行包）。
- 内容包中的 `source-verification.json`（含本机绝对路径）、`block-selection.json`、`figure-usage*.json`、`coverage/`、`concepts/`、`review/`、`fragments/`、`tools/`。
- 任何 `*.log`、`*.key`、`*.pfx`、`*.pem`、`*.tsbuildinfo`、`dist` 临时目录、`node_modules/.cache`。

### 4.4 泄漏扫描（A32 阻断门）

- 文件清单扫描 + 内容扫描：`%PDF` 魔数、`DEEPSEEK_API_KEY`/`sk-`/`Bearer `、`BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY`、`.env`、`learner.local`/真实 learner id、`journal/events.jsonl`、`snapshots/`、`E:\DSH`/用户绝对路径、`人教版` 原文长段/页图哈希清单。
- 对 `licenses/**` 允许许可文本；对 `content/**` 只允许结构 JSON/短标题，不允许页图/OCR 文本。
- 扫描结果、文件数/字节数、排除清单 hash 写入 T16 报告；不以文件名扫描代替内容扫描。

### 4.5 安装/卸载/更新

- 安装：每用户到 `%LOCALAPPDATA%\Programs\SproutAsk`；数据目录独立；不写系统 PATH/全局 DSH。
- 卸载：删除程序文件，询问“保留学习数据/删除学习数据”；删除教材与删除学习记录分开确认（A33/A26 语义）。
- 更新：覆盖程序文件保留 userData；新版本首次启动迁移内容包版本（`contentHash` 变化时旧理解证据标 stale，遵循 05 §9）。
- 便携：删除目录不自动删除 `%LOCALAPPDATA%` 数据；文档明示。

## 5. G3 可达性判定

| 目标 | 判定 | 依据/当前缺口 | 最小外部输入 |
|---|---|---|---|
| **便携版（浏览器+launcher）** | **有条件可做** | hoisted 树 + workspace 布局冷启动实测成功；内容包 2.0.0 加载；仍需 T13 UI live data source 与 host auth、T15/G2、产品启动器、独立 app 布局复测、NOTICE、内容最终 hash 冻结 | T13 UI 返工 + T15 通过；产品/品牌决定；许可文本收集；可选签名 |
| **安装版（标准 NSIS/MSI）** | **当前不可做（无新工具）** | makensis/WiX/dotnet SDK 均无；仅 7-Zip/SDK makeappx+signtool | 批准安装 NSIS 或 WiX/.NET SDK；CA 代码签名证书；安装脚本 |
| **MSIX 安装** | **有条件可做** | makeappx/signtool 已在 SDK；缺 CA 证书、全信任/侧载策略 | 证书 + 侧载/全信任决策 + manifest |
| **原生 Electron 桌面壳** | **BLOCKED** | 官方 `dsh-desktop` npm 404、源码不可得；需新增 electron 依赖与自写壳；品牌未授权 | 源码/许可 + 品牌授权 + 新增依赖批准（不建议本期） |
| **G3 整体** | **BLOCKED** | T15 contentReadyFull=PARTIAL（G2 未放行）、T13 UI/auth 未完成（后端 G1 已 PARTIAL）、T16 产物未构建、账户/品牌/签名未决 | 先解 T13/T15，再按上表选择交付形态 |

“有条件可做”不等于可交付：便携版当前只能证明 runtime+内容包+插件可启动；client root 仍是 fixture shell（T12 明确待 T13），所以**不能把当前冷启动当作 G3 学习闭环**。

## 6. T17 打包后验证清单

- [ ] **包清单与 hash**：产物文件清单、SHA-256、依赖/许可清单、内容包 `packVersion`/`contentHash`、DSH 版本/lock hash；与实际安装目录逐一对应。
- [ ] **泄漏扫描**：无 PDF/页图/OCR 全文/`.env`/密钥/个人 journal/研究材料/绝对开发路径；文件名+内容双扫描；白名单外零文件。
- [ ] **干净标准用户**：新 Windows 用户、无 Node/Python/pnpm/DSH、无开发 PATH、无 `E:\DSH\.dsh`；只运行交付 exe/快捷方式。
- [ ] **冷启动/离线首开**：断网首次启动可打开本地 UI；loopback only；模型不可用有明确降级文案（A30）；无 Key 不伪造回答；端口被 Windows 排除时自动换端口并重试。
- [ ] **真实教材**：用户显式导入 PDF；OCR（Windows OCR 语言包）；PDF 页/印刷页/bbox 来源可回落；全册 22 节目录/地图；不把原文/页图写入包。
- [ ] **真实模型**：按已批准 API Key 路线完成至少一次 DSH session→模型→教育工具→反馈；记录模型/版本/费用；账户路线明确不可用（用户决定）。
- [ ] **学习闭环**：作答→反馈→证据→三轴→地图更新；正确/误解/提示后作答；自评与系统判断分离。
- [ ] **重启恢复**：退出/重启/断电模拟后回到上次概念/活动；journal 尾半行/损坏恢复；不重复累计。
- [ ] **导入/删除/导出**：导入取消/恢复；导出本人记录；删除学习数据 vs 删除教材教材分开确认；卸载保留/删除数据。
- [ ] **权限与安全**：无 shell/PTC/任意路径/插件市场；Host/Origin/token；教材内提示不能提升权限；并发第二实例。
- [ ] **可访问性/视觉**：1280×800、1440×900、200% 缩放、键盘全流程、颜色+文字一致、来源弹层可读。
- [ ] **版本/兼容**：同版本重装、升级保留数据、内容包版本变化时旧证据 stale/needs_recheck。
- [ ] **签名/SmartScreen**：记录是否签名、证书主体、SmartScreen 实际表现；不冒充官方签名。
- [ ] **卸载**：标准用户卸载、快捷方式/ARP 清理、数据保留/删除符合用户选择。
- [ ] **证据**：命令、退出码、截图/日志、文件 hash、环境（OS/架构/用户类型/是否管理员）；区分便携/安装、无 Key/有 Key。

## 7. 未实测 / 未决定 / 风险

- 未实测：产品 exe/安装包、**独立 `app/` 布局的冷启动**（本轮是 workspace 布局）、真实浏览器渲染教育 root（T01 有 phase B 渲染证据，但非本卡产物）、PDF 导入→OCR→全册地图、真实模型、卸载/更新、SmartScreen、VC++ 缺失环境、长路径目标机、360/Defender 误报。
- 未决定：产品名称/品牌与分发许可；浏览器窗口 vs 原生壳；安装工具 NSIS/WiX/MSIX/SFX；代码签名证书；API Key 存储/分发；是否裁剪 office（182 MB）/speech（22 MB）/pty（26 MB）/sharp（19 MB）以缩小体积。
- 风险：T13 明确 `/edu/api/g1/*` 尚未接 Host 会话授权中间件（A24），G3 打包前必须补；hoisted 安装 exit=1（`ERR_PNPM_IGNORED_BUILDS`）需在构建流水线明确 approve/预编译策略，否则原生模块可能不可用；node-pty/koffi/sharp 的 VC++ 依赖；pnpm 符号链接不能直接分发；内容包/T15/T13 变更会改变产物与证据；MSIX/签名策略可能阻塞标准用户安装。

## 8. 证据索引（本机，均不入 Git）

| 证据 | 路径 | SHA-256/说明 |
|---|---|---|
| T00 许可清单（558 包） | `education/.local/evidence/T00/run-01/40-licenses/license-inventory.json` | `8a096371…8f2d`（250,120 B） |
| T00 许可摘要 | 同目录 `license-summary.json` | `5bd66de8…0756` |
| 固定 runtime lock | `docs/rebuild/runtime-lock.json` | `0cdb8da8…2e19` |
| hoisted 安装树（测量用） | `education/.local/cache/T16/hoisted-test/node_modules` | 527.8 MB / 35,264 files / 0 symlink；生产构建须重新生成并记录 lock/hash |
| 压缩测量：node_modules | `education/.local/cache/T16/hoisted-node_modules.7z` | `c706a547…9c2`（118.7 MB，`-mx=1`，46.4s） |
| 压缩测量：node.exe | `education/.local/cache/T16/node-exe.7z` | `b1e7cb45…a2bf`（26.3 MB） |
| 冷启动结果 | `education/.local/cache/T16/logs/cold-start.result.jsonl` | `22e6dcbe…4462`；1.69s；303→200；pack 2.0.0；无 Key degraded |
| 冷启动 stdout/stderr | 同目录 `cold-start.stdout.log` / `.stderr.log` | stdout 含一次性 token（仅本机，不提交）；stderr 空 |
| 隔离 DSH_HOME/数据 | `education/.local/cache/T16/home`、`…/data` | 生成 profiles（junction）；未触碰 `E:\DSH\.dsh` |
