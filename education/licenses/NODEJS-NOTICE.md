# Node.js 运行时许可与第三方声明

Windows 产物将自带 Node.js 运行时（`app/node/node.exe`）；按 Node.js 分发要求保留其 LICENSE（含 bundled third-party notices）。

- 源文件：`E:/DSH-desktop/resources/runtime/primary-runtime/dependencies/node/LICENSE`
- 已收录全文：[texts/nodejs-LICENSE.txt](texts/nodejs-LICENSE.txt)（SHA-256 `ed34dd8e3f0a78dbaf00d0444ce8e285b015b765379c2e17880455f70370f8e9`，160555 B）
- 对应 node.exe：`E:/DSH-desktop/resources/runtime/primary-runtime/dependencies/node/bin/node.exe`（93580104 B，SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`）；版本由桌面运行时清单声明为 v24.21.0。

## 文本内容说明

Node.js LICENSE 文件包含 Node.js MIT 主许可、V8/OpenSSL/ICU 等 bundled 库的许可声明，以及 “The externally maintained libraries used by Node.js are:” 之后的第三方库段落。完整文本按字节复制到上述 `texts/nodejs-LICENSE.txt`，不在本文重复粘贴，避免文本漂移。

## 分发注意

- 必须随 `node.exe` 一起分发完整 LICENSE，不得删减第三方段落。
- Node.js 商标与官方背书不由 MIT 许可授予；产品命名/署名口径需人工确认。
- 最终产物 node.exe 版本/哈希必须与随包 LICENSE 的版本一致；升级 Node 后必须重新复制 LICENSE 并重算哈希。
