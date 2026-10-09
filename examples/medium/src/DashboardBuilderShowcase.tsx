import { useState } from "react";
import { DashboardFilterBar, PageBody, PageHeader, computeDelta, useNotify, vizOptionColor, type DashboardDimension, type DashboardFilterValue, type FilterOption } from "@adminui/react";
import {
  DashboardBuilder,
  migrateDashboardSpec,
  type DashboardDataSource,
  type DashboardMetricDef,
  type DashboardSchema,
  type DashboardTargetDef,
  type DashboardTableRow,
  type DashboardWidget,
  type DashboardWidgetData,
  type WidgetMetric,
  type WidgetTemplate,
} from "@adminui/react/dashboard-builder";
import type { GridField } from "@adminui/react/grid";

/*
 * 看板搭建示例（样稿 D32；T17 看板搭建器模板 TemplateBuilder 也用 WeeklyDashboardBuilder）。
 * 看板分类卡（DASHBOARDS.md §0）：业务类型 销售跟进（§2.12 通用硬规则）· 用途 经营复盘（周会）· 受众 组长
 * 北极星 按时有效跟进率；一级 KPI 有效跟进、按时有效跟进率、上门次数（自定义口径）· 对比 上周同一天 · 时区 Asia/Shanghai
 * 指标字典、数据源、聚合查询都在宿主服务端；这里的 loadWidgetData 在浏览器里造数据。
 * SAVED_V1 故意是 7.16 以前存的版本 1（行高 64px）：读出来先用 migrateDashboardSpec 换成 28px 行，大小不变（8.0 起搭建器只认版本 2）。
 */

const TIMES: FilterOption[] = [
  { value: "today", label: "今天" },
  { value: "10d", label: "近 10 个工作日" },
  { value: "month", label: "本月" },
];
const COMPARES: FilterOption[] = [
  { value: "wow", label: "上周同一天", description: "和上周同一天同时段比，遇假日自动改比上一个工作日" },
  { value: "prev", label: "上一期", description: "和前一个同样长的周期比" },
  { value: "target", label: "目标", description: "和这一期的目标比" },
];
const DIMENSIONS: DashboardDimension[] = [
  { key: "team", label: "组", options: [{ value: "g1", label: "一组" }, { value: "g2", label: "二组" }] },
  { key: "person", label: "人", allLabel: "全部 5 人", options: ["阿杰", "美华", "小王", "小李", "小陈"].map((n) => ({ value: n, label: n })) },
  { key: "source", label: "来源", options: [{ value: "web", label: "官网" }, { value: "ref", label: "转介绍" }, { value: "fair", label: "展会" }] },
];
const DEFAULT_FILTERS: DashboardFilterValue = { time: "10d", compare: "wow", dims: { team: "g1" } };

type FollowUp = { way: string; owner: string; stage: string };
const FOLLOW_FIELDS: GridField<FollowUp>[] = [
  { key: "way", title: "方式", type: "singleSelect", options: [{ value: "visit", label: "上门" }, { value: "phone", label: "电话" }, { value: "line", label: "微信" }, { value: "other", label: "其他" }] },
  { key: "owner", title: "负责人", type: "user" },
  { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "s1", label: "首通" }, { value: "s2", label: "二通", tone: "blue" }, { value: "s3", label: "报价", tone: "yellow" }] },
];
const GROUPS: FilterOption[] = [
  { value: "owner", label: "负责人" },
  { value: "way", label: "跟进方式" },
  { value: "stage", label: "阶段" },
];
const SOURCES: DashboardDataSource[] = [
  { id: "customers", label: "客户", group: "多维表格", count: 1284, groupBy: GROUPS, fields: FOLLOW_FIELDS },
  { id: "followups", label: "跟进记录", group: "多维表格", count: 9610, groupBy: GROUPS, fields: FOLLOW_FIELDS },
  { id: "deals", label: "商机", group: "多维表格", count: 412 },
  { id: "installs", label: "安装工单", group: "多维表格", count: 356 },
  { id: "follow", label: "跟进", group: "平台数据", groupBy: GROUPS, fields: FOLLOW_FIELDS },
  { id: "calls", label: "通话", group: "平台数据" },
  { id: "assign", label: "分配", group: "平台数据" },
  { id: "payments", label: "收款", group: "平台数据", disabledReason: "财务模块上线后可用" },
];
const METRICS: DashboardMetricDef[] = [
  { key: "valid", name: "有效跟进数", version: 1, unit: "条", formula: "有定位或照片、时长 ≥ 1 分钟的跟进" },
  { key: "ontime", name: "按时有效跟进率", version: 1, unit: "%", formula: "到期计划里按时有效跟进的 ÷ 到期计划数" },
  { key: "firstResp", name: "新客户首次响应（中位）", version: 2, unit: "分钟", formula: "分配到首次有效跟进的分钟数，中位数" },
  { key: "deals", name: "成交客户数", version: 1, unit: "位" },
  { key: "amount", name: "成交金额", version: 1, unit: "元", formula: "本期签约的合同金额合计（含税）" },
  { key: "respMedian", name: "首次响应时长（中位）", version: 1, unit: "duration", formula: "分配时间到首次跟进时间的间隔，中位数（值是秒，卡上写小时 / 天）" },
];
// 表上设的目标（宿主保存）：目标类组件可以选它们，搭建器只存 targetRef，取数时宿主按本期算实际值和目标值
const TARGETS: DashboardTargetDef[] = [
  { id: "monthly-amount", name: "每月成交金额", period: "month", unit: "元" },
  { id: "weekly-valid", name: "每周有效跟进", period: "week", unit: "条" },
];
const TARGET_VALUES: Record<string, number> = { "monthly-amount": 3_000_000, "weekly-valid": 300 };
/** The current calendar month as a target period (first and last day). */
function thisMonth(): { start: string; end: string; label: string } {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { start: `${ym}-01`, end: `${ym}-${pad(last)}`, label: "本月" };
}
const TEMPLATES: WidgetTemplate[] = [
  { id: "t-ontime", label: "按时有效跟进率", kind: "kpi", group: "标准组件 · 口径来自指标字典", widget: { title: "按时有效跟进率 · 今天", query: { source: "follow", metric: { kind: "standard", key: "ontime", version: 1 } } } },
  { id: "t-people", label: "每个人今天的情况", kind: "table", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, groupBy: "owner" } } },
  { id: "t-first", label: "新客户首次响应", kind: "kpi", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "assign", metric: { kind: "standard", key: "firstResp", version: 2 } } } },
  { id: "t-amount", label: "本月成交金额", kind: "kpi", group: "标准组件 · 口径来自指标字典", widget: { title: "本月成交金额", query: { source: "deals", metric: { kind: "standard", key: "amount", version: 1 } } } },
  { id: "t-funnel", label: "客户卡在哪一步", kind: "funnel", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "customers", metric: { kind: "standard", key: "deals", version: 1 } } } },
  { id: "t-cohort", label: "每批进线最后成交多少", kind: "cohort", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "customers", metric: { kind: "standard", key: "deals", version: 1 } } } },
  { id: "t-rhythm", label: "今天的节奏", kind: "targetBar", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, granularity: "hour" } } },
  // 审阅 06 新组件
  { id: "t-group", label: "本周关键数字", kind: "group", group: "标准组件 · 口径来自指标字典", keywords: "数字组", widget: { items: [{ id: "n1", title: "有效跟进", query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 } } }, { id: "n2", title: "按时有效跟进率", query: { source: "follow", metric: { kind: "standard", key: "ontime", version: 1 } } }, { id: "n3", title: "首次响应", query: { source: "assign", metric: { kind: "standard", key: "firstResp", version: 2 } } }, { id: "n4", title: "本月成交金额", query: { source: "deals", metric: { kind: "standard", key: "amount", version: 1 } } }] } },
  { id: "t-way", label: "跟进方式分布", kind: "donut", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, groupBy: "way" } } },
  { id: "t-rank", label: "谁本周有效跟进最多", kind: "hbar", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, groupBy: "owner" } } },
  { id: "t-stack", label: "各阶段客户数（按负责人）", kind: "stacked", group: "标准组件 · 口径来自指标字典", widget: { query: { source: "customers", metric: { kind: "standard", key: "deals", version: 1 }, groupBy: "stage", stackBy: "owner" } } },
  { id: "t-target", label: "每周有效跟进 vs 目标", kind: "targetBar", group: "标准组件 · 口径来自指标字典", widget: { target: 300, query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, granularity: "week" } } },
  { id: "t-goal", label: "本月成交金额 · 目标进度", kind: "targetProgress", group: "标准组件 · 口径来自指标字典", keywords: "目标 完成率", widget: { title: "本月成交金额", targetRef: "monthly-amount", query: { source: "deals", metric: { kind: "standard", key: "amount", version: 1 } } } },
  { id: "t-resp", label: "首次响应时长（中位）", kind: "kpi", group: "标准组件 · 口径来自指标字典", keywords: "时长 duration", widget: { query: { source: "assign", metric: { kind: "standard", key: "respMedian", version: 1 } } } },
  { id: "t-bullet", label: "按时有效跟进率 vs 目标", kind: "bullet", group: "标准组件 · 口径来自指标字典", widget: { target: 80, query: { source: "follow", metric: { kind: "standard", key: "ontime", version: 1 } } } },
  { id: "v-all", label: "客户 · 全部客户", kind: "table", group: "多维表格视图", widget: { query: { source: "customers" } } },
  { id: "v-stage", label: "客户 · 阶段看板", kind: "table", group: "多维表格视图", widget: { query: { source: "customers", groupBy: "stage" } } },
  { id: "v-week", label: "跟进记录 · 本周", kind: "table", group: "多维表格视图", widget: { query: { source: "followups" } } },
];

// 存档是版本 1：读出来先过 migrateDashboardSpec（8.0 起搭建器只认版本 2）。
const SAVED_V1: Omit<DashboardSchema, "version"> & { version: number } = {
  version: 1,
  id: "team1-weekly",
  title: "一组周会看板",
  filters: DEFAULT_FILTERS,
  widgets: [
    { id: "w1", kind: "kpi", title: "有效跟进 · 今天", layout: { x: 0, y: 0, w: 2, h: 2 }, query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 } } },
    { id: "w2", kind: "kpi", title: "按时有效跟进率 · 今天", layout: { x: 2, y: 0, w: 2, h: 2 }, query: { source: "follow", metric: { kind: "standard", key: "ontime", version: 1 } } },
    { id: "w3", kind: "kpi", title: "上门次数", layout: { x: 4, y: 0, w: 2, h: 2 }, query: { source: "follow", metric: { kind: "custom", name: "上门次数", formula: "跟进方式 = 上门（不看有没有定位 / 照片）" }, compare: "prev" } },
    { id: "w4", kind: "bar", title: "每天有效跟进", layout: { x: 0, y: 2, w: 4, h: 4 }, caption: "9-25 中秋放假不画；今天还在进行中", query: { source: "follow", metric: { kind: "standard", key: "valid", version: 1 }, granularity: "day", filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "way", op: "noneOf", value: ["other"] }] } } },
    { id: "w5", kind: "funnel", title: "本月客户推进 · 一组", layout: { x: 4, y: 2, w: 2, h: 4 }, query: { source: "customers", metric: { kind: "standard", key: "deals", version: 1 } } },
    { id: "w6", kind: "table", title: "逾期客户", layout: { x: 0, y: 6, w: 6, h: 3 }, query: { source: "customers" } },
  ],
};
const INITIAL: DashboardSchema = migrateDashboardSpec(SAVED_V1);

const scale = (ctx: DashboardFilterValue) => (ctx.time === "today" ? 1 : ctx.time === "month" ? 2.4 : 1.6) * (ctx.dims.team === "g2" ? 0.8 : 1);
const OVERDUE_FIELDS: GridField<DashboardTableRow>[] = [
  { key: "name", title: "客户", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: FOLLOW_FIELDS[2]?.options },
  { key: "owner", title: "负责人", type: "text" },
  { key: "last", title: "最后有效跟进", type: "text" },
  { key: "days", title: "没跟进", type: "text" },
];

/** One number of a KPI card or a 「数字组」. */
function kpiCard(metric: WidgetMetric | undefined, n: (v: number) => number): Extract<DashboardWidgetData, { kind: "kpi" }>["card"] {
  if (metric?.kind === "standard" && metric.key === "ontime") return { value: "65", unit: "%", delta: computeDelta(0.65, 0.71, { mode: "points" }), comparison: "比 9-21 同时段" };
  if (metric?.kind === "custom") return { value: String(n(14)), unit: "次", delta: computeDelta(n(14), n(11), { mode: "absolute" }), comparison: "近 10 个工作日 · 比前 10 个" };
  // 大数字（审阅 06：窄组件里只剩「1.」）：放不下先缩字号，再换成 万 / 亿
  if (metric?.kind === "standard" && metric.key === "amount") return { value: n(1_594_200).toLocaleString("en-US"), unit: "元", delta: computeDelta(n(1_594_200), n(1_402_000)), comparison: "比上月同期" };
  // 时长指标：值是秒，unit "duration" → 「3.2 小时」/「1.5 天」
  if (metric?.kind === "standard" && metric.key === "respMedian") return { value: n(11_520), unit: "duration", delta: computeDelta(n(11_520), n(14_400), { better: "down" }), comparison: "比上周" };
  if (metric?.kind === "standard" && metric.key === "firstResp") return { value: "18", unit: "分钟", delta: computeDelta(18, 22, { better: "down" }), comparison: "比上周" };
  return { value: String(n(40)), unit: "条", delta: computeDelta(n(40), n(36), { mode: "absolute" }), comparison: "比 9-21 同时段" };
}

const WAYS = ["上门", "电话", "微信", "其他"];
const WAY_COLORS = [vizOptionColor("green"), vizOptionColor("blue"), vizOptionColor("teal"), vizOptionColor("gray")];
const PEOPLE = ["阿杰", "美华", "小王", "小李", "小陈"];

/** Stand-in for the host's server aggregation (respecting the viewer's scope there). */
async function loadWidgetData(widget: DashboardWidget, ctx: DashboardFilterValue, signal: AbortSignal): Promise<DashboardWidgetData> {
  await new Promise((r) => setTimeout(r, 250));
  if (signal.aborted) throw new Error("已取消");
  const k = scale(ctx);
  const n = (v: number) => Math.round(v * k);
  const metric = widget.query?.metric;
  switch (widget.kind) {
    case "group":
      return { kind: "group", items: (widget.items ?? []).map((item) => ({ id: item.id, card: kpiCard(item.query?.metric ?? metric, n) })) };
    case "targetProgress": {
      // targetRef 优先（表上的目标，按本期算），否则用组件里写的常数目标
      const target = widget.targetRef ? TARGET_VALUES[widget.targetRef] ?? null : widget.target ?? null;
      return { kind: "targetProgress", value: n(1_594_200), target, period: thisMonth(), targetNote: widget.targetRef ? "全公司目标" : "组件里设的目标", currency: "CNY" };
    }
    case "donut":
      return { kind: "bar", bars: { categories: WAYS, values: [14, 38, 22, 4].map(n), name: "有效跟进", unit: "条" }, colors: WAY_COLORS };
    case "hbar":
      return { kind: "bar", bars: { categories: PEOPLE, values: [52, 47, 41, 33, 28].map(n), name: "有效跟进", unit: "条" } };
    case "stacked":
      return { kind: "stacked", categories: ["首次接触", "需求确认", "报价", "成交"], series: PEOPLE.slice(0, 3).map((name, i) => ({ name, values: [12 - i * 2, 8 - i, 5 - i, 2].map(n) })), unit: "位" };
    case "kpi":
      return { kind: "kpi", card: kpiCard(metric, n) };
    case "bullet":
      return { kind: "bullet", value: "65", unit: "%", detail: "32 / 49 个到期计划", bullet: { value: 65, target: widget.target ?? null, max: 100, timeProgress: 0.6, format: (v) => `${v}%` } };
    case "line":
      return { kind: "line", unit: "条", expectedIntervalMs: 86_400_000, inProgress: true, series: [{ id: "valid", name: "有效跟进", points: [61, 57, 63, 55, 59, 62, 54, 60, 40].map((v, i) => [Date.UTC(2026, 8, 21 + i), n(v)] as [number, number]) }] };
    case "bar":
    case "targetBar":
      if (widget.kind === "targetBar" && widget.query?.granularity === "week")
        return { kind: "bar", bars: { categories: ["第 37 周", "第 38 周", "第 39 周", "第 40 周"], values: [281, 312, 296, 204].map(n), targets: Array(4).fill(widget.target ?? null), inProgress: true, unit: "条", name: "有效跟进" } };
      return { kind: "bar", bars: { categories: ["9-21", "9-22", "9-23", "9-24", "9-29", "9-30", "10-01", "10-02", "10-05"], values: [61, 57, 63, 55, 59, 62, 54, 60, 40].map(n), targets: widget.kind === "targetBar" ? Array(9).fill(widget.target ?? n(60)) : undefined, inProgress: true, unit: "条", name: "有效跟进" } };
    case "funnel":
      return { kind: "funnel", funnel: { steps: [{ key: "s1", label: "首次接触", count: n(41) }, { key: "s2", label: "需求确认", count: n(26) }, { key: "s3", label: "报价", count: n(14) }, { key: "s4", label: "成交", count: n(4) }], footer: "右边是这一步 ÷ 上一步" } };
    case "cohort":
      return { kind: "cohort", cohort: { periods: ["7 天", "30 天", "60 天"], rows: [{ key: "7", label: "7 月", size: "298 位", values: [0.04, 0.11, 0.15] }, { key: "8", label: "8 月", size: "312 位", values: [0.05, 0.13, null] }, { key: "9", label: "9 月", size: "276 位", values: [0.06, null, null] }] } };
    case "rollup":
      return { kind: "rollup", card: { title: "一组", value: String(n(204)), unit: "条", targetText: "/ 目标 300 条", bullet: { value: n(204), target: 300, timeProgress: 0.6 }, metrics: [{ key: "a", label: "按时率", value: "65", unit: "%" }, { key: "b", label: "上门", value: String(n(14)), unit: "次" }] } };
    case "table":
      if (widget.query?.groupBy === "owner")
        return { kind: "table", rowKey: "name", fields: [{ key: "name", title: "人", type: "text", primary: true }, { key: "valid", title: "有效跟进", type: "number" }, { key: "rate", title: "按时率", type: "text" }], rows: ["阿杰", "美华", "小王", "小李", "小陈"].map((name, i) => ({ name, valid: n(12 - i), rate: `${78 - i * 5}%` })) };
      return { kind: "table", rowKey: "name", fields: OVERDUE_FIELDS, rows: [{ name: "何俊贤", stage: "s2", owner: "阿杰", last: "09-26", days: "9 天" }, { name: "刘建宏", stage: "s3", owner: "阿杰", last: "09-28", days: "7 天" }, { name: "陈雅婷", stage: "s2", owner: "小王", last: "09-29", days: "6 天" }] };
    default:
      return { kind: "empty" };
  }
}

/** The 一组周会看板 builder (filters, sources, metric dictionary, demo data); the showcase and template T17 both use it. */
export function WeeklyDashboardBuilder({ height }: { height: number | string }) {
  const notify = useNotify();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  return (
    <DashboardBuilder
      value={INITIAL}
      filterContext={filters}
      filterBar={<DashboardFilterBar value={filters} onChange={setFilters} defaultValue={DEFAULT_FILTERS} timeOptions={TIMES} compareOptions={COMPARES} dimensions={DIMENSIONS} />}
      dimensions={DIMENSIONS}
      loadWidgetData={loadWidgetData}
      sources={SOURCES}
      metrics={METRICS}
      targets={TARGETS}
      compareOptions={COMPARES}
      templates={TEMPLATES}
      scopeLabel="我的看板"
      scope="personal"
      permissionNote="你只能看到你有权限的数据：一组 5 人"
      onSave={async () => {
        await new Promise((r) => setTimeout(r, 300));
        notify("看板已保存", "success");
      }}
      onSaveAsMine={async () => {
        await new Promise((r) => setTimeout(r, 300));
        notify("已另存为我的看板", "success");
      }}
      onCancel={() => notify("已放弃没保存的改动", "info")}
      height={height}
    />
  );
}

export function DashboardBuilderShowcase() {
  return (
    <>
      <PageHeader title="看板搭建" description="从左边拖组件到 6 列画布（行高 28px），拖动 / 改大小 / 键盘调整；选中一张卡右边才出设置：数据源、标准或自定义指标、分组、对比、目标值、数字组；样式里换图表类型。样稿 D32 + 审阅 06。" />
      <PageBody>
        <WeeklyDashboardBuilder height="calc(100vh - 150px)" />
      </PageBody>
    </>
  );
}
