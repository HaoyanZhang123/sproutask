# 功能地图

## 功能: 在真实 DSH 内核上对话，不是外观相似的聊天
- 状态: 可用
- 简介: 每次提问都走本机 DSH 会话与受限工具；模型只负责推理，教材与记录不离开本机。
- 证据: education/runtime/src/g1-service.ts, education/runtime/host-plugin/src/index.ts
- 依赖: 无

### 子项: 答完能追到课本页
- 状态: 可用
- 简介: 解释回合带出处；页码只引用本轮工具确实返回过的页。
- 证据: education/packages/tutor/, education/content/biology-7a/source/

## 功能: 知识地图：先看全册，再看一章里的关系
- 状态: 可用（重构中）
- 简介: 全册按单元/章列出概念状态；点进一章看"先学→接着学→再学"的分层关系图，另有列表等价视图。
- 证据: education/client/map/src/, education/content/biology-7a/fragments/relations-full.json
- 依赖: 在真实 DSH 内核上对话，不是外观相似的聊天

## 功能: 学习台：读课本、作答、看反馈在一处
- 状态: 可用（重构中）
- 简介: 左边课本原文（可折叠易混点与出处），右边题目；提交后原地展开结论、依据、出处与下一题；小芽收成右下角浮起按钮。
- 证据: education/client/study/src/controller.ts, education/client/study/src/page.ts
- 依赖: 知识地图：先看全册，再看一章里的关系

### 子项: 提示与示范
- 状态: 可用
- 简介: 卡住时可以要提示、解释或示范；用了帮助会如实记为"用了提示"。
- 证据: education/client/study/src/controller.ts

### 子项: 草稿与恢复
- 状态: 可用
- 简介: 作答草稿保存在本机；离开再回来恢复到同一题。
- 证据: education/client/study/src/machine.ts, education/packages/storage/

## 功能: 复习与短诊断
- 状态: 可用
- 简介: 按自选范围回忆作答，给出有依据的反馈；短诊断可随时结束，不锁住后续学习。
- 证据: education/client/study/src/controller.ts, education/packages/learner/

## 功能: 图片作答
- 状态: 可用
- 简介: 图片先过质量门（模糊/倾斜/空白会要求重拍），再分步识别与批改；同一张图不重复记分。
- 证据: education/client/visuals/src/image-flow.ts
- 依赖: 在真实 DSH 内核上对话，不是外观相似的聊天

## 功能: 本机学习记录：三轴 + 自评 + 导出删除
- 状态: 可用
- 简介: 学习进程、理解证据、复习活动分开记录；自评单独保存；记录可导出、可确认后删除。
- 证据: education/packages/storage/, education/packages/learner/, education/client/shell/src/pages/records.ts（重构中）

### 子项: 关掉再打开接着上次
- 状态: 可用
- 简介: 事件日志 + 快照，崩溃后可恢复；不会把"聊过"当成"学会了"。
- 证据: education/packages/storage/src/

## 功能: 内容包与出处核对
- 状态: 可用
- 简介: 七上 2 单元 / 7 章 / 22 节 / 43 概念的正文结构、活动、评分与关系；原文只在本机。
- 证据: education/content/biology-7a/, education/scripts/content-validate.mjs

### 子项: 未核实内容明确标出来
- 状态: 可用
- 简介: 候选教材与未核对字段会显示"未核实"，并且不会被当成稳定结论。
- 证据: education/content/biology-7a/source/, education/client/library/src/labels.ts

## 功能: 第一次打开就能自己配好
- 状态: 可用
- 简介: 三步引导：记录只在本机、选教材、填 Key（可跳过）；没有 Key 也能读教材看记录。
- 证据: education/client/shell/src/pages/first-run.ts, education/client/shell/src/pages/account.ts

## 功能: 装到自己电脑上就能用
- 状态: 可用
- 简介: 每用户安装版（免管理员、可卸载、保留数据）与便携版；未签名，附 SHA256。
- 证据: education/scripts/packaging/, education/dist/student/version.txt
- 依赖: 内容包与出处核对

## 功能: 界面改成学生能用的
- 状态: 可用（待人工走查）
- 简介: A 期做视觉、文案减法与状态；B 期重排主旅程（今天 / 学习 / 进展 + 设置），学习台与两级知识地图落地。
- 证据: docs/rebuild/11-ui-redesign.md（随实施创建）, docs/PROGRESS.md
