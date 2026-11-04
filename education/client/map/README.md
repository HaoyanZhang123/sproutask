# @edu/client-map（两级知识地图）

框架无关的 DOM 知识地图，挂在 T08 `@edu/client-shell` 的 `/map` 页与 `map:content` / `map:details` 两个槽位上。

```ts
const map = createMapUi({ dataSource: createFixtureMapDataSource({ scenario: 'demo' }) });
map.register(shell); // 替换 shell 的 /map fallback
```

## 两级结构

1. **全册总览**：按「单元 → 章」分组；每章一行，显示章名、节数、概念数与「已学 N / M」进度，并列出概念胶囊。胶囊状态是四态 **在学 / 要再练 / 比较稳 / 还没开始**，用颜色 + 文字 + 形状三重编码。点章名或「还有 N 个」进入第二级。顶部有搜索框（按概念标题过滤，输入时保持焦点）、图例和「回到我正在学的」。
2. **章级关系图**：`layout.ts` 按先修关系做最长路径分层；先学 → 接着学 → 再学 → 连起来（超过四层并入「连起来」，全部按目录顺序）。节点固定 12.5rem × 5.5rem，同层对齐，坐标由布局算法给出，因此不会重叠；连线用 SVG 贝塞尔曲线，先修带箭头，相关为虚线。选中节点会点亮它的先修/后继连线并高亮相关节点；下方详情卡显示概念名、一句话说明、状态、课本页码（`未核实` 时标注）、可点的先修/后继关系，以及 `开始学习` / `先复习`（要再练时先复习为主按钮）。
3. **列表等价视图**：「关系图 / 列表」切换；列表用同一份数据渲染成按层级嵌套的列表，每个概念下面列出先修/后继，全部是原生按钮，Tab 可以走完。窄屏（<1100px）时关系图改为纵向分层列表，不横向溢出。

## 结构

| 文件 | 作用 |
|---|---|
| `src/types.ts` | `MapDataSource` 读模型接缝、`GraphSlice`、概念详情/搜索形状（公共接缝未改） |
| `src/fixture.ts` | 明确标注“演示数据（fixture）”的合成数据源（demo / candidate / scale 三种场景） |
| `src/model.ts` | 目录索引、四态推导、全册总览（单元/章/计数/搜索过滤）、章级模型、先修/后继、出处页 |
| `src/layout.ts` | 章级分层布局：最长路径分层、同层按目录排序、固定节点尺寸、无重叠、环降级、SVG 曲线路径 |
| `src/views.ts` | 纯渲染函数：总览、图例、章头、关系图（横向/窄屏纵向）、嵌套列表、详情卡、加载/空/失败态 |
| `src/controller.ts` | 两级状态（总览 ⇄ 章）、视图切换、搜索、焦点管理、窄屏断点、只读数据加载 |
| `src/page.ts` | `/map` 页与两个槽位容器 |
| `src/styles.ts` | 仅使用 `@edu/client-shell` token（`var(--edu-*)`）的样式；无字面颜色/px 字号；focus-visible；<1100px 单列 |

## 数据接缝

`MapDataSource` 仍是唯一接缝，形状未改（五个只读方法）。本版 UI 只调用 `loadMap`（全册目录 + 全部概念 + 关系 + 学习者投影）和 `loadConceptDetail`；`loadChapterGraph` / `expandConcept` / `searchConcepts` 保留给 T13 的真实 facade，UI 侧不新增网络接口。

- `loadMap` ← `KnowledgeService.getToc` + 包内全部概念 + 学习者投影 `LearnerProjectionStore.list` + 自评/证据；`fixture: false`、`notice: null`。
- `loadConceptDetail` ← `getConcept` + `resolveSourceRef`（只有页码/印刷页/材料可用性，无 OS 路径）+ 证据/自评只读列表。
- 搜索、分层、计数全部在本地由 `loadMap` 的只读数据推导，不写学习状态。

`fixture: true` 时页面显示“演示数据（fixture）”徽标；接真实数据源后必须为 `false` 且 `notice` 置空。

## 边界

- 不实现存储、不写 journal、不改变学习进程；`开始学习` / `先复习` 只做路由跳转：`/workspace?mode=learn|review&concept=<id>`（T12 负责活动）。
- 四态只由已有学习记录推导：理解需巩固 / 最近复习仍需巩固 → 要再练；学习完成 + 表现稳定 + 证据当前有效 → 比较稳；其余“动过”的 → 在学；从未动过 → 还没开始。候选内容不显示强结论。
- 无掌握百分比；只给「已学 N / M（去重概念）」。
- 总览每章最多先画 6 个胶囊，其余藏在「还有 N 个」后，避免一次铺满全册。

## 测试

```powershell
cd education/client/map
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
```

覆盖：布局属性（层级单调、同层目录序、无重叠、每节点坐标、环降级、确定性）、两级交互（总览→章→返回、搜索过滤、回到正在学的）、章级图（边型/箭头/高亮/详情卡/跨章跳转）、列表等价与 Tab 可达、四态与候选/未核实、加载/失败/空态、窄屏纵向布局、token 与禁词扫描、500 概念规模 DOM 预算与时序。
