# @edu/client-study

T12 学习/复习工作区：材料阅读、活动状态机、草稿恢复、教学助手、复习范围、反馈与三轴结果。

## 现状

- 无 React/Vue；纯 TypeScript DOM，复用 `@edu/client-shell` 的 token/组件/布局、`@edu/client-visuals` 的作答表单/反馈/图片流、`@edu/client-map` 的三轴文案与 `summarizeConceptState`。
- 页面数据与教学回合来自 **fixture**（`src/fixture.ts`），醒目标注“演示数据（fixture）”。真实 DSH/模型接线归 T13；产物重启归 T16。
- 通过 `shell.registerPage(page)` 接管 `/workspace`，通过 `registerPanel('study:activity'|'study:feedback')` 挂载活动与反馈；`study:visuals` 留给 T11/图示组件。
- 不 import `@edu/tutor`/`@edu/learner`/`@edu/importer` 的实现文件；只消费注入的 `StudyDataSource`（结构上是 T07 `TutorService` 的子集 + T06 三轴/草稿读取）。

## 用法

```ts
const study = createStudyUi({ dataSource, createRequest, returnPath: '/workspace?mode=learn&concept=concept.cell' });
study.register(shell);
```

T13 实现 `StudyDataSource`：`startSession/submitTurn/skip/end/finishLearning/finishReview/retryPendingGrading` 委托给 `TutorService`；`loadWorkspace/loadProgress/loadReviewRange/deferReview/saveSelfReport` 由 `KnowledgeService` + `LearnerService` 适配；`loadDraft/saveDraft/clearDraft` 接本机持久化；`submitImageAnswer` 接 T11 图片批改。

## 验证

```powershell
pnpm --config.verify-deps-before-run=false --dir education typecheck:task T12
pnpm --config.verify-deps-before-run=false --dir education test:task T12
```
