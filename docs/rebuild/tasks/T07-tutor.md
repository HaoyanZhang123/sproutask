# T07 实现DSH教学工具与生物Skill

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现DSH教学工具与生物Skill。需求：R01、R06、R07、R14、R16、R17。验收：A01、A13、A14、A24、A27、A29，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T04、T06；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：T00/T01固定DSH adapter；knowledge与learner公开port；live缺预算先离线。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[01-product-contract](../01-product-contract.md)、[02-user-flows](../02-user-flows.md)、[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/packages/tutor/`
- 计划路径：`education/skills/biology/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T07.md`、`docs/rebuild/requests/T07.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

教学Skill、工具factory与公开ports完成，mock gateway下12类行为回放及权限负例可测试；DSH实际绑定与真实模型语义评价待runtimeReady后由T13/T15补。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A01/A13/A14/A24/A29真实DSH语义→T13/T15；A27实际产物→T16。

附加允许写入：`education/.local/evidence/T07/`、`education/.local/cache/T07/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 为learn/review/diagnostic注册DSH教育工具与Skill；查询内容/提交作答/获取反馈/解释证据走同一服务，不另建旧Agent loop。
2. 上下文只带当前材料、相关前置与必要证据；引用事实和模型解释/类比分开，图文提示注入当数据。
3. 允许提示、直接解释、示范、确认和纠错；连续受挫降低难度，复习按作答选回忆/辨析/迁移/补前置，尊重跳过/结束。
4. 落实host权限allowlist、取消与迟到响应检查；attempt先存、模型失败可重试，不重复评估入账。
5. 交注册factory与真实DSH轨迹格式，完成离线教学回归和获准预算内真实路径验证，不能以关键词/问号代替语义判读。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T07 / test:task T07及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T07.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不改domain/runtime公共入口；不继承旧“永不直接回答”的硬护栏。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
