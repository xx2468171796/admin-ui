/**
 * Dashboard filter context (DASHBOARDS.md §5, §6): time range, comparison basis and dimension
 * filters as one serialisable value that goes into the URL and is carried along every drill-down.
 * Pure functions, no React / DOM. URL input is untrusted: decoding keeps only known values — and the
 * server must still intersect the result with the viewer's permission scope (§8).
 */

export type DashboardFilterValue = {
  /** Time segment id, kept relative (「today」, not a date) so a shared link stays 「today」. */
  time: string;
  /** Only when `time` is the custom segment: inclusive local dates, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Comparison basis id (「mom」 环比 / 「yoy」 同比 / 「target」 目标, or the host's own). */
  compare: string;
  /** Dimension key → selected value; a missing key means 「全部」. */
  dims: Readonly<Record<string, string>>;
};

export type FilterOption = { value: string; label: string; description?: string };
export type FilterDimensionSpec = { key: string; options: readonly { value: string }[] };
export type FilterContextSpec = {
  times: readonly { value: string }[];
  compares: readonly { value: string }[];
  dimensions: readonly FilterDimensionSpec[];
  /** Id of the custom-range segment, default 「custom」. */
  customTime?: string;
};

export const CUSTOM_TIME = "custom";
export const DEFAULT_TIME_OPTIONS: readonly FilterOption[] = [
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: CUSTOM_TIME, label: "自定义" },
];
export const DEFAULT_COMPARE_OPTIONS: readonly FilterOption[] = [
  { value: "mom", label: "环比", description: "和上一个同样长的周期比：日看上周同一天同时段，月看上月同期日均" },
  { value: "yoy", label: "同比", description: "和去年同期比，相差 364 天，星期对得上" },
  { value: "target", label: "目标", description: "和这一期的目标比；周期没结束时看时间进度" },
];

/** URL keys used by the context itself; a dimension may not use them. */
export const RESERVED_FILTER_KEYS = ["t", "from", "to", "cmp"] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (day: string) => DATE.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

/** The custom range is complete and ordered. */
export function validCustomRange(from: string | undefined, to: string | undefined): boolean {
  return Boolean(from && to && validDate(from) && validDate(to) && from <= to);
}

/**
 * Context → URL query. Only values that differ from `defaults` are written (short, shareable links);
 * pass `{ full: true }` to write everything (e.g. for a server request).
 */
export function encodeFilterContext(value: DashboardFilterValue, defaults?: DashboardFilterValue, options: { full?: boolean; customTime?: string } = {}): URLSearchParams {
  const custom = options.customTime ?? CUSTOM_TIME;
  const base = options.full ? undefined : defaults;
  const params = new URLSearchParams();
  if (!base || value.time !== base.time || value.time === custom) params.set("t", value.time);
  if (value.time === custom && value.from && value.to) {
    params.set("from", value.from);
    params.set("to", value.to);
  }
  if (!base || value.compare !== base.compare) params.set("cmp", value.compare);
  for (const key of Object.keys(value.dims).sort()) {
    const v = value.dims[key];
    if (v === undefined || (RESERVED_FILTER_KEYS as readonly string[]).includes(key)) continue;
    if (!base || base.dims[key] !== v) params.set(key, v);
  }
  // A default dimension the user cleared to 「全部」 must survive the round trip — also with `full`,
  // otherwise the server (or a decode) re-applies the default.
  if (defaults)
    for (const key of Object.keys(defaults.dims))
      if (value.dims[key] === undefined && defaults.dims[key] !== undefined && !params.has(key) && !(RESERVED_FILTER_KEYS as readonly string[]).includes(key)) params.set(key, "");
  return params;
}

/**
 * URL query → context. Unknown keys, unknown option values and broken custom ranges are dropped and
 * fall back to `defaults`; an empty dimension value means 「全部」.
 */
export function decodeFilterContext(query: URLSearchParams | string, defaults: DashboardFilterValue, spec: FilterContextSpec): DashboardFilterValue {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  const custom = spec.customTime ?? CUSTOM_TIME;
  const known = (list: readonly { value: string }[], v: string | null) => (v !== null && list.some((o) => o.value === v) ? v : null);
  let time = known(spec.times, params.get("t")) ?? defaults.time;
  let from: string | undefined;
  let to: string | undefined;
  if (time === custom) {
    from = params.get("from") ?? defaults.from;
    to = params.get("to") ?? defaults.to;
    if (!validCustomRange(from, to)) {
      time = defaults.time === custom ? (spec.times.find((o) => o.value !== custom)?.value ?? defaults.time) : defaults.time;
      from = undefined;
      to = undefined;
    }
  }
  const compare = known(spec.compares, params.get("cmp")) ?? defaults.compare;
  const dims: Record<string, string> = {};
  for (const dim of spec.dimensions) {
    if ((RESERVED_FILTER_KEYS as readonly string[]).includes(dim.key)) continue;
    const raw = params.get(dim.key);
    if (raw === "") continue;
    const v = known(dim.options, raw) ?? (raw === null ? defaults.dims[dim.key] : undefined);
    if (v !== undefined) dims[dim.key] = v;
  }
  return time === custom ? { time, from, to, compare, dims } : { time, compare, dims };
}

/**
 * Drill-down / jump: time and comparison always travel; dimensions the target page does not support
 * are dropped and listed so the target can say 「未应用：渠道」 (§3, §5). Grafana's 「carry nothing by
 * default」 is the anti-pattern this replaces.
 */
export function carryFilterContext(value: DashboardFilterValue, supported: readonly string[]) {
  const dims: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [key, v] of Object.entries(value.dims)) {
    if (supported.includes(key)) dims[key] = v;
    else dropped.push(key);
  }
  return { value: { ...value, dims }, dropped };
}

/** Number of differences from the defaults (time + range, comparison, each dimension). 0 = 「重置」 has nothing to do. */
export function filterChangeCount(value: DashboardFilterValue, defaults: DashboardFilterValue): number {
  let n = 0;
  if (value.time !== defaults.time || value.from !== defaults.from || value.to !== defaults.to) n++;
  if (value.compare !== defaults.compare) n++;
  const keys = new Set([...Object.keys(value.dims), ...Object.keys(defaults.dims)]);
  for (const key of keys) if (value.dims[key] !== defaults.dims[key]) n++;
  return n;
}

/** Set (or clear with null / undefined) one dimension, returning a new context. */
export function withDimension(value: DashboardFilterValue, key: string, next: string | null | undefined): DashboardFilterValue {
  const dims = { ...value.dims };
  if (next === null || next === undefined) delete dims[key];
  else dims[key] = next;
  return { ...value, dims };
}
