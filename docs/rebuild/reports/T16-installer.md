# T16 安装器（A3）：NSIS 一键安装 exe

- 负责人：主控（lead）
- 时间：2026-10-30 03:1x–03:55 +08:00
- 结论：**一键安装 v1 已产出并完成"安装→启动→卸载"冒烟**；仍未达 G3（L5 完整学习闭环），原因见 §5。

## 1. 产物

| 项 | 值 |
|---|---|
| 安装包（v3，含 sharp + F4 修复） | `education/dist/SproutAsk-Setup-x64.exe` |
| 大小 / SHA-256 | **59,398,331 B（56.6 MB）** / `4B983BEB0B52EA45E623D2F3C0A0DB71DF1A78535DBC2F0E3D81629280A1D2F6`（v3；v2 为 59,399,731 B / `62BD79CC…3527`）（v1 为 52,796,562 B / `8440B210…5BD05`，已被 v2 取代） |
| 学生 payload | `education/dist/student/`，**34,493 文件 / 408,379,623 B（389.5 MB），含 sharp/libvips**，0 符号链接 |
| 7z 对照体积 | 74.2 MB（payload 7z -mx=1，A1 实测；NSIS lzma solid 更小） |
| 构建命令 | `node education/scripts/packaging/build-installer.mjs`（约 628 s） |
| 脚本 | `education/scripts/packaging/nsis/SproutAsk-Setup.nsi`、`education/scripts/packaging/build-installer.mjs` |
| 证据 | `education/.local/evidence/T16/smoke-installer/smoke-summary.json` |

NSIS 3.10（`zlib/libpng` 许可）来自 SourceForge 官方 zip（本机 GitHub/winget 下载被网络阻断，SourceForge http 直连可用），解压到 `education/.local/cache/T16/tools/nsis/`，**未做系统级安装**。

## 2. 安装器行为

- **免管理员**：`RequestExecutionLevel user`，安装到 `%LOCALAPPDATA%\SproutAsk\current`。
- 开始菜单 + 桌面快捷方式 → `launcher.vbs`（隐藏控制台，内部调用 `launcher.cmd`）。
- 标准卸载项（`HKCU\…\Uninstall\SproutAsk`，DisplayName `SproutAsk 生物学习`、Version `0.3.0`），支持 `/S` 静默卸载。
- 学习数据固定在 `%LOCALAPPDATA%\SproutAsk\data`（`dsh-home` + `learner-data` + `logs`），**卸载时单独询问是否删除，默认保留**。
- 安装目录写 `install-info.txt`（版本/build/安装目录/数据目录/"NSIS"/"signed: no"）。
- UI 语言：简体中文 + English（MUI2，`Unicode true` + UTF-8 BOM 编译，中文显示已实测正确）。

## 3. 冒烟实测（2026-10-30 03:4x）

| 步骤 | 结果 |
|---|---|
| 静默安装（`/S`） | 退出 0；34,434 文件 / 369.6 MB；开始菜单与桌面快捷方式存在；ARp 项正确（中文 DisplayName、0.3.0） |
| 启动（`launcher.vbs`，临时数据根） | 1,692 ms 启动；端口 38828；token 访问 **303** → `/edu/api/status` **200**；`degraded`（`DEEPSEEK_API_KEY is not present`）；DSH `0.2.1-rc.3`、6 个教育工具、`loopback_only`、pack `2.0.0`；Edge `--app` 窗口打开（独立 `--user-data-dir`，不干扰用户浏览器） |
| 停止 | 结束 App 进程与独立 Edge 实例后端口关闭、无残留 node 进程 |
| 静默卸载（`/S`） | 安装目录、快捷方式、注册表项全部移除；**`data` 目录保留**（设计如此） |

## 4. 关键限制（如实）

1. **未签名**：Windows 会提示"未知发布者"；安装页已如实告知。要消除需 CA 代码签名证书（未购买）。
2. **首启 23.1 s**（A1 实测：首次创建 profile + 打开 Edge）；热启 1.47 s。
3. **不含 sharp**（按 5A 裁剪）：DSH 原生图片附件路径 `prepareImageFile` 会 `MODULE_NOT_FOUND: sharp`。若要让"上传图片"走 DSH 原生附件，需 `--keep-sharp` 重建（payload +19.8 MB，且重新引入 LGPL-3.0 的 libvips 义务）。
4. **UI 仍 `fixtureData: true`**（status.body 实测）：T13 的 live data source 只接了一部分，真实学习闭环未在产物中验证。
5. **无 Key 即 `degraded`**：可读本地教材/地图/记录，云推理不可用；安装包里没有 Key 配置界面（下一步需补）。
6. **内容仍是 candidate**：理解证据显示"尚无足够证据"，正式学习需 human curator 发布。
7. **build id 显示 `unversioned`**：payload `version.txt` 的字段名与安装器正则不一致（只影响 `install-info.txt` 一行，不影响功能）。

## 5. 与 G3 的关系

| G3 要求（07 §3） | 当前 |
|---|---|
| 实际便携/安装产物、固定 hash | ✅ 安装 exe 有固定 hash；便携 payload 有目录与体积 |
| 独立 userData、无开发 PATH | ⚠️ 安装烟试用独立数据根通过；未在"无 Node/无 pnpm/无项目目录"的干净机验证 |
| 离线首次打开 | ✅ 无 Key 可启动并显示 degraded（本地材料可读） |
| 配置后真实学习 | ❌ UI live data source 未接完 + 内容 candidate |
| 卸载保留/删除数据 | ✅ 已实测（保留） |

**结论：G3 = BLOCKED（不是 PASS）**。产物可用，但"真实学习闭环"这一条没达到；不得据此宣称学生可交付。

## 6. 下一步（按依赖）

1. T13 把 live data source 接完（`fixtureData=false`）并在产物里跑 G1 UI 旅程 → 才有 L5 学习证据；
2. 补 Key 录入界面（宿主侧加密存储）+ 首次启动引导；
3. 内容 human curator 发布首节 → 正式理解判断可用；
4. 决定是否 `--keep-sharp` 重建（A20 图片上传）；
5. 若要对外分发：买证书签名 + 品牌/商标口径确认 + 17 个缺许可文本包处理。

## 7. v2 重建（2026-10-30 04:5x）：含 sharp + live sources + Key 端点

用户批准保留图片上传能力，因此按 `--keep-sharp` 重建；同时 T13 已把 live data source 接完、Key 端点完成。

| 项 | v1 | v2 |
|---|---|---|
| payload | 34,432 文件 / 369.5 MB（无 sharp） | **34,493 文件 / 389.5 MB**（含 sharp + libvips） |
| 安装包 | 52,796,562 B（50.4 MB） / `8440B210…5BD05` | **59,399,731 B（56.6 MB）** / `62BD79CC…3527` |
| 产物内 `dto.fixtureData` | true（演示数据） | **false**（真实 knowledge/learner/storage/importer） |
| Key 录入 | 无界面 | `/account` 可录；`POST/GET/DELETE /edu/api/auth/key`，DPAPI 存 `secrets/model-key.dat`，`restartRequired:true` |
| 真实模型通路 | 未验（无 Key） | **已验**：无 env key、仅加密文件启动 → `status=ready`；1 次 `/edu/api/live-selftest` 返回带 PDF 11/印刷页 2 锚点的回答 |

**v2 冒烟实测（04:46）**：静默安装 34,495 文件 → 启动 **1.62 s**（端口 47172）→ token 303 / status 200 → `fixtureData=false / packVersion=2.0.0 / conceptCount=43 / 6 tools / loopback_only` → Edge `--app` 打开 → 结束进程后端口关闭、无残留；安装目录当前保留在本机（开始菜单/桌面快捷方式）。

**注意（卸载器行为）**：若产品进程仍占用安装目录文件（例如 node.exe 未退出），NSIS 卸载器在静默模式下会**反复重试而不返回**。实际卸载前请先关闭应用窗口；必要时结束残留 `node.exe` 再卸载。已实测：关闭进程后卸载正常。

**sharp 许可**：`@img/sharp-win32-x64` 内含 libvips（LGPL-3.0-or-later）→ 已把 `education/licenses/NOTICE.md` 对应行改为 `yes（随包）`，并在 `EXCLUDED.md` 写明 LGPL 义务（附全文、源码获取方式、可替换）。

**剩余 L5 缺口**：干净机（无 Node/pnpm/项目目录）验证、内容 human curator 发布、代码签名。

## 8. L5 近似验证（2026-10-30 05:2x，主控实测）

07 的 L5 要求"实际 Windows 产物在独立用户数据目录运行"。本机只有一台机器，因此做的是**明确标注的 L5 近似**（同一台机器、同一 Windows 账户）：

| 条件 | 做法 |
|---|---|
| 不用开发机依赖 | 启动前把 `PATH` 裁剪为 `C:\Windows\system32;C:\Windows`（**无 node/pnpm/git**），工作目录设为 `C:\Windows\Temp` |
| 独立数据目录 | 全新空数据根（`...\.local\cache\T16\l5-approx`），不继承任何既有 `DSH_HOME` |
| 真实产物 | 只用已安装的 `%LOCALAPPDATA%\SproutAsk\current\launcher.vbs` / `start-student-web.mjs` |
| Key 路径 | 不设环境变量，通过产物自身 `POST /edu/api/auth/key` 录入 → DPAPI 加密文件 → 重启生效 |
| 真实模型 | `POST /edu/api/live-selftest`（header `x-edu-selftest: 1`） |

**结果**：首启 44.97 s（建 profile + 无 Edge）→ `/edu/api/status` **200**、`fixtureData=false`、pack 2.0.0、43 概念、6 工具、loopback；Key 录入 **200** `configured + restartRequired`；重启后 `status=ready`、`auth=api_key/available`（1.85 s）；`live-selftest` **200**，assistant 文本含"观察的含义与地位 / PDF 页 11 / 印刷页 2"。结束后进程清理、端口关闭、**含 Key 副本的测试数据根已删除**。

**发现（F4，已交 T13 owner）**：在 PATH 被裁剪的环境里，`POST /edu/api/auth/key` 返回 **500 INTERNAL** —— Key 的 DPAPI 加解密按名调用 `powershell`，PATH 无 `System32\WindowsPowerShell\v1.0` 时失败。默认 Windows PATH 含该目录，故普通用户不受影响；修复方式为改用绝对路径。

**仍然不是 L5 的部分**：同一台机器/同一账户、未签名、内容仍 candidate（正式理解判断不可用）、未在"另一台从未装过开发工具"的机器上跑。因此 G3 记 **PARTIAL**，不记 PASS。
