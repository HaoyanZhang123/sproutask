# @edu/client-library

T09 教材库界面：三态教材、导入进度/取消/恢复/重试、候选试用与来源阅读。

## 当前状态

- 无 React/Vue；纯 TypeScript DOM，复用 `@edu/client-shell` 的 token、按钮、状态标签、确认对话框、错误条与布局样式。
- 页面数据来自 **fixture**（`src/fixture-data.ts`）；界面醒目标注“演示数据（fixture）”，不冒充真实教材/真实 API。真实接线归 T13。
- 通过 `shell.registerPage(page)` 接管 `/library`，通过 `shell.registerPanel('library:content'|'library:import', panel)` 挂载两个子区域。
- 不 import `@edu/importer`/`@edu/knowledge` 的私有实现：只消费注入的 `LibraryDataSource`（T03 `ImportPort`/`ImportJob` 形状 + T04 `resolveSource` 形状的视图）。

## 用法

```ts
const library = createLibraryUi({ dataSource, createRequest });
library.register(shell);
```

`LibraryDataSource` 需要实现：

- `listBooks` / `listSources` / `openSource`
- `chooseFile` / `startImport`
- `jobStatus` / `cancelImport` / `resumeImport` / `retryImport`
- 可选 `watchImport(jobId, listener)`（T13 接 `import.progress`）

T13 用真实 `ImportPort` 与 `ContentQuery.resolveSource` 适配本接口；课程内容版本/候选状态由服务返回，UI 不自行判定基准。

## 验证

```powershell
pnpm --config.verify-deps-before-run=false --dir education typecheck:task T09
pnpm --config.verify-deps-before-run=false --dir education test:task T09
```
