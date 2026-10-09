/**
 * Dashboard builder rules (bt/builders-b D9, demo D32): the serializable dashboard schema, the
 * 6-column grid layout (place / move / resize with collisions and upward compaction), keyboard steps,
 * reading order, undo / redo history, filter inheritance (which dashboard filters a widget follows,
 * which it overrides) and reading a stored schema safely. Pure functions, no React / DOM; unit-tested
 * in test/dashboard-builder-core.test.ts. Components: dashboard-builder*.tsx.
 *
 * Layout model: integer cells, x 0..columns-1, y ≥ 0 (rows), w 1..columns, h ≥ 1. Widgets never
 * overlap and float up (gravity): after every change the layout is compacted, the widget being moved /
 * resized / added keeps priority over the ones it lands on (they move down).
 */
import { isConditionValue, normalizeConditionTree, type ConditionGroup, type ConditionKind, type ConditionNode } from "./condition-core.ts";
import type { DashboardFilterValue } from "./dashboard-filters-core.ts";
import { formatNumber } from "./dashboard-core.ts";

// ---------------------------------------------------------------- schema

export const DASHBOARD_COLUMNS = 6;
/**
 * 2 = rows of 28px (审阅 06); 1 = the old 64px rows. Read stored dashboards through
 * `normalizeDashboard` / `migrateDashboardSpec`, which scale version-1 layouts so they keep their size.
 */
export const DASHBOARD_SCHEMA_VERSION = 2;
export type DashboardSchemaVersion = 1 | 2;
/** Tallest widget in rows (24 × 28px + gaps ≈ 950px). */
export const MAX_WIDGET_ROWS = 24;
/** Highest row a widget may start on (stored JSON with a huge y is pulled back here, then floats up). */
const MAX_LAYOUT_ROW = 10_000;

/**
 * Widget kinds; each renders with an existing dashboard component (KpiCard, BulletBar, RollupCard,
 * StepFunnel, CohortTable, CompactTable, AdminChart + the option builders).
 * bar = vertical bars, hbar = ranking bars, donut = shares (≤ 5 + 其他), stacked = bars split by a second
 * dimension, targetBar = actual vs target per period, group = 「数字组」 2–6 equal-width numbers, targetProgress =
 * 「目标进度」 (actual / target, 完成率, 「按时间应完成」 marker, 「还差 X · 剩 N 天」).
 */
export type WidgetKind = "group" | "kpi" | "bullet" | "line" | "bar" | "hbar" | "donut" | "stacked" | "targetBar" | "targetProgress" | "funnel" | "cohort" | "table" | "rollup" | "text";
export const WIDGET_KINDS: readonly WidgetKind[] = ["group", "kpi", "bar", "hbar", "line", "donut", "stacked", "targetBar", "targetProgress", "funnel", "table", "bullet", "rollup", "cohort", "text"];
export const WIDGET_KIND_LABELS: Readonly<Record<WidgetKind, string>> = {
  group: "数字组",
  kpi: "数字卡",
  bullet: "子弹图",
  line: "折线",
  bar: "柱图",
  hbar: "条形",
  donut: "环图",
  stacked: "堆叠柱",
  targetBar: "实际 vs 目标",
  targetProgress: "目标进度",
  funnel: "漏斗",
  cohort: "批次留存表",
  table: "表格",
  rollup: "汇总卡",
  text: "文字",
};
/** Kinds that compare against a target: `widget.target` (a number) or `widget.targetRef` (a host target). */
export const TARGET_WIDGET_KINDS: readonly WidgetKind[] = ["bullet", "targetBar", "targetProgress", "rollup"];
/** Numbers in a 「数字组」. */
export const WIDGET_GROUP_LIMITS = { min: 2, max: 6 } as const;
/**
 * Default size (cells, rows of 28px) of a new widget and the smallest it can be resized to:
 * a number ≈ 108px (3 rows), a chart ≈ 308px (8 rows). A 「数字组」 needs 4 rows (148px) at least:
 * the editing header plus one line of numbers — 3 rows clipped it (8.0.2). On the fixed-row grid its
 * numbers always stay on one line and shrink to fit; they wrap two per row only when stacked.
 */
export const WIDGET_SIZES: Readonly<Record<WidgetKind, { w: number; h: number; minW: number; minH: number }>> = {
  group: { w: 6, h: 4, minW: 2, minH: 4 },
  kpi: { w: 1, h: 3, minW: 1, minH: 3 },
  bullet: { w: 2, h: 4, minW: 2, minH: 3 },
  line: { w: 3, h: 8, minW: 2, minH: 5 },
  bar: { w: 3, h: 8, minW: 2, minH: 5 },
  hbar: { w: 3, h: 8, minW: 2, minH: 4 },
  donut: { w: 2, h: 8, minW: 2, minH: 6 },
  stacked: { w: 3, h: 8, minW: 2, minH: 5 },
  targetBar: { w: 3, h: 8, minW: 2, minH: 5 },
  targetProgress: { w: 2, h: 7, minW: 2, minH: 6 },
  funnel: { w: 3, h: 8, minW: 2, minH: 6 },
  cohort: { w: 6, h: 8, minW: 3, minH: 6 },
  table: { w: 3, h: 8, minW: 2, minH: 5 },
  rollup: { w: 3, h: 6, minW: 2, minH: 5 },
  text: { w: 2, h: 3, minW: 1, minH: 2 },
};

export type WidgetLayout = { x: number; y: number; w: number; h: number };
export type WidgetGranularity = "hour" | "day" | "week" | "month";
export const WIDGET_GRANULARITIES: readonly { value: WidgetGranularity; label: string }[] = [
  { value: "hour", label: "小时" },
  { value: "day", label: "天" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];

/**
 * The metric: a standard one from the host's metric dictionary (DASHBOARDS.md §4 — its definition
 * cannot be changed here; the widget shows 「标准口径 vN」) or a custom one only this dashboard uses
 * (shows 「自定义口径」 with its formula as the tooltip).
 */
export type WidgetMetric = { kind: "standard"; key: string; version?: number } | { kind: "custom"; name: string; formula?: string };

export type WidgetQuery = {
  /** Data source id (a bitable table, platform data …). */
  source?: string;
  metric?: WidgetMetric;
  /** Group-by key; null / absent = 不分组. */
  groupBy?: string | null;
  /** Second dimension of a stacked bar (one segment per value); null / absent = not stacked. */
  stackBy?: string | null;
  /** Comparison basis; null / absent = follow the dashboard's. */
  compare?: string | null;
  granularity?: WidgetGranularity;
  /** The widget's own conditions (in addition to the dashboard filters). */
  filter?: ConditionGroup<string>;
  /** Dashboard dimension keys this widget does not follow (shown as 「已覆盖」). */
  ignore?: string[];
};

export type DashboardWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  layout: WidgetLayout;
  query?: WidgetQuery;
  /** Text note (kind text). */
  text?: string;
  /** Grey line under the widget (「9-25 中秋放假不画；今天还在进行中」). */
  caption?: string;
  /** Library template it came from (standard widgets). */
  template?: string;
  /** 目标值 per period in the metric's unit (bullet, actual vs target, 目标进度, rollup); null / absent = no target set. */
  target?: number | null;
  /**
   * Instead of `target`: the id of a target the host keeps (DashboardBuilder `targets`, e.g. a table's monthly goal).
   * The builder only stores the id; `loadWidgetData` resolves the value and the period. Wins over `target`.
   */
  targetRef?: string;
  /** 「数字组」: 2–6 numbers side by side, each with its own title and metric (the group's query is their default source). */
  items?: WidgetGroupItem[];
  /** Number size of KPI-like widgets: lg 28 · md 24 · sm 20. */
  size?: "lg" | "md" | "sm";
};

/** One number of a 「数字组」. */
export type WidgetGroupItem = { id: string; title: string; query?: WidgetQuery };

/** The whole dashboard: plain JSON, store it as is (`version` lets a reader migrate later). */
export type DashboardSchema = {
  /** Always 2 from normalizeDashboard / migrateDashboardSpec; 1 = stored before 7.16 (64px rows). */
  version: DashboardSchemaVersion;
  id?: string;
  title: string;
  /** The dashboard's standard filter context (what 「重置」 returns to). */
  filters?: DashboardFilterValue;
  widgets: DashboardWidget[];
};

// ---------------------------------------------------------------- layout primitives

const int = (n: unknown, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback);

/** A layout inside the grid: w 1..columns (≥ the kind's minimum), x so it fits, y 0..MAX_LAYOUT_ROW, h 1..MAX_WIDGET_ROWS. */
export function clampLayout(layout: Partial<WidgetLayout>, kind?: WidgetKind, columns = DASHBOARD_COLUMNS): WidgetLayout {
  const size = kind ? WIDGET_SIZES[kind] : { w: 2, h: 2, minW: 1, minH: 1 };
  const w = Math.min(columns, Math.max(Math.min(size.minW, columns), int(layout.w, size.w)));
  const h = Math.min(MAX_WIDGET_ROWS, Math.max(size.minH, int(layout.h, size.h)));
  const x = Math.min(columns - w, Math.max(0, int(layout.x, 0)));
  const y = Math.min(MAX_LAYOUT_ROW, Math.max(0, int(layout.y, 0)));
  return { x, y, w, h };
}

export const overlaps = (a: WidgetLayout, b: WidgetLayout) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Rows the widgets use (the canvas height without the drop row). */
export const layoutBottom = (widgets: readonly { layout: WidgetLayout }[]) => widgets.reduce((n, w) => Math.max(n, w.layout.y + w.layout.h), 0);
/** Reading order: top to bottom, then left to right (keyboard order, phones stack in it). */
export function readingOrder<W extends { id: string; layout: WidgetLayout }>(widgets: readonly W[]): W[] {
  return widgets.slice().sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x || a.id.localeCompare(b.id));
}

/**
 * The row a layout floats up to: the highest row ≤ its own where every slot between is free.
 * Computed from the placed widgets (not row by row), so a huge stored y costs nothing.
 */
function floatRow(placed: readonly { layout: WidgetLayout }[], at: WidgetLayout): number {
  let blocked = -1;
  for (const { layout: p } of placed) {
    if (!(at.x < p.x + p.w && p.x < at.x + at.w)) continue;
    // The slot starting at row r overlaps p for r in [p.y - h + 1, p.y + p.h - 1].
    if (p.y - at.h + 1 <= at.y - 1) blocked = Math.max(blocked, Math.min(p.y + p.h - 1, at.y - 1));
  }
  return blocked + 1;
}

/**
 * Remove overlaps and float everything up. `priority` (the widget being moved / resized / added) is
 * placed before the widgets that start on its row or below, so they make room for it.
 */
export function compactLayout<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], priority?: string, columns = DASHBOARD_COLUMNS): W[] {
  const key = (w: W) => (w.id === priority ? w.layout.y - 0.5 : w.layout.y);
  const sorted = widgets
    .map((w) => ({ ...w, layout: clampLayout(w.layout, w.kind, columns) }))
    .sort((a, b) => key(a) - key(b) || a.layout.x - b.layout.x || a.id.localeCompare(b.id));
  const placed: W[] = [];
  for (const widget of sorted) {
    const at = { ...widget.layout, y: floatRow(placed, widget.layout) };
    for (let hit = placed.find((p) => overlaps(p.layout, at)); hit; hit = placed.find((p) => overlaps(p.layout, at))) at.y = hit.layout.y + hit.layout.h;
    placed.push({ ...widget, layout: at });
  }
  const order = new Map(widgets.map((w, i) => [w.id, i]));
  return placed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Put a widget at (x, y); the ones it lands on move down, then everything floats up. */
export function moveWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], id: string, to: { x: number; y: number }, columns = DASHBOARD_COLUMNS): W[] {
  return compactLayout(widgets.map((w) => (w.id === id ? { ...w, layout: clampLayout({ ...w.layout, x: to.x, y: to.y }, w.kind, columns) } : w)), id, columns);
}
/** Change a widget's size (clamped to its kind's minimum and the grid). */
export function resizeWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], id: string, size: { w: number; h: number }, columns = DASHBOARD_COLUMNS): W[] {
  return compactLayout(
    widgets.map((w) => {
      if (w.id !== id) return w;
      const width = Math.min(int(size.w, w.layout.w), columns - w.layout.x);
      return { ...w, layout: clampLayout({ ...w.layout, w: Math.max(1, width), h: size.h }, w.kind, columns) };
    }),
    id,
    columns,
  );
}
/** Add a widget at `at` (a drop cell) or at the bottom-left; it floats up into a gap if one fits. */
export function addWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], widget: W, at?: { x: number; y: number }, columns = DASHBOARD_COLUMNS): W[] {
  const base = clampLayout(widget.layout, widget.kind, columns);
  const layout = at ? clampLayout({ ...base, x: at.x, y: at.y }, widget.kind, columns) : { ...base, x: 0, y: layoutBottom(widgets) };
  return compactLayout([...widgets, { ...widget, layout }], widget.id, columns);
}
export function removeWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], id: string, columns = DASHBOARD_COLUMNS): W[] {
  return compactLayout(widgets.filter((w) => w.id !== id), undefined, columns);
}
/** A copy right below the original (same size); `id` is the copy's id. */
export function duplicateWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout; title?: string }>(widgets: readonly W[], id: string, copyId: string, columns = DASHBOARD_COLUMNS): W[] {
  const source = widgets.find((w) => w.id === id);
  if (!source) return widgets.slice();
  const copy = { ...source, id: copyId, layout: { ...source.layout, y: source.layout.y + source.layout.h } };
  return compactLayout([...widgets, copy], copyId, columns);
}
/**
 * 「上移 / 下移」 in reading order: up takes the place of the previous widget (which moves down),
 * down lets the next widget take this one's place. Unchanged at the ends.
 */
export function shiftWidget<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], id: string, dir: -1 | 1, columns = DASHBOARD_COLUMNS): W[] {
  const order = readingOrder(widgets);
  const index = order.findIndex((w) => w.id === id);
  const self = order[index];
  const other = order[index + dir];
  if (!self || !other) return widgets.slice();
  return dir < 0 ? moveWidget(widgets, id, { x: other.layout.x, y: other.layout.y }, columns) : moveWidget(widgets, other.id, { x: self.layout.x, y: self.layout.y }, columns);
}

/** Keyboard on a selected widget: arrows move one cell, Shift+arrows resize. null = not a layout key. */
export function keyboardLayoutStep<W extends { id: string; kind?: WidgetKind; layout: WidgetLayout }>(widgets: readonly W[], id: string, key: string, shift: boolean, columns = DASHBOARD_COLUMNS): W[] | null {
  const self = widgets.find((w) => w.id === id);
  if (!self) return null;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key] as [number, number] | undefined;
  if (!d) return null;
  const { x, y, w, h } = self.layout;
  if (shift) return resizeWidget(widgets, id, { w: w + d[0], h: h + d[1] }, columns);
  // Moving up past a widget: jump above it (gravity would otherwise put us right back).
  if (d[1] < 0) {
    const above = widgets.filter((o) => o.id !== id && o.layout.x < x + w && x < o.layout.x + o.layout.w && o.layout.y + o.layout.h <= y);
    const target = above.reduce((best, o) => Math.max(best, o.layout.y), -1);
    return target < 0 ? widgets.slice() : moveWidget(widgets, id, { x, y: target }, columns);
  }
  if (d[1] > 0) {
    const below = widgets.filter((o) => o.id !== id && o.layout.x < x + w && x < o.layout.x + o.layout.w && o.layout.y >= y + h);
    const next = below.sort((a, b) => a.layout.y - b.layout.y)[0];
    return next ? moveWidget(widgets, next.id, { x: next.layout.x, y }, columns) : widgets.slice();
  }
  return moveWidget(widgets, id, { x: x + d[0], y }, columns);
}

/** Grid cell under a point of the canvas (px from its top-left): column / row clamped to the grid. */
export function cellAt(point: { x: number; y: number }, grid: { width: number; rowHeight: number; gap: number; columns?: number }): { x: number; y: number } {
  const columns = grid.columns ?? DASHBOARD_COLUMNS;
  const colWidth = (grid.width - grid.gap * (columns - 1)) / columns;
  const x = Math.floor(point.x / (colWidth + grid.gap));
  const y = Math.floor(point.y / (grid.rowHeight + grid.gap));
  return { x: Math.min(columns - 1, Math.max(0, x)), y: Math.max(0, y) };
}
/** Size (cells) for a resize handle dragged to a point: from the widget's top-left cell to the point. */
export function sizeAt(layout: WidgetLayout, point: { x: number; y: number }, grid: { width: number; rowHeight: number; gap: number; columns?: number }, axis: "x" | "y" | "both" = "both"): { w: number; h: number } {
  const columns = grid.columns ?? DASHBOARD_COLUMNS;
  const colWidth = (grid.width - grid.gap * (columns - 1)) / columns;
  const right = Math.round((point.x + grid.gap) / (colWidth + grid.gap));
  const bottom = Math.round((point.y + grid.gap) / (grid.rowHeight + grid.gap));
  return { w: axis === "y" ? layout.w : Math.max(1, right - layout.x), h: axis === "x" ? layout.h : Math.max(1, bottom - layout.y) };
}

/** Next free id with a prefix: w1, w2 … */
export function nextWidgetId(widgets: readonly { id: string }[], prefix = "w"): string {
  const used = new Set(widgets.map((w) => w.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// ---------------------------------------------------------------- history

export type BuilderHistory<T> = { past: readonly T[]; present: T; future: readonly T[] };
export const historyStart = <T>(present: T): BuilderHistory<T> => ({ past: [], present, future: [] });
/**
 * Record a change (same value = no step); the redo stack is dropped; at most `limit` undo steps.
 * `merge` replaces the present step instead (typing a title is one step, not one per key).
 */
export function historyPush<T>(history: BuilderHistory<T>, next: T, limit = 100, merge = false): BuilderHistory<T> {
  if (next === history.present) return history;
  if (merge && history.past.length) return { ...history, present: next, future: [] };
  const past = [...history.past, history.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] };
}
export function historyUndo<T>(history: BuilderHistory<T>): BuilderHistory<T> {
  const prev = history.past[history.past.length - 1];
  if (prev === undefined) return history;
  return { past: history.past.slice(0, -1), present: prev, future: [history.present, ...history.future] };
}
export function historyRedo<T>(history: BuilderHistory<T>): BuilderHistory<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

// ---------------------------------------------------------------- filter inheritance

export type FilterInheritance = {
  /** Dashboard filters the widget follows (labels): 「时间」「对比」「组」. */
  inherited: string[];
  /** Dashboard filters the widget overrides: own comparison, ignored dimensions. */
  overridden: string[];
  /** The widget has its own conditions on top. */
  ownConditions: number;
};
/**
 * What a widget does with the dashboard filters. `dimensions` = the dashboard's dimension keys with
 * labels (only dimensions that have a value count as filters).
 */
export function filterInheritance(widget: Pick<DashboardWidget, "query">, context: DashboardFilterValue, dimensions: readonly { key: string; label: string }[] = []): FilterInheritance {
  const q = widget.query ?? {};
  const inherited = ["时间"];
  const overridden: string[] = [];
  if (q.compare) overridden.push("对比");
  else inherited.push("对比");
  for (const d of dimensions) {
    if (!context.dims[d.key]) continue;
    if (q.ignore?.includes(d.key)) overridden.push(d.label);
    else inherited.push(d.label);
  }
  const ownConditions = q.filter ? countLeaves(q.filter) : 0;
  return { inherited, overridden, ownConditions };
}
const countLeaves = (g: ConditionGroup<string>): number => g.items.reduce((n, item) => n + ("items" in item ? countLeaves(item) : 1), 0);

/** The filter context a widget's data is loaded with: its own comparison, ignored dimensions dropped. */
export function widgetFilterContext(widget: Pick<DashboardWidget, "query">, context: DashboardFilterValue): DashboardFilterValue {
  const q = widget.query ?? {};
  const dims = Object.fromEntries(Object.entries(context.dims).filter(([key]) => !q.ignore?.includes(key)));
  return { ...context, compare: q.compare || context.compare, dims };
}

/** Badge of the metric (DASHBOARDS.md §4): standard 「标准口径 v1」 / custom 「自定义口径」; null = none chosen. */
export function metricBadge(metric: WidgetMetric | undefined, dictionary: readonly { key: string; version?: number }[] = []): { kind: "standard" | "custom"; label: string } | null {
  if (!metric) return null;
  if (metric.kind === "custom") return { kind: "custom", label: "自定义口径" };
  const def = dictionary.find((m) => m.key === metric.key);
  const version = metric.version ?? def?.version;
  return { kind: "standard", label: version ? `标准口径 v${version}` : "标准口径" };
}

/** A stable key of what a widget's data depends on (not its title / layout): reload only when it changes. */
export function widgetDataKey(widget: Pick<DashboardWidget, "kind" | "query"> & Partial<Pick<DashboardWidget, "items" | "target" | "targetRef">>, context: DashboardFilterValue): string {
  return JSON.stringify([widget.kind, widget.query ?? null, widget.items ?? null, widget.target ?? null, widget.targetRef ?? null, widgetFilterContext(widget, context)]);
}

// ---------------------------------------------------------------- reading a stored schema

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Shape-only reading of a condition tree when the field kinds are not known (ids, field, op, value kept if well-formed). */
function looseTree(input: Record<string, unknown>, depth = 0): ConditionGroup<string> {
  const items: ConditionNode<string>[] = [];
  for (const item of Array.isArray(input.items) ? input.items.slice(0, 50) : []) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.items)) {
      if (depth < 2) items.push(looseTree(item, depth + 1));
    } else if (str(item.field, 64) && str(item.op, 32)) {
      items.push({ id: str(item.id, 64) ?? `f${items.length + 1}`, field: str(item.field, 64) ?? "", op: str(item.op, 32) ?? "", ...(isConditionValue(item.value) ? { value: item.value } : {}) });
    }
  }
  return { id: depth === 0 ? "root" : (str(input.id, 64) ?? `g${depth}`), conjunction: input.conjunction === "or" ? "or" : "and", items };
}

function readQuery(input: unknown, kindOf: ((field: string) => ConditionKind | undefined) | undefined): WidgetQuery | undefined {
  if (!isRecord(input)) return undefined;
  const q: WidgetQuery = {};
  if (str(input.source)) q.source = str(input.source);
  const m = input.metric;
  if (isRecord(m) && m.kind === "standard" && str(m.key)) q.metric = { kind: "standard", key: str(m.key) ?? "", ...(Number.isInteger(m.version) ? { version: m.version as number } : {}) };
  if (isRecord(m) && m.kind === "custom" && str(m.name)) q.metric = { kind: "custom", name: str(m.name) ?? "", ...(str(m.formula, 2000) ? { formula: str(m.formula, 2000) } : {}) };
  if (input.groupBy === null || str(input.groupBy)) q.groupBy = (input.groupBy as string | null) ?? null;
  if (input.stackBy === null || str(input.stackBy)) q.stackBy = (input.stackBy as string | null) ?? null;
  if (input.compare === null || str(input.compare)) q.compare = (input.compare as string | null) ?? null;
  if (WIDGET_GRANULARITIES.some((g) => g.value === input.granularity)) q.granularity = input.granularity as WidgetGranularity;
  if (isRecord(input.filter)) q.filter = kindOf ? normalizeConditionTree(input.filter, kindOf) : looseTree(input.filter);
  if (Array.isArray(input.ignore)) q.ignore = input.ignore.filter((k): k is string => typeof k === "string").slice(0, 50);
  return q;
}

// ---------------------------------------------------------------- schema migration (审阅 06: rows 64 → 28)

/** Old grid (version 1, before 7.16): 64px rows, 12px gaps. Current (version 2): 28px rows, same gaps. */
const LEGACY_ROW_HEIGHT = 64;
const ROW_GAP = 12;
const NEW_ROW_HEIGHT = 28;
const ROW_SCALE = (LEGACY_ROW_HEIGHT + ROW_GAP) / (NEW_ROW_HEIGHT + ROW_GAP);

/**
 * A version-1 layout (64px rows) in 28px rows with the same pixel size: y and the bottom edge are scaled
 * (64 + 12 → 28 + 12 = ×1.9) and rounded, so widgets that touched still touch and none overlaps.
 */
function migrateLayout(layout: WidgetLayout): WidgetLayout {
  const top = Math.round(layout.y * ROW_SCALE);
  const bottom = Math.round((layout.y + layout.h) * ROW_SCALE);
  return { x: layout.x, y: top, w: layout.w, h: Math.min(MAX_WIDGET_ROWS, Math.max(1, bottom - top)) };
}

type MigratableWidget = { layout: WidgetLayout; items?: unknown };
type Migratable = { version?: number; widgets: readonly MigratableWidget[] };

/**
 * The one data-upgrade helper for dashboards stored before 7.16 (pure; other fields are kept as they are, so
 * a host's own extras such as `filterFields` survive). Version 1 (or none) → 2: layouts scaled from 64px to
 * 28px rows, stored dashboards keep their visual size. Version ≥ 2 is returned unchanged. The components and
 * `normalizeDashboard` only read version 2: run this on stored data first (or migrate the table once).
 */
export function migrateDashboardSpec<T extends Migratable>(spec: T): Omit<T, "version"> & { version: typeof DASHBOARD_SCHEMA_VERSION } {
  if (typeof spec.version === "number" && spec.version >= DASHBOARD_SCHEMA_VERSION) return spec as Omit<T, "version"> & { version: typeof DASHBOARD_SCHEMA_VERSION };
  return { ...spec, version: DASHBOARD_SCHEMA_VERSION, widgets: spec.widgets.map((w) => ({ ...w, layout: migrateLayout(w.layout) })) };
}

/** How many widgets (added, removed or changed) and dashboard settings differ: 「3 处修改未保存」. */
export function countSchemaChanges(saved: DashboardSchema, current: DashboardSchema): number {
  if (saved === current) return 0;
  const before = new Map(saved.widgets.map((w) => [w.id, JSON.stringify(w)]));
  let n = 0;
  for (const w of current.widgets) {
    const old = before.get(w.id);
    if (old === undefined || old !== JSON.stringify(w)) n++;
    before.delete(w.id);
  }
  n += before.size;
  if (saved.title !== current.title) n++;
  if (JSON.stringify(saved.filters ?? null) !== JSON.stringify(current.filters ?? null)) n++;
  return n;
}

function readItems(input: unknown, kindOf: ((field: string) => ConditionKind | undefined) | undefined): WidgetGroupItem[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const used = new Set<string>();
  const items: WidgetGroupItem[] = [];
  for (const raw of input) {
    if (!isRecord(raw) || items.length >= WIDGET_GROUP_LIMITS.max) continue;
    let id = str(raw.id, 64) ?? "";
    if (!id || used.has(id)) id = nextWidgetId([...used].map((u) => ({ id: u })), "n");
    used.add(id);
    const query = readQuery(raw.query, kindOf);
    items.push({ id, title: str(raw.title) ?? "", ...(query ? { query } : {}) });
  }
  return items;
}

/**
 * Read a stored / pasted dashboard (untrusted JSON, version 2 — older data goes through
 * `migrateDashboardSpec` first): unknown kinds and broken widgets dropped, ids made unique, layouts clamped and overlaps resolved, at most
 * `maxWidgets` (default 60). Condition fields are read as text unless `kindOf` knows them.
 */
export function normalizeDashboard(input: unknown, options: { kindOf?: (field: string) => ConditionKind | undefined; maxWidgets?: number; columns?: number } = {}): DashboardSchema {
  const source = isRecord(input) ? input : {};
  const kindOf = options.kindOf;
  const used = new Set<string>();
  const widgets: DashboardWidget[] = [];
  for (const raw of Array.isArray(source.widgets) ? source.widgets : []) {
    if (!isRecord(raw) || !WIDGET_KINDS.includes(raw.kind as WidgetKind)) continue;
    if (widgets.length >= (options.maxWidgets ?? 60)) break;
    const kind = raw.kind as WidgetKind;
    let id = str(raw.id, 64) ?? "";
    if (!id || used.has(id)) id = nextWidgetId([...used].map((u) => ({ id: u })));
    used.add(id);
    const stored = isRecord(raw.layout) ? (raw.layout as Partial<WidgetLayout>) : {};
    const layout = clampLayout(stored, kind, options.columns);
    const widget: DashboardWidget = { id, kind, title: str(raw.title) ?? WIDGET_KIND_LABELS[kind], layout };
    const query = readQuery(raw.query, kindOf);
    if (query) widget.query = query;
    if (str(raw.text, 4000) !== undefined) widget.text = str(raw.text, 4000);
    if (str(raw.caption, 500)) widget.caption = str(raw.caption, 500);
    if (str(raw.template, 64)) widget.template = str(raw.template, 64);
    if (typeof raw.target === "number" && Number.isFinite(raw.target)) widget.target = raw.target;
    if (str(raw.targetRef, 64)) widget.targetRef = str(raw.targetRef, 64);
    if (raw.size === "lg" || raw.size === "md" || raw.size === "sm") widget.size = raw.size;
    const items = kind === "group" ? readItems(raw.items, kindOf) : undefined;
    if (items) widget.items = items;
    widgets.push(widget);
  }
  const filters = isRecord(source.filters) && typeof source.filters.time === "string" && typeof source.filters.compare === "string" && isRecord(source.filters.dims)
    ? { time: source.filters.time, compare: source.filters.compare, dims: Object.fromEntries(Object.entries(source.filters.dims).filter((e): e is [string, string] => typeof e[1] === "string")), ...(str(source.filters.from) ? { from: str(source.filters.from) } : {}), ...(str(source.filters.to) ? { to: str(source.filters.to) } : {}) }
    : undefined;
  return {
    version: DASHBOARD_SCHEMA_VERSION,
    ...(str(source.id, 64) ? { id: str(source.id, 64) } : {}),
    title: str(source.title) ?? "未命名看板",
    ...(filters ? { filters } : {}),
    widgets: compactLayout(widgets, undefined, options.columns),
  };
}

// ---------------------------------------------------------------- KPI values in narrow widgets (审阅 06)

/**
 * A plain number text as 万 / 亿 for a widget too narrow for it: 「3,824,600」→「382.5万」. null when the
 * text isn't a plain number (already 「1.2万」, 「65%」, words) or is under 10 000 (nothing to shorten).
 */
export function compactNumberText(text: string): string | null {
  const match = /^\s*([−-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*$/.exec(text);
  if (!match) return null;
  const n = Number(`${match[2]!.replace(/,/g, "")}${match[3] ?? ""}`);
  if (!Number.isFinite(n) || n < 1e4) return null;
  return formatNumber(match[1] ? -n : n, { compact: true });
}

/**
 * Font scale that fits a value of `natural` px into `available` px: 1 when it fits, else the ratio
 * (two decimals, rounded down) while it is ≥ `min`; null when it would have to go below `min`
 * (abbreviate instead). A value is never cut mid-number.
 */
export function kpiFitScale(natural: number, available: number, min = 0.6): number | null {
  if (natural <= 0 || natural <= available + 0.5) return 1;
  const scale = Math.floor((Math.max(0, available) / natural) * 100) / 100;
  return scale >= min ? scale : null;
}
