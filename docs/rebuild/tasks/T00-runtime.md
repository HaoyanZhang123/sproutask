# T00 固定DSH来源与隔离运行准入

> 主智能体内部工作包。当前为待实施规格；用户只需发总控提示词，主智能体自动派发本卡，不要求用户另开对话。执行前先读[总控调度](../08-execution.md)和[子智能体模板](../SUBAGENT-PROMPT.md)。

## 目标、前置与读取

目标：固定DSH来源与隔离运行准入。需求：R01、R14、R18。验收：A01、A02、A03、A24，这些是对最终AC的贡献，不是本阶段全部退出门；最终等级以[验收矩阵](../07-acceptance.md)为准。

前置主阶段：无，领域阶段可与T00并行；实际解锁以index.json的readinessDependencies/phaseGates为准，不要求前置的所有最终AC已完成。

必要输入：官方可构建固定DSH来源；正当账户/API Key和live预算若缺则单列外部门，不取当前DSH凭据。

必读：[交接入口](../00-START.md)、[产品契约](../01-product-contract.md)、[数据契约](../05-data-contracts.md)、[执行协议](../08-execution.md)；本卡补充：[03-evidence](../03-evidence.md)、[04-dsh-integration](../04-dsh-integration.md)。不依赖先前聊天。

## 独占写入范围

- 计划路径：`education/probes/runtime/`
- 计划路径：`docs/rebuild/runtime-lock.json`

另外仅可写自己的交回报告与变更请求：`docs/rebuild/reports/T00.md`、`docs/rebuild/requests/T00.md`。其他公共契约、配置、锁文件、宿主注册、旧工程、原DSH安装均只读。主控PROGRESS只由主控写。需要跨域改动先请求，禁止擅自越界。以上新代码路径为未来计划，当前不存在也不能声称已实现。

## 阶段退出门与最终验收延期

固定来源/license清单和隔离真实DSH启动、root/最小工具校验分别交sourceReady/runtimeReady；无凭据时账户/模型live明确未验。无来源不产生runtimeReady，但不阻塞T01.domainReady。

可提供门：sourceReady、runtimeReady、accountVerified。主控记录implementation/contract readiness和globalAcStatus两个维度；只按依赖指定的门解锁后继，最终AC必须后续补齐。

延期补验责任：A01→T13/T15，A02→T16/T17，A03→T08/T13/T16，A24→T13；runtime probe只覆盖各AC前置子项。

附加允许写入：`education/.local/evidence/T00/`、`education/.local/cache/T00/`及自己包内已忽略的构建/test临时产物；禁止写其他任务local目录或旧数据。

## 必须完成的步骤

1. 核实官方源码或可嵌入发行物、版本/commit、license与完整依赖指纹；禁止编辑/复制已安装asar作为工程。
2. 在本项目隔离probe验证root替换、最小受限教育工具、会话及模型路由；拒绝shell/PTC与任意路径；用户当前GUI不受影响。
3. 核实平台DSH专用授权对派生产品的准入，账号/API Key分别测试；不明许可不自行绕过；图像能力只记目录和待实测。
4. 形成runtime-lock：来源、版本、Node/pnpm要求、插件API、client框架/bundle、host/desktop方式、启动清理命令、可再分发物料、认证门状态及证据。

## 验证与交回

按04执行隔离probe并保存实际命令/结果，不能运行尚不存在的新工程脚本。

真实模型/图像/打包等依本卡AC级别补验；mock/历史通过/目录声明不能替代。预算或原材料缺失时交可复核离线结果及精确BLOCKED，主控继续独立工作。测试失败先分析归属，在范围内自主修，不能删测试/降标准/重跑取最好一次。

使用[报告模板](../09-report-template.md)交回../reports/T00.md（执行时创建），包括改动、命令/退出码、AC逐项、证据与hash、失败/未测、契约影响和后继输入。报告中的文件路径必须能解析；原文/图/真实对话local证据不提交Git。主控复核接受后才释放后继。

## 特别约束

来源/许可/root本地准入只阻塞T01.runtimeReady，不阻塞T01.domainReady；认证live未知可允许领域工作有条件推进，但最终A03仍需真实补齐。probe本地私有目录自行.gitignore，不改当前DSH配置。

用户派发总控提示词后，本卡范围内可逆实现与必要依赖申请不需逐项重复请示；本轮编交接文档不实施。公开发布、push、付费/注册、删旧数据、改安装版均需另行明确授权。
