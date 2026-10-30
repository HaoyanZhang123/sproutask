# T13 集成首节真实端到端闭环

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：集成首节真实端到端闭环。需求：R01、R03、R06、R07、R11、R12、R15、R17、R18。验收：A01、A08、A13、A14、A20、A21、A22、A24、A25、A29、A30、A35，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T05、T12、T00、T01；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：全部前置报告、partial真实首节；live预算/凭据有授权；公共写锁由主控转交。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)、[06-system-design](../06-system-design.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/runtime/`
- 计划路径：`education/package.json`
- 计划路径：`education/pnpm-lock.yaml`
- 计划路径：`education/config/`
- 计划路径：`education/scripts/`
- 计划路径：`education/tests/integration/`
- 计划路径：`education/tests/e2e/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T13.md`、`docs/rebuild/requests/T13.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

G1：在T00/T01 runtimeReady及真实首节下，真实DSH/正当模型和预算内完成首节端到端及失败恢复，当前AC中可本阶段验证项达到L4；L5后补。

可提供门：G1。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：所有L5→T16/T17；A09/A10全册→T14/T15；最终语义稳定性→T15。

附加允许写入：`education/.local/evidence/T13/`、`education/.local/cache/T13/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 暂停并行写入后接各模块factory、UI路由、safe assets与DSH桥，去除生产fixture替身；不直接把旧loop粘接作引擎。
2. 运行全部离线/契约/本地集成与真实UI主旅程，无Key/有Key与mock/live分别出报告。
3. 执行G1：原PDF→匹配→地图→学→解释/错误/纠错→复习→图示图片→证据三轴→关闭重开恢复，保留真实DSH轨迹。
4. 检查隐藏开发入口与后端真实拒绝、双提交、磁盘满、限流、切概念迟到、候选试用及版本更新。
5. 把跨模块失败按owner返工，不多方同时修；修改后重跑受影响AC，交可复现启动说明。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T13 / test:task T13及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T13.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

若认证/预算/原PDF受阻，离线集成可交但G1不得PASS；不要因此把最终范围降为演示。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
