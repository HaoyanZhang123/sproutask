# 03 静态证据与缺口

核查日期：2026-10-29（Asia/Shanghai）。本文件是交接证据，不是实施完成报告。目标为 Windows 个人学生桌面、可扩展全学科架构，首期人教 2024 七上生物全册概念学习；教学引导优先，允许按需要讲解。目标不等于现有能力。

## 核查方法与基线

- 已核实：工作区 E:/DSH/workspaces/ai4edu；Git HEAD a8822e8082855df7d8688e0d6dbe4be543513816。文档任务开始时只有 [PROGRESS](<E:/DSH/workspaces/ai4edu/docs/PROGRESS.md>) 存在未提交变更，该变更不是本文件作者所作。education/ 当前不存在，留作后续隔离实现目录，本轮未创建。
- 已核实：[app.asar](<E:/DSH-desktop/resources/app.asar>) 是 182,434,783 字节的 Electron 安装归档，LastWriteTimeUtc=2026-10-23T08:00:56Z，SHA-256=04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0。文件时间不是构建时间证明。
- 普通 Windows 文件操作不能将归档内部 dsh 当真实目录。本次通过现有 Electron Node fs 只读访问虚拟路径，不落地解包、不执行包内代码。读到的是随包 README、package 元数据和 lib 编译实现，**不是完整源码 checkout，也未证明可构建性**。
- [运行时包元数据](<E:/DSH-desktop/resources/app.asar/dsh/package.json>) 声明版本 0.2.1-rc.3，相关 DSH 依赖固定为同版。[认证包元数据](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/package.json>) 指向官方仓库 <https://github.com/deepseek-ai/deepseek-harness>；本次未联网确认对应 tag/commit、源码可取得性和构建结果。
- 证据收集子任务仅写本文件及 [接入方案](<E:/DSH/workspaces/ai4edu/docs/rebuild/04-dsh-integration.md>)，未运行应用、测试、构建、安装或模型请求，未读取用户凭据、私人配置或浏览器 Cookie。只读元数据与指纹计算不是功能实测。

## 旧工作区：机制存在不等于新方案通过

| 状态 | 已读证据 | 结论及限制 |
|---|---|---|
| 已核实，静态 | [JSONL 存储:9](<E:/DSH/workspaces/ai4edu/src/main/storage/jsonl-store.ts#L9>)、[读取:40](<E:/DSH/workspaces/ai4edu/src/main/storage/jsonl-store.ts#L40>)、[追加:56](<E:/DSH/workspaces/ai4edu/src/main/storage/jsonl-store.ts#L56>) | 已有按学生/会话拆文件、追加记录、统计坏行的实现；不能称存储未实现。它不等于新方案统一有序事件真相，未验证并发、幂等、崩溃恢复和快照重建 |
| 已核实，静态 | [上下文装配:28](<E:/DSH/workspaces/ai4edu/src/core/content/scope.ts#L28>) | 按学习位置选择小节与知识点，不证明全册完整或教学有效 |
| 已核实，静态 | [本地内容装载:14](<E:/DSH/workspaces/ai4edu/src/main/content/file-library.ts#L14>)、[装载:68](<E:/DSH/workspaces/ai4edu/src/main/content/file-library.ts#L68>) | 结构 YAML 与本地原文分离，原文不随包。旧演示回落不能冒充新产品真实教材 |
| 已核实，静态 | [领域契约:14](<E:/DSH/workspaces/ai4edu/src/core/domain/index.ts#L14>)、[学情字段:55](<E:/DSH/workspaces/ai4edu/src/core/domain/index.ts#L55>) | 已有小节出处、知识点、三态掌握和学习位置字段；字段存在不是掌握判定有效性证明，也不自动冻结为新接口 |
| 历史文档记载，非本次实测 | [历史进度记录](../PROGRESS.md)及该文档更早记录 | 旧测试、评测、装机数字只能作为历史记录，不能写成本次通过或重构后通过；概览曾与实际实现不同步 |

已读范围：项目架构、约定、进度；上述四份旧源码。未全仓审计，未读学生历史数据，未修改或搬迁旧源码。

## 教材材料：只列元数据

当前工作区 glob 模式 `**/*.pdf` 返回空，**未找到实际教材 PDF**。不推断工作区外不存在，不广扫个人盘，不把“此前可能有 PDF”写成当前可用。以下仅 stat，未读正文；文件名里的 reviewed/annotated 不构成质量证明。

| 实际文件 | 字节 | 修改时间 UTC |
|---|---:|---|
| [旧一节文本](<E:/DSH/workspaces/ai4edu/content/textbook/rjb-7s/第一单元/第二章/第四节-细胞的生活.md>) | 8543 | 2026-09-27T09:24:29.715Z |
| [旧一节修订稿](<E:/DSH/workspaces/ai4edu/content/textbook/rjb-7s/第一单元/第二章/第四节-细胞的生活.reviewed.md>) | 8530 | 2026-09-27T09:37:55.650Z |
| [旧一节标注稿](<E:/DSH/workspaces/ai4edu/content/textbook/rjb-7s/第一单元/第二章/第四节-细胞的生活.annotated.md>) | 9034 | 2026-09-27T12:31:58.048Z |
| [旧修正记录](<E:/DSH/workspaces/ai4edu/content/textbook/rjb-7s/第一单元/第二章/第四节-细胞的生活.修正日志.md>) | 3624 | 2026-09-27T09:37:55.660Z |
| [课标文本](<E:/DSH/workspaces/ai4edu/content/textbook/curriculum/义务教育生物学课程标准（2022年版）.md>) | 125360 | 2026-09-27T12:50:08.917Z |

T03 可用自有/获准 fixture 开发 PDF 提取与页码映射；**T05 首节真实内容、T14 全册内容验收均被实际教材缺失阻塞**。需取得实际 PDF，核对封面、版权页、版次、目录与页数，记录来源和指纹。教材原文只存本地、不进公开仓库或分发包；模型云端会接收当前任务必要片段/图片，不能声称教材内容绝不出本机。

## DSH 0.2.1-rc.3 静态证据

以下为归档内虚拟文件，行号仅对应本版。

| 主题与状态 | 准确位置 | 结论及证据边界 |
|---|---|---|
| 账户类型：已核实 | [平台来源:501](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js#L501>)；[初始化:1018](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js#L1018>)；[兑换:1056](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js#L1056>) | 默认 platform.deepseek.com；系统浏览器 /dsh/authorize，state+S256 PKCE，auth_init/auth_exchange；不是 chat 网页 Cookie 复用，未见独立 DSH 学生注册库。平台注册细节未核实 |
| 凭据路线：已核实 | [两路认证:89](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/README.zh.md#L89>) | 已有账户 token 走 x-dsh-auth-token，API Key 走 x-api-key，独立且不互相回退 |
| 平台限制：已核实实现；第三方许可未知 | [来源检查:804](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js#L804>)；[限制:95](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/README.zh.md#L95>) | 精确 inferenceOrigin；回调仅本机显式端口或 SSH 转发，不支持非本机域名反代；文档称无 token 过期/刷新流程。代码存在不等于衍生应用获准 |
| root 接管：已核实机制 | [渲染根:32](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-renderer/README.zh.md#L32>)；[槽位:30](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/README.zh.md#L30>)；[空 host 入口:2](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/index.js#L2>) | 根占用方拥有产品布局与 document 元数据，布局本身是 browser-only 插件。替换旧 root 后实际装载及依赖兼容待 T00 实证 |
| client 构建：已核实要求 | [声明:34](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-modules/README.zh.md#L34>)；[构建产物:55](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-modules/README.zh.md#L55>) | 需要 dsh.client 元数据、构建后的 bundle；不是写 Skill 就能重做 UI |
| 教育工具：已核实扩展点 | [工具:30](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tools/README.zh.md#L30>)；[守卫:83](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tools/README.zh.md#L83>)；[Skill:12](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-skill/README.zh.md#L12>) | 可注册服务工具、校验参数与限制执行。Skill 是任务指令目录/加载，不是独立权限边界 |
| Host 安全：已核实 | [访问认证:65](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-web-app/README.zh.md#L65>)；[owner:33](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-api-gateway/README.zh.md#L33>)；[秘密投影:49](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-settings/README.zh.md#L49>) | Host token-cookie/Host-Origin 与模型账户登录不同；owner 直通，非 owner 经资源策略；不是教育多租户现成实现。隐藏菜单不等于限制权限 |
| 多模态：接口已核实，效果未实测 | [图像检查:1438](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js#L1438>)；[附件:40](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-attachment/README.zh.md#L40>)；[PDF 延期:153](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-web/README.zh.md#L153>) | 模型需有 image 能力及附件服务；非图片仅传文件路径句柄，PDF 上传/预览不等于解析/OCR。图像批改必须 T11 真模型验收 |

技术推断：独立教育插件组合可复用 DSH 工具与浏览器根界面。原生窗口、preload、安装更新、启动内核超出普通页面 slot 范围。未据此证明可构建、可嵌入、可分发或识图正确。

## 指纹与许可证

| 归档内文件 | SHA-256 |
|---|---|
| [平台认证实现](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js>) | 3b82b41e3e94566e43105a2552c0a4804983be39e1e16ad8b0d0646c76ec0057 |
| [渲染器文档](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-renderer/README.zh.md>) | b60fa7e998d8453338f3b336224b318ae104da303a4870cef380c30b8d62bf42 |
| [客户端布局](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js>) | eb011a7b5699fac7f3ad0aa15408f46a6cf47f79b8cc15db1f81739e81e70587 |
| [工具文档](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tools/README.zh.md>) | b4ef23bb0848626ea98b99f308ba0eb442f34e889f3b3db8a665b24e6be23176 |
| [附件文档](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-attachment/README.zh.md>) | f583e75a5771b3f1dfd6247928ee20246203305a428e8e214b65a0f1fa19f454 |
| [模型传输](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js>) | 21fedb71f8d9aafea73b35ee13bc73737a8271d7ffa261697d4208e8563196cb |

已读 [认证包 LICENSE](<E:/DSH-desktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/LICENSE>)：MIT、Copyright (c) 2026 DeepSeek，要求保留版权和许可。**这仅是该包的证据，不是整个桌面物料及依赖的许可证审计**；品牌、模型服务、第三方二进制须由 T00/T16 分开核查。

## 未知项归属与阻塞范围

| 未知/待实测 | 责任 | 阻塞范围 |
|---|---|---|
| 官方可取得、可构建或可合法再分发来源；固定版本与 commit；root/RPC兼容；隔离实证 | T00 | 阻塞具体 DSH 集成及分发，不阻塞独立领域契约和自有样例 |
| DSH 专用平台授权第三方准入、注册与使用许可 | T00 | 阻塞已有账户登录路线承诺；API Key 路线独立验证，不自动视为通过 |
| PDF 提取、OCR、出处映射、原图保真与恢复 | T03 | 阻塞实际材料导入；自有 fixture 不阻塞。无实际教材还阻塞 T05/T14 |
| 图片能力与真实手写/图表批改效果、失败路径、成本 | T11，接入资格由 T00 | 阻塞图片批改上线，不必阻塞文本学习 |
| Windows 安装包依赖、许可清单、冷启动与数据隔离 | T16，来源 gate 前置 T00 | 阻塞学生分发，不能借用本机 DSH 安装状态宣称完成 |

T01 的冻结要求见 [接入方案](<E:/DSH/workspaces/ai4edu/docs/rebuild/04-dsh-integration.md>)。所有待实测项保持未通过。
