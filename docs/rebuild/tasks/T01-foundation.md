# T01 建立隔离教育工作区并冻结公共契约

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：建立隔离教育工作区并冻结公共契约。需求：R01、R09、R15、R16、R18。验收：A02、A27、A28，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：无，领域阶段可与T00并行；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：领域阶段仅需产品/公共契约与通用TS工具链；runtime阶段才要求T00可构建来源和适配面。不得在domainReady期间伪造DSH绑定。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)、[06-system-design](../06-system-design.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/package.json`
- 计划路径：`education/pnpm-lock.yaml`
- 计划路径：`education/pnpm-workspace.yaml`
- 计划路径：`education/tsconfig*.json`
- 计划路径：`education/packages/domain/`
- 计划路径：`education/runtime/`
- 计划路径：`education/scripts/`
- 计划路径：`education/config/`
- 计划路径：`education/client/package.json`
- 计划路径：`education/client/tsconfig*.json`
- 计划路径：`education/.gitignore`
- 计划路径：`docs/rebuild/contract-lock.json`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T01.md`、`docs/rebuild/requests/T01.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

阶段A domainReady：纯domain校验器、fixtures、独立工具链、按任务检查和mock port实际通过；不绑定DSH具体API。阶段B runtimeReady：T00.runtimeReady后实现实际adapter/root/build并更新contract-lock；无运行时不能伪造该门。

可提供门：domainReady、runtimeReady。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A02/A27→T16，真实模块组合→T13；domainReady不能冒充runtimeReady。

附加允许写入：`education/.local/evidence/T01/`、`education/.local/cache/T01/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 按06建立education独立pnpm工作区，不改变旧根package/lock/src；依赖集中锁定并记录license；原文/图片/数据/.local构建产物忽略。
2. 实现05全部实体/运行时校验与ports、正负fixtures；版本隔离、partial/full范围、candidate试用、两阶段attempt/assessment提交均明确类型。
3. 实现最小DSH adapter与模块factory/页面注册契约，UI框架依T00；提供可测试mock gateway和host能力接口，不写正式业务。
4. 建立06命令及按Txx包级typecheck:task/test:task路由；未到阶段脚本非零not implemented；独立配置下启动最小教育root。
5. 交contract-lock（schema/API版本、文件hash、脚本入口、包名与依赖方向），让所有后继用同一fixture而非各造协议。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T01 / test:task T01及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T01.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

T01拥有共享配置写锁；受影响契约变更必须停消费者。只创建后续包必要空入口，不写其实现、不假报未实现脚本通过。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
