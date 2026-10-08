/**
 * Demo data for the chart / dashboard pages: SaaS metrics of the fictional company 「北辰云」 (MRR, new customers,
 * seats, churn, trial funnel, retention cohorts). All numbers are made up. Builder data (sources, metric
 * dictionary, widget templates, a fake server loader) lives here too, so the demos stay short.
 */
import { computeDelta, type DashboardDimension, type DashboardFilterValue, type FilterOption } from "@adminui/react";
import type { DashboardDataSource, DashboardMetricDef, DashboardSchema, DashboardWidget, DashboardWidgetData, WidgetMetric, WidgetTemplate } from "@adminui/react/dashboard-builder";

// ---------------------------------------------------------------- monthly business numbers

export const MONTHS = ["5 月", "6 月", "7 月", "8 月", "9 月", "10 月"] as const;
/** New contract bookings per month, 万元; October is still running. */
export const BOOKINGS = [182, 191, 203, 214, 226, 58] as const;
export const BOOKINGS_TARGET = [180, 190, 200, 215, 230, 240] as const;
/** Monthly recurring revenue at month end, 万元 (a level, not a sum). */
export const MRR_TREND = [171, 183, 196, 208, 214, 226] as const;
/** New paying customers per month. */
export const NEW_CUSTOMERS = [41, 46, 52, 49, 57, 15] as const;
/** Customer churn rate per month (0..1). */
export const CHURN = [0.021, 0.019, 0.018, 0.02, 0.016, 0.015] as const;

export const PLANS = ["基础版", "专业版", "企业版"] as const;
/** Paid seats per plan per month (stacked bars). */
export const SEATS_BY_PLAN: Record<(typeof PLANS)[number], readonly number[]> = {
  基础版: [820, 860, 905, 930, 968, 980],
  专业版: [1240, 1310, 1402, 1490, 1575, 1602],
  企业版: [960, 1010, 1080, 1166, 1230, 1251],
};

/** Where this month's new customers came from. */
export const CHANNELS = [
  { name: "官网注册", value: 23 },
  { name: "渠道伙伴", value: 14 },
  { name: "转介绍", value: 9 },
  { name: "展会", value: 6 },
  { name: "广告投放", value: 3 },
  { name: "其他", value: 2 },
] as const;

/** New MRR per account manager this month, 万元 (ranking). */
export const REP_RANKING = [
  { name: "陈一鸣", value: 18.6 },
  { name: "王佳宁", value: 15.2 },
  { name: "赵思远", value: 12.9 },
  { name: "周可欣", value: 9.4 },
] as const;

/** Daily active users over the last 4 weeks (time series; the last day is still running). */
export const DAU_POINTS: [number, number][] = [
  3120, 3260, 3305, 3280, 3190, 1980, 1850, 3240, 3390, 3410, 3375, 3302, 2050, 1910, 3380, 3460, 3512, 3488, 3420, 2110, 1990, 3501, 3590, 3622, 3605, 3540, 2160, 1720,
].map((v, i) => [Date.UTC(2026, 8, 11 + i), v]);

/** Trial funnel of September sign-ups, read at day 30. */
export const TRIAL_FUNNEL = [
  { key: "t0", label: "注册试用", count: 1260 },
  { key: "t1", label: "完成引导", count: 918, delta: computeDelta(0.729, 0.702, { mode: "points" }) },
  { key: "t2", label: "邀请同事", count: 402, delta: computeDelta(0.438, 0.455, { mode: "points" }) },
  { key: "t3", label: "创建第一个项目", count: 337, delta: computeDelta(0.838, 0.81, { mode: "points" }) },
  { key: "t4", label: "转为付费", count: 126, delta: computeDelta(0.374, 0.351, { mode: "points" }) },
];

/** Share of each paid cohort's seats still active N months later (null = the cohort has not reached that age yet). */
export const RETENTION = [
  { key: "2605", label: "5 月", size: "41 家", values: [0.84, 0.72, 0.66, 0.61] },
  { key: "2606", label: "6 月", size: "46 家", values: [0.86, 0.75, 0.69, 0.64] },
  { key: "2607", label: "7 月", size: "52 家", values: [0.83, 0.71, 0.65, null] },
  { key: "2608", label: "8 月", size: "49 家", values: [0.88, 0.78, null, null] },
  { key: "2609", label: "9 月", size: "57 家", values: [0.9, null, null, null] },
];
export const RETENTION_PERIODS = ["1 个月", "2 个月", "3 个月", "4 个月"] as const;

// ---------------------------------------------------------------- dashboard filters

export const TIME_OPTIONS: FilterOption[] = [
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "quarter", label: "本季度" },
  { value: "custom", label: "自定义" },
];
export const COMPARE_OPTIONS: FilterOption[] = [
  { value: "mom", label: "比上月同期", description: "10-01 ~ 10-08 比 9-01 ~ 9-08，同样天数" },
  { value: "yoy", label: "比去年同期", description: "相差 364 天，星期对得上" },
  { value: "target", label: "比目标", description: "和这一期的目标比；周期没结束时看时间进度" },
];
export const DIMENSIONS: DashboardDimension[] = [
  { key: "region", label: "区域", options: [{ value: "east", label: "华东" }, { value: "south", label: "华南" }, { value: "west", label: "西南" }] },
  { key: "plan", label: "套餐", options: PLANS.map((p) => ({ value: p, label: p })) },
  { key: "owner", label: "负责人", allLabel: "全部 4 人", options: REP_RANKING.map((r) => ({ value: r.name, label: r.name })) },
];
export const DEFAULT_FILTERS: DashboardFilterValue = { time: "month", compare: "mom", dims: {} };

// ---------------------------------------------------------------- dashboard builder

export const BUILDER_SOURCES: DashboardDataSource[] = [
  { id: "subscriptions", label: "订阅", group: "业务数据", count: 1842, groupBy: [{ value: "plan", label: "套餐" }, { value: "region", label: "区域" }] },
  { id: "customers", label: "客户", group: "业务数据", count: 1206, groupBy: [{ value: "channel", label: "来源渠道" }, { value: "owner", label: "负责人" }] },
  { id: "usage", label: "产品使用", group: "埋点数据", count: 98_412 },
  { id: "invoices", label: "发票", group: "财务数据", disabledReason: "财务模块接入后可用" },
];
export const BUILDER_METRICS: DashboardMetricDef[] = [
  { key: "mrr", name: "MRR", version: 2, unit: "万元", formula: "当月有效订阅的月费合计（年付按 12 个月摊）" },
  { key: "bookings", name: "新签合同额", version: 1, unit: "万元", formula: "本期签约的合同金额合计（含税）" },
  { key: "newCustomers", name: "新增付费客户", version: 1, unit: "家", formula: "本期首次付费的客户数" },
  { key: "seats", name: "付费席位", version: 1, unit: "个", formula: "期末有效订阅的席位数" },
  { key: "churn", name: "客户流失率", version: 1, unit: "%", formula: "本期流失客户 ÷ 期初付费客户" },
  { key: "dau", name: "日活用户", version: 1, unit: "人", formula: "当天至少打开一次产品的去重用户" },
];
const std = (key: string): WidgetMetric => ({ kind: "standard", key, version: key === "mrr" ? 2 : 1 });
const GROUP = "标准组件 · 口径来自指标字典";
export const BUILDER_TEMPLATES: WidgetTemplate[] = [
  { id: "t-numbers", label: "本月关键数字", kind: "group", group: GROUP, keywords: "数字组", widget: { items: [{ id: "n1", title: "MRR", query: { metric: std("mrr") } }, { id: "n2", title: "新增付费客户", query: { metric: std("newCustomers") } }, { id: "n3", title: "付费席位", query: { metric: std("seats") } }, { id: "n4", title: "客户流失率", query: { metric: std("churn") } }] } },
  { id: "t-bookings", label: "每月新签合同额 vs 目标", kind: "targetBar", group: GROUP, widget: { target: 240, query: { source: "subscriptions", metric: std("bookings"), granularity: "month" } } },
  { id: "t-channel", label: "新客户从哪来", kind: "donut", group: GROUP, widget: { query: { source: "customers", metric: std("newCustomers"), groupBy: "channel" } } },
  { id: "t-rank", label: "谁本月新增 MRR 最多", kind: "hbar", group: GROUP, widget: { query: { source: "customers", metric: std("mrr"), groupBy: "owner" } } },
  { id: "t-dau", label: "日活趋势", kind: "line", group: GROUP, widget: { query: { source: "usage", metric: std("dau"), granularity: "day" } } },
  { id: "t-funnel", label: "试用卡在哪一步", kind: "funnel", group: GROUP, widget: { query: { source: "usage", metric: std("newCustomers") } } },
];

const INITIAL_WIDGETS: DashboardWidget[] = [
  { id: "w1", kind: "group", title: "本月关键数字", layout: { x: 0, y: 0, w: 6, h: 5 }, items: BUILDER_TEMPLATES[0]?.widget?.items },
  { id: "w2", kind: "targetBar", title: "每月新签合同额 vs 目标", layout: { x: 0, y: 5, w: 3, h: 8 }, target: 240, caption: "10 月进行中", query: { source: "subscriptions", metric: std("bookings"), granularity: "month" } },
  { id: "w3", kind: "donut", title: "新客户从哪来", layout: { x: 3, y: 5, w: 3, h: 8 }, query: { source: "customers", metric: std("newCustomers"), groupBy: "channel" } },
  { id: "w4", kind: "funnel", title: "试用卡在哪一步", layout: { x: 0, y: 13, w: 3, h: 8 }, query: { source: "usage", metric: std("newCustomers") } },
  { id: "w5", kind: "hbar", title: "谁本月新增 MRR 最多", layout: { x: 3, y: 13, w: 3, h: 8 }, query: { source: "customers", metric: { kind: "custom", name: "新增 MRR", formula: "本月新签 + 增购的月费，不含续费" }, groupBy: "owner" } },
];
export const INITIAL_DASHBOARD: DashboardSchema = { version: 2, id: "sales-monthly", title: "销售月度看板", filters: DEFAULT_FILTERS, widgets: INITIAL_WIDGETS };

function kpiOf(metric: WidgetMetric | undefined): Extract<DashboardWidgetData, { kind: "kpi" }>["card"] {
  const key = metric?.kind === "standard" ? metric.key : "";
  if (key === "newCustomers") return { value: "57", unit: "家", delta: computeDelta(57, 49), comparison: "比上月" };
  if (key === "seats") return { value: "3,833", unit: "个", delta: computeDelta(3833, 3586), comparison: "比上月" };
  if (key === "churn") return { value: "1.6", unit: "%", delta: computeDelta(0.016, 0.02, { mode: "points", better: "down" }), comparison: "比上月" };
  return { value: "226", unit: "万元", delta: computeDelta(226, 214), comparison: "比上月" };
}

/** Stand-in for the server: aggregates inside the viewer's permission scope and returns widget data. */
export async function loadWidgetData(widget: DashboardWidget, _context: DashboardFilterValue, signal: AbortSignal): Promise<DashboardWidgetData> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (signal.aborted) throw new Error("已取消");
  const metric = widget.query?.metric;
  switch (widget.kind) {
    case "group":
      return { kind: "group", items: (widget.items ?? []).map((item) => ({ id: item.id, card: kpiOf(item.query?.metric) })) };
    case "kpi":
      return { kind: "kpi", card: kpiOf(metric) };
    case "bar":
    case "targetBar":
      return { kind: "bar", bars: { categories: [...MONTHS], values: [...BOOKINGS], targets: widget.kind === "targetBar" ? MONTHS.map(() => widget.target ?? null) : undefined, inProgress: true, name: "新签合同额", unit: "万元" } };
    case "hbar":
      return { kind: "bar", bars: { categories: REP_RANKING.map((r) => r.name), values: REP_RANKING.map((r) => r.value), name: "新增 MRR", unit: "万元" } };
    case "donut":
      return { kind: "donut", items: CHANNELS.map((c) => ({ ...c })), unit: "家", centerLabel: "新客户" };
    case "stacked":
      return { kind: "stacked", categories: [...MONTHS], series: PLANS.map((p) => ({ name: p, values: SEATS_BY_PLAN[p] })), unit: "个" };
    case "line":
      return { kind: "line", unit: "人", expectedIntervalMs: 86_400_000, inProgress: true, series: [{ id: "dau", name: "日活用户", points: DAU_POINTS }] };
    case "funnel":
      return { kind: "funnel", funnel: { steps: TRIAL_FUNNEL } };
    case "cohort":
      return { kind: "cohort", cohort: { periods: [...RETENTION_PERIODS], rows: RETENTION } };
    case "bullet":
      return { kind: "bullet", value: "226", unit: "万元", detail: "目标 240 万元", bullet: { value: 226, target: widget.target ?? 240, timeProgress: 0.26 } };
    case "rollup":
      return { kind: "rollup", card: { title: "华东区", value: "96", unit: "万元", targetText: "/ 目标 100 万元", bullet: { value: 96, target: 100, timeProgress: 0.26 } } };
    default:
      return { kind: "empty" };
  }
}
