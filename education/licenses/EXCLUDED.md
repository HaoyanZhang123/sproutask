# 5A 裁剪清单（EXCLUDED）

> 由 `education/licenses/tools/build-notice-v2.mjs` 生成，请勿手改。
> **判定口径**：本文件只列 `education/dist/student/app/node_modules` 实测**不存在**、且能归入裁剪策略的包。
> 生成时 payload 共 193 个顶层条目、546 个包随包、12 个包被裁剪。

## 1. 被裁剪的包（12 包 / 5 组）

| 组 | 包 | 版本 | 许可 | 裁剪原因 | 恢复分发需承担的义务 |
|---|---|---|---|---|---|
| Office 转换（LibreOffice Kit，MPL-2.0） | `@deepseek-ai/libreoffice-kit` | 0.1.5 | MPL-2.0 | 学生端不提供 Office 转换；需要几百 MB 二进制与额外运行时 | 附 MPL-2.0 全文与包内 NOTICE/program/license.txt，并提供对应源码获取方式 |
| Office 转换（LibreOffice Kit，MPL-2.0） | `@deepseek-ai/libreoffice-kit-win32-x64` | 0.1.5 | MPL-2.0 | 学生端不提供 Office 转换；需要几百 MB 二进制与额外运行时 | 附 MPL-2.0 全文与包内 NOTICE/program/license.txt，并提供对应源码获取方式 |
| Office 技能入口（MIT） | `@deepseek-ai/dsh-office-to-pdf` | 0.2.1-rc.3 | MIT | 依赖 office 转换链路，链路裁剪后入口无意义 | 随 office 一起恢复，并重跑 scan-payload 与 NOTICE |
| Office 技能入口（MIT） | `@deepseek-ai/dsh-skill-office` | 0.2.1-rc.3 | MIT | 依赖 office 转换链路，链路裁剪后入口无意义 | 随 office 一起恢复，并重跑 scan-payload 与 NOTICE |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-api-speech-to-text` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 | 恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-client-ui-voice-input` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 | 恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-speech-to-text` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 | 恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-speech-to-text-sensevoice` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 | 恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明 |
| 语音识别 / 语音输入（Apache-2.0） | `@deepseek-ai/dsh-experimental-voice-input-bundle` | 0.2.1-rc.3 | MIT | 语音链路（sherpa-onnx 原生库 + 实验性语音插件）不进入学生包 | 恢复时需附 Apache-2.0 全文与 onnxruntime/sherpa 的 DLL 来源说明 |
| sherpa-onnx 原生库（Apache-2.0） | `sherpa-onnx-node` | 1.13.8 | Apache-2.0 | 语音识别的原生依赖，随语音链路一起裁剪 | 恢复时需附 Apache-2.0 全文（上游 tarball 未附文本，需向上游索取） |
| sherpa-onnx 原生库（Apache-2.0） | `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | 语音识别的原生依赖，随语音链路一起裁剪 | 恢复时需附 Apache-2.0 全文（上游 tarball 未附文本，需向上游索取） |
| node-pty（MIT） | `node-pty` | 1.2.0-beta.15 | MIT | 学生端不起终端，PTY 及其 conpty/OpenConsole 二进制不需要 | 附 MIT 全文与 Windows Terminal 的 MIT 版权行 |

## 2. 明确**不在**本清单内的包

- `sharp` 0.35.5（Apache-2.0）：**随包**，学生端图片处理依赖；不在裁剪清单。
- `@img/sharp-win32-x64`（Apache-2.0 AND LGPL-3.0-or-later）：**随包**，内含 libvips（LGPL-3.0-or-later）；
  分发义务见 `NOTICE.md` §3.1（LGPL 全文 + libvips 源码获取 + 允许替换 DLL）。
- 因此本文件与 `NOTICE.md` 的口径一致：`no (5A trim)` = 仅本清单这 12 个包，sharp/@img 一律 `yes`。

## 3. 恢复某个裁剪项时的步骤

1. 改 `education/scripts/packaging/build-student-payload.mjs` 的 `isCropped()`（去掉对应判断）；
2. 重打 payload：`node education/scripts/packaging/build-student-payload.mjs --keep-sharp --clean`；
3. 重跑 `node education/scripts/packaging/scan-payload.mjs education/dist/student`；
4. 重跑 `node education/licenses/tools/build-notice-v2.mjs`（本文件与 NOTICE 会自动改口径）；
5. 重跑 `node education/licenses/tools/verify-licenses.mjs <evidence-dir>` 留证。

## 4. 与旧版（2026-10-30 及以前）的差异

- 旧版把 `sharp`、`@img/sharp-win32-x64` 列为"裁剪根"，与 `--keep-sharp` 后的实物冲突，形成"正文说已裁剪、表格说随包"的自相矛盾；
- 新版以 payload 实测为准，sharp/@img 归入随包并在 `NOTICE.md` §3.1 承担 LGPL 义务；
- 旧版"近似裁剪闭包 22 包"是按依赖图推算的，含 `brotli`、`fontkit`、`saxes` 等实际仍在 payload 内的包，已删除该节。
