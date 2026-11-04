# @edu/client-shell

教育界面壳：框架无关的 TypeScript DOM（无 React/Vue），运行时依赖 0。

## 当前状态

- 2026-11 界面重构后：顶栏 = 品牌「芽问」+ 今天 / 学习 / 进展 + 设置；单列内容，不再有侧栏和调试状态条。
- 数据来自 `runtime/client-plugin/src/live-sources.ts`（真实 `/edu/api/g1/*`）；fixture 仍可用于离线测试，页面底部会注明“演示数据”。
- 本包不含终端、代码、插件市场或开发设置入口；权限由后端裁剪，客户端只显示后端返回的 `auth.status` 可用性，不持有 token。
- 学生文案由 `test/copy-guard.test.ts` 把关（禁词扫描）。

## 页面与挂载契约

页面形状对齐 `education/runtime/src/pages.ts` 的 `PageDefinition`：

```ts
interface EducationPage {
  id: string;
  path: string;
  title: string;
  requiresLearner: boolean;
  mount(context: EducationPageContext): void | Promise<void>;
  unmount(): void | Promise<void>;
}
```

`EducationPageContext` 提供真实 `container: HTMLElement`、`services` 与 `navigate`。
通过 `shell.registerPage(page)` 注册；`client/study`、`client/map`、`client/library` 会覆盖同路径的内置 fallback 页面。
面板通过 `shell.registerPanel('study:visuals', panel)` 挂到命名槽位：

- `library:content`、`library:import`
- `map:content`、`map:details`
- `study:activity`、`study:feedback`、`study:visuals`

公共组件（空态/错误条/保存失败/确认对话框/证据卡/状态标签）从包入口导出，其他 client 包可直接复用。

## 设计约束

- token 集中在 `src/tokens.ts`：16px 基准（1rem），正文 16–18px/1.85；颜色为暖纸底 + 白卡 + 深绿主色 + 琥珀提醒；字号/间距用 rem。
- 布局：`evaluateLayout()` 给出逻辑预算（wide / compact），断点 1100px；三档截图验收（1440×900 / 1280×800 / 1024×768），不横向溢出。
- 键盘：所有动作是原生 `<button>`；Tab 顺序与阅读顺序一致；对话框/浮层有焦点陷阱、Escape 关闭、关闭后焦点回触发处。
- 状态同时有颜色 + 文字（+ 形状）；不显示 0–100 掌握百分比或排名。
- 学生文案禁词：见 `docs/CONVENTIONS.md`；`test/copy-guard.test.ts` 自动扫描。

## 验证

```powershell
pnpm --dir education typecheck:task T08
pnpm --dir education test:task T08
```
