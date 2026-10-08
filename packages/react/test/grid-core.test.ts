import test from "node:test";
import assert from "node:assert/strict";
import { constructTable, tableFeatures } from "@tanstack/react-table";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import {
  activeFilterCount,
  filterGridRows,
  fitFrozenWidths,
  gridGroupKey,
  gridGroupLabel,
  gridRowHeight,
  gridRowLines,
  gridViewReducer,
  majorToMinor,
  matchesFilter,
  moveGridCell,
  normalizeGridView,
  parseGridView,
  serializeGridView,
  summarizeField,
  valueText,
  type GridField,
  type GridView,
  type GridViewInput,
} from "../src/grid-core.ts";
import { GRID_FEATURE_MAP, GRID_GROUP_COLUMN, GRID_ROW_COLUMN, GRID_TABLE_OPTIONS, gridColumnDefs, gridTableState } from "../src/grid-engine.ts";
import { groupedRowOrder, groupLayout, groupTreeFromRows } from "../src/grid-group-core.ts";

type Deal = { id: string; name: string; stage: string; tags: string[]; owner: string[]; amount: number | null; units: number | null; closed: string | null; won: boolean; note?: string };
const STAGES = [
  { value: "lead", label: "线索" },
  { value: "deal", label: "商机" },
  { value: "won", label: "赢单" },
];
const fields: GridField<Deal>[] = [
  { key: "name", title: "名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES },
  { key: "tags", title: "标签", type: "multiSelect", options: [{ value: "vip", label: "大客户" }, { value: "new", label: "新客" }] },
  { key: "owner", title: "负责人", type: "user" },
  { key: "amount", title: "金额", type: "money", currency: "¥", summary: "sum" },
  { key: "units", title: "数量", type: "number" },
  { key: "closed", title: "成交日", type: "date", timeZone: "Asia/Shanghai" },
  { key: "won", title: "已签", type: "checkbox" },
  { key: "note", title: "备注", type: "longText" },
];
const rows: Deal[] = [
  { id: "1", name: "远山制造", stage: "won", tags: ["vip"], owner: ["陈晓"], amount: 1_000_050, units: 3, closed: "2026-09-01T02:00:00Z", won: true, note: "续约" },
  { id: "2", name: "北辰物流", stage: "lead", tags: [], owner: ["林宁", "周敏"], amount: null, units: 10, closed: null, won: false },
  { id: "3", name: "Alpha 科技", stage: "deal", tags: ["new", "vip"], owner: ["陈晓"], amount: 25_00, units: null, closed: "2026-08-31T20:00:00Z", won: false, note: "" },
  { id: "4", name: "远山二期", stage: "won", tags: ["new"], owner: [], amount: 99, units: 4.5, closed: "2026-09-02T00:00:00Z", won: true },
];
const field = (key: string) => fields.find((f) => f.key === key)!;
const base = normalizeGridView({}, fields);

test("summaries: count / filled / empty / unique / exact money sum and avg / number / date min-max", () => {
  assert.equal(summarizeField(field("name"), rows, "count").text, "4");
  assert.equal(summarizeField(field("amount"), rows, "filled").value, 3);
  assert.equal(summarizeField(field("amount"), rows, "empty").value, 1);
  assert.equal(summarizeField(field("note"), rows, "filled").value, 1, "空串算未填写");
  assert.equal(summarizeField(field("owner"), rows, "unique").value, 2, "人员按组合去重：陈晓 / 林宁+周敏");
  assert.equal(summarizeField(field("name"), rows, "unique").value, 4);
  const sum = summarizeField(field("amount"), rows, "sum");
  assert.equal(sum.value, 1_002_649n);
  assert.equal(sum.text, "¥10,026.49");
  assert.equal(summarizeField(field("amount"), rows, "avg").value, 334_216n, "1002649 / 3 = 334216.33 → 四舍五入");
  assert.equal(summarizeField(field("amount"), rows, "min").text, "¥0.99");
  assert.equal(summarizeField(field("amount"), rows, "max").text, "¥10,000.50");
  assert.equal(summarizeField(field("units"), rows, "sum").value, 17.5);
  assert.equal(summarizeField(field("units"), rows, "avg").text, "5.83");
  assert.equal(summarizeField(field("closed"), rows, "min").text, "2026-09-01", "按上海时区：08-31 20:00Z = 09-01 04:00");
  assert.equal(summarizeField(field("closed"), rows, "max").text, "2026-09-02");
  assert.equal(summarizeField(field("won"), rows, "filled").label, "已勾选");
  assert.equal(summarizeField(field("won"), rows, "filled").value, 2);
  assert.equal(summarizeField(field("amount"), [], "sum").text, "—", "没有值不是 0");
  assert.equal(summarizeField(field("amount"), rows, "none").text, "");
});

test("filters per type, incomplete conditions ignored, and/or conjunction, multi-term search", () => {
  // Legacy flat filters (filters + conjunction) still filter: old saved views keep working.
  const ids = (view: GridViewInput) => filterGridRows(rows, fields, { search: view.search ?? "", hidden: view.hidden ?? [], filters: view.filters, conjunction: view.conjunction }).map((r) => r.id);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "name", op: "contains", value: "远山" }] }), ["1", "4"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "name", op: "contains", value: " " }] }), ["1", "2", "3", "4"], "空值条件不生效");
  assert.deepEqual(ids({ filters: [{ id: "a", field: "amount", op: "gte", value: "25" }] }), ["1", "3"], "金额按元输入，比较分");
  assert.deepEqual(ids({ filters: [{ id: "a", field: "amount", op: "empty" }] }), ["2"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "units", op: "lt", value: 4 }] }), ["1"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "stage", op: "anyOf", value: ["won", "deal"] }] }), ["1", "3", "4"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "stage", op: "noneOf", value: ["won"] }] }), ["2", "3"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "tags", op: "hasAll", value: ["vip", "new"] }] }), ["3"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "tags", op: "hasNone", value: ["vip"] }] }), ["2", "4"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "owner", op: "hasAny", value: ["周敏"] }] }), ["2"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "closed", op: "is", value: "2026-09-01" }] }), ["1", "3"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "closed", op: "after", value: "2026-09-01" }] }), ["4"]);
  assert.deepEqual(ids({ filters: [{ id: "a", field: "won", op: "checked" }] }), ["1", "4"]);
  const both = [{ id: "a", field: "stage", op: "anyOf" as const, value: ["lead"] }, { id: "b", field: "won", op: "checked" as const }];
  assert.deepEqual(ids({ filters: both, conjunction: "and" }), []);
  assert.deepEqual(ids({ filters: both, conjunction: "or" }), ["1", "2", "4"]);
  assert.deepEqual(ids({ search: "远山 续约" }), ["1"], "每个词都要出现");
  assert.deepEqual(ids({ search: "alpha" }), ["3"], "不分大小写");
  assert.deepEqual(ids({ search: "大客户" }), ["1", "3"], "选项按显示文字搜");
  assert.deepEqual(ids({ search: "续约", hidden: ["note"] }), [], "只搜显示的字段");
  assert.equal(matchesFilter(field("units"), rows[2]!, { id: "x", field: "units", op: "neq", value: 1 }), true, "空值 ≠ 任何数");
  assert.equal(activeFilterCount({ filters: [{ id: "a", field: "name", op: "contains" }, { id: "b", field: "won", op: "checked" }] }, fields), 1);
  assert.equal(majorToMinor("-12.345"), -1234n);
  assert.equal(majorToMinor("1e3"), null);
});

test("view normalization, reducers and serialization round-trip", () => {
  const view = normalizeGridView({ order: ["stage", "gone", "name"], hidden: ["name", "units", "gone"], widths: { amount: 5, stage: 9999, gone: 10 }, sort: [{ key: "amount", direction: "desc" }, { key: "amount", direction: "asc" }, { key: "x", direction: "asc" }], groupBy: "gone", rowHeight: "giant", summary: { units: "avg", name: "sum", amount: "none" } }, fields, { rowHeight: "medium" });
  assert.deepEqual(view.order, ["name", "stage", "tags", "owner", "amount", "units", "closed", "won", "note"], "主字段在最前，新字段补在后，未知字段丢弃");
  assert.deepEqual(view.hidden, ["units"], "主字段不能隐藏");
  assert.deepEqual(view.widths, { amount: 60, stage: 800 });
  assert.deepEqual(view.sort, [{ key: "amount", direction: "desc" }]);
  assert.deepEqual(view.groupBy, [], "分组字段不存在 → 不分组");
  assert.equal(view.rowHeight, "medium");
  assert.deepEqual(view.summary, { units: "avg" }, "字段默认统计可被用户关掉，非法统计丢弃");
  let next = gridViewReducer(view, { type: "move", key: "won", to: 0 }, fields);
  assert.deepEqual(next.order.slice(0, 2), ["name", "won"], "不能挪到主字段前面");
  next = gridViewReducer(next, { type: "resize", key: "note", width: 333.4 }, fields);
  assert.equal(next.widths.note, 333);
  next = gridViewReducer(next, { type: "sortBy", key: "closed", direction: "asc" }, fields);
  assert.deepEqual(next.sort.map((s) => s.key), ["closed", "amount"]);
  next = gridViewReducer(next, { type: "addFilter", field: "stage" }, fields);
  assert.deepEqual(next.filter.items, [{ id: "f1", field: "stage", op: "anyOf" }]);
  next = gridViewReducer(next, { type: "updateFilter", id: "f1", patch: { value: ["won"] } }, fields);
  next = gridViewReducer(next, { type: "updateFilter", id: "f1", patch: { op: "empty" } }, fields);
  assert.deepEqual(next.filter.items[0], { id: "f1", field: "stage", op: "empty" }, "无值条件去掉旧值");
  next = gridViewReducer(next, { type: "updateFilter", id: "f1", patch: { field: "amount" } }, fields);
  assert.deepEqual(next.filter.items[0], { id: "f1", field: "amount", op: "eq" }, "换字段重置条件");
  next = gridViewReducer(next, { type: "groupBy", key: "stage" }, fields);
  next = gridViewReducer(next, { type: "toggleGroup", key: "won" }, fields);
  assert.deepEqual(next.collapsed, ["won"]);
  assert.deepEqual(gridViewReducer(next, { type: "groupBy", key: "owner" }, fields).collapsed, [], "换分组清空折叠");
  next = gridViewReducer(next, { type: "rowHeight", value: "extraTall" }, fields);
  const restored = parseGridView(serializeGridView(next), fields);
  assert.deepEqual(restored, next, "序列化后原样恢复");
  assert.equal(parseGridView("{bad", fields), null);
  assert.equal(parseGridView(JSON.stringify({ v: 99, view: next }), fields), null, "版本不对用默认");
  // Stored with an older field list: a removed field disappears, a new one is appended.
  const fewer = fields.filter((f) => f.key !== "note");
  assert.ok(!parseGridView(serializeGridView(next), fewer)!.order.includes("note"));
});

test("group keys and labels, row geometry, frozen widths on phones, keyboard moves", () => {
  assert.equal(gridGroupKey(field("closed"), rows[2]!), "2026-09-01");
  assert.equal(gridGroupLabel(field("stage"), "won"), "赢单");
  assert.equal(gridGroupLabel(field("amount"), ""), "（空）");
  assert.equal(gridGroupLabel(field("won"), "false"), "未勾选");
  assert.equal(valueText(field("owner"), ["林宁", { name: "周敏" }]), "林宁、周敏");
  for (const [preset, height, lines] of [["short", 32, 1], ["medium", 56, 2], ["tall", 88, 3], ["extraTall", 120, 5]] as const) {
    assert.equal(gridRowHeight(preset), height, preset);
    assert.equal(gridRowLines(preset), lines, preset);
  }
  assert.equal(gridRowHeight("short", { touch: true }), 44, "手机行高至少 44");
  assert.equal(gridRowHeight("medium", { fontScale: 1.3 }), 61, "特大号字：两行 22.1px + 留白 8×2，整表仍一样高");
  assert.deepEqual(fitFrozenWidths([200], 76, 1440), [200]);
  const narrow = fitFrozenWidths([200], 76, 390);
  assert.ok(narrow[0]! + 76 <= 390 * 0.6 + 1, JSON.stringify(narrow));
  const bounds = { rows: 10, cols: 5, page: 4 };
  assert.deepEqual(moveGridCell({ row: 0, col: 0 }, "ArrowUp", bounds), { row: -1, col: 0 }, "可以上到表头");
  assert.deepEqual(moveGridCell({ row: 9, col: 4 }, "ArrowDown", bounds), { row: 9, col: 4 });
  assert.deepEqual(moveGridCell({ row: 3, col: 2 }, "End", bounds, { ctrl: true }), { row: 9, col: 4 });
  assert.deepEqual(moveGridCell({ row: 3, col: 2 }, "PageDown", bounds), { row: 7, col: 2 });
  assert.equal(moveGridCell({ row: 3, col: 2 }, "Enter", bounds), null);
});

test("TanStack sorts, BitableGrid groups (option order, empty last, sort inside groups, collapse), column model", () => {
  const features = tableFeatures({ ...GRID_FEATURE_MAP, coreReactivityFeature: storeReactivityBindings() });
  const make = (view: GridView, frozen = 1) =>
    constructTable({ ...GRID_TABLE_OPTIONS, features, data: rows, getRowId: (row: Deal) => row.id, columns: gridColumnDefs(fields, null, true), state: gridTableState(view, { frozenColumns: frozen, actions: true }) } as never) as unknown as {
      getRowModel: () => { rows: { id: string; original: Deal; getIsGrouped: () => boolean; subRows: unknown[] }[] };
      getStartVisibleLeafColumns: () => { id: string; getStart: (p: string) => number; getSize: () => number }[];
      getCenterVisibleLeafColumns: () => { id: string }[];
      getEndVisibleLeafColumns: () => { id: string }[];
    };
  // Sort by amount desc: empties last in both directions.
  const sorted = make(gridViewReducer(base, { type: "sortBy", key: "amount", direction: "desc" }, fields));
  assert.deepEqual(sorted.getRowModel().rows.map((r) => r.id), ["1", "3", "4", "2"]);
  const asc = make(gridViewReducer(base, { type: "sortBy", key: "amount", direction: "asc" }, fields));
  assert.deepEqual(asc.getRowModel().rows.map((r) => r.id), ["4", "3", "1", "2"], "空值升序也在最后");
  // Group by stage (option order 线索 / 商机 / 赢单), sort by units inside each group: TanStack sorts flat, the group core groups.
  let view = gridViewReducer(base, { type: "groupBy", key: "stage" }, fields);
  view = gridViewReducer(view, { type: "sortBy", key: "units", direction: "desc" }, fields);
  const table = make(view);
  assert.ok(!table.getRowModel().rows.some((r) => r.getIsGrouped()), "TanStack 不再分组");
  const tree = groupTreeFromRows(table.getRowModel().rows.map((r) => r.original), view.groupBy, fields);
  assert.deepEqual(tree.map((g) => [g.key, g.count]), [["lead", 1], ["deal", 1], ["won", 2]]);
  assert.deepEqual(groupedRowOrder(tree).map((r) => r.id), ["2", "3", "4", "1"], "组内按数量降序");
  view = gridViewReducer(view, { type: "toggleGroup", key: "won" }, fields);
  const layout = groupLayout(tree, view.collapsed);
  assert.equal(layout.count, 5, "收起的组只剩标题：3 个组头 + 2 行");
  assert.deepEqual(Array.from({ length: layout.count }, (_, i) => { const at = layout.at(i)!; return at.kind === "group" ? `g:${at.group.key}` : at.kind === "row" ? at.offset : "add"; }), ["g:lead", 0, "g:deal", 1, "g:won"]);
  // Group by amount puts the empty group last.
  const byAmount = groupTreeFromRows(rows, [{ field: "amount", order: "asc" }], fields).map((g) => g.key);
  assert.equal(byAmount.at(-1), "");
  // Columns: row number (48px) + 2 frozen fields at the start, hidden ones gone, actions at the end, widths from the view.
  const columns = make(gridViewReducer(gridViewReducer(base, { type: "toggleHidden", key: "tags" }, fields), { type: "resize", key: "name", width: 250 }, fields), 2);
  const start = columns.getStartVisibleLeafColumns();
  assert.deepEqual(start.map((c) => c.id), [GRID_ROW_COLUMN, "name", "stage"]);
  assert.deepEqual(start.map((c) => c.getStart("start")), [0, 48, 298]);
  assert.ok(!columns.getCenterVisibleLeafColumns().some((c) => c.id === "tags" || c.id === GRID_GROUP_COLUMN));
  assert.deepEqual(columns.getEndVisibleLeafColumns().map((c) => c.id), ["__actions"]);
});

test("column moves: drag before a field, shift among visible fields, primary stays first", () => {
  let view = gridViewReducer(base, { type: "toggleHidden", key: "tags" }, fields);
  view = gridViewReducer(view, { type: "moveBefore", key: "won", before: "stage" }, fields);
  assert.deepEqual(view.order.slice(0, 4), ["name", "won", "stage", "tags"]);
  view = gridViewReducer(view, { type: "moveBefore", key: "stage", before: null }, fields);
  assert.equal(view.order.at(-1), "stage");
  view = gridViewReducer(view, { type: "shift", key: "owner", delta: -1 }, fields);
  assert.deepEqual(view.order.slice(0, 4), ["name", "owner", "won", "tags"], "跳过隐藏字段，左移一格到 won 前");
  view = gridViewReducer(view, { type: "shift", key: "owner", delta: -1 }, fields);
  assert.equal(view.order[0], "name", "不能移到主字段前");
  view = gridViewReducer(view, { type: "moveBefore", key: "won", before: "name" }, fields);
  assert.equal(view.order[0], "name");
});
