# 原生二进制清单与许可以及运行库说明

文件哈希来自当前全量闭包（`education/.local/cache/T16/hoisted-test/node_modules`）。`no (5A trim)` 包在裁剪后不随学生包分发；`@img/sharp-win32-x64` 自 2026-10-30 起随包（`--keep-sharp`），本表状态为 `yes`。

| 包 | 版本 | 许可 | 随包 | 文件（相对包目录） | 字节 | SHA-256 |
|---|---|---|---|---|---|---|
| `@deepseek-ai/libreoffice-kit-win32-x64` | 0.1.5 | MPL-2.0 | no (5A trim) | `bin/libreoffice-kit.exe` | 178548224 | `4b60b337f493421cd3b8690c9706494df620d6ba265b99c0cc6ab22b88cb6fd7` |
| `@img/sharp-win32-x64` | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | yes | `lib/libvips-42.dll` | 19018240 | `06dab07cc386748513337a31672b1d5269fbc770a14ff403080575665bf0813f` |
| `@img/sharp-win32-x64` | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | yes | `lib/libvips-cpp-8.18.7.dll` | 333312 | `25001dbd05305a0a29119ab49933622c70b4a20ea12ef1d5d20ca40181db53bf` |
| `@img/sharp-win32-x64` | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | yes | `lib/sharp-win32-x64-0.35.5.node` | 443904 | `971048779f9c8598df14641dfc03c625885c93f473a788e65ca2deb50d0b083e` |
| `@koromix/koffi-win32-x64` | 3.1.1 | MIT | yes | `win32_x64/koffi.node` | 1042944 | `eb0587c804bb76262968bf83028528da4dc2d4322f558845cce205c709e2ba20` |
| `@vscode/ripgrep-win32-x64` | 1.18.0 | MIT | yes | `bin/rg.exe` | 5429760 | `f9dde63498b3193f098355dbec97af99dc4f6b8fa0df5ed04114a03012c042cb` |
| `node-addon-require-builtin-win32-x64-msvc` | 0.1.9 | MIT | yes | `prebuilt/win32-x64-msvc-napi-v9.node` | 343552 | `ead441d11202126827a789a7eb88e79abe8f7f374b16e7273c4244225c8d6c2b` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/darwin-arm64/pty.node` | 86904 | `0aae85518beb134a666f8e415f78bf528b2e9d40b47498af97433dc459661366` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/darwin-x64/pty.node` | 58576 | `811f4a357e260fc0e520c250a3de5990483761d82afd635effbdf4b793b8a0e9` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/linux-arm64/pty.node` | 69112 | `5a3b8930d62535edabec2eac79fe8eca70a178d93fbb76b1ae875dd60ee8f825` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/linux-x64/pty.node` | 75976 | `123792d8f22f36d519b21dfb6f4b716f9b18b9e579085ea2840d0773d88d35fd` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-arm64/conpty/conpty.dll` | 106528 | `b3a9f975c51d5b9b96d290bf784e990e3f85203b063c21614457353f566266ff` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-arm64/conpty/OpenConsole.exe` | 1110560 | `7fa560be0c9b6c81db5d1b855a4a6e0f3ee5a2ea75d36eebb3ae44443b8d4866` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-arm64/conpty.node` | 279040 | `6da15dc84b864bb4630d95faef97da5f323a078b53d73f395b5efd6f7952c3e0` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-arm64/conpty_console_list.node` | 122368 | `327cf47db8b524a75813c98871037bc60f0a08660e75635897aed957a059b690` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-x64/conpty/conpty.dll` | 110152 | `3319b484b80bb53d1f4d0a9eb0ea60fd0f61da69db7280ca43b84215f19245ff` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-x64/conpty/OpenConsole.exe` | 1062472 | `7f68c840226505004215c0b82d4e502c24b5bc3f4b93c4baaaa19bd679c0def8` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-x64/conpty.node` | 291328 | `ec2fd8545c30e051ee3fa17d26127f7e615919814879c7f746cf4c80845226e0` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `prebuilds/win32-x64/conpty_console_list.node` | 134656 | `d46800643f90fc56b9fd67398f04a04a871521de0e825211c8382d187859d3ed` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `third_party/conpty/1.25.260303002/win10-arm64/conpty.dll` | 106528 | `b3a9f975c51d5b9b96d290bf784e990e3f85203b063c21614457353f566266ff` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `third_party/conpty/1.25.260303002/win10-arm64/OpenConsole.exe` | 1110560 | `7fa560be0c9b6c81db5d1b855a4a6e0f3ee5a2ea75d36eebb3ae44443b8d4866` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `third_party/conpty/1.25.260303002/win10-x64/conpty.dll` | 110152 | `3319b484b80bb53d1f4d0a9eb0ea60fd0f61da69db7280ca43b84215f19245ff` |
| `node-pty` | 1.2.0-beta.15 | MIT | no (5A trim) | `third_party/conpty/1.25.260303002/win10-x64/OpenConsole.exe` | 1062472 | `7f68c840226505004215c0b82d4e502c24b5bc3f4b93c4baaaa19bd679c0def8` |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | no (5A trim) | `onnxruntime.dll` | 17799168 | `7f66f939a881baf4f46a2216496798edf4a1429878b646d12674aa62f27d8a25` |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | no (5A trim) | `onnxruntime_providers_shared.dll` | 104960 | `551d0e1fe4c227d8542314ba718d52f4379e0c7bfe729a37c59833a884e27b4d` |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | no (5A trim) | `sherpa-onnx-c-api.dll` | 4605952 | `b0801cd8eeead83213c60b92cc004de6f3ac4cd4a9ac7c388c16b97c590f1e99` |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | no (5A trim) | `sherpa-onnx-cxx-api.dll` | 259584 | `e709c46a63e4b84f3862aa0c843a804040b42ea054a398b420142f6c8e58ec77` |
| `sherpa-onnx-win-x64` | 1.13.8 | Apache-2.0 | no (5A trim) | `sherpa-onnx.node` | 681984 | `f5fd562bdc4bea167eee8ac981c6acd88c05cc8d2792b67d8951566818e293ca` |

## 运行库

- `koffi` 与 `node-addon-require-builtin`：N-API 模块，通常需要目标机具备 **Microsoft Visual C++ 2015–2022 Redistributable (x64)**；必须在干净标准用户机实测（T16）。
- `node-pty`（已裁剪）：`conpty.dll`/`OpenConsole.exe` 来自 Windows Terminal（MIT）；如恢复 PTY，需随包保留其许可并确认 VC++ 运行库。
- `sharp`/`libvips`（**随包**，Apache-2.0 AND LGPL-3.0-or-later）：`@img/sharp-win32-x64` 内的 `libvips-42.dll`/`libvips-cpp-*` 以动态链接随包，须满足 LGPL 全文、libvips 源码获取与"允许替换 DLL"义务（见 `NOTICE.md` §3.1）。
- `sherpa-onnx`（已裁剪，Apache-2.0）：如恢复，onnxruntime DLL 与模型/语音资产需单独核对许可与体积。
- `@vscode/ripgrep-win32-x64`（MIT）：`rg.exe` 静态二进制，无额外运行库要求（仍应在干净机验证）。
- `libreoffice-kit`（已裁剪，MPL-2.0）：其 exe 与 `program/license.txt`/NOTICE 需随恢复后的包分发。

## 检查命令

```powershell
node education/scripts/packaging/scan-payload.mjs <payload-dir> --json
```

