# T03 实现PDF图文解析和可恢复导入

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：实现PDF图文解析和可恢复导入。需求：R02、R03、R17。验收：A04、A05、A06、A07、A29，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T01；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：先用自有合法PDF fixture；实际教材缺失不阻塞机制开发，不可假称已核教材。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[03-evidence](../03-evidence.md)、[04-dsh-integration](../04-dsh-integration.md)、[05-data-contracts](../05-data-contracts.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/packages/importer/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T03.md`、`docs/rebuild/requests/T03.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

自有文本/扫描/混排/损坏fixture的提取、OCR、页码、cancel/resume/重试测试通过，引擎分发物料齐；L5待T16。

可提供门：implementationAccepted。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A05无开发PATH产物→T16；A06/A07/A29真实UI→T09/T13。

附加允许写入：`education/.local/evidence/T03/`、`education/.local/cache/T03/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 实现受管资产、文件hash、版本信息确认、页数/加密/损坏检查；禁止任意路径读取。
2. 文本层优先，扫描页OCR、图像/图注定位、PDF页与印刷页映射分别保存；原稿不可覆盖，修订留账；选择可Windows分发的引擎及license。
3. 按stage/page checkpoint和版本hash缓存，cancel/resume/retry幂等，迟到结果不发布，重跑不覆盖人工修订。
4. 区分同hash、同版不同扫描和同名异版；交来源blocks/figures/目录候选；无网络时本地步骤继续而云抽取明确暂停。
5. 验证不依赖开发机全局Python、中文路径、旋转/多栏/图片混排/空白/扫描失败；给T16运行物料清单。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T03 / test:task T03及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T03.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不得把“PDF上传给DSH”当解析完成。真实教材输出只落.local，不把原文原图写Git。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
