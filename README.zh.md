<p align="center">
  <img src="docs/images/cover.png" alt="芽问封面：深色背景上一枚抽象叶片标记，右侧为 SproutAsk 与「芽问」字标" width="100%">
</p>

<h1 align="center">芽问 SproutAsk</h1>
<p align="center">装在学生自己电脑上的初中生物学习 Agent，基于 DeepSeek Harness 内核。</p>
<p align="center"><a href="README.md">English</a></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@deepseek-ai/dsh"><img src="https://img.shields.io/badge/DSH-0.2.1--rc.3-3B5BDB?style=flat-square" alt="DSH 0.2.1-rc.3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A524-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 24 或更高"></a>
  <a href="https://learn.microsoft.com/windows/"><img src="https://img.shields.io/badge/Windows-10%20%2F%2011%20x64-0078D4?style=flat-square" alt="Windows 10 / 11 x64"></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-11.21.0-F69220?style=flat-square&amp;logo=pnpm&amp;logoColor=white" alt="pnpm 11.21.0"></a>
</p>

## 简介

芽问把一册教材变成一条有引导的学习回路：在教材库里读一节，沿概念地图走，到工作区把某个概念想清楚、作答，拿到能指回原文页码的反馈。它面向在人教版《生物学·七年级·上册》（2024 年版）上学习、使用自己 Windows 电脑的学生。

学习记录保存在学生本机。唯一的云端依赖是 DeepSeek 推理接口；没有配 Key 时应用仍可打开，可作为教材库、概念地图与历史记录的本地阅读器使用。

v0.3.0 是 **DSH 教育重构线**：应用改为在真实 DeepSeek Harness 内核上以「本机后台服务 + 应用窗口」运行，不再附带 Electron 外壳。此前的 Electron 0.2.x 线不是这一期的产物。

## 核心特性

- **一册完整内容，经人工审校后发布。** 1 册 / 2 单元 / 7 章 / 22 节 / 43 概念 / 88 活动 / 43 评分细则 / 44 条关系，含 193 个去重教材出处（281 条出处引用）。内容包在人工 curator 逐项审校后为 `status=published`。
- **回答带页码锚点。** 反馈同时给出 PDF 页码与印刷页码，学生能翻到纸面上的那句话。
- **三轴学习状态。** 概念级状态随学习流程推进；复习通过 `finish-review` 落账，而不是从翻页行为推断。
- **显式处理核心误解。** 概念未达成时，指出具体是哪个误解、正确说法是什么、依据哪一处原文。
- **提示如实标记。** 提示之后作答记为 `assisted`，不计入独立证据。
- **图片作答先过质量门。** 模糊、倾斜、空白图片在调用模型前就被拦下并要求澄清；通过的图片判分幂等。
- **记录留在本机，崩溃后可恢复。** 学习数据以 JSONL 写在本机数据目录，journal 对陈旧锁自愈，半行写入有降级路径。
- **API Key 不出本机。** 在应用内录入，用 Windows DPAPI 加密保存，客户端不回显，重启后生效。
- **免管理员、无 Electron。** 按用户安装，以本机服务加应用窗口启动。

## 安装

**环境要求：** Windows 10 或 11，x64。

v0.3.0 分发两个 Windows 产物。它们属于构建产物、不存于本 Git 仓库；请从维护者或 Releases 页面获取，运行前先核对哈希。

| 文件 | 大小 | SHA-256 |
|---|---:|---|
| `SproutAsk-Setup-0.3.0-x64.exe`（一键安装） | 56.7 MB | `0fc5df1828265d0ed74e20f89cc7ddc0d3c55f5ac83e6de3df39a2e042d9c014` |
| `SproutAsk-0.3.0-x64-portable.zip`（便携） | 117.4 MB | `6a0852cd186e27db861d1fc80cdc9c19800e76ce186fbf750397ec9df9bfaa7b` |

1. 运行安装程序。按用户安装到 `%LOCALAPPDATA%\SproutAsk\current`，不需要管理员权限。
2. 产物**未做代码签名**，Windows SmartScreen 会提示"未知发布者"。维护者未购买签名证书。
3. 运行前先核对：

```powershell
Get-FileHash .\SproutAsk-Setup-0.3.0-x64.exe -Algorithm SHA256
# 应为 0FC5DF1828265D0ED74E20F89CC7DDC0D3C55F5AC83E6DE3DF39A2E042D9C014
```

**从源码运行（开发）：** 需要 Node.js 24 或更高，pnpm 11.21.0。

```powershell
cd education
pnpm install
pnpm typecheck
pnpm test
pnpm dev          # 构建、打印本机回环地址、前台常驻
```

`pnpm dev` 使用 `education/.local/` 下的隔离配置运行，不会影响已有的 Harness 安装。开发运行时从 `education/.local/secrets/deepseek.key` 读取 Key，该文件仅存在于本机、不在本仓库中。

## 使用方式

1. 从开始菜单启动 **SproutAsk**。首次启动会创建本机数据目录 `%LOCALAPPDATA%\SproutAsk\data`。
2. 打开 `/account`，粘贴 DeepSeek API Key 并保存。Key 在本机加密保存，之后不再回显。**重启应用**后生效。
3. 在 `/library` 选一节；或打开 `/map`，按概念而不是按页序推进。
4. 在 `/workspace` 作答。答错时反馈会指出对应误解，并给出教材页码。
5. 用 `/records` 回看已学内容、完成复习。
6. 没有 Key 时应用处于本地模式：教材库、概念地图与历史记录可用，云端推理不可用。

## 配置

| 配置项 | 位置 | 说明 |
|---|---|---|
| DeepSeek API Key | 应用内 `/account` 页面 | 用 Windows DPAPI 加密，只存在本机，不回显给客户端；需重启应用生效。 |
| 学习数据 | `%LOCALAPPDATA%\SproutAsk\data` | JSONL 记录，以及复习与 journal 状态；首次启动时创建。 |
| 安装位置 | `%LOCALAPPDATA%\SproutAsk\current` | 按用户安装；卸载默认保留学习数据，可选择删除。 |
| 数据根覆盖 | 环境变量 `SPROUTASK_DATA_ROOT` | 进阶用法：改变数据根，用于隔离的测试配置。 |
| 开发用 Key | `education/.local/secrets/deepseek.key` | 仅开发运行时使用；本机文件，永不提交。 |

## 发布

当前发布为 **v0.3.0 — DSH 教育重构线**。发布说明见 [docs/releases/v0.3.0.md](docs/releases/v0.3.0.md)。

### v0.3.0 已知限制

写在这里是因为它们真实存在且尚未解决，不是客套：

1. **未做代码签名。** SmartScreen 会提示未知发布者。
2. **图义只做了抽样核对。** 图注的视觉核对覆盖 **73 张中的 8 张**（一致 7、无法判断 1），其余 65 张未核对；且结论来自会话内视觉模型，不是人眼签字。
3. **版次、印次、定价、开本未核实。** OCR 未识别版权页小字。已知信息是 ISBN-13 `978-7-107-38263-5` 与出版社人民教育出版社。
4. **没有干净机验证。** 只有本机近似（无开发 PATH、独立数据根）通过，没有第二台 Windows 机器。
5. **没有界面视觉走查。** 界面行为有离线断言，但没有真实浏览器或设备截图。
6. **拍照路径未在真机验证。** 手机 JPEG、canvas 压缩、澄清后重试三条路径均未测。
7. **没做学习效果实验。** 本期不声称提升理解或成绩。
8. **Harness 没有回合取消接口。** 超出预算时应用只是不再等待，被放弃的模型回合仍会在后台跑完。
9. **门状态如实：** G1 = PARTIAL，G2 = FAIL/PARTIAL，G3 = PARTIAL，最上层 `finalAccepted` 门 **不可达**。

### 本期不包含

教师端、班级聚合、多设备同步、自动更新、遥测、公网暴露，以及对其他教材的同等质量承诺。

## 许可证

**尚未声明许可证（No license specified）。** 本仓库根目录没有 `LICENSE` 文件，`package.json` 标注 `"license": "UNLICENSED"`。`publish/public/LICENSE` 下那份 MIT 文本是发布导出流程使用的模板（占位符 `{{YEAR}} {{HOLDER}}` 未填写），不构成对本仓库的授权声明。许可证如何选择待维护者决定。
