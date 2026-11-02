# 许可与 NOTICE 生成说明（A2/T16）

本目录是 Windows 产物 `licenses/` 的源：第三方 NOTICE、许可全文索引、Node.js/字体/原生二进制声明与 5A 裁剪记录。

## 文件

- `NOTICE.md`：按许可分组的 558 包清单（版权行、是否随包、文本链接）与 18 个缺文本包的处理结果；
- `THIRD-PARTY-LICENSES.md`：去重许可全文索引 + 包→文本映射；
- `texts/`：按 SHA-256 前 16 位命名的许可全文；`texts/supplemented/` 为 18 包补全中实际取得的上游文本；`texts/nodejs-LICENSE.txt` 为 Node.js 发行包 LICENSE；
- `NODEJS-NOTICE.md`、`FONTS-NOTICE.md`、`NATIVE-BINARIES.md`、`EXCLUDED.md`：专项说明；
- `data/license-manifest.json`、`data/missing-licenses.json`、`data/license-text-index.json`：机器可读清单与哈希。

## 如何更新

```powershell
# 1) 补全缺文本包（只在 .local/cache/T16 下载 tarball，不进 Git）
node education/licenses/tools/fetch-missing-licenses.mjs
# 2) 重新生成 NOTICE/索引/EXCLUDED（v2 生成器，可重复运行、字节稳定）
node education/licenses/tools/build-notice-v2.mjs
# 2b) 只校验磁盘文件是否与生成结果一致（不写盘）
node education/licenses/tools/build-notice-v2.mjs --check
# 3) 扫描待打包 payload（拒绝 PDF/页图/秘密/journal/个人数据）
node education/scripts/packaging/scan-payload.mjs <payload-dir> --json
```

## 约束与声明

- **不是法律意见**：本目录是工程归因材料，最终分发合规由用户/法务确认。
- 许可文本全部按字节复制自上游文件；17 个包的上游 tarball 无文本，已按“上游未提供文本”记录来源 URL/版本，未编造。
- 随包/裁剪状态**不再用依赖图近似**：`EXCLUDED.md` 与 `data/license-status.json` 均由生成器对 `education/dist/student/app/node_modules` 实测得出，与 `scan-payload` 口径一致。
- 需人工确认：①DeepSeek/Node.js/教材等商标与署名口径；②Montserrat OFL 保留字体名与 KaTeX 精确版本。


## 2026-10-31 备注（生成器重写）
- `tools/build-notice.mjs` 在 2026-10-30 05:00 被 PowerShell 文本重写损坏（UTF-8 BOM + 乱码，`node --check` 直接语法错误），已改名为 `tools/build-notice.mjs.broken` 保留证据。
- 新版生成器：`tools/build-notice-v2.mjs`（未加 BOM，可重复运行）。"随包/已裁剪"以 `education/dist/student/app/node_modules` **实测**为准；缺失但未声明裁剪的包会让生成器报错退出。
- sharp / `@img/sharp-win32-x64` 为**随包**（`--keep-sharp`），已从裁剪清单删除，其 LGPL-3.0-or-later 义务写在 `NOTICE.md` §3.1。
- 现状：558 包 = 546 随包 + 12 裁剪（office 2、office 技能 2、语音 5、sherpa 2、PTY 1）。
