# 字体资产许可（Montserrat / KaTeX）

本产品随 DSH web 前端分发两组字体：Montserrat（界面字体）与 KaTeX 字体（数学排版）。本文件记录来源、许可、字体名与哈希。

## Montserrat（SIL Open Font License 1.1）

- 上游文本：`node_modules/@deepseek-ai/dsh-client-ui-theme/lib/styles/Montserrat-OFL.txt`
- 已收录全文：[texts/861d64229728cd65.txt](texts/861d64229728cd65.txt)（SHA-256 `861d64229728cd65a98d119612c12769582574d1a092f0b63c8b0fd474e7065f`，4400 B）
- 保留字体名条款：该 OFL 文本的版权行未声明 Reserved Font Name（仅含 OFL 1.1 定义段）；仍需人工核对上游版本。

| 字体文件 | 包 | 字节 | SHA-256 |
|---|---|---|---|
| `lib/styles/montserrat-light.woff2` | `@deepseek-ai/dsh-client-ui-theme` | 61548 | `da25f1327eb1dcc70c193897b5d7e00d31821d9518c0a49e073ff50d97a3f10a` |
| `lib/styles/montserrat-medium.woff2` | `@deepseek-ai/dsh-client-ui-theme` | 62148 | `8a81ca6f05cb6831d5487e4b287ce5a625a718c39226b736f155900adc394166` |
| `lib/styles/montserrat-regular.woff2` | `@deepseek-ai/dsh-client-ui-theme` | 62008 | `0f4a15e29a9535af580a64db967929a8d6b202fad9a467be390619a591d2c4c5` |
| `dist/assets/fonts/montserrat-light-Cvd2VjE_.woff2` | `@deepseek-ai/dsh-web-frontend` | 61548 | `da25f1327eb1dcc70c193897b5d7e00d31821d9518c0a49e073ff50d97a3f10a` |
| `dist/assets/fonts/montserrat-medium-B4OyO9CN.woff2` | `@deepseek-ai/dsh-web-frontend` | 62148 | `8a81ca6f05cb6831d5487e4b287ce5a625a718c39226b736f155900adc394166` |
| `dist/assets/fonts/montserrat-regular-DYep38cA.woff2` | `@deepseek-ai/dsh-web-frontend` | 62008 | `0f4a15e29a9535af580a64db967929a8d6b202fad9a467be390619a591d2c4c5` |

## KaTeX 字体（MIT）

- 上游：KaTeX v0.19.1（闭包中无 katex 包；字体随 `@deepseek-ai/dsh-web-frontend` 打包）
- 已收录 MIT 全文：[texts/766ccc1f306c885a.txt](texts/766ccc1f306c885a.txt)（SHA-256 `766ccc1f306c885aa45542a9846bbd0a505b27a0374f146778171c2254ce18e3`，1107 B）
- npm 来源：https://www.npmjs.com/package/katex/v/0.19.1

| 字体文件 | 包 | 字节 | SHA-256 |
|---|---|---|---|
| `dist/assets/fonts/KaTeX_AMS-Regular-BQhdFMY1.woff2` | `@deepseek-ai/dsh-web-frontend` | 28076 | `0cdd387c9590a1a9f9794560022dbb59654a7d86f187aa0c81495ad42d3a7308` |
| `dist/assets/fonts/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2` | `@deepseek-ai/dsh-web-frontend` | 6912 | `de7701e42cf1f4cf0b766c03fb27977207eee2f4fd5d76fa82188406da43ea4c` |
| `dist/assets/fonts/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2` | `@deepseek-ai/dsh-web-frontend` | 6908 | `5d53e70ad607c2352162dec9e0923fb54ecdafaccbf604cd8dcf7d00facb989b` |
| `dist/assets/fonts/KaTeX_Fraktur-Bold-CL6g_b3V.woff2` | `@deepseek-ai/dsh-web-frontend` | 11348 | `74444efd593c005e3f4573b44524704c0af0a937fe911cca9e94068d0d140d3f` |
| `dist/assets/fonts/KaTeX_Fraktur-Regular-CTYiF6lA.woff2` | `@deepseek-ai/dsh-web-frontend` | 11316 | `51814d270d06ff0255dba0799994fa4d8c84d11f09951d47595f4abb1f3602dc` |
| `dist/assets/fonts/KaTeX_Main-Bold-Cx986IdX.woff2` | `@deepseek-ai/dsh-web-frontend` | 25324 | `0f60d1b897938ec918c8ce073092411baf9438f6739465693ff18b0f9d20b021` |
| `dist/assets/fonts/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2` | `@deepseek-ai/dsh-web-frontend` | 16780 | `99cd42a3c072d918f2f44984a807cf7aa16e13545fd0875fc07c6c65f99e715b` |
| `dist/assets/fonts/KaTeX_Main-Italic-NWA7e6Wa.woff2` | `@deepseek-ai/dsh-web-frontend` | 16988 | `97479ca6cce906abc961ecac96faa5f9ca2e61b8e7670d475826bcdee9a7c267` |
| `dist/assets/fonts/KaTeX_Main-Regular-B22Nviop.woff2` | `@deepseek-ai/dsh-web-frontend` | 26272 | `c2342cd8b869e01752a9321dc17213fc40d4d04c79688c1d43f2cf316abd7866` |
| `dist/assets/fonts/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2` | `@deepseek-ai/dsh-web-frontend` | 16400 | `dc47344dbb6cb5b655c8460d561f4df5f501b90c804ad3c6cec65fe322351ab1` |
| `dist/assets/fonts/KaTeX_Math-Italic-t53AETM-.woff2` | `@deepseek-ai/dsh-web-frontend` | 16440 | `7af58c5ec8f132a2ddde9027c6d7814decce4d3b822a11192a42a20e2e973264` |
| `dist/assets/fonts/KaTeX_SansSerif-Bold-D1sUS0GD.woff2` | `@deepseek-ai/dsh-web-frontend` | 12216 | `e99ae51144bf1232efcc1bfe5add36262c6866b0faab24fa75740e1b98577a62` |
| `dist/assets/fonts/KaTeX_SansSerif-Italic-C3H0VqGB.woff2` | `@deepseek-ai/dsh-web-frontend` | 12028 | `00b26ac825e2095056396e0553b8ac26d3f8ad158c3826e28b4c45b385c4714a` |
| `dist/assets/fonts/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2` | `@deepseek-ai/dsh-web-frontend` | 10344 | `68e8c73ef42afd3ccec58bf0fba302cce448938e7fc020a5e31f8a952eee1342` |
| `dist/assets/fonts/KaTeX_Script-Regular-D3wIWfF6.woff2` | `@deepseek-ai/dsh-web-frontend` | 9644 | `036d4e95149b69ff9bcc0cd55771efeb25ffa3947293e69acd78d5ac328c684b` |
| `dist/assets/fonts/KaTeX_Size1-Regular-mCD8mA8B.woff2` | `@deepseek-ai/dsh-web-frontend` | 5468 | `6b47c40166b6dbe21a5dfca7718413f2147fd2399be1ba605d8ad39cedf25dfe` |
| `dist/assets/fonts/KaTeX_Size2-Regular-Dy4dx90m.woff2` | `@deepseek-ai/dsh-web-frontend` | 5208 | `d04c54219f9eaec6d4d4fd42dfb28785975a4794d6b2fc71e566b9cd6db842dd` |
| `dist/assets/fonts/KaTeX_Size4-Regular-Dl5lxZxV.woff2` | `@deepseek-ai/dsh-web-frontend` | 4928 | `a4af7d414440a1c1790825cfb700cf9cf43b0f2c4b04f0ebc523011ad9853ec0` |
| `dist/assets/fonts/KaTeX_Typewriter-Regular-CO6r4hn1.woff2` | `@deepseek-ai/dsh-web-frontend` | 13568 | `71d517d67827787cfabdf186914cc3358eda539e37931941f2b2fd4a21f68c0b` |

**人工确认**：KaTeX 字体由上游构建并嵌入 DSH 前端，未记录其精确 KaTeX 版本；本文件使用 npm 最新版 MIT 文本。若要求严格版本对应，应从 DSH 发布方取得构建时 KaTeX 版本并复核。

## 已裁剪字体

LibreOffice 随包字体属于 MPL-2.0 的 `libreoffice-kit-win32-x64`，已按 5A 裁剪；如恢复 office 组件，需重新纳入字体许可与 NOTICE。

