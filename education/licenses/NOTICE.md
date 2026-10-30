# 第三方许可 NOTICE（Third-Party Notices）

> 本文件由 `education/licenses/tools/build-notice-v2.mjs` 从数据文件生成，**请勿手改**。

- 包清单基准：`.local/evidence/T00/run-01/40-licenses/license-inventory.json`（sha256 `8a096371fb93089e3f577b120084051a04fdc9a7ea7de7579f50bd8343f88f2d`，558 包；306 官方 / 252 第三方）
- 随包判定基准：`education/dist/student/app/node_modules` 实测目录（本文件生成时该目录含 193 个顶层条目）
- 缺文本清单：`education/licenses/data/missing-licenses.json`（18 包：1 已补齐 / 17 上游未提供）
- 生成器不写入时间戳、按包名排序，因此同一份输入两次生成的字节相同（可重复性见 §4）

## 0. 随包状态总览（以实物 payload 为准）

| 状态 | 包数 | 含义 |
|---|---|---|
| `yes` | 546 | payload 内实测存在该包目录 → 随学生包分发 |
| `no (5A trim)` | 12 | payload 内实测不存在，且属于 §0.1 的裁剪项 → 不随包 |
| 合计 | 558 | 与 T00 全量闭包一致 |

### 0.1 当前裁剪项（12 包 / 5 组，全部为 payload 实测缺失）

| 组 | 包 | 版本 | 许可 | 裁剪原因 |
|---|---|---|---|---|
| Office 转换（LibreOffice Kit，MPL-2.0） | `@deepseek-ai/libreoffice-kit` | 0.1.5 | MPL-2.0 | 学生端不提供 Office 转换；需要几百 MB 二进制与额外运行时 |
| Office 转换（LibreOffice Kit，MPL-2.0） | `@deepseek-ai/libreoffice-kit-win32-x64` | 0.1.5 | MPL-2.0 | 学生端不提供 Office 转换；需要几百 MB 二进制与额外运行时 |
| Office 技能入口（MIT） | `@deepseek-ai/dsh-office-to-pdf` | 0.2.1-rc.3 | MIT | 依赖 office 转换链路，链路裁剪后入口无意义 |
| Office 技能入口（MIT） | `@deepseek-ai/dsh-skill-office` | 0.2.1-rc.3 | MIT | 依赖 office 转换链路，链路裁剪后入口无意义 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-api-speech-to-text` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-client-ui-voice-input` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-speech-to-text` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-speech-to-text-sensevoice` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-voice-input-bundle` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 |
| sherpa-onnx 原生库（Apache-2.0） | `sherpa-onnx-node` | 1.13.8 | Apache-2.0 | 语音识别的原生依赖，随语音链路一起裁剪 |
| sherpa-onnx 原生库（Apache-2.0） | `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | 语音识别的原生依赖，随语音链路一起裁剪 |
| node-pty（MIT） | `node-pty` | 1.2.0-beta.15 | MIT | 学生端不起终端，PTY 及其 conpty/OpenConsole 二进制不需要 |

### 0.2 sharp / libvips 的状态（与裁剪清单互斥，必须显式确认）

- `sharp` 0.35.5（Apache-2.0）：**随包 (`yes`)**，学生端图片上传/缩略图依赖它。
- `@img/sharp-win32-x64`（Apache-2.0 AND **LGPL-3.0-or-later**）：**随包 (`yes`)**；payload 内 `@img/sharp-win32-x64/lib/` 实测含 `libvips-42.dll`、`libvips-cpp-8.18.7.dll`。
- 结论：**sharp/@img 不属于 5A 裁剪项**，不得在 NOTICE/EXCLUDED 中写成"已裁剪"；其 LGPL 义务见 §3.1。

## 1. 包清单（按许可分组）

列说明：`随包` = payload 实测；`版权行` 取自该包许可文本的首个版权行（无文本则记 `—`）；`文本` 指向去重后的全文文件。

### MIT（472 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@anthropic-ai/sdk` | 0.129.0 | MIT | Copyright 2023 Anthropic, PBC. | yes | [8bf96984ff8bcfae.txt](texts/8bf96984ff8bcfae.txt)<br>[d8c77eaffed7f1f8.txt](texts/d8c77eaffed7f1f8.txt) |
| `@babel/code-frame` | 7.29.7 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors | yes | [117da2af0d4ce0fe.txt](texts/117da2af0d4ce0fe.txt) |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors | yes | [117da2af0d4ce0fe.txt](texts/117da2af0d4ce0fe.txt) |
| `@babel/runtime` | 7.29.10 | MIT | Copyright (c) 2014-present Sebastian McKenzie and other contributors | yes | [117da2af0d4ce0fe.txt](texts/117da2af0d4ce0fe.txt) |
| `@deepseek-ai/cordis` | 4.0.5 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/cordis-plugin-group` | 1.0.5 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/cordis-plugin-include` | 1.0.10 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/cordis-plugin-loader` | 1.0.6 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/cordis-plugin-timer` | 1.1.7 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/cosmokit` | 1.8.6 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/dsh` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-acp` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-acp-app` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-default-model` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-instructions` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-loop` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-preset` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-preset-registry` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-agent-tool-presentation` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-anonymous-user-id` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-account-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-gateway` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-job-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-remote-access` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-remotes` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-session-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-settings-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-terminal-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-workspace-controller` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-api-workspace-files` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-app-boot` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-atomic-write` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-attachment` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-attachment-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-authorization` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-base` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-bash-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-bash-sandbox` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-brand` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-chunked-list` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-connection` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-file-upload` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-hmr` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-locale` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-modules` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-product-analytics` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-resources` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-shortcuts` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-agent-preset` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-approval` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-attachment` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-brand-official` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-chat` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-commands` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-conversation` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-cordis` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-deepseek-model-label-1017` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-deliverables` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-directory-picker-browse` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-directory-picker-native` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-entry-customization` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-goal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-input-trigger` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-jobs` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-layout` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-message-feedback` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-model-selection` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-open-in-app` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-permission-presets` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-plan` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-plugin-manager` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-plugin-market` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-reference` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-renderer` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-schedule` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-secret-mask` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-session` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-account` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-agent-loop` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-general` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-models` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-plugins` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-session-log` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-shell` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-subagent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-settings-web-search` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-shortcuts` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar-browser` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar-documentpreview` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar-files` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar-right` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-sidebar-terminal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-skill` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-subagent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-theme` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-tool` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-trajectory` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-user-questions` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-workflow-run` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-client-ui-workspace` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-cmdline` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-command-compact` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-command-feedback` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-command-goal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-commands` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-compaction` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-compaction-basic` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-compaction-image-offload` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-compaction-tool-result-pruner` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-config-editor` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-cordis-client-runner` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-cordis-host-runner` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-credentials` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-credentials-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-deepseek-account` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-deepseek-account-platform` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-deepseek-llm-api-extensions` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-deque` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-agent-team` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-agent-team-profile` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-api-speech-to-text` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-auto-review` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-badge-skill-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-client-ui-agent-team` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-client-ui-cot-translation` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-client-ui-voice-input` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-cot-translation-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-inspector` | 0.2.1-rc.3 | MIT | // Copyright 2014 The Chromium Authors | yes | [ff11d445fb41a108.txt](texts/ff11d445fb41a108.txt)<br>[76a876cf886ff9be.txt](texts/76a876cf886ff9be.txt)<br>[af175b9d96ee93c2.txt](texts/af175b9d96ee93c2.txt)<br>[ff11d445fb41a108.txt](texts/ff11d445fb41a108.txt)<br>[a3f2fe2ac6b471aa.txt](texts/a3f2fe2ac6b471aa.txt)<br>[aa8f65819a471c1a.txt](texts/aa8f65819a471c1a.txt)<br>[58d1e17ffe5109a7.txt](texts/58d1e17ffe5109a7.txt)<br>[58d1e17ffe5109a7.txt](texts/58d1e17ffe5109a7.txt)<br>[7ec9661a8afafab1.txt](texts/7ec9661a8afafab1.txt)<br>[0212e9ffd60f4c2e.txt](texts/0212e9ffd60f4c2e.txt)<br>[ef3882f3b2cf9e1c.txt](texts/ef3882f3b2cf9e1c.txt)<br>[53e59feb13058722.txt](texts/53e59feb13058722.txt)<br>[cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt)<br>[7ec9661a8afafab1.txt](texts/7ec9661a8afafab1.txt)<br>[45d31799d0db956c.txt](texts/45d31799d0db956c.txt)<br>[91968bf678e8c3d9.txt](texts/91968bf678e8c3d9.txt)<br>[8e3a3f82f59a6095.txt](texts/8e3a3f82f59a6095.txt)<br>[a27ca07269b35185.txt](texts/a27ca07269b35185.txt)<br>[4687b3b5b6eb3af1.txt](texts/4687b3b5b6eb3af1.txt)<br>[eb0fa16c74523410.txt](texts/eb0fa16c74523410.txt)<br>[a8d80f63116de4ec.txt](texts/a8d80f63116de4ec.txt)<br>[cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt)<br>[53b4475d1cda8c46.txt](texts/53b4475d1cda8c46.txt)<br>[53b4475d1cda8c46.txt](texts/53b4475d1cda8c46.txt)<br>[e1f2a92813d0a716.txt](texts/e1f2a92813d0a716.txt)<br>[e1f2a92813d0a716.txt](texts/e1f2a92813d0a716.txt)<br>[c2cfccb812fe4821.txt](texts/c2cfccb812fe4821.txt)<br>[0d542e0c8804e39a.txt](texts/0d542e0c8804e39a.txt)<br>[bfdeded4040e05da.txt](texts/bfdeded4040e05da.txt) |
| `@deepseek-ai/dsh-experimental-inspector-profile` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-plugin-market-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-ralph-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-session-inspector` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-session-search` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-session-titles-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-speech-to-text` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-speech-to-text-sensevoice` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-terminal-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-tool-agent-team` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-tool-worktree` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-translator` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-voice-input-bundle` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-experimental-worktree` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-file-reference` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-file-reference-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-fs` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-fs-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-fs-observation-policy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-fs-sandbox` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-goal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-goal-round-driver` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-harness-dev-context` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-headless` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-hmr` | 0.2.1-rc.3 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@deepseek-ai/dsh-home-paths` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-directory-picker` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-directory-picker-auto` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-directory-picker-browse` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-directory-picker-native` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-frontend-static` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-open-in-app` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-plugin-inventory` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-product-telemetry-otel` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-host-webserver` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-http-proxy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-jobs` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-jobs-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-launch-environment` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-lazy-require` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm-deepseek` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm-deepseek-account` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm-deepseek-api-key` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm-pi-ai` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-llm-retry` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-mcp-client` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-mcp-resources` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-message-feedback` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-native-command` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-office-to-pdf` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-otel` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-output-retention` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-package-manifest` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-permission-presets` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-persona` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-plan-mode` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-plugin-manager` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-plugin-market` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-plugin-market-index` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-plugin-package-inventory-deepseek` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-ptc-runtime` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-ptc-runtime-node` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-pwsh-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-pwsh-sandbox` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-repeat-tool-reminder` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sandbox` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sandbox-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sandbox-policy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sandbox-windows-acl` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-schedule` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-scope` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sdk-app` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sdk-jsonrpc-server` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sdk-minimal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-sdk-protocol` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-checkpoint-policy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format-catalog` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format-v0-to-v1` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format-v1-to-v2` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format-v2-to-v3` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-format-v3-to-v4` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-log-deepseek` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-log-export` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-persistence` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-persistence-jsonl` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-projection` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-projection-cache` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-query` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-query-sqlite` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-reference` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-stats` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-telemetry` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-telemetry-otel` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-title` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-title-all-prompts-llm` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-title-first-prompt-llm` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-title-llm` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-session-turn-outline` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-settings` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-shell` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-shell-env` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-skill` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-skill-badge` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-skill-filesystem` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-skill-office` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | no (5A trim) | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-spill` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-spill-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-spill-policy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [8f2bee9bda101e73.txt](texts/8f2bee9bda101e73.txt)<br>[0e8b5a28ec714310.txt](texts/0e8b5a28ec714310.txt)<br>[ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-storage` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-storage-domain` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-storage-json` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-subagent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-subagent-fork-in-process` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-subagent-spawn-in-process` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-subprocess` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-subprocess-local` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-system-prompt` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-terminal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-terminal-bash` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-time-context` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-timeout` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tmux-context` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-token-meter` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-ask-user` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-bash` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-bash-persistent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-call-timeout-policy` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-cordis` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-fs` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-fs-search` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-goal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-jobs` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-present` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-pwsh` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-pwsh-persistent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-ralph` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-schedule` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-session-query` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-skill` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-str-replace-editor` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-subagent` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-subagent-control` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-terminal` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-todo` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-web` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-workflow` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-working-directory` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tool-workspace-dependencies` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-tools` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-typert-loader` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-typert-protocol` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-typert-registry` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-user-approval` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-user-questions` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-util-code-language` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-util-crypto` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-util-time` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-util-values` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-util-workspace-path` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web-app` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web-deepseek-api` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web-fetch-http` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web-frontend` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-web-search-deepseek` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-win32-process` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-workflow` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-workflow-ptc` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-working-directory` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-workspace` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/dsh-workspace-changes` | 0.2.1-rc.3 | MIT | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@deepseek-ai/schemastery` | 3.18.5 | MIT | Copyright (c) 2021-present Shigma | yes | [034fb52b1d57360e.txt](texts/034fb52b1d57360e.txt) |
| `@earendil-works/pi-ai` | 1.4.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `@earendil-works/pi-telemetry` | 1.4.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `@eslint-community/regexpp` | 4.12.2 | MIT | Copyright (c) 2018 Toru Nagashima | yes | [fcf6eabf68ca9698.txt](texts/fcf6eabf68ca9698.txt) |
| `@img/colour` | 1.1.0 | MIT | Copyright (c) 2012 Heather Arthur | yes | [e2eaa4603c14cb26.txt](texts/e2eaa4603c14cb26.txt) |
| `@joplin/turndown-plugin-gfm` | 1.0.68 | MIT | Copyright (c) 2017 Dom Christie | yes | [a055e3a15db4b4cb.txt](texts/a055e3a15db4b4cb.txt) |
| `@keyv/serialize` | 1.1.1 | MIT | Copyright (c) 2017-2021 Luke Childs | yes | [1f7dca26d2d328c3.txt](texts/1f7dca26d2d328c3.txt) |
| `@koromix/koffi-win32-x64` | 3.1.1 | MIT | — | yes | 上游未提供文本（见 §2） |
| `@modelcontextprotocol/client` | 2.2.0 | MIT | "Licensor" shall mean the copyright owner or entity authorized by | yes | [0382b0057770ca05.txt](texts/0382b0057770ca05.txt) |
| `@modelcontextprotocol/core` | 2.2.0 | MIT | "Licensor" shall mean the copyright owner or entity authorized by | yes | [0382b0057770ca05.txt](texts/0382b0057770ca05.txt) |
| `@sec-ant/readable-stream` | 0.4.1 | MIT | Copyright (c) 2022 Ze-Zheng Wu | yes | [7e32638e170fa734.txt](texts/7e32638e170fa734.txt) |
| `@sindresorhus/is` | 7.2.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `@sindresorhus/merge-streams` | 4.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `@stablelib/base64` | 1.0.1 | MIT | Copyright (C) 2016 Dmitry Chestnykh | yes | [1605b77bebe018db.txt](texts/1605b77bebe018db.txt) |
| `@standard-schema/spec` | 1.1.0 | MIT | Copyright (c) 2024 Colin McDonnell | yes | [653b779005a3a4d6.txt](texts/653b779005a3a4d6.txt) |
| `@types/http-cache-semantics` | 4.2.0 | MIT | Copyright (c) Microsoft Corporation. | yes | [c2cfccb812fe4821.txt](texts/c2cfccb812fe4821.txt) |
| `@types/node` | 26.6.5 | MIT | Copyright (c) Microsoft Corporation. | yes | [c2cfccb812fe4821.txt](texts/c2cfccb812fe4821.txt) |
| `@types/retry` | 0.12.0 | MIT | Copyright (c) Microsoft Corporation. All rights reserved. | yes | [dea9265341829002.txt](texts/dea9265341829002.txt) |
| `@vscode/ripgrep` | 1.18.0 | MIT | Copyright (c) Microsoft Corporation | yes | [ccf06b70760761ae.txt](texts/ccf06b70760761ae.txt) |
| `@vscode/ripgrep-win32-x64` | 1.18.0 | MIT | Copyright (c) Microsoft Corporation | yes | [ccf06b70760761ae.txt](texts/ccf06b70760761ae.txt) |
| `@xterm/addon-serialize` | 0.14.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `@xterm/headless` | 6.0.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `agent-base` | 7.1.4 | MIT | Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net> | yes | [8d8c55319c7729d5.txt](texts/8d8c55319c7729d5.txt) |
| `agent-base` | 9.0.0 | MIT | Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net> | yes | [8d8c55319c7729d5.txt](texts/8d8c55319c7729d5.txt) |
| `ajv` | 8.20.0 | MIT | Copyright (c) 2015-2021 Evgeny Poberezkin | yes | [a05350a88e318e4f.txt](texts/a05350a88e318e4f.txt) |
| `base64-js` | 1.5.1 | MIT | Copyright (c) 2014 Jameson Little | yes | [5b37224c080cdcc9.txt](texts/5b37224c080cdcc9.txt) |
| `bignumber.js` | 9.3.1 | MIT | Copyright © `<2025>` `Michael Mclaughlin` | yes | [def75ba75d6426f1.txt](texts/def75ba75d6426f1.txt) |
| `bowser` | 2.15.0 | MIT | Copyright 2015, Dustin Diaz (the "Original Author") | yes | [dfde54fedc270c2a.txt](texts/dfde54fedc270c2a.txt) |
| `brotli` | 1.3.3 | MIT | — | yes | 上游未提供文本（见 §2） |
| `bundle-name` | 4.1.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `byte-counter` | 0.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `bytes` | 3.1.2 | MIT | Copyright (c) 2012-2014 TJ Holowaychuk <tj@vision-media.ca> | yes | [e3b44af066615de2.txt](texts/e3b44af066615de2.txt) |
| `cacheable-lookup` | 7.0.0 | MIT | Copyright (c) 2019 Szymon Marczak | yes | [b35de79efc88b23c.txt](texts/b35de79efc88b23c.txt) |
| `cacheable-request` | 13.0.19 | MIT | MIT License & © Jared Wray | yes | [465e8da349d50d85.txt](texts/465e8da349d50d85.txt) |
| `chokidar` | 5.0.0 | MIT | Copyright (c) 2012 Paul Miller (https://paulmillr.com), Elan Shanker | yes | [bdfd5e0edb6089e6.txt](texts/bdfd5e0edb6089e6.txt) |
| `clone` | 2.1.2 | MIT | Copyright © 2011-2015 Paul Vorbach <paul@vorba.ch> | yes | [3fb0857ef0133928.txt](texts/3fb0857ef0133928.txt) |
| `commander` | 15.0.0 | MIT | Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca> | yes | [04512a63dce4d2d5.txt](texts/04512a63dce4d2d5.txt) |
| `compressible` | 2.0.18 | MIT | Copyright (c) 2013 Jonathan Ong <me@jongleberry.com> | yes | [b6be1b6c4e8c0441.txt](texts/b6be1b6c4e8c0441.txt) |
| `compression` | 1.8.2 | MIT | Copyright (c) 2014 Jonathan Ong <me@jongleberry.com> | yes | [23d466b1b134b415.txt](texts/23d466b1b134b415.txt) |
| `content-type` | 2.1.0 | MIT | Copyright (c) 2015 Douglas Christopher Wilson | yes | [257aed98914108e9.txt](texts/257aed98914108e9.txt) |
| `cross-spawn` | 7.0.6 | MIT | Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio> | yes | [aaa78451b6fecd1b.txt](texts/aaa78451b6fecd1b.txt) |
| `data-uri-to-buffer` | 4.0.1 | MIT | — | yes | 上游未提供文本（见 §2） |
| `debug` | 2.6.9 | MIT | — | yes | 上游未提供文本（见 §2） |
| `debug` | 4.4.3 | MIT | Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> | yes | [3a61c6c96caf5c1d.txt](texts/3a61c6c96caf5c1d.txt) |
| `decompress-response` | 10.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `default-browser` | 5.5.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `default-browser-id` | 5.0.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `define-lazy-prop` | 3.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `depd` | 2.0.0 | MIT | Copyright (c) 2014-2018 Douglas Christopher Wilson | yes | [bd134b41da59e452.txt](texts/bd134b41da59e452.txt) |
| `destroy` | 1.2.0 | MIT | Copyright (c) 2014 Jonathan Ong me@jongleberry.com | yes | [ffe370c8785b0b68.txt](texts/ffe370c8785b0b68.txt) |
| `dfa` | 1.2.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `ee-first` | 1.1.1 | MIT | Copyright (c) 2014 Jonathan Ong me@jongleberry.com | yes | [965ef284f7f4c176.txt](texts/965ef284f7f4c176.txt) |
| `encodeurl` | 2.0.0 | MIT | Copyright (c) 2016 Douglas Christopher Wilson | yes | [7585ea7bba616ccb.txt](texts/7585ea7bba616ccb.txt) |
| `escape-html` | 1.0.3 | MIT | Copyright (c) 2012-2013 TJ Holowaychuk | yes | [255aa557a1f55224.txt](texts/255aa557a1f55224.txt) |
| `etag` | 1.8.1 | MIT | Copyright (c) 2014-2016 Douglas Christopher Wilson | yes | [a7996721249a136f.txt](texts/a7996721249a136f.txt) |
| `eventsource` | 3.0.7 | MIT | Copyright (c) EventSource GitHub organisation | yes | [f683a72ffe6a9675.txt](texts/f683a72ffe6a9675.txt) |
| `eventsource-parser` | 3.1.1 | MIT | Copyright (c) 2026 Espen Hovlandsdal <espen@hovlandsdal.com> | yes | [835eb611a23301b2.txt](texts/835eb611a23301b2.txt) |
| `execa` | 10.2.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `extend` | 3.0.2 | MIT | Copyright (c) 2014 Stefan Thomas | yes | [97af7428f93afbab.txt](texts/97af7428f93afbab.txt) |
| `fast-deep-equal` | 3.1.3 | MIT | Copyright (c) 2017 Evgeny Poberezkin | yes | [7bf9b2de73a6b356.txt](texts/7bf9b2de73a6b356.txt) |
| `fetch-blob` | 3.2.0 | MIT | Copyright (c) 2019 David Frank | yes | [a5edccac92c3aa84.txt](texts/a5edccac92c3aa84.txt) |
| `fflate` | 0.8.2 | MIT | Copyright (c) 2023 Arjun Barrett | yes | [805f6cb28bb8b6d3.txt](texts/805f6cb28bb8b6d3.txt) |
| `fflate` | 0.8.3 | MIT | — | yes | 上游未提供文本（见 §2） |
| `figures` | 6.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `fontkit` | 2.0.4 | MIT | — | yes | 上游未提供文本（见 §2） |
| `form-data-encoder` | 4.1.0 | MIT | Copyright (c) 2021-present Nick K. | yes | [cd1dfbe6a9f582a5.txt](texts/cd1dfbe6a9f582a5.txt) |
| `formdata-polyfill` | 4.0.10 | MIT | Copyright (c) 2016 Jimmy Karl Roland Wärting | yes | [435a6437e47e5e47.txt](texts/435a6437e47e5e47.txt) |
| `fresh` | 2.0.0 | MIT | Copyright (c) 2012 TJ Holowaychuk <tj@vision-media.ca> | yes | [a0ec0dab16b3666f.txt](texts/a0ec0dab16b3666f.txt) |
| `get-stream` | 9.0.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `got` | 14.6.6 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `http-errors` | 2.0.1 | MIT | Copyright (c) 2014 Jonathan Ong me@jongleberry.com | yes | [dcb94ff9b1e037a8.txt](texts/dcb94ff9b1e037a8.txt) |
| `http-proxy-agent` | 9.1.0 | MIT | Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net> | yes | [71368fd0f5b41291.txt](texts/71368fd0f5b41291.txt) |
| `http2-wrapper` | 2.2.1 | MIT | Copyright (c) 2018 Szymon Marczak | yes | [0194571d45a06ea2.txt](texts/0194571d45a06ea2.txt) |
| `https-proxy-agent` | 7.0.6 | MIT | Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net> | yes | [8d8c55319c7729d5.txt](texts/8d8c55319c7729d5.txt) |
| `https-proxy-agent` | 9.1.0 | MIT | Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net> | yes | [8d8c55319c7729d5.txt](texts/8d8c55319c7729d5.txt) |
| `ipaddr.js` | 2.5.0 | MIT | Copyright (C) 2011-2017 whitequark <whitequark@whitequark.org> | yes | [62568a2d1337b771.txt](texts/62568a2d1337b771.txt) |
| `is-docker` | 3.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-in-ssh` | 1.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-inside-container` | 1.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-plain-obj` | 4.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-stream` | 4.0.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-unicode-supported` | 2.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `is-wsl` | 3.1.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `jose` | 6.2.13 | MIT | Copyright (c) 2018 Filip Skokan | yes | [8078b0829d6c3e9e.txt](texts/8078b0829d6c3e9e.txt) |
| `js-tokens` | 4.0.0 | MIT | Copyright (c) 2014, 2015, 2016, 2017, 2018 Simon Lydell | yes | [2213d91c606205c7.txt](texts/2213d91c606205c7.txt) |
| `js-yaml` | 4.3.2 | MIT | Copyright (C) 2011-2015 by Vitaly Puzrin | yes | [a07bc24468b9654c.txt](texts/a07bc24468b9654c.txt) |
| `json-bigint` | 1.0.0 | MIT | Copyright (c) 2013 Andrey Sidorov | yes | [def82c085d05e795.txt](texts/def82c085d05e795.txt) |
| `json-schema-to-ts` | 3.1.1 | MIT | Copyright (c) 2020 Thomas Aribart | yes | [18a2bfd070b08bd1.txt](texts/18a2bfd070b08bd1.txt) |
| `json-schema-traverse` | 1.0.0 | MIT | Copyright (c) 2017 Evgeny Poberezkin | yes | [7bf9b2de73a6b356.txt](texts/7bf9b2de73a6b356.txt) |
| `jwa` | 2.0.1 | MIT | Copyright (c) 2013 Brian J. Brennan | yes | [3320319f8a5f42bc.txt](texts/3320319f8a5f42bc.txt) |
| `jws` | 4.0.1 | MIT | Copyright (c) 2013 Brian J. Brennan | yes | [3320319f8a5f42bc.txt](texts/3320319f8a5f42bc.txt) |
| `keyv` | 5.6.0 | MIT | Copyright (c) 2017-2021 Luke Childs | yes | [1f7dca26d2d328c3.txt](texts/1f7dca26d2d328c3.txt) |
| `koffi` | 3.1.1 | MIT | Copyright (C) 2026  Niels Martignène <niels.martignene@protonmail.com> | yes | [22bcbbbacd739b02.txt](texts/22bcbbbacd739b02.txt)<br>[89024017b88a9f2b.txt](texts/89024017b88a9f2b.txt)<br>[a553508f516031c9.txt](texts/a553508f516031c9.txt) |
| `lowercase-keys` | 3.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `mime-db` | 1.54.0 | MIT | Copyright (c) 2014 Jonathan Ong <me@jongleberry.com> | yes | [cc1dfd4dafa27271.txt](texts/cc1dfd4dafa27271.txt) |
| `mime-types` | 3.0.2 | MIT | Copyright (c) 2014 Jonathan Ong <me@jongleberry.com> | yes | [71f83c4c0621102a.txt](texts/71f83c4c0621102a.txt) |
| `mimic-response` | 4.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `minisearch` | 7.2.0 | MIT | Copyright 2022 Luca Ongaro | yes | [70d37354d6395629.txt](texts/70d37354d6395629.txt) |
| `ms` | 2.0.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `ms` | 2.1.3 | MIT | Copyright (c) 2020 Vercel, Inc. | yes | [1662fae9b5314d11.txt](texts/1662fae9b5314d11.txt) |
| `negotiator` | 0.6.4 | MIT | Copyright (c) 2012-2014 Federico Romero | yes | [553d4d20029a24e3.txt](texts/553d4d20029a24e3.txt) |
| `negotiator` | 1.1.0 | MIT | Copyright (c) 2012-2014 Federico Romero | yes | [553d4d20029a24e3.txt](texts/553d4d20029a24e3.txt) |
| `node-addon-api` | 7.1.1 | MIT | Copyright (c) 2017 [Node.js API collaborators](https://github.com/nodejs/node-addon-api#collabor… | yes | [89024017b88a9f2b.txt](texts/89024017b88a9f2b.txt) |
| `node-addon-native-custom-loader` | 0.1.9 | MIT | Copyright (c) 2026 node-addon-require-builtin contributors | yes | [75bd0a6d6b9f9f0a.txt](texts/75bd0a6d6b9f9f0a.txt) |
| `node-addon-require-builtin` | 0.1.9 | MIT | Copyright (c) 2026 node-addon-require-builtin contributors | yes | [75bd0a6d6b9f9f0a.txt](texts/75bd0a6d6b9f9f0a.txt) |
| `node-addon-require-builtin-win32-x64-msvc` | 0.1.9 | MIT | Copyright (c) 2026 node-addon-require-builtin contributors | yes | [75bd0a6d6b9f9f0a.txt](texts/75bd0a6d6b9f9f0a.txt) |
| `node-domexception` | 1.0.0 | MIT | Copyright (c) 2021 Jimmy Wärting | yes | [8ec1386f7f078b0c.txt](texts/8ec1386f7f078b0c.txt) |
| `node-fetch` | 3.3.2 | MIT | Copyright (c) 2016 - 2020 Node Fetch Team | yes | [3e2c11dcf3f17ab5.txt](texts/3e2c11dcf3f17ab5.txt) |
| `node-pty` | 1.2.0-beta.15 | MIT | Copyright (c) 2012-2015, Christopher Jeffrey (https://github.com/chjj/) | no (5A trim) | [a3d60eaf32d2fb09.txt](texts/a3d60eaf32d2fb09.txt) |
| `normalize-url` | 8.1.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `npm-run-path` | 6.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `on-finished` | 2.4.2 | MIT | Copyright (c) 2013 Jonathan Ong <me@jongleberry.com> | yes | [8089bcc08845ec14.txt](texts/8089bcc08845ec14.txt) |
| `on-headers` | 1.1.0 | MIT | Copyright (c) 2014 Douglas Christopher Wilson | yes | [74d8054d56d522bd.txt](texts/74d8054d56d522bd.txt) |
| `open` | 11.0.4 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `p-cancelable` | 4.0.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `p-limit` | 7.3.3 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `p-retry` | 4.6.2 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com) | yes | [48da2f39e100d408.txt](texts/48da2f39e100d408.txt) |
| `pako` | 0.2.9 | MIT | Copyright (C) 2014-2016 by Vitaly Puzrin | yes | [3bc404ffa7888053.txt](texts/3bc404ffa7888053.txt) |
| `parse-ms` | 4.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `parseurl` | 1.3.3 | MIT | Copyright (c) 2014 Jonathan Ong <me@jongleberry.com> | yes | [11d017c3b9f1ee3f.txt](texts/11d017c3b9f1ee3f.txt) |
| `partial-json` | 0.1.7 | MIT | Copyright (c) 2023 Promplate Dev Team | yes | [cd519ad3d7e01242.txt](texts/cd519ad3d7e01242.txt) |
| `path-key` | 3.1.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com) | yes | [48da2f39e100d408.txt](texts/48da2f39e100d408.txt) |
| `path-key` | 4.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `picomatch` | 4.0.7 | MIT | Copyright (c) 2017-present, Jon Schlinkert. | yes | [d0cd141b0c322fde.txt](texts/d0cd141b0c322fde.txt) |
| `pkce-challenge` | 5.0.1 | MIT | Copyright (c) 2019 | yes | [feb87a2e0c305de3.txt](texts/feb87a2e0c305de3.txt) |
| `powershell-utils` | 0.2.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `pretty-ms` | 9.3.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `proxy-agent-negotiate` | 1.1.0 | MIT | — | yes | 上游未提供文本（见 §2） |
| `quick-lru` | 5.1.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com) | yes | [48da2f39e100d408.txt](texts/48da2f39e100d408.txt) |
| `range-parser` | 1.3.0 | MIT | Copyright (c) 2012-2014 TJ Holowaychuk <tj@vision-media.ca> | yes | [f655e6291356ec0d.txt](texts/f655e6291356ec0d.txt) |
| `readdirp` | 5.1.1 | MIT | Copyright (c) 2012-2019 Thorsten Lorenz, Paul Miller (https://paulmillr.com) | yes | [dffec71d93f273d2.txt](texts/dffec71d93f273d2.txt) |
| `require-from-string` | 2.0.2 | MIT | Copyright (c) Vsevolod Strukchinsky <floatdrop@gmail.com> (github.com/floatdrop) | yes | [6ee0feb1f6ef996f.txt](texts/6ee0feb1f6ef996f.txt) |
| `resolve-alpn` | 1.2.1 | MIT | Copyright (c) 2018 Szymon Marczak | yes | [03b347a3d13b0e5b.txt](texts/03b347a3d13b0e5b.txt) |
| `resolve.exports` | 2.0.4 | MIT | Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com) | yes | [306fa513e39b23a6.txt](texts/306fa513e39b23a6.txt) |
| `responselike` | 4.0.2 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [a368f64e3edd0af4.txt](texts/a368f64e3edd0af4.txt) |
| `restructure` | 3.0.2 | MIT | Copyright (c) 2015-present Devon Govett | yes | [c0df7f551401f8f8.txt](texts/c0df7f551401f8f8.txt) |
| `retry` | 0.13.1 | MIT | Copyright (c) 2011: | yes | [01ad164273e8e095.txt](texts/01ad164273e8e095.txt) |
| `run-applescript` | 7.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `safe-buffer` | 5.2.1 | MIT | Copyright (c) Feross Aboukhadijeh | yes | [c7cc929b57080f4b.txt](texts/c7cc929b57080f4b.txt) |
| `send` | 1.2.1 | MIT | Copyright (c) 2012 TJ Holowaychuk | yes | [25a328069fe771f8.txt](texts/25a328069fe771f8.txt) |
| `serve-static` | 2.2.1 | MIT | Copyright (c) 2010 Sencha Inc. | yes | [63b9a188d7d43e64.txt](texts/63b9a188d7d43e64.txt) |
| `shebang-command` | 2.0.0 | MIT | Copyright (c) Kevin Mårtensson <kevinmartensson@gmail.com> (github.com/kevva) | yes | [69dee148a2cc4705.txt](texts/69dee148a2cc4705.txt) |
| `shebang-regex` | 3.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com) | yes | [48da2f39e100d408.txt](texts/48da2f39e100d408.txt) |
| `standardwebhooks` | 1.1.1 | MIT | — | yes | 上游未提供文本（见 §2） |
| `statuses` | 2.0.2 | MIT | Copyright (c) 2014 Jonathan Ong <me@jongleberry.com> | yes | [512cfa4d5e7a7569.txt](texts/512cfa4d5e7a7569.txt) |
| `strip-final-newline` | 4.0.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `tiny-inflate` | 1.0.3 | MIT | Copyright (c) 2015-present Devon Govett | yes | [c0df7f551401f8f8.txt](texts/c0df7f551401f8f8.txt) |
| `toidentifier` | 1.0.1 | MIT | Copyright (c) 2016 Douglas Christopher Wilson <doug@somethingdoug.com> | yes | [a832d679750e49ab.txt](texts/a832d679750e49ab.txt) |
| `ts-algebra` | 2.0.0 | MIT | Copyright (c) 2020 Thomas Aribart | yes | [18a2bfd070b08bd1.txt](texts/18a2bfd070b08bd1.txt) |
| `turndown` | 7.2.4 | MIT | Copyright (c) 2017 Dom Christie | yes | [a055e3a15db4b4cb.txt](texts/a055e3a15db4b4cb.txt) |
| `typebox` | 1.3.27 | MIT | Copyright (c) 2017-2026 Haydn Paterson | yes | [e8a7cc256941a26b.txt](texts/e8a7cc256941a26b.txt) |
| `undici` | 8.11.2 | MIT | Copyright (c) 2020 Ethan Arrowood | yes | [a21d6c8d3fc63119.txt](texts/a21d6c8d3fc63119.txt)<br>[a6db8096b2707bc0.txt](texts/a6db8096b2707bc0.txt) |
| `undici-types` | 8.9.0 | MIT | Copyright (c) Matteo Collina and Undici contributors | yes | [a6db8096b2707bc0.txt](texts/a6db8096b2707bc0.txt) |
| `unicode-properties` | 1.4.1 | MIT | Copyright 2018 | yes | [43439dbd4f43837a.txt](texts/43439dbd4f43837a.txt) |
| `unicode-trie` | 2.0.0 | MIT | Copyright 2018 | yes | [43439dbd4f43837a.txt](texts/43439dbd4f43837a.txt) |
| `unicorn-magic` | 0.3.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `vary` | 1.1.2 | MIT | Copyright (c) 2014-2017 Douglas Christopher Wilson | yes | [bd47ce7b88c77596.txt](texts/bd47ce7b88c77596.txt) |
| `web-streams-polyfill` | 3.3.3 | MIT | Copyright (c) 2024 Mattias Buelens | yes | [81008a3fb78f69f3.txt](texts/81008a3fb78f69f3.txt) |
| `which-command` | 0.1.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `ws` | 8.22.0 | MIT | Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com> | yes | [2b29dcfe0d6471f7.txt](texts/2b29dcfe0d6471f7.txt) |
| `wsl-utils` | 1.0.1 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `xmlchars` | 2.2.0 | MIT | Copyright Louis-Dominique Dubeau and contributors to xmlchars | yes | [45d196313c2647d3.txt](texts/45d196313c2647d3.txt) |
| `yocto-queue` | 1.2.2 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `yoctocolors` | 2.2.0 | MIT | Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com) | yes | [5c932d88256b4ab9.txt](texts/5c932d88256b4ab9.txt) |
| `zod` | 4.4.3 | MIT | Copyright (c) 2025 Colin McDonnell | yes | [3f1189b28e3866e0.txt](texts/3f1189b28e3866e0.txt) |
| `zod` | 4.6.7 | MIT | Copyright (c) 2025 Colin McDonnell | yes | [3f1189b28e3866e0.txt](texts/3f1189b28e3866e0.txt) |

### Apache-2.0（53 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@agentclientprotocol/sdk` | 1.4.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [6ed4f049cce59e05.txt](texts/6ed4f049cce59e05.txt) |
| `@aws-sdk/client-bedrock-runtime` | 3.1127.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [18c295fdd68d4f68.txt](texts/18c295fdd68d4f68.txt) |
| `@aws-sdk/core` | 3.978.6 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [edea91454b811f12.txt](texts/edea91454b811f12.txt) |
| `@aws-sdk/credential-provider-env` | 3.972.77 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/credential-provider-http` | 3.972.79 | Apache-2.0 | — | yes | 上游未提供文本（见 §2） |
| `@aws-sdk/credential-provider-ini` | 3.973.22 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/credential-provider-login` | 3.972.84 | Apache-2.0 | — | yes | 上游未提供文本（见 §2） |
| `@aws-sdk/credential-provider-node` | 3.972.89 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/credential-provider-process` | 3.972.77 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [2ef1e48ea743d9c8.txt](texts/2ef1e48ea743d9c8.txt) |
| `@aws-sdk/credential-provider-sso` | 3.973.21 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [2ef1e48ea743d9c8.txt](texts/2ef1e48ea743d9c8.txt) |
| `@aws-sdk/credential-provider-web-identity` | 3.972.83 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [2ef1e48ea743d9c8.txt](texts/2ef1e48ea743d9c8.txt) |
| `@aws-sdk/eventstream-handler-node` | 3.972.39 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [07364a5f7d0177a5.txt](texts/07364a5f7d0177a5.txt) |
| `@aws-sdk/middleware-eventstream` | 3.972.34 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [e345c2ee7df4446e.txt](texts/e345c2ee7df4446e.txt) |
| `@aws-sdk/middleware-websocket` | 3.972.59 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [07364a5f7d0177a5.txt](texts/07364a5f7d0177a5.txt) |
| `@aws-sdk/nested-clients` | 3.997.51 | Apache-2.0 | — | yes | 上游未提供文本（见 §2） |
| `@aws-sdk/signature-v4-multi-region` | 3.996.49 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [07364a5f7d0177a5.txt](texts/07364a5f7d0177a5.txt) |
| `@aws-sdk/token-providers` | 3.1127.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/token-providers` | 3.1157.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/types` | 3.975.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws-sdk/xml-builder` | 3.972.41 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@aws/lambda-invoke-store` | 0.3.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [09e8a9bcec806710.txt](texts/09e8a9bcec806710.txt) |
| `@google/genai` | 2.21.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `@opentelemetry/api` | 1.9.1 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/api-logs` | 0.222.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/core` | 2.11.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/otlp-exporter-base` | 0.222.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/otlp-transformer` | 0.222.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/resources` | 2.11.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/sdk-logs` | 0.222.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/sdk-metrics` | 2.11.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/sdk-trace` | 2.11.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@opentelemetry/semantic-conventions` | 1.43.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [c71d239df91726fc.txt](texts/c71d239df91726fc.txt) |
| `@smithy/core` | 3.37.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [07364a5f7d0177a5.txt](texts/07364a5f7d0177a5.txt) |
| `@smithy/credential-provider-imds` | 4.5.2 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@smithy/fetch-http-handler` | 5.8.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@smithy/node-http-handler` | 4.12.1 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@smithy/node-http-handler` | 4.13.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@smithy/signature-v4` | 5.7.4 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d82ceb8cbd004a2d.txt](texts/d82ceb8cbd004a2d.txt) |
| `@smithy/types` | 4.19.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [07364a5f7d0177a5.txt](texts/07364a5f7d0177a5.txt) |
| `@swc/helpers` | 0.5.23 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [d96eba1f1881334d.txt](texts/d96eba1f1881334d.txt) |
| `detect-libc` | 2.1.2 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [b40930bbcf80744c.txt](texts/b40930bbcf80744c.txt) |
| `ecdsa-sig-formatter` | 1.0.11 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [50a6b24f8defc31a.txt](texts/50a6b24f8defc31a.txt) |
| `gaxios` | 7.3.1 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `gcp-metadata` | 8.1.2 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `google-auth-library` | 10.9.1 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `google-logging-utils` | 1.1.3 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `human-signals` | 8.0.1 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [f4ff0f211345d249.txt](texts/f4ff0f211345d249.txt) |
| `jsbi` | 4.3.2 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [9568a2b155e66ac3.txt](texts/9568a2b155e66ac3.txt) |
| `long` | 5.3.2 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [cfc7749b96f63bd3.txt](texts/cfc7749b96f63bd3.txt) |
| `openai` | 7.19.0 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by | yes | [636eb7d79da9bb6d.txt](texts/636eb7d79da9bb6d.txt)<br>[d8c77eaffed7f1f8.txt](texts/d8c77eaffed7f1f8.txt)<br>[cd519ad3d7e01242.txt](texts/cd519ad3d7e01242.txt)<br>[7beaa85b57d7211f.txt](texts/7beaa85b57d7211f.txt) |
| `sharp` | 0.35.5 | Apache-2.0 | "Licensor" shall mean the copyright owner or entity authorized by the copyright | yes | [73ba74dfaa520b49.txt](texts/73ba74dfaa520b49.txt) |
| `sherpa-onnx-node` | 1.13.8 | Apache-2.0 | — | no (5A trim) | 上游未提供文本（见 §2） |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | — | no (5A trim) | 上游未提供文本（见 §2） |

### BSD-3-Clause（14 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@deepseek-ai/node-addon-system` | 0.1.2 | BSD-3-Clause | Copyright (c) 2026 DeepSeek | yes | [ebb4f09972aee860.txt](texts/ebb4f09972aee860.txt) |
| `@protobufjs/aspromise` | 1.1.2 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/base64` | 1.1.2 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/codegen` | 2.0.5 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/eventemitter` | 1.1.1 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/fetch` | 1.1.1 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/float` | 1.0.2 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/path` | 1.1.2 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/pool` | 1.1.0 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `@protobufjs/utf8` | 1.1.2 | BSD-3-Clause | Copyright (c) 2016, Daniel Wirtz  All rights reserved. | yes | [a67b34a24a5daddc.txt](texts/a67b34a24a5daddc.txt) |
| `buffer-equal-constant-time` | 1.0.1 | BSD-3-Clause | Copyright (c) 2013, GoInstant Inc., a salesforce.com company | yes | [751d0e80fb5c828f.txt](texts/751d0e80fb5c828f.txt) |
| `diff` | 9.0.0 | BSD-3-Clause | Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com> | yes | [eda81a415869e678.txt](texts/eda81a415869e678.txt) |
| `fast-uri` | 3.1.9 | BSD-3-Clause | Copyright (c) 2011-2021, Gary Court until https://github.com/garycourt/uri-js/commit/a1acf730b4b… | yes | [b010b0dfdfdb23d7.txt](texts/b010b0dfdfdb23d7.txt) |
| `protobufjs` | 7.6.6 | BSD-3-Clause | Copyright 2014, Google Inc.  All rights reserved. | yes | [4ab87e6e3c0c0b78.txt](texts/4ab87e6e3c0c0b78.txt)<br>[49d6a1c9a623784c.txt](texts/49d6a1c9a623784c.txt) |

### ISC（10 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@js-temporal/polyfill` | 0.5.1 | ISC | Copyright 2017, 2018, 2019, 2020 ECMA International | yes | [ffc4aee7f1279fc0.txt](texts/ffc4aee7f1279fc0.txt) |
| `inherits` | 2.0.4 | ISC | Copyright (c) Isaac Z. Schlueter | yes | [5ffe28e7ade7d8f1.txt](texts/5ffe28e7ade7d8f1.txt) |
| `isexe` | 2.0.0 | ISC | Copyright (c) Isaac Z. Schlueter and Contributors | yes | [4ec3d4c66cd87f5c.txt](texts/4ec3d4c66cd87f5c.txt) |
| `picocolors` | 1.1.1 | ISC | Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov | yes | [6582629e29794668.txt](texts/6582629e29794668.txt) |
| `saxes` | 6.0.0 | ISC | — | yes | 上游未提供文本（见 §2） |
| `semver` | 7.8.5 | ISC | Copyright (c) Isaac Z. Schlueter and Contributors | yes | [4ec3d4c66cd87f5c.txt](texts/4ec3d4c66cd87f5c.txt) |
| `setprototypeof` | 1.2.0 | ISC | Copyright (c) 2015, Wes Todd | yes | [76d6d1ea0c268da3.txt](texts/76d6d1ea0c268da3.txt) |
| `signal-exit` | 4.1.0 | ISC | Copyright (c) 2015-2023 Benjamin Coe, Isaac Z. Schlueter, and Contributors | yes | [b173e19b9a78df30.txt](texts/b173e19b9a78df30.txt) |
| `which` | 2.0.2 | ISC | Copyright (c) Isaac Z. Schlueter and Contributors | yes | [4ec3d4c66cd87f5c.txt](texts/4ec3d4c66cd87f5c.txt) |
| `yaml` | 2.9.1 | ISC | Copyright Eemeli Aro <eemeli@gmail.com> | yes | [5bba27375d93e911.txt](texts/5bba27375d93e911.txt) |

### BSD-2-Clause（2 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@mixmark-io/domino` | 2.2.0 | BSD-2-Clause | Copyright (c) 2011 The Mozilla Foundation. | yes | [9672b5ea831c3604.txt](texts/9672b5ea831c3604.txt) |
| `http-cache-semantics` | 4.3.0 | BSD-2-Clause | Copyright 2016-2018 Kornel Lesiński | yes | [ab868ad5a2ef5068.txt](texts/ab868ad5a2ef5068.txt) |

### MPL-2.0（2 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@deepseek-ai/libreoffice-kit` | 0.1.5 | MPL-2.0 | applicable copyright doctrines of fair use, fair dealing, or other | no (5A trim) | [1f256ecad1928805.txt](texts/1f256ecad1928805.txt)<br>[b8841df06ad9243a.txt](texts/b8841df06ad9243a.txt) |
| `@deepseek-ai/libreoffice-kit-win32-x64` | 0.1.5 | MPL-2.0 | Third Party Code Additional copyright notices and license terms applicable to portions of the So… | no (5A trim) | [9a7e34fbf3903507.txt](texts/9a7e34fbf3903507.txt)<br>[8d34210ebbfaee4b.txt](texts/8d34210ebbfaee4b.txt) |

### (MIT OR CC0-1.0)（1 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `type-fest` | 4.41.0 | (MIT OR CC0-1.0) | — | yes | 上游未提供文本（见 §2） |

### 0BSD（1 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `tslib` | 2.8.1 | 0BSD | Copyright (c) Microsoft Corporation. | yes | [210b19e543130388.txt](texts/210b19e543130388.txt) |

### Apache-2.0 AND LGPL-3.0-or-later（1 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `@img/sharp-win32-x64` | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | "Licensor" shall mean the copyright owner or entity authorized by the copyright | yes | [dc1f5d2d43c5531d.txt](texts/dc1f5d2d43c5531d.txt) |

### Python-2.0（1 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `argparse` | 2.0.1 | Python-2.0 | provided, however, that PSF's License Agreement and PSF's notice of copyright, | yes | [de4d1f2d2ad5ad0c.txt](texts/de4d1f2d2ad5ad0c.txt) |

### Unlicense（1 包）

| 包名 | 版本 | 许可 | 版权行 | 随包 | 文本 |
|---|---|---|---|---|---|
| `fast-sha256` | 1.3.0 | Unlicense | In jurisdictions that recognize copyright laws, the author or authors | yes | [88d9b4eb60579c19.txt](texts/88d9b4eb60579c19.txt) |

## 2. 18 个缺许可文本包的处理结果

上游 npm tarball 本身不含许可文本，因此**不编造文本**：能从上���其它产物取到全文的补入 `texts/` 并标 `supplemented`，其余标 `absent-in-tarball` 并给出上游地址。

| 包 | 版本 | 许可 | 处理 | 上游地址 |
|---|---|---|---|---|
| `@aws-sdk/credential-provider-http` | 3.972.79 | Apache-2.0 | 上游未提供（不编造） | <https://www.npmjs.com/package/@aws-sdk/credential-provider-http/v/3.972.79> |
| `@aws-sdk/credential-provider-login` | 3.972.84 | Apache-2.0 | 上游未提供（不编造） | <https://www.npmjs.com/package/@aws-sdk/credential-provider-login/v/3.972.84> |
| `@aws-sdk/nested-clients` | 3.997.51 | Apache-2.0 | 上游未提供（不编造） | <https://www.npmjs.com/package/@aws-sdk/nested-clients/v/3.997.51> |
| `@earendil-works/pi-ai` | 1.4.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/@earendil-works/pi-ai/v/1.4.0> |
| `@earendil-works/pi-telemetry` | 1.4.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/@earendil-works/pi-telemetry/v/1.4.0> |
| `@koromix/koffi-win32-x64` | 3.1.1 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/@koromix/koffi-win32-x64/v/3.1.1> |
| `@xterm/addon-serialize` | 0.14.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/@xterm/addon-serialize/v/0.14.0> |
| `@xterm/headless` | 6.0.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/@xterm/headless/v/6.0.0> |
| `brotli` | 1.3.3 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/brotli/v/1.3.3> |
| `data-uri-to-buffer` | 4.0.1 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/data-uri-to-buffer/v/4.0.1> |
| `dfa` | 1.2.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/dfa/v/1.2.0> |
| `fontkit` | 2.0.4 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/fontkit/v/2.0.4> |
| `proxy-agent-negotiate` | 1.1.0 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/proxy-agent-negotiate/v/1.1.0> |
| `saxes` | 6.0.0 | ISC | 上游未提供（不编造） | <https://www.npmjs.com/package/saxes/v/6.0.0> |
| `sherpa-onnx-node` | 1.13.8 | Apache-2.0 | 上游未提供（不编造） | <https://www.npmjs.com/package/sherpa-onnx-node/v/1.13.8> |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | 上游未提供（不编造） | <https://www.npmjs.com/package/sherpa-onnx-win-x64/v/1.13.8> |
| `standardwebhooks` | 1.1.1 | MIT | 上游未提供（不编造） | <https://www.npmjs.com/package/standardwebhooks/v/1.1.1> |
| `type-fest` | 4.41.0 | (MIT OR CC0-1.0) | 已补入 `texts/a2010f343487d3f7.txt` `texts/5c932d88256b4ab9.txt` | <https://www.npmjs.com/package/type-fest/v/4.41.0> |

## 3. 分发义务摘要

### 3.1 LGPL-3.0-or-later（`@img/sharp-win32-x64` 内的 libvips，随包）

- 许可表达式：`Apache-2.0 AND LGPL-3.0-or-later`（见该包 `package.json`）。
- **LGPL-3.0 全文**：`texts/9a7e34fbf3903507.txt`（316506 字节，sha256 `9a7e34fbf3903507665e3ec7ca8b3d0c11f73bf2d5a0d754a079ab9f505bafef`）。该文件是上游随 LibreOffice 许可汇编一起提供的 LGPL-3.0 全文，本项目未改动任何字节；`@img/sharp-win32-x64` 自带的 `LICENSE`（`texts/2ef1e48ea743d9c8.txt`）只有 Apache-2.0 正文，因此 LGPL 全文以本文件为准。
- **libvips 源码获取**：本项目未修改 libvips。对应源码可从上游取得：
  - libvips 本体：<https://github.com/libvips/libvips>（payload 内 DLL 版本见文件名 `libvips-cpp-<version>.dll`）
  - Windows 预编译与构建脚本：<https://github.com/lovell/sharp>（`@img/sharp-win32-x64` 的发布物即由该仓库的构建流程产出）
- **可替换性（LGPL §4 动态链接要求）**：libvips 以 DLL 动态链接方式随包，接收者可自行替换 `node_modules/@img/sharp-win32-x64/lib/libvips-42.dll`（保持 ABI 版本一致即可），本项目不阻止替换。
- 若后续修改 libvips，必须按 LGPL-3.0 提供修改后的源码；当前状态为「未修改」。
- 分发时须同时保留 `@img/sharp-win32-x64/lib/*` 内的 DLL 与本节说明，不得只留 sharp 主包。

### 3.2 Apache-2.0（sharp 主包、sherpa-onnx 等）

- 随包部分：附 Apache-2.0 全文（`texts/` 内已含），保留上游 `NOTICE`/版权行（如有），修改过的文件须标注。
- 已裁剪部分（sherpa-onnx 两包）：当前不分发，恢复时再补全文（上游 tarball 未附文本，需向上游索取）。

### 3.3 MPL-2.0（LibreOffice Kit，当前已裁剪）

- 当前不随包，无分发义务；若恢复分发：附 MPL-2.0 全文与包内 `program/license.txt`，公开 MPL 覆盖文件的源码获取方式，修改文件需保留修改说明与日期。

### 3.4 MIT / ISC / BSD / 0BSD / Unlicense / Python-2.0 / (MIT OR CC0-1.0)

- 随包部分：保留版权行与许可全文（见 §1 各行与 `THIRD-PARTY-LICENSES.md`）。
- 这些许可不要求公开源码，但**不得删除版权与许可声明**。

### 3.5 上游未提供文本的 17 包

- `sherpa-onnx-node`、`sherpa-onnx-win-x64` 当前已裁剪；其余 15 包随包分发时依 §2 的上游地址提供来源说明，并在取得上游文本后补入 `texts/`（补入需重跑本生成器与 `verify-licenses.mjs`）。

## 4. 重新生成与校验

```powershell
node education/licenses/tools/build-notice-v2.mjs          # 生成 NOTICE/THIRD-PARTY-LICENSES/EXCLUDED + data/license-status.json
node education/licenses/tools/build-notice-v2.mjs --check   # 只校验磁盘上的文件是否与生成结果一致
node education/licenses/tools/verify-licenses.mjs education/.local/evidence/T16/license-verify
```

生成器会先做三件事，任何一条不满足就报错退出：① inventory 的 sha256 必须与 manifest 记录一致；② payload 内缺失的包必须全部落在 §0.1 的裁剪组内；③ `sharp`/`@img/sharp-win32-x64` 必须在 payload 内且不在裁剪组。
