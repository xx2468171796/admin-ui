# 多维表格 BitableGrid（可选子路径 `@adminui/react/grid`）

> **只给像电子表格一样用的页面**：用户的主要工作是在格子里录入 / 修改 / 粘贴数据、自己分组统计。后台管理的主列表（每行要点按钮操作）用 `DataTable`，选型表见 [TABLES.md](TABLES.md) §1；记录详情三档见 [TABLES.md](TABLES.md) §3。
>
> 可选子路径，不进根入口；先装 optional peer `@tanstack/react-table@^9.2.4 @tanstack/react-virtual@^3.14.13`，页面用 `React.lazy` 按需加载。后端半边在 `@adminui/react/grid-query`（无 React）。这份手册照着做就能接，不用读源码。

## 1. 先选数据模式

| 数据量 / 场景 | 用法 | 说明 |
|---|---|---|
| 一次拿得到、几千条以内 | `rows={list}` | 搜索 / 筛选 / 排序 / 分组 / 统计全在浏览器，最快 |
| 上万条、持续增长 | `dataSource={source}` | 服务端按查询分块返回，滚到哪儿加载到哪儿（无限滚动）；给 `loadGroups` 才能分组（§7.1） |
| 嵌在卡片里、需要格内编辑的小表（几行到几十行；只读的小表用 `CompactTable`） | `rows` + `height="auto"` + `toolbar={false}` + `summary={false}` | 高度随行数，`maxHeight` 封顶 |

高度：默认 `height="fill"`，表格铺到窗口底部（扣掉页面自己的底部内边距），窗口变化、上面内容变化会重新算；整页只有表格自己滚动。小表用 `"auto"`；也可以给固定值。

## 2. 模块地图（都在本包 `src/`）

| 文件 | 职责 | 有无 React |
|---|---|---|
| `grid-core.ts` | 字段类型、视图 `GridView`、筛选 / 搜索、排序键、分组键、统计、行高几何 | 纯函数 |
| `condition-core.ts` | 条件树（条件组、全部满足 / 任一满足、「我」、相对日期、每种字段的运算符），表格筛选、填色、治理条件共用；根入口也导出 | 纯函数 |
| `grid-view-v2.ts` / `grid-group-core.ts` / `grid-color-core.ts` / `grid-fields-core.ts` / `view-diff-core.ts` | 旧视图迁移、分组层级 / 字段编组 / 填色规则的规范化；多级分组树和显示布局（前端 / 服务端同一套）；填色命中；字段面板的树；「你的个人设置」差异 | 纯函数 |
| `grid-sql-groups.ts` | 服务端分组：`buildGridGroupSql`（每级一条 GROUP BY）+ `gridGroupsFromSql` | 纯函数 |
| `grid-edit-core.ts` | 编辑规则：输入解析 `parseFieldInput`、校验、选区、剪贴板 TSV、粘贴 / 清空计划、撤销栈、按键映射 | 纯函数 |
| `grid-data-core.ts` | 服务端契约：`GridQuery`、`GridDataSource`、分块缓存；后端用的 `parseGridQuery` / `applyGridQuery` | 纯函数 |
| `grid-sql.ts` | `buildGridSql`：GridQuery → PostgreSQL / MySQL / SQLite 的 where + 参数 + orderBy | 纯函数 |
| `grid-query.ts` | 后端入口 `@adminui/react/grid-query`（`parseGridQuery` / `applyGridQuery` / `buildGridSql` / `parseFieldInput` / `validateFieldInput` / `gridQueryKey`，Node 直接 import）；`@adminui/react/grid` 不再转出这些 | 无 |
| `grid-engine.ts` | TanStack Table v9 接线（列模型、前端行管线） | 无 |
| `grid-editing.ts` | 钩子：先显示新值 → 宿主保存 → 成功保留 / 失败按格回滚；撤销 / 重做；状态提示 | 有 |
| `grid-data.ts` | 钩子：服务端分块加载、取消旧查询、刷新保持总数、失败重试 | 有 |
| `grid-view.ts` | 钩子：视图持久化（localStorage 或宿主接口） | 有 |
| `grid-cells.tsx` / `grid-editors.tsx` / `grid-toolbar.tsx` / `grid-popover.tsx` | 格子渲染、格内编辑器、工具栏、浮层 | 有 |
| `grid-fields-panel.tsx` / `grid-filter-panel.tsx` / `grid-group-panel.tsx`（分组 + 排序）/ `grid-color-panel.tsx` / `grid-condition-editor.tsx` / `grid-field-picker.tsx` / `grid-group-row.tsx` / `view-override.tsx` | 工具栏的五个视图面板（按钮）、条件树编辑器、字段选择框、多级组头、个人设置条 | 有 |
| `grid-fields-body.tsx` / `grid-filter-body.tsx` / `grid-group-body.tsx` / `grid-color-rules.tsx` | 五个面板的内容（懒加载：第一次打开、或鼠标移到 / 焦点到按钮上时才下载） | 有 |
| `grid-data-groups.ts` | 钩子：服务端组头（`loadGroups`） | 有 |
| `grid-field-types.ts` | 新字段类型规则：`coreType`（映射到基础类型）、显示文字、掩码 `maskPhone`、输入解析、只读类型 | 纯函数 |
| `grid-fill-core.ts` | 填充柄：拖到哪 `fillTarget`、数列 `fillSeries`、`planFill`、Ctrl+D `fillDownTarget` | 纯函数 |
| `grid-interact-core.ts` | 冻结线落点 `frozenCountAt`、菜单作用的记录 `menuRowIds`、排序提示 `sortHints`、行拖动落点 `rowMoveOf` | 纯函数 |
| `grid-menus.tsx` | 表头菜单 / 单元格菜单 / 分组菜单的数据（交给根入口的 `Menu`） | 有 |
| `grid-cells-extra.tsx` / `grid-editors-extra.tsx` / `grid-editors-date.tsx` / `grid-drag.ts` | 新类型的格子和评分编辑器；冻结线、填充柄、行拖动的指针拖动 | 有 |
| `grid.tsx` | `BitableGrid` 组合以上全部 | 有 |

规则（纯函数）和界面分开：改规则先改 `*-core.ts` 并补单测（`test/grid-*.test.ts`），界面只负责把规则串起来。

**首屏只带看得见的部分**（8.3）：只读打开一张表要的是表格本体、格子渲染、工具栏按钮、TanStack Table / Virtual；这些都按需下载——工具栏五个面板的内容（条件树、日期选择、可拖动列表、色板）、格内编辑器（文本 / 选项 / 日期 / 评分，可编辑的表在空闲时预取，第一次编辑基本不用等）、改冲突提示、附件灯箱和迷你播放器（音频格先显示缩略图）、手机上菜单的底部弹层。体积门禁 `npm run size` 的 `grid:read-only` 量的就是「只读渲染一张表」的首屏（含 TanStack，预算 120 KB JS / 41 KB CSS）。宿主想更快可以在空闲时自己 `import("@adminui/react/grid")`。

## 3. 最小接入（前端数据 + 编辑）

```tsx
import { BitableGrid, useGridView, type GridField, type GridCellChange } from '@adminui/react/grid';

type Machine = { id: string; name: string; env: string; tags: string[]; owner: { name: string }[]; cpu: number | null; note: string; enabled: boolean };
const fields: GridField<Machine>[] = [            // 模块级或 useMemo，保持引用稳定
  { key: 'name', title: '名称', type: 'text', primary: true, editable: true, required: true },
  { key: 'env', title: '环境', type: 'singleSelect', editable: true, options: [{ value: 'prod', label: '生产', tone: 'red' }, { value: 'test', label: '测试' }] },
  { key: 'tags', title: '标签', type: 'multiSelect', editable: true, options: TAGS },
  { key: 'owner', title: '负责人', type: 'user', editable: true },
  { key: 'cpu', title: 'CPU', type: 'number', precision: 1, summary: 'avg' },          // 不写 editable = 只读
  { key: 'enabled', title: '启用', type: 'checkbox', editable: (row) => row.env !== 'prod' }, // 按行决定能不能改
  { key: 'note', title: '备注', type: 'longText', editable: true },
];

export function Machines({ rows, reload, userId }: Props) {
  const { view, onViewChange } = useGridView(fields, { storageKey: `ops:${userId}:machines:view` });
  const save = async (changes: GridCellChange<Machine>[]) => {
    // 一批改动（编辑一格、粘贴一块、清空、撤销）一次发给服务端；服务端再校验一遍
    const res = await api.post('/api/machines/cells', changes.map(({ rowId, field, value }) => ({ id: rowId, field, value })));
    await reload();                                   // 让 rows 带上新值后再 resolve
    return { rejected: res.rejected };                // [{ rowId, field, error }]：这些格子回滚并显示原因
  };
  return <BitableGrid caption="机器" rows={rows} getRowId={(r) => r.id} fields={fields} view={view} onViewChange={onViewChange}
    onCellsChange={save} peopleOptions={{ owner: PEOPLE }} expandRecord={{ layout: machineLayout, url: true }}
    rowActions={(row) => [...]} />;
}
```

## 4. 字段 `GridField<T>`

| 属性 | 说明 |
|---|---|
| `key, title, type` | 13 种基础类型：`text / longText / number / money / date / datetime / singleSelect / multiSelect / user / checkbox / url / email / custom`；另有 12 种（见第 12.6 节）：`rating / progress / phone / autoNumber / createdBy / createdAt / modifiedBy / modifiedAt / formula / attachment / link / lookup` |
| `primary` | 主字段：冻结在最左、不能隐藏、读屏用它称呼这一行 |
| `restricted` | 受限字段（脱敏 / 只能看部分值）：字段配置和筛选字段框里带锁，不能按它筛选；给字符串就是原因（悬停显示） |
| `group` | 默认放进哪个字段编组（字段配置里的「联系方式」这种），用户可以在视图里重新编组 |
| `value(row)` / `text(row)` | 值不在 `row[key]` 时用 `value` 读；`custom` 类型要搜 / 筛 / 排 / 分组时给 `text` |
| `render(row)` / `detail(row)` | 覆盖格子 / 详情里的显示（尽量不用：类型自带的显示就是 SDK 标准样子） |
| `options` | 单选 / 多选的选项，顺序 = 排序和分组顺序；`tone` 或 `color` 定颜色 |
| `onCreateOption(label)` | 单选 / 多选：编辑器（格子、记录详情里的 `GridCellEditor variant="field"`）里搜索词去掉首尾空格后和所有选项名都不完全相同（区分大小写）时，列表最后一行「+ 新建选项「…」」；回车（它是当前行时）或点它 → 显示「正在新建」，等宿主返回 `Promise<GridSelectOption \| null>`：返回选项就选上（多选是加上），`null` = 取消，reject = 编辑器不关、用通知说原因（没有 NotificationProvider 时写在编辑器下面）。宿主负责加进字段配置并判断权限；不给就没有这一行 |
| `summary` | 默认统计（用户可改） |
| `currency / precision / timeZone` | 金额符号（值是「分」）/ 显示几位小数（数字默认最多 2 位；金额 0–2 位、默认 2 位，例：237900000 分 + `precision: 0` → `¥2,379,000`；不写 `currency` 时用 `AdminProvider defaults.currency`；格子、底部统计、输入都按它四舍五入（远离零），值仍存分，统计值本身精确）/ 日期时区（默认 Asia/Shanghai） |
| `editable` | `true` 或 `(row) => boolean`；需要表格给 `onCellsChange` |
| `write(row, value)` | 用了 `value` 读取函数的字段，编辑时必须给（告诉表格新值写在哪） |
| `parse(text, row)` / `validate(value, row)` / `required` / `placeholder` | 自定义解析、校验、必填、编辑框提示 |
| `locked` / `description` | 表头的锁（有权限限制，字符串 = 悬停说明）和 ⓘ（字段说明，读屏也念） |
| `tone(row)` | 按行给格子文字着色：`danger / warning / info / success / brand / note` |
| `deadline` | 日期 / 日期时间是截止日期：`true` 或 `{ closed: (row) => 已办完 }`。按字段时区（默认 `AdminProvider defaults.timeZone`）的日历天比今天（`deadlineState`）：逾期 → 文字 `danger` + 格内小字「逾期 N 天」（窄列截断，悬停「已逾期 N 天」）；今天、1–2 天后 → `warning`；更远 / 空 → 不着色；带时间的按当天算（今天下午到期 = 今天到期）。`closed(row)` 为真不着色。`tone(row)` 返回了颜色时以它为准。默认列宽加宽到放得下小字（日期 184、日期时间 232）。看板 / 画册卡片上的这个字段同样着色；卡片底部的 `due` 胶囊也按它（2 天内注意色、办完的不着色）；日历事件给 `deadline: true` 按它变红 / 黄 |
| `max` / `mask` / `onReveal` / `resultType` / `openRef` / `openEditor` / `openAttachment` | 新类型用：评分星数；掩码与留痕查看；公式结果类型；打开关联记录；用宿主自己的界面编辑（记录选择器、上传抽屉）；打开附件 |

值的形状：money 是分（bigint / 整数 / 整数字符串）；user 是名字、`{ name, hint?, key? }` 或它们的数组；singleSelect 是选项 value；multiSelect 是 value 数组；date / datetime 是 ISO 字符串 / 毫秒 / Date。

## 5. 编辑、选区、复制粘贴、撤销

- **进入编辑**：双击格子、Enter / F2、或直接打字（替换原值）。勾选框不进编辑：点勾、或 Enter 切换。
- **编辑器**：文本 / 数字 / 金额 / 链接 / 邮箱是格内输入框；长文本向下展开的大框（Shift + Enter 换行）；日期 / 日期时间是格内输入框 + 格子下方的日历（`grid-editors-date.tsx`，和 `DatePicker` 同一个月份方格：可直接打 2026/10/5、10/5，↓ 进日历，日期字段选中即保存，日期时间字段换天保留时间）；单选 / 多选 / 人员是带搜索的选项列表（多选 Ctrl + Enter 或「完成」）。
- **按键**：Enter 保存并下移，Shift + Enter 上移，Tab / Shift + Tab 左右，Esc 取消；输入法选词时的回车不会误提交；点别处保存。
- **校验**：先按类型解析（金额最多两位小数、给了 `precision` 的金额按它取整、日期可写 2026/9/30、2026年9月30日、Excel 序列号，单选可写选项名），再 `required` / `validate`；不通过编辑器不关、显示原因。
- **保存**：新值立刻显示（格子变淡 + 右上角小点 = 保存中）；`onCellsChange` resolve 后保留，throw 整批回滚，返回 `{ rejected }` 按格回滚，左下角提示结果并可「撤销」。宿主**在 rows 带上新值后再 resolve**（setState 或 await 重新拉取）；服务端模式会自动把新值写进缓存。
- **选区**：鼠标拖选、Shift + 点击、Shift + 方向键、Ctrl + A。
- **复制 / 剪切 / 粘贴**：Ctrl + C 复制成 TSV + HTML 表格（Excel / WPS / 飞书 / 本表都能贴）；Ctrl + V 粘贴：复制的是一个值就填满选区，是一块就从选区左上角贴（不新增行，超出的丢弃），分组标题跳过，只读格和不合法的值跳过并提示原因；Ctrl + X 剪切；Delete / Backspace 清空（必填字段不清）。
- **撤销 / 重做**：Ctrl + Z、Ctrl + Y / Ctrl + Shift + Z，工具栏也有按钮；最多 100 步；撤销本身也是一次保存（走 `onCellsChange`，`context.source` 为 `undo` / `redo`）。
- **填充**：选区右下角的小方块拖到相邻格子（上下左右），或 Ctrl + D 把选区第一行复制到下面几行；规则见第 12.4 节。
- **审计**：每批改动带 `source`（`edit / paste / clear / undo / redo / fill`）和每格的 `previous`，服务端据此写审计日志。

## 6. 键盘（整表只占一个 Tab 停靠点）

| 键 | 作用 |
|---|---|
| 方向键 / Home / End / Ctrl + Home / End / PageUp / PageDown | 移动活动格（表头、统计行也能到） |
| Enter / F2 | 可编辑格：编辑；只读格里有链接 / 标签 / 按钮：**进入格子**（Tab 在格内循环，Esc 回到格子）；都没有：打开记录详情 |
| 空格 / Ctrl + E | 打开记录详情（行号列上空格是勾选这一行；Ctrl + E 在哪都是展开） |
| Shift + F10 / 菜单键 | 打开当前格（或表头）的右键菜单 |
| Ctrl + D | 向下填充（选区第一行复制到下面） |
| Shift + Enter / Ctrl + Shift + Enter | 给了 `onRowsInsert` 时：在下面 / 上面插入记录（没给时 Shift + Enter 仍是编辑） |
| Alt + Shift + ↑ / ↓ | 给了 `onRowMove` 且没排序时：把这条记录上移 / 下移一位 |
| Shift + 空格 | 勾选这一行 |
| 表头上 Enter / Alt + ← → | 字段菜单（第 12.1 节）/ 调列宽 |
| 统计行上 Enter | 选统计方式 |
| Esc | 取消选区 / 取消编辑 / 从格内控件回到格子 |

## 7. 服务端数据（无限滚动）

前端：

```tsx
const source: GridDataSource<AuditRow> = {
  capabilities: { search: true, filter: true, sort: true, summaries: ['sum', 'max'] },   // 不支持的工具自动隐藏
  load: async ({ query, offset, limit, summaries, signal }) => {
    const res = await fetch('/api/audit/grid', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, offset, limit, summaries }) });
    if (!res.ok) throw new Error('加载失败');
    return res.json();                                // { rows, total, summaries? }
  },
};
<BitableGrid caption="审计日志" dataSource={source} getRowId={(r) => r.id} fields={fields} />
```

- 每块默认 100 行（`blockSize`），只取看得见的块和后面 20 行；未加载的行显示骨架条；一块失败只那一段显示「加载失败，回车重试」。
- 查询一变（搜索、筛选、排序）取消在途请求、清空缓存重新取；工具栏「刷新」保留总数，滚动条不跳。
- 内存里最多保留 30 块，离得远的先丢，滚回去再取。
- 统计栏：记录数用 `total`；其他统计由服务端按 `summaries` 算好返回显示文字。

后端（Node / Bun，无 React 依赖）：

```ts
import { parseGridQuery, buildGridSql, applyGridQuery } from '@adminui/react/grid-query';

const FIELDS = [                                   // 服务端自己的字段表（不信前端）
  { key: 'actor', type: 'text' }, { key: 'action', type: 'singleSelect' }, { key: 'at', type: 'datetime' }, { key: 'amount', type: 'money' },
] as const;
const COLUMNS = {                                   // 列表达式由服务端写死；用户值全部走参数
  actor: { sql: 'a.actor', type: 'text' },
  action: { sql: 'a.action', type: 'singleSelect', options: ['login', 'exec', 'logout'] },
  at: { sql: 'a.created_at', type: 'datetime' },
  amount: { sql: 'a.amount_fen', type: 'money' },
};

app.post('/api/audit/grid', async (req) => {
  const query = parseGridQuery(req.body.query, FIELDS);          // 丢掉未知字段、非法条件、超长输入
  const { where, params, orderBy } = buildGridSql(query, COLUMNS, { dialect: 'pg' });
  const offset = Math.max(0, Number(req.body.offset) || 0), limit = Math.min(500, Number(req.body.limit) || 100);
  const base = `FROM audit a WHERE a.tenant_id = $${params.length + 1}${where ? ` AND ${where}` : ''}`;   // 权限条件自己加
  const rows = await db.query(`SELECT * ${base} ORDER BY ${orderBy ? `${orderBy}, ` : ''}a.id DESC LIMIT ${limit} OFFSET ${offset}`, [...params, tenantId]);
  const total = await db.query(`SELECT count(*) ${base}`, [...params, tenantId]);
  return { rows, total: Number(total[0].count) };
});
```

- `buildGridSql` 的语义和前端一致：文本「包含」用 ILIKE / LIKE（自动转义 `% _`），空值永远排最后，金额按元筛选自动转分，日期按时区按天比较，单选按选项顺序排序；PostgreSQL 的 `text[]` 列给 `array: true` 支持多选 / 人员筛选，其他情况给列的 `filter` 自定义。
- 数据本来就在内存（或量不大）时用 `applyGridQuery(rows, fields, query, { offset, limit, summaries })`，结果与前端表格完全一致，同一查询的后续分块走缓存。
- 保存编辑的接口用 `validateFieldInput` / `parseFieldInput` 做和前端同一套解析，再做权限检查。

### 7.1 服务端分组（`loadGroups`）

数据源给 `loadGroups`，用户就能在服务端模式分组（不给就隐藏分组按钮）。表格每次查询变了先取组头，再照常分块取行：**行必须按 `query.groups` 先排**（`applyGridQuery` / `buildGridSql` 已经这样做），组头插在对应的行之间，收起的组不取它的行。

```ts
const source: GridDataSource<Deal> = {
  load: (req) => post('/api/deals/grid', req),                 // { rows, total, summaries? }
  loadGroups: ({ query, summaries, signal }) => post('/api/deals/groups', { query, summaries }, signal),   // { groups }
};
// 后端（内存）
const groups = applyGridGroups(rows, FIELDS, parseGridQuery(body.query, FIELDS), { summaries: body.summaries }, { resolve: sessionResolver });
// 后端（SQL）：每级一条语句
const query = parseGridQuery(body.query, FIELDS);
const plan = buildGridGroupSql(query, COLUMNS, { dialect: 'pg', summaries: body.summaries, resolve: sessionResolver });
const results = [];
for (const level of plan.levels)
  results.push(await db.query(`SELECT ${level.select} FROM deals d WHERE d.tenant_id = $${plan.params.length + 1}${plan.where ? ` AND ${plan.where}` : ''} GROUP BY ${level.groupBy} ORDER BY ${level.orderBy}`, [...plan.params, tenantId]));
return gridGroupsFromSql(results.map((r) => r.rows), plan, FIELDS);
```

- 组键：空值是 `""` 并且永远在最后；日期按时区的天；勾选是 `'true' / 'false'`；单选按选项顺序；PostgreSQL 的 `text[]` 人员 / 多选列（`array: true`）按整个组合分组；别的情况给列 `group`（分组键表达式）。
- 组头最多 2000 个（`gridGroupsFromSql` / `applyGridGroups` 的 `maxGroups`），超过时返回 `truncated`。

## 8. 视图（筛选 / 分组 / 排序 / 字段 / 填色）、选择、行操作、详情

### 8.1 视图保存什么

`useGridView(fields, { storageKey | load/save, defaults })` 按人保存：隐藏列、顺序、列宽、排序、筛选、分组、行高、统计、显示空分组、自动排序、字段编组、填色。键要带项目 / 用户 / 表名。

- **旧视图照样能用**：存着 `filters + conjunction` 的旧视图读进来自动变成条件树 `filter`；`groupBy: "stage"` 自动变成 `[{ field: "stage", order: "asc" }]`；一级分组的折叠键不变。`defaults` 也能继续写旧形状。
- **异步读取**：`load` 可以返回 Promise（从宿主的个人设置接口取）。返回前表格先用 `defaults`，`loading` 为 true，这期间不保存；用户在返回前已经改了，就以用户的为准。`save` 也可以是异步的。

```tsx
const { view, onViewChange, reset, loading } = useGridView(fields, {
  load: () => api.get(`/me/views/deals`).then((r) => r.view),      // 可以是同步值，也可以是 Promise
  save: (v) => api.put(`/me/views/deals`, { view: v }),
  defaults: sharedView,                                             // 共享视图（所有人看到的）
});
```

### 8.2 工具栏

工具栏**固定一行**，换一张表按钮位置也不跳：

```
[toolbarLeading] 字段 · 筛选 3 · 分组 · 排序 1 · 行高 · 填色 · 撤销 重做        [toolbarQuick 公海 15 · 我跟进中的 32 · 停滞 4] 🔍 24 条 ⋯ [actions + 新记录]
```

- 左边是视图工具；生效中的按钮 = 主色浅底 + 数量徽标（「筛选」+ 3，不再写成「筛选 3」文字）。容器窄于 1100px 时没生效的工具只留图标，再窄左右滑，**不折行**。
- `toolbarQuick`：业务预设的快捷筛选（带条数，宿主自己的 `ChipGroup`），在**右边**、搜索前面；手机上单独一行横滑。
- `toolbarSearch="icon"`：搜索收成右边一个图标，点开变输入框（有搜索词时一直开着）；默认 `"box"` 仍是左边的搜索框。
- `toolbarMore`：工具栏的「⋯」——表设置 · 权限 · 操作记录 · 公开登记链接 · 导出这些不常用的都进这里，不各占一个按钮；`actions` 只放**一个**主按钮（「+ 新记录」，从表单 / Excel 新建放它旁边的 ▾）。
- 视图标签那一行（`ViewTabs`）不再有「视图 ▾」按钮：视图管理在标签行右边的「视图」和「更多 N」最下面的「管理视图…」（VIEWS.md §1）。

### 8.2.1 五个视图面板（样稿 D04 / D05 / D17 / D17b）

五个面板一个外框：左边对齐触发按钮，宽度按内容三档（`VIEW_PANEL_WIDTHS`：筛选 / 填色 580、分组 / 排序 420、字段 320），标题行右边写一句有用的话（「符合 5 / 168 条」「最多 3 级」「靠上的先排」「从上往下，先命中的生效」「显示 13 / 15」），底栏左边「+ 添加…」、右边 `panelNote`；**手机上变底部弹层**（抓手 + 标题 + 关闭）。宿主自己的 `ToolbarPanel` 同样：`width="condition" | "list" | "field"`、`badge` 写生效数，手机自动底部弹层。

| 按钮 | 面板里有什么 |
|---|---|
| 字段 | 「显示 13 / 15」、搜索、全部显示 / 全部隐藏、拖动排序（键盘：把手上 Alt + ↑↓，或空格拿起）、主字段锁定在第一个、字段编组可折叠且有整组的眼睛、受限字段带锁；底部「新建字段」(`onCreateField`)、「新建字段编组」(`onCreateFieldGroup`，宿主问名字后 `gridViewReducer(view, { type: "addFieldGroup", id, title }, fields)`) |
| 筛选 N | 「符合以下 全部满足 / 任一满足 的条件」；每行「当 / 且 / 或 · 字段 · 条件 · 值 · 删除」；**条件组**有自己的全部满足 / 任一满足（默认嵌套 1 层）；字段框可搜索、带类型图标、受限字段带锁；值：选项多选、人员可选「我（当前用户）」「我的下属」、评分是星、日期可选具体日期 / 今天 / 本周 / 上月 / 过去 N 天 / 未来 N 天 / 自定义范围；右上角「符合 N / M 条」（没条件时「最多 50 个条件」） |
| 分组: 阶段 / 分组 3 级 | 最多 3 级、拖动调层级、每级选组的顺序（按选项顺序 / A→Z / 从早到晚…）、显示空分组（没有记录的选项也显示一组）、全部展开 / 全部收起 |
| 排序 + 数量 | 「首先 / 然后」可拖动、方向文字按类型（从大到小 9 → 0、从早到晚…）、自动排序开关（关掉后改了数据行不跳）、「分组时在组内排序」和「空值永远排在最后」的说明 |
| 填色 + 数量 | 规则 = 条件 + 选项 10 色之一（可选实心），整行或某一格；从上到下第一条符合的生效，可拖动、可暂时关掉 |

条件行和条件组是通用的 `ConditionTreeEditor`（根入口，GridConditionTree 是它套上表格字段的样子）：治理规则、表格权限「按条件」、表单显示条件、分配规则都用同一个，别的地方要「满足这些条件」也用它，不另写条件行。

面板底部的「另存为新视图」给 `onSaveAsView`（宿主新建视图），旁边的说明给 `panelNote`（例：「只改你的个人设置，自动保存」）。上限用 `limits` 改：`{ maxGroupLevels: 3, maxConditions: 50, maxFilterDepth: 1, maxColorRules: 20 }`（都是可改的默认值）。

### 8.3 「我」和相对日期

```tsx
<BitableGrid … conditionContext={{ resolve: (token) => token === 'me' ? [me.name] : token === 'mySubordinates' ? team.map((p) => p.name) : null, weekStart: 1 }} />
```

- `resolve(token)` 返回要匹配的值（人员名字或 `key`）。解析不了 = 这个条件一条都不匹配，**不会**退回显示全部。要加自己的动态值（「我的部门」），传 `dynamicTokens={[...CONDITION_DYNAMIC_TOKENS, { token: 'myDept', label: '我的部门' }]}` 并在 `resolve` 里回答。
- 相对日期按字段的时区算「今天」，`weekStart`（0 周日 … 6 周六，默认周一）决定「本周」；不内置任何地区的节假日。
- 服务端模式：查询里带的是 `{ dynamic: 'me' }` 这种记号，**后端从登录会话解析**（`applyGridQuery(…, context)` / `buildGridSql(…, { resolve })`），不要信前端传来的身份。

### 8.4 多级分组

- 组头按层缩进，显示「字段 · 值（选项标签 / 人员）· N 条」，底部统计栏选了统计的列在组头上显示本组的统计（求和、平均…）。
- 折叠记在视图的 `collapsed`（路径键，一级就是组的值）。
- 前端模式自己分；服务端模式见 §7.1。

### 8.5 个人设置条（改了标准视图的提示）

标准 / 共享视图被个人调整后，在 `banner` 槽放 `ViewOverrideBar`：注意色浅底一行「你改了「我的客户」的筛选 3 条（含 1 个条件组），**只对你生效**，别人看到的还是原样」+ 文字按钮 恢复 · 另存为我的视图 · 保存给所有人（有权限才给 `onSaveForAll`）；同时视图标签上给这个视图 `modified: true`（注意色小点）。不给 `viewName` 时是旧文案「你的个人设置：…」。文字来自纯函数 `describeViewDiff(base, mine, fields)`（搜索和折叠不算设置）。

```tsx
<BitableGrid … banner={<ViewOverrideBar viewName={active.name} base={shared} view={view} fields={fields} onReset={reset} onSaveAsNew={saveAs} onSaveForAll={canManage ? publish : undefined} />} />
```

### 8.6 选择、行操作、详情

- 选择：`selection` + `onSelectionChange`（行号列：数字悬停变勾选框，选中的行一直显示勾；Shift 连选、表头全选 / 半选「−」）。勾了记录只有**一个**反馈：表格底部居中的浮条 `BulkActionBar`「已选 2 条 · 转交 · 批量修改 · 删除 · ✕」（和 DataTable 同一个，不推动表格，超过一屏贴视口底），动作给 `bulkActions={(ids) => BulkAction[]}`；工具栏不再写「已选择 N 条」，也不要再往 `actions` / `banner` 里塞批量按钮。
- 工具栏最左的宿主内容放 `toolbarLeading`（T15 表格工作区的「添加记录 ▾」`SplitButton`），右端的放 `actions`（一个主按钮），少用的进 `toolbarMore`（§8.2）。
- 行号列 48px（`GRID_ROW_NUMBER_WIDTH`），展开按钮在主字段格子右侧（悬停出）。
- 空格子留白（不画「—」）；「—」只给只读的 DataTable、记录详情和键值列表。
- 行操作：`rowActions={(row) => RowAction[]}` 固定在最右的「⋯」菜单。
- 记录详情：`expandRecord={{ layout, level, url }}`，三档标准见 [TABLES.md](TABLES.md) §3。

## 9. 不要做

- 不要把后台管理主列表、弹框里的小表做成多维表格（用 `DataTable` / `CompactTable`）；不要在格子里自己画带样式的 span / 竖着堆内容（用字段类型；长内容进详情）。
- 不要在 `onCellsChange` 里不做服务端校验：前端校验只是体验，权限和数据正确性在服务端。
- 不要给几十万行的数据用 `rows`：用 `dataSource`。
- 不要在业务代码里直接 import `@tanstack/react-table` / `@tanstack/table-core`：只用本包的 `BitableGrid` / `useGridView`，TanStack 换版本只改本包这一层（见第 11 节）。
- 不要自己拼 SQL 字符串里的用户值：用 `buildGridSql` 的参数。
- 不要在后端用请求里带来的身份解析「我 / 我的下属」：从登录会话解析（`resolve`）；不要为了「分组好看」在服务端模式偷偷改用前端分组（10 万行时只拿到了看得见的块）。

## 10. 验收

- 单测：`npm test`（含 `condition-core / grid-core / grid-view-v2 / grid-group-core / grid-field-types / grid-fill-core / grid-interact-core / grid-edit-core / grid-data-core / record-detail-core`）。
- 浏览器：`npm run test:grid-panels`（字段配置 / 嵌套筛选逐行核对 / 三级分组含服务端 10 万条 / 排序 / 填色 / 个人设置条 / 深色 / 390，截图 `test/artifacts/grid-panels/`）、`npm run test:grid-tools`（starter「多维表格 · 客户」：表头图标与「+」列、表头 / 单元格 / 分组菜单鼠标与键盘、冻结线拖动、填充柄与 Ctrl+D、行拖动、每组新增一行、角标与着色、全部新类型、浅深色与 390 截图，截图 `test/artifacts/grid-tools/`）、`npm run test:grid`（2000 条：虚拟滚动、四档行高、冻结列、列宽 / 顺序持久化、分组、统计、键盘、手机、深色）、`npm run test:grid-edit`（编辑 / 打字编辑 / 校验 / 选项 / 勾选 / 选区复制粘贴 / 外部粘贴跳过 / 撤销重做 / 清空 / 服务端拒绝回滚 / 铺满窗口 / 服务端 10 万条无限滚动 + 搜索）、`npm run test:record-detail`。
- 示例：starter「系统 → 多维表格」，右上角切换「前端 2000 条（可编辑）/ 服务端 10 万条（无限滚动）」；「系统 → 多维表格 · 客户」照样稿 D01 摆了菜单、冻结线、填充柄、行操作和全部新类型。

## 11. TanStack 版本怎么跟

TanStack Table 是本包的 optional peer：运行时用的是**宿主自己装的那份**，本包不打包它。每次发版十几个框架的包一起出 tag，看着很频繁，跟我们有关的只有 `@tanstack/react-table` 和 `@tanstack/table-core`。

| 当前 | 版本 |
|---|---|
| peer 要求 | `@tanstack/react-table@^9.2.4`、`@tanstack/react-virtual@^3.14.13` |
| 已验证（单测 + `test:grid` + `test:grid-edit` 全过） | `@tanstack/react-table` / `table-core` **9.2.6**、`react-virtual` 3.14.13（6.6.1，2026-10-05） |

- **小版本 / 补丁（9.x）**：每月攒一次，或者要用某个修复时，在本包把 devDependencies 升到最新 → `npm run check` + `npm run test:grid` + `npm run test:grid-edit` → 发补丁版并把上表「已验证」改掉 → 宿主把自己的 TanStack 升到同一版本。
- **大版本（10.0 起）**：先读官方迁移指南，在本包开分支适配（只动 `grid-engine.ts` 等接线层，`BitableGrid` 的属性不变），浏览器验收全过再发版，并在本包 CHANGELOG 写宿主要做什么。
- 宿主的 TanStack 版本要等于上表「已验证」的版本（`pnpm why @tanstack/react-table` 查），不要领先本包去升。

## 12. 菜单、冻结线、填充柄、行操作、更多字段类型（样稿 D01 / D02 / D03 / D19）

全部可选：不给对应回调，界面就不出现那一项。菜单用根入口的 `Menu`（键盘：↑ ↓ / Home / End / 首字母、→ 打开子菜单、Esc 关闭并把焦点还回去）。

### 12.1 表头菜单（D03）

点表头、表头上回车、右键、Shift + F10 都打开。顺序固定：

| 分组 | 项 | 谁做 |
|---|---|---|
| 编辑 | 修改字段（右侧「双击表头」）· 编辑字段说明 | 宿主 `onFieldAction("edit" / "describe", field)`；双击表头 = `edit` |
| 插入 | 向左插入字段 · 向右插入字段 · 复制字段 | 宿主 `insertLeft / insertRight / duplicate` |
| 视图 | 隐藏字段 · 冻结至此列（已冻结到这列时是「取消冻结」）· 移动字段 ›（左移 / 右移 / 移到最前 / 移到最后） | 表格自己改视图 |
| 排序筛选 | 升序 / 降序（右侧「0 → 9」「A → Z」「早 → 晚」）· 按此字段筛选 · 按此字段分组（多级分组时加一级，满了替换最后一级；「取消分组」只去掉这一级） | 表格；「按此字段筛选」给了 `onFilterByField(field)` 就交给你的筛选面板，没给就往视图加一个空条件并提示去工具栏填写 |
| 管理 | 字段权限（右侧「谁能看 / 改」）+ `headerMenuItems(field)` 的项（默认放这里，例：「加入字段编组 ›」子菜单） | 宿主 `permission` |
| 危险 | 删除字段（主字段不能删，显示原因） | 宿主 `delete`，自己弹 `ConfirmDialog` |

`fieldActions` 决定出现哪几个宿主项（数组，或按字段返回的函数；默认七个全有）。`headerMenuItems(field)` 返回 `MenuItem & { slot }`，`slot` 取 `edit / insert / view / sort / manage / danger`。

表头上：`locked` 显示锁（注意色），`description` 显示 ⓘ，都紧跟在字段名后面；▾ 只在悬停 / 聚焦 / 菜单打开时出现。给了 `onAddField` 末尾多一列「+」（添加字段）。

### 12.2 单元格 / 选区 / 分组菜单（D02）

右键或 Shift + F10。右键在选区里不会改选区。作用的记录：点在勾选的行上 = 所有勾选的行；点在选区里 = 选区里的行；否则这一行。

| 分组 | 项 |
|---|---|
| 剪贴板 | 复制（Ctrl+C）· 粘贴（Ctrl+V，要能编辑；浏览器不让读剪贴板时提示用 Ctrl+V） |
| 记录 | 向上 / 向下插入记录（`onRowsInsert(position, anchorRowId)`）· 复制 N 条记录（`onRowsDuplicate(ids)`） |
| 打开 | 展开记录（Ctrl+E）+ `cellMenuItems(ctx)`：分享记录 / 复制记录链接 / 查看修改历史 / 添加子记录 / 添加评论，宿主给 |
| 危险 | 删除所选 N 条记录（`onRowsDelete(ids)`，宿主先用 `ConfirmDialog` 确认） |

`ctx` = `{ row, rowId, field, rowIds, cells }`。分组标题右键：收起 / 展开本组、全部收起、全部展开、在本组新增记录（要 `onAddRow`）。

### 12.3 冻结线

冻结的列数存在视图里（`GridView.frozen`，随 `useGridView` 保存）；`frozenColumns` 只是没设置时的默认。冻结线是最后一个冻结列右边的 2px 主色线；表头悬停时线上出现手柄，拖到哪条列边界就冻结到哪（拖到最左 = 只冻结行号列），拖动时整列高显示预览线。键盘：表头菜单「冻结至此列」/「取消冻结」。手机上冻结块仍不超过 60% 宽。

### 12.4 填充柄与选区外框

多格选区有 2px 主色外框；能编辑时，表格有焦点就在选区右下角显示填充柄。拖动预览是虚线框，松开后：

- 一个源格子：复制；两个以上：数字 / 金额 / 评分 / 进度 / 日期 / 日期时间步长一致就续写数列（1, 3 → 5, 7；10-01, 10-08 → 10-15），往上 / 往左倒推；其他按顺序循环复制；评分夹在 0–max、进度 0–100。
- 左右填充按格子文字过目标字段的解析，放不下的跳过。
- 只读格、`validate` / `required` 不过的跳过，左下角提示原因；分组标题行不占位。
- 走 `onCellsChange`，`source: "fill"`，可以撤销。Ctrl + D 是「向下填充」。

纯函数 `fillTarget` / `fillSeries` / `planFill` / `fillDownTarget` 可单独用。

### 12.5 行操作

- 悬停行：行号列显示拖动手柄（给了 `onRowMove` 且没排序、前端数据）+ 勾选框；主字段右端显示展开图标（Ctrl+E）。
- `onRowMove({ rowId, afterId, beforeId, group })`：拖手柄或 Alt + Shift + ↑ / ↓；拖到别的组时 `group` 是目标组每一级的分组值（`{ stage: "quote", owner: "小王", region: "tp" }`），宿主据此改这些字段、存顺序；只在同一个最底层组里排序。
- `onAddRow(group)`：每个展开的最底层组底部一行「+ 新增一行 自动带上 首通 · 小王 · 杭州」（参数是这一组每一级的分组值），不分组时在最底下（`{}`）；分组标题右键「在本组新增记录」给的是到那一级为止的分组值；空表时空状态上也有「新增一行」按钮。
- `cellBadge(row, field)` → `{ label, tone? }`：格子右上角小三角（默认注意色），`label` 给读屏和悬停。
- `GridField.tone(row)`：格子文字着色；截止日期（「下次跟进」）用 `GridField.deadline`，不用自己写 `tone`。

### 12.6 更多字段类型

| 类型 | 值 | 显示 / 编辑 | 规则（筛选 / 排序 / 统计 / SQL）按 |
|---|---|---|---|
| `rating` | 0–`max`（默认 5）整数 | 注意色星星（`Rating`）；点第 N 颗直接打 N 分（再点清空），回车进入星级滑块（← → / 数字，回车保存）；粘贴「4」「★★★」「4星」 | 数字 |
| `progress` | 0–100 | 进度条 + 「62%」；输入「62」或「62%」 | 数字（统计带 %） |
| `phone` | 文字 | `mask: true`（或函数）显示 138****5600；`onReveal(row)` 加眼睛按钮，宿主取完整号码并留痕；复制、搜索用掩码后的文字 | 文字 |
| `autoNumber` | 数字 | 原样显示，只读 | 数字 |
| `createdBy` / `modifiedBy` | 同 `user` | 人员胶囊，只读 | 人员 |
| `createdAt` / `modifiedAt` | 同 `datetime` | 日期时间，只读 | 日期时间 |
| `formula` | 宿主算好的值 | 按 `resultType`（text / number / money / date / datetime / checkbox）显示，只读 | `resultType` |
| `attachment` | `MediaItem[]`（同附件集） | 缩略图 / 文件块，点开 `MediaLightbox`（或 `openAttachment(row, i)`）；第一个是音频时显示 `AudioPlayer variant="mini"` + 「+N」；上传用 `openEditor` 打开宿主的抽屉，清空写 `[]`，不能粘贴文字 | 文件名文字 |
| `link` | `{ id, title }[]` | 主色浅胶囊，给了 `openRef` 可点开；选择记录用 `openEditor`（回车 / 双击调用） | 标题文字 |
| `lookup` | 文字 / 数字 / `{ title }` 数组 | 中性胶囊，只读 | 文字 |

**掩码只是显示**：真正的脱敏在服务端（只把 138****5600 发给前端，`onReveal` 再按权限取完整号码并写审计）；前端 `mask: true` 加原始号码只适合本来就能看的人。

写类型相关的规则时用 `coreType(field)`（新类型 → 基础类型，公式 → `resultType`）和 `gridFilterOps(field)`（每个字段的条件），不要直接 `switch (field.type)`。服务端：`@adminui/react/grid-query` 的 `parseGridQuery` / `applyGridQuery` / `buildGridSql` 都认这些类型（`GridSqlColumn` 可写 `resultType`；附件不参与搜索；`array: true` 的 `text[]` 列照常筛空）；`maskPhone` 也可以在服务端用。
