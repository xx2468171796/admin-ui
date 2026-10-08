import test from "node:test";
import assert from "node:assert/strict";
import { conditionTreeParts, describeConditionTree, type DescribeField } from "../src/condition-describe.ts";
import type { ConditionGroup } from "../src/condition-core.ts";
import {
  addWidget,
  cellAt,
  clampLayout,
  compactLayout,
  duplicateWidget,
  filterInheritance,
  historyPush,
  historyRedo,
  compactNumberText,
  historyStart,
  historyUndo,
  kpiFitScale,
  keyboardLayoutStep,
  layoutBottom,
  metricBadge,
  moveWidget,
  nextWidgetId,
  normalizeDashboard,
  migrateDashboardSpec,
  countSchemaChanges,
  TARGET_WIDGET_KINDS,
  WIDGET_GROUP_LIMITS,
  WIDGET_KINDS,
  WIDGET_KIND_LABELS,
  WIDGET_SIZES,
  overlaps,
  readingOrder,
  removeWidget,
  resizeWidget,
  shiftWidget,
  sizeAt,
  widgetDataKey,
  widgetFilterContext,
  type DashboardWidget,
  type WidgetLayout,
} from "../src/dashboard-builder-core.ts";

// ---------------------------------------------------------------- describeConditionTree

const fields: DescribeField[] = [
  { key: "source", title: "来源", type: "singleSelect", options: [{ value: "web", label: "官网" }, { value: "ref", label: "转介绍", tone: "teal" }, { value: "fair", label: "展会" }] },
  { key: "region", title: "地区", type: "singleSelect", options: [{ value: "tpe", label: "上海" }, { value: "ntpc", label: "杭州" }] },
  { key: "quality", title: "客户质量", type: "singleSelect", options: [{ value: "high", label: "高", tone: "greenSolid" }, { value: "low", label: "低" }] },
  { key: "owner", title: "负责人", type: "user" },
  { key: "created", title: "创建时间", type: "date" },
  { key: "amount", title: "预计金额", type: "number" },
];

test("describeConditionTree reads a rule in plain Chinese", () => {
  const tree: ConditionGroup<string> = {
    id: "root",
    conjunction: "and",
    items: [
      { id: "f1", field: "source", op: "anyOf", value: ["web"] },
      { id: "f2", field: "region", op: "anyOf", value: ["tpe", "ntpc"] },
    ],
  };
  assert.equal(describeConditionTree(tree, fields), "来源 = 官网 且 地区 是 上海、杭州");
  const or: ConditionGroup<string> = { id: "root", conjunction: "or", items: [{ id: "f1", field: "quality", op: "anyOf", value: ["low"] }, { id: "f2", field: "quality", op: "empty" }] };
  assert.equal(describeConditionTree(or, fields), "客户质量 = 低 或 客户质量 为空");
});

test("nested groups, dynamic and relative values, incomplete and unknown conditions", () => {
  const tree: ConditionGroup<string> = {
    id: "root",
    conjunction: "and",
    items: [
      { id: "f1", field: "owner", op: "hasAny", value: { dynamic: "me" } },
      { id: "g1", conjunction: "or", items: [{ id: "f2", field: "created", op: "is", value: { relative: "pastDays", days: 7 } }, { id: "f3", field: "amount", op: "gte", value: 100000 }] },
      { id: "f4", field: "source", op: "anyOf", value: [] },
      { id: "f5", field: "gone", op: "is", value: "x" },
    ],
  };
  assert.equal(describeConditionTree(tree, fields), "负责人 是 我 且（创建时间 在过去 7 天 或 预计金额 ≥ 100000）");
  const parts = conditionTreeParts(tree, fields);
  const leaves = parts.items.filter((p) => p.kind === "condition");
  assert.deepEqual(leaves.map((p) => p.kind === "condition" && p.inactive), [false, true, true], "empty list and unknown field are inactive");
  assert.equal(describeConditionTree({ id: "root", conjunction: "and", items: [] }, fields), "所有记录");
  assert.equal(describeConditionTree({ id: "root", conjunction: "and", items: [] }, fields, { emptyText: "全部客户" }), "全部客户");
});

test("the review-02 sentence: relative dates read 「在…」, money shows its currency, no spaces around full-width brackets", () => {
  const sentenceFields: DescribeField[] = [
    { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "q", label: "报价" }, { value: "n", label: "谈判" }] },
    { key: "owner", title: "负责人", type: "user" },
    { key: "next", title: "下次跟进", type: "date" },
    { key: "amount", title: "预计金额", type: "money", currency: "¥" },
  ];
  const tree: ConditionGroup<string> = {
    id: "root",
    conjunction: "and",
    items: [
      { id: "f1", field: "stage", op: "anyOf", value: ["q", "n"] },
      { id: "f2", field: "owner", op: "hasAny", value: { dynamic: "me" } },
      { id: "g1", conjunction: "or", items: [{ id: "f3", field: "next", op: "is", value: { relative: "nextDays", days: 7 } }, { id: "f4", field: "amount", op: "gte", value: "50000" }] },
    ],
  };
  assert.equal(describeConditionTree(tree, sentenceFields), "阶段 是 报价、谈判 且 负责人 是 我 且（下次跟进 在未来 7 天 或 预计金额 ≥ ¥ 50,000）");
  const first: ConditionGroup<string> = { id: "root", conjunction: "or", items: [tree.items[2] ?? tree, { id: "f5", field: "next", op: "notInRange", value: { relative: "thisMonth" } }] };
  assert.equal(describeConditionTree(first, sentenceFields), "（下次跟进 在未来 7 天 或 预计金额 ≥ ¥ 50,000）或 下次跟进 不在本月");
  assert.equal(describeConditionTree({ id: "root", conjunction: "and", items: [{ id: "f1", field: "next", op: "is", value: "2026-10-08" }] }, sentenceFields), "下次跟进 是 2026-10-08");
});

test("option values carry their tone for chips (legacy colours mapped, unknown → gray)", () => {
  const parts = conditionTreeParts({ id: "root", conjunction: "and", items: [{ id: "f1", field: "source", op: "anyOf", value: ["web", "ref", "zzz"] }] }, fields);
  const leaf = parts.items[0];
  assert.ok(leaf?.kind === "condition");
  assert.deepEqual(leaf.values, [{ text: "官网", tone: "gray" }, { text: "转介绍", tone: "teal" }, { text: "zzz" }]);
  assert.equal(leaf.opLabel, "是", "several values read 「是」");
});

// ---------------------------------------------------------------- layout

const W = (id: string, x: number, y: number, w: number, h: number, kind: DashboardWidget["kind"] = "text"): DashboardWidget => ({ id, kind, title: id, layout: { x, y, w, h } });
const at = (list: readonly DashboardWidget[]) => Object.fromEntries(list.map((w) => [w.id, [w.layout.x, w.layout.y, w.layout.w, w.layout.h]]));
const noOverlap = (list: readonly { layout: WidgetLayout }[]) => list.every((a, i) => list.every((b, j) => i === j || !overlaps(a.layout, b.layout)));

test("clampLayout keeps widgets inside the 6 columns and above their minimum size", () => {
  assert.deepEqual(clampLayout({ x: 5, y: -2, w: 4, h: 1 }, "line"), { x: 2, y: 0, w: 4, h: 5 }, "a chart is at least 5 rows of 28px");
  assert.deepEqual(clampLayout({ x: 0, y: 0, w: 99, h: 99 }, "table"), { x: 0, y: 0, w: 6, h: 24 });
  assert.deepEqual(clampLayout({}, "kpi"), { x: 0, y: 0, w: 1, h: 3 }, "a number ≈ 108px");
  assert.deepEqual(clampLayout({}, "group"), { x: 0, y: 0, w: 6, h: 4 }, "数字组 spans the row");
  assert.equal(clampLayout({ w: 6, h: 3 }, "group").h, 4, "数字组 is at least 4 rows: editing header + one line of numbers (3 clipped it, 8.0.2)");
  assert.deepEqual(clampLayout({ x: 1.6, y: 2.2, w: 2.4, h: 2.6 }, "text"), { x: 2, y: 2, w: 2, h: 3 });
});

test("compaction floats widgets up and removes overlaps", () => {
  const out = compactLayout([W("a", 0, 3, 2, 2), W("b", 0, 3, 2, 2), W("c", 2, 9, 2, 2)]);
  assert.deepEqual(at(out), { a: [0, 0, 2, 2], b: [0, 2, 2, 2], c: [2, 0, 2, 2] });
  assert.ok(noOverlap(out));
  assert.deepEqual(out.map((w) => w.id), ["a", "b", "c"], "array order kept");
});

test("a huge stored y is clamped and floats up at once (no row-by-row loop)", () => {
  assert.equal(clampLayout({ x: 0, y: 1e12, w: 2, h: 2 }, "kpi").y, 10_000);
  const started = Date.now();
  const out = compactLayout([W("a", 0, 0, 2, 2), W("far", 0, 1e12, 2, 2), W("b", 2, 1e9, 2, 2)]);
  assert.ok(Date.now() - started < 200, "compaction must not walk 10 000 rows one by one per widget");
  assert.deepEqual(at(out), { a: [0, 0, 2, 2], far: [0, 2, 2, 2], b: [2, 0, 2, 2] });
  const gap = compactLayout([W("top", 0, 0, 6, 2), W("mid", 0, 5, 2, 1), W("low", 0, 9, 2, 2)]);
  assert.deepEqual(at(gap), { top: [0, 0, 6, 2], mid: [0, 2, 2, 2], low: [0, 4, 2, 2] }, "floats through gaps like before");
});

test("moving onto a widget pushes it down; moving right into a free column", () => {
  const base = [W("a", 0, 0, 2, 2), W("b", 2, 0, 2, 2), W("chart", 0, 2, 4, 5, "bar")];
  const moved = moveWidget(base, "chart", { x: 0, y: 0 });
  assert.deepEqual(at(moved), { a: [0, 5, 2, 2], b: [2, 5, 2, 2], chart: [0, 0, 4, 5] });
  assert.ok(noOverlap(moved));
  const right = moveWidget(base, "a", { x: 4, y: 0 });
  assert.deepEqual(at(right).a, [4, 0, 2, 2]);
  assert.deepEqual(at(moveWidget(base, "a", { x: 9, y: 0 })).a, [4, 0, 2, 2], "clamped to the last fitting column");
});

test("resize respects the kind minimum and pushes neighbours below", () => {
  const base = [W("chart", 0, 0, 4, 5, "bar"), W("k", 0, 5, 2, 2)];
  const grown = resizeWidget(base, "chart", { w: 6, h: 8 });
  assert.deepEqual(at(grown), { chart: [0, 0, 6, 8], k: [0, 8, 2, 2] });
  assert.deepEqual(at(resizeWidget(base, "chart", { w: 1, h: 1 })).chart, [0, 0, 2, 5], "bar chart min 2 × 5");
  assert.deepEqual(at(resizeWidget([W("k", 4, 0, 2, 2)], "k", { w: 5, h: 2 })).k, [4, 0, 2, 2], "cannot grow past the right edge");
});

test("add, duplicate, remove, shift and reading order", () => {
  const base = [W("a", 0, 0, 2, 2), W("b", 2, 0, 4, 5, "line")];
  const added = addWidget(base, W("n", 0, 0, 2, 2));
  assert.deepEqual(at(added).n, [0, 2, 2, 2], "a new widget floats into the gap under a");
  const dropped = addWidget(base, W("n", 0, 0, 2, 2), { x: 2, y: 0 });
  assert.deepEqual(at(dropped), { a: [0, 0, 2, 2], b: [2, 2, 4, 5], n: [2, 0, 2, 2] });
  const dup = duplicateWidget(base, "b", "b2");
  assert.deepEqual(at(dup).b2, [2, 5, 4, 5]);
  assert.equal(dup.find((w) => w.id === "b2")?.title, "b");
  assert.deepEqual(at(removeWidget(added, "a")).n, [0, 0, 2, 2]);
  const row = [W("a", 0, 0, 2, 2), W("b", 2, 0, 2, 2), W("c", 4, 0, 2, 2)];
  assert.deepEqual(readingOrder(shiftWidget(row, "c", -1)).map((w) => w.id), ["a", "c", "b"]);
  const up = shiftWidget(row, "b", -1);
  assert.deepEqual(at(up).b, [0, 0, 2, 2], "b takes a's place");
  assert.ok(noOverlap(up));
  const down = shiftWidget(row, "a", 1);
  assert.deepEqual(at(down).b, [0, 0, 2, 2], "the next one takes a's place");
  assert.deepEqual(at(shiftWidget(row, "a", -1)), at(row), "first stays");
  assert.equal(layoutBottom(dup), 10);
  assert.equal(nextWidgetId(dup), "w1");
  assert.equal(nextWidgetId([{ id: "w1" }, { id: "w2" }]), "w3");
});

test("keyboard: arrows move a cell or jump over a neighbour, Shift resizes", () => {
  const base = [W("a", 0, 0, 2, 2), W("b", 0, 2, 2, 2), W("c", 2, 0, 2, 2)];
  assert.deepEqual(at(keyboardLayoutStep(base, "c", "ArrowRight", false) ?? []).c, [3, 0, 2, 2]);
  const down = keyboardLayoutStep(base, "a", "ArrowDown", false) ?? [];
  assert.deepEqual([at(down).a, at(down).b], [[0, 2, 2, 2], [0, 0, 2, 2]], "a goes below b");
  const up = keyboardLayoutStep(base, "b", "ArrowUp", false) ?? [];
  assert.deepEqual([at(up).a, at(up).b], [[0, 2, 2, 2], [0, 0, 2, 2]], "b goes above a");
  assert.deepEqual(at(keyboardLayoutStep(base, "c", "ArrowRight", true) ?? []).c, [2, 0, 3, 2]);
  assert.deepEqual(at(keyboardLayoutStep(base, "c", "ArrowDown", true) ?? []).c, [2, 0, 2, 3]);
  assert.equal(keyboardLayoutStep(base, "c", "Enter", false), null);
});

test("pointer → cell and resize handle → size", () => {
  const grid = { width: 6 * 100 + 5 * 12, rowHeight: 64, gap: 12 };
  assert.deepEqual(cellAt({ x: 0, y: 0 }, grid), { x: 0, y: 0 });
  assert.deepEqual(cellAt({ x: 230, y: 160 }, grid), { x: 2, y: 2 });
  assert.deepEqual(cellAt({ x: 9999, y: -50 }, grid), { x: 5, y: 0 });
  assert.deepEqual(sizeAt({ x: 0, y: 0, w: 2, h: 2 }, { x: 330, y: 220 }, grid), { w: 3, h: 3 });
  assert.deepEqual(sizeAt({ x: 0, y: 0, w: 2, h: 2 }, { x: 330, y: 220 }, grid, "x"), { w: 3, h: 2 });
});

test("undo / redo history", () => {
  let h = historyStart(1);
  h = historyPush(h, 2);
  h = historyPush(h, 3);
  assert.equal(historyPush(h, 3), h, "same value is no step");
  h = historyUndo(h);
  assert.equal(h.present, 2);
  h = historyRedo(h);
  assert.equal(h.present, 3);
  h = historyUndo(historyUndo(h));
  assert.equal(h.present, 1);
  assert.equal(historyUndo(h), h, "nothing to undo");
  h = historyPush(h, 9);
  assert.deepEqual(h.future, [], "a new change drops redo");
  let long = historyStart(0);
  for (let i = 1; i <= 10; i++) long = historyPush(long, i, 5);
  assert.equal(long.past.length, 5);
});

test("filter inheritance, widget context, metric badge, data key", () => {
  const ctx = { time: "10d", compare: "wow", dims: { team: "g1", source: "web" } };
  const dims = [{ key: "team", label: "组" }, { key: "person", label: "人" }, { key: "source", label: "来源" }];
  const widget: Pick<DashboardWidget, "query"> = { query: { compare: "target", ignore: ["source"], filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "way", op: "noneOf", value: ["other"] }] } } };
  assert.deepEqual(filterInheritance(widget, ctx, dims), { inherited: ["时间", "组"], overridden: ["对比", "来源"], ownConditions: 1 });
  assert.deepEqual(filterInheritance({}, ctx, dims).inherited, ["时间", "对比", "组", "来源"]);
  assert.deepEqual(widgetFilterContext(widget, ctx), { time: "10d", compare: "target", dims: { team: "g1" } });
  assert.deepEqual(metricBadge({ kind: "standard", key: "valid" }, [{ key: "valid", version: 1 }]), { kind: "standard", label: "标准口径 v1" });
  assert.deepEqual(metricBadge({ kind: "custom", name: "上门次数" }), { kind: "custom", label: "自定义口径" });
  assert.equal(metricBadge(undefined), null);
  const k1 = widgetDataKey({ kind: "bar", query: { source: "s" } }, ctx);
  assert.equal(widgetDataKey({ kind: "bar", query: { source: "s" } }, ctx), k1);
  assert.notEqual(widgetDataKey({ kind: "bar", query: { source: "s" } }, { ...ctx, time: "today" }), k1);
});

test("normalizeDashboard reads untrusted JSON safely", () => {
  const schema = normalizeDashboard({
    title: "一组周会看板",
    filters: { time: "10d", compare: "wow", dims: { team: "g1", bad: 3 } },
    widgets: [
      { id: "a", kind: "kpi", title: "有效跟进", layout: { x: 0, y: 0, w: 2, h: 2 }, query: { metric: { kind: "standard", key: "valid", version: 1 }, filter: { conjunction: "or", items: [{ field: "way", op: "noneOf", value: ["x"] }, { nope: 1 }] } } },
      { id: "a", kind: "bar", layout: { x: 0, y: 0, w: 4, h: 4 } },
      { id: "z", kind: "pie", layout: {} },
      "junk",
      { id: "t", kind: "text", text: "说明", layout: { x: 8, y: 1, w: 9, h: 0 } },
    ],
  });
  assert.equal(schema.version, 2, "read as the current schema");
  assert.equal(schema.title, "一组周会看板");
  assert.deepEqual(schema.filters, { time: "10d", compare: "wow", dims: { team: "g1" } });
  assert.deepEqual(schema.widgets.map((w) => [w.id, w.kind]), [["a", "kpi"], ["w1", "bar"], ["t", "text"]]);
  assert.equal(schema.widgets[1]?.title, "柱图");
  assert.ok(noOverlap(schema.widgets));
  assert.deepEqual(schema.widgets[0]?.query?.filter, { id: "root", conjunction: "or", items: [{ id: "f1", field: "way", op: "noneOf", value: ["x"] }] });
  assert.deepEqual(schema.widgets[0]?.layout, { x: 0, y: 0, w: 2, h: 3 }, "read as version 2 (28px rows, KPI at least 3 rows): no scaling — older data goes through migrateDashboardSpec first");
  assert.deepEqual(normalizeDashboard(null), { version: 2, title: "未命名看板", widgets: [] });
  assert.ok(JSON.parse(JSON.stringify(schema)), "plain JSON");
});

test("merged history steps: typing is one undo step", () => {
  let h = historyStart("a");
  h = historyPush(h, "ab");
  h = historyPush(h, "abc", 100, true);
  h = historyPush(h, "abcd", 100, true);
  assert.equal(h.past.length, 1);
  assert.equal(historyUndo(h).present, "a");
  assert.equal(historyPush(historyStart("x"), "y", 100, true).past.length, 1, "nothing to merge into → a normal step");
});

test("看板数字卡：窄组件里数字不截成「1.」（审阅 06）——先缩字号，再换成 万 / 亿", () => {
  assert.equal(compactNumberText("3,824,600"), "382.5万");
  assert.equal(compactNumberText("1594200"), "159.4万");
  assert.equal(compactNumberText("−12,345"), "−1.2万");
  assert.equal(compactNumberText("320,000,000"), "3.2亿");
  assert.equal(compactNumberText("9,999"), null, "不到 1 万不用缩");
  assert.equal(compactNumberText("1.2万"), null, "已经是万");
  assert.equal(compactNumberText("65%"), null);
  assert.equal(compactNumberText("12,34"), null, "不是正常的千分位");
  assert.equal(kpiFitScale(100, 120), 1);
  assert.equal(kpiFitScale(100, 80), 0.8);
  assert.equal(kpiFitScale(100, 59), null, "要缩到 60% 以下就换成万");
  assert.equal(kpiFitScale(0, 0), 1);
});

// ---------------------------------------------------------------- 审阅 06：网格行高 64 → 28 的迁移

const mig = (layout: { x: number; y: number; w: number; h: number }) => migrateDashboardSpec({ version: 1, widgets: [{ layout }] }).widgets[0]!.layout;
test("migrateDashboardSpec keeps the pixel size of a version-1 widget (64px rows → 28px rows, gap 12)", () => {
  const px = (rows: number, row: number) => rows * row + (rows - 1) * 12;
  for (const h of [1, 2, 3, 4, 6, 12]) {
    const next = mig({ x: 0, y: 0, w: 2, h });
    assert.ok(Math.abs(px(next.h, 28) - px(h, 64)) <= 20, `h ${h}: ${px(h, 64)}px → ${px(next.h, 28)}px`);
  }
  assert.deepEqual(mig({ x: 3, y: 2, w: 3, h: 4 }), { x: 3, y: 4, w: 3, h: 7 }, "y 2 → 4 (152px from the top either way)");
  // Widgets that touched still touch; none overlaps after rounding.
  const old = [W("a", 0, 0, 2, 1), W("b", 0, 1, 2, 3), W("c", 0, 4, 2, 5), W("d", 2, 0, 4, 9)];
  const moved = old.map((w) => ({ ...w, layout: mig(w.layout) }));
  assert.ok(noOverlap(moved));
  assert.equal(moved[1]!.layout.y, moved[0]!.layout.y + moved[0]!.layout.h);
  assert.equal(moved[2]!.layout.y, moved[1]!.layout.y + moved[1]!.layout.h);
  assert.equal(moved[3]!.layout.y + moved[3]!.layout.h, moved[2]!.layout.y + moved[2]!.layout.h, "same bottom line");
});

test("migrateDashboardSpec bumps version 1 → 2, keeps the host's own fields, and is idempotent", () => {
  const v1 = { version: 1 as const, title: "经营看板", filterFields: { time: "f1" }, widgets: [{ id: "k", kind: "kpi" as const, title: "成交", layout: { x: 0, y: 0, w: 2, h: 2 } }, { id: "c", kind: "bar" as const, title: "状态", layout: { x: 0, y: 2, w: 3, h: 4 } }] };
  const v2 = migrateDashboardSpec(v1);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.filterFields, { time: "f1" }, "extra fields survive");
  assert.deepEqual(v2.widgets.map((w) => w.layout), [{ x: 0, y: 0, w: 2, h: 4 }, { x: 0, y: 4, w: 3, h: 7 }]);
  assert.equal(v1.widgets[0]!.layout.h, 2, "input not mutated");
  assert.equal(migrateDashboardSpec(v2), v2, "version 2 is returned as is");
  const unversioned = migrateDashboardSpec({ widgets: [{ layout: { x: 0, y: 1, w: 1, h: 2 } }] });
  assert.deepEqual(unversioned.widgets[0]!.layout, { x: 0, y: 2, w: 1, h: 4 }, "no version = 1");
  assert.deepEqual(normalizeDashboard(v2).widgets.map((w) => w.layout), v2.widgets.map((w) => w.layout), "normalize does not scale twice");
});

test("new widget kinds, 数字组 items and targets survive normalizeDashboard", () => {
  const schema = normalizeDashboard({
    version: 2,
    widgets: [
      { id: "g", kind: "group", title: "本月关键数字", layout: { x: 0, y: 0, w: 6, h: 3 }, size: "lg", items: [{ id: "n1", title: "成交额", query: { metric: { kind: "standard", key: "won" } } }, { id: "n1", title: "新客户" }, ...Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, title: `多余 ${i}` }))] },
      { id: "s", kind: "stacked", title: "各阶段", layout: { x: 0, y: 3, w: 3, h: 8 }, query: { groupBy: "stage", stackBy: "owner" } },
      { id: "t", kind: "targetBar", title: "月成交 vs 目标", layout: { x: 3, y: 3, w: 3, h: 8 }, target: 1_200_000 },
      { id: "d", kind: "donut", title: "来源", layout: { x: 0, y: 11, w: 2, h: 8 }, target: "x" },
      { id: "h", kind: "hbar", title: "谁成交最多", layout: { x: 2, y: 11, w: 2, h: 8 } },
    ],
  });
  assert.deepEqual(schema.widgets.map((w) => w.kind), ["group", "stacked", "targetBar", "donut", "hbar"]);
  const group = schema.widgets[0]!;
  assert.equal(group.size, "lg");
  assert.equal(group.items?.length, WIDGET_GROUP_LIMITS.max, "at most 6 numbers");
  assert.deepEqual(group.items?.slice(0, 2).map((i) => i.id), ["n1", "n2"], "item ids made unique");
  assert.deepEqual(group.items?.[0]?.query?.metric, { kind: "standard", key: "won" });
  assert.equal(schema.widgets[1]!.query?.stackBy, "owner");
  assert.equal(schema.widgets[2]!.target, 1_200_000);
  assert.equal(schema.widgets[3]!.target, undefined, "a non-number target is dropped");
  assert.ok(TARGET_WIDGET_KINDS.includes("bullet") && TARGET_WIDGET_KINDS.includes("rollup") && TARGET_WIDGET_KINDS.includes("targetBar"));
  for (const kind of WIDGET_KINDS) assert.ok(WIDGET_KIND_LABELS[kind] && WIDGET_SIZES[kind].minH <= WIDGET_SIZES[kind].h, kind);
  assert.notEqual(widgetDataKey({ kind: "targetBar", query: {}, target: 1 }, { time: "t", compare: "c", dims: {} }), widgetDataKey({ kind: "targetBar", query: {}, target: 2 }, { time: "t", compare: "c", dims: {} }), "a new target reloads");
});

test("countSchemaChanges: 「N 处修改未保存」 counts widgets added / removed / changed and the dashboard title", () => {
  const saved = normalizeDashboard({ version: 2, title: "看板", widgets: [W("a", 0, 0, 2, 2), W("b", 2, 0, 2, 2)] });
  assert.equal(countSchemaChanges(saved, saved), 0);
  const moved = { ...saved, widgets: saved.widgets.map((w) => (w.id === "a" ? { ...w, layout: { ...w.layout, y: 3 } } : w)) };
  assert.equal(countSchemaChanges(saved, moved), 1);
  const more = { ...moved, title: "新名字", widgets: [...moved.widgets.filter((w) => w.id !== "b"), W("c", 0, 6, 2, 2)] };
  assert.equal(countSchemaChanges(saved, more), 4, "a moved + b removed + c added + title");
});
