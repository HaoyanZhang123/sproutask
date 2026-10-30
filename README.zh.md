<p align="center">
  <img src="docs/images/cover.png" alt="芽问封面：深色横幅，含「芽问 SproutAsk」字标与「观察 → 推理 → 理解」示意面板" width="100%">
</p>
<p align="center"><sub>设计示意图，非产品截图。</sub></p>

<h1 align="center">芽问 SproutAsk</h1>
<p align="center">运行在 DSH 内核上的本地优先生物学学习 Agent。</p>
<p align="center"><a href="README.md">English</a></p>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="DSH" src="https://img.shields.io/badge/runtime-DSH%200.2.1--rc.3-1f6feb"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6"></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-24-3c873a"></a>
  <a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-11-f69220"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-2ea44f"></a>
</p>

## 简介

芽问是给**一名学生、一台 Windows 电脑**用的学习工作区。它把真实的 DSH Agent 会话与一套经过核实的内容包（人教 2024 七年级上册生物学）接在一起：学生读概念、作答，获得带教材出处的解释或纠错，并在本机留下"理解到什么程度"的记录。

这里有两件事比功能数量更重要——**对话跑在真实 DSH 内核上，不是外观相似的聊天应用**；**学情判断建立在已记录的证据上，而不是对话条数上**。每一段解释都绑定到学生导入的教材页。

## 核心特性

- **目录树与概念图分开**：目录树和先修/相关关系图是两个视图；先修边必须带依据，绝不按章节顺序生成。
- **三条轴独立**：学习进程、理解证据、复习活动分别存储与显示；自评单独保存，永不写进学情判断。
- **先引导，必要时直说**：会提问、提示、示范，也可以解释、给完整答案——但会把"已披露答案"标出来，保证证据诚实。
- **回答带出处**：解释回合带 source id 与 PDF 页/印刷页；教材原文只留在本机。
- **图片作答先过质量门**：模糊、倾斜、空白图片在调用模型前直接要求重拍；判定过的图片只落库一次，重复提交不重复记分。
- **可恢复的本地日志**：追加式事件日志 + 快照 + 崩溃恢复 + 陈旧锁自愈 + 导出与确认删除。

## 安装

从 [Releases](https://github.com/HaoyanZhang123/sproutask/releases/tag/v0.3.0) 下载：

- `SproutAsk-Setup-0.3.0-x64.exe` —— **免管理员**的每用户安装包，装到 `%LOCALAPPDATA%\SproutAsk\current`
- `SproutAsk-0.3.0-x64-portable.zip` —— 解压后运行 `launcher.cmd`

安装包**未做代码签名**，Windows 会提示"未知发布者"；包内附 `SHA256SUMS.txt` 供校验。

## 使用方式

1. 从开始菜单或桌面快捷方式启动 **SproutAsk**。
2. 打开 `/account` 粘贴 DeepSeek API Key（本机加密存储，之后不再回显），随后**重启应用**——Key 按设计在进程启动时加载。
3. 导入你自己的教材 PDF，从教材库或地图选概念开始学习。
4. 没有 Key 时处于本地模式：教材、地图、记录可读，云推理明确不可用。

## 配置

| 项 | 值 |
|---|---|
| 模型 | DeepSeek 官方 API，`deepseek-flash`；仅 API Key（不提供账户登录） |
| Key 存储 | `%LOCALAPPDATA%\SproutAsk\data\secrets\model-key.dat`，DPAPI 加密，仅宿主侧 |
| 学习数据 | `%LOCALAPPDATA%\SproutAsk\data`（journal、快照、导入材料） |
| 网络 | 仅 loopback，本地服务不绑定公网接口 |

## 项目结构

```
education/packages/   domain、storage、importer、knowledge、learner、tutor、visuals
education/client/     无框架 DOM 界面：shell、library、map、study、visuals
education/runtime/    DSH host/client 插件、适配器、组合根、启动器
education/content/    biology-7a 内容包：概念、活动、rubric、关系、出处
education/licenses/   第三方许可清单（含 libvips LGPL-3.0 义务）
```

## 发布

见 [v0.3.0 发布说明](docs/releases/v0.3.0.md)。DSH 重构线现已合并到 `main`；旧的 Electron 0.2.x 源码保留在仓库中供追溯。

## 当前状态与已知限制

这是**带已知缺口的冻结工程版**，不是完成品。

- 门状态：G1（首节闭环）PARTIAL · G2（全册与教学）FAIL/PARTIAL · G3（Windows 产物）PARTIAL · 最终验收**未达成**。
- 图义视觉核对**只抽样 8/73**（7 条一致、1 条无法判断），其余 65 条仍待人眼复核。
- 版次、印次、定价、ISBN 行在内容包中为 `unverified`；ISBN-13 `978-7-107-38263-5` 来自封底识别。
- 未做干净机验证、未做代码签名、**未做学习效果实验**——不声称提升理解或成绩。
- 界面只有 DOM 级断言，没有真实浏览器视觉走查；图片作答未用真实手机照片验证。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。Copyright (c) 2026 HaoyanZhang123。
