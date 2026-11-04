# @edu/client-library（我的课本 / `/library`）

`/library` 这一页只回答一件事：**现在用的是哪本、哪一版、内容从哪来、能不能用。**

## 页面结构（自上而下）

1. **一张课本卡**（`library-book-card`）：CSS 封面 + 书名 + 出版社/年级 + 整页唯一的核实 chip
   （`library-verified-chip`：`已核对` / `待核实` / `打不开`）+ 一句学生话（`全册 N 页，已经标出 M 处原文`）
   + 主按钮 `用这本开始`（`library-start`，进入 `/map`）+ 次按钮 `换一本` / `导入新的`（`library-import`）。
2. **换一本**（`library-book-chooser`）：默认 `hidden`；展开后整行是一个 `button`，状态只用文字
   （`核对过的课本` / `先当参考` / `打不开`），不出现第二个 chip。
3. **课本原文从哪来**（`library-sources`）：默认折叠，标题写“N 条来源”；展开后先解释
   “PDF 第几页和课本第几页不是同一个数字”，再列 `PDF 第 X 页 · 课本第 Y 页` 的简洁列表，点开可对照原句。
4. **导入新的课本**（`library-import-panel`）：选择本地 PDF → 确认元数据 → 真实阶段/页数 → 取消/恢复/重试/刷新；
   失败、离线、等确认、完成各自有可读文案和下一步。
5. 一行淡色 fixture 说明（`library-fixture-notice`）。

## 约束

- 无 React/Vue；纯 TypeScript DOM，只复用 `@edu/client-shell` 导出的 token / `h` / 按钮 / 状态 chip / 确认框 /
  错误条 / 页面标题；不 import `@edu/importer`、`@edu/knowledge` 的私有实现，只消费注入的 `LibraryDataSource`
  （T03 `ImportPort`/`ImportJob` 形状 + T04 `resolveSource` 形状的视图）。
- 文案里不出现工程/审校术语（`机器匹配`、`覆盖完整`、`不可作为基准`、`文件指纹`、`内容包版本`、`受控`、
  `解析器`、`审校` 等）；`待核实` 只由那一个 chip 承载。
- 窄屏 < 1100px 单列；可点元素都是原生 `button`/`input`；状态同时有文字和颜色（不只靠颜色）。
- 页面数据来自 **fixture**（`src/fixture-data.ts`），真实接线归 T13。

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

课程内容版本/候选状态由服务返回，UI 不自行判定基准。

## 验证

```powershell
cd education/client/library
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
```
