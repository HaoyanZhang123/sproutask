# T16 构建并验证Windows桌面交付物

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：构建并验证Windows桌面交付物。需求：R01、R02、R14、R15、R18。验收：A02、A05、A22、A27、A31、A32，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：T15；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：T00合法固定物料、T15通过、DSH账户准入结论与OCR可分发runtime。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[04-dsh-integration](../04-dsh-integration.md)、[06-system-design](../06-system-design.md)、[07-acceptance](../07-acceptance.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/desktop/`
- 计划路径：`education/runtime/launcher/`
- 计划路径：`education/package.json`
- 计划路径：`education/pnpm-lock.yaml`
- 计划路径：`education/scripts/packaging/`
- 计划路径：`education/licenses/`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T16.md`、`docs/rebuild/requests/T16.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

G3：实际便携和安装exe分别运行且达到A31/A32等L5，固定hash；账户/来源/预算受阻则该门BLOCKED。

可提供门：G3。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：独立最终复核所有AC→T17；发现问题必须返原owner。

附加允许写入：`education/.local/evidence/T16/`、`education/.local/cache/T16/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。打包产物只写`education/dist/`。

## 必须完成的步骤

1. 构建独立Windows便携版与标准用户安装版，实际包含可运行DSH与OCR等必要物料，不依赖全局DSH/Python/项目.env。
2. 仅白名单自有内容结构/图形、代码、license，扫描包内部实际清单和秘密/原文/个人数据，不只扫描文件名。
3. 运行要交付的exe本身，隔离新userData、无Key与合法配置后真实模型、用户导入PDF/OCR、全册地图、作答和重启恢复。
4. 验证安装/卸载/版本更新数据保留，删除仅明确确认；输出产物hash与复现命令、依赖物料清单、已知SmartScreen等实情。

## 验证与交回

T01建立命令后，运行自己范围的typecheck:task T16 / test:task T16及公共契约检查；全量typecheck/test/build须主控检查屏障。T01自身需先提供可执行命令，不得以echo成功凑数。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T16.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

不上传发布、不替换当前DSH安装；不能只测win-unpacked就宣称交付exe已测。签名不伪装官方。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
