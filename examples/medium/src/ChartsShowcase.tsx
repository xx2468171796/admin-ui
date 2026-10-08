import { useMemo, useState, type CSSProperties } from "react";
import {
  ChartState,
  DashboardFilterBar,
  DashboardSection,
  DeltaBadge,
  KpiCard,
  PageBody,
  PageHeader,
  Panel,
  ReportToolbar,
  SegmentedControl,
  chartColors,
  computeDelta,
  useAdminTheme,
  useNotify,
  vizOptionColor,
  type ChartStateKind,
  type DashboardDimension,
  type DashboardFilterValue,
  type FilterOption,
  type ReportFilter,
} from "@adminui/react";
import { AdminChart, barOption, donutOption, stackedBarOption, targetBarOption, timeSeriesOption } from "@adminui/react/charts";
import { DashboardTabs, ViewTabs, type ScopeTab, type ViewSummary } from "@adminui/react/views";

/*
 * 图表与仪表盘（组件库审阅 06）：色板从色卡算（类别 = 选项标签色，单系列 = 主色）、10 种图表的统一样子、
 * 7 种等高状态、数字卡 3 档 + 变化值标签、仪表盘标签带范围图标、不套卡的筛选行、选了就查的报表工具条。
 * 分类卡（DASHBOARDS.md §0）：业务类型 销售跟进 · 用途 经营复盘 · 受众 销售经理；数据是演示数。
 */

const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "stretch" };
const STATES: { value: ChartStateKind | "ready"; label: string }[] = [
  { value: "ready", label: "有数据" },
  { value: "loading", label: "加载中" },
  { value: "empty", label: "没有数据" },
  { value: "no-match", label: "筛选无结果" },
  { value: "error", label: "加载失败" },
  { value: "stale", label: "刷新失败（旧数据）" },
  { value: "forbidden", label: "无权限" },
];
const VIEWS: ViewSummary[] = [
  { id: "all", name: "全部客户", kind: "grid", tier: "standard" },
  { id: "pool", name: "公海", kind: "grid", tier: "standard" },
  { id: "mine", name: "我跟进中的", kind: "grid", tier: "mine" },
];
const TABS: ScopeTab[] = [
  { id: "overview", label: "经营看板", scope: "company" },
  { id: "today", label: "我的今天", scope: "company" },
  { id: "weekly", label: "我的周报", scope: "personal" },
];
const TIMES: FilterOption[] = [
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "year", label: "今年" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自定义" },
];
const COMPARES: FilterOption[] = [
  { value: "mom", label: "比上月同期", description: "10-01 ~ 10-07 比 9-01 ~ 9-07，同样天数" },
  { value: "none", label: "不对比", description: "只看这一段" },
];
const DIMS: DashboardDimension[] = [
  { key: "owner", label: "负责人", options: [{ value: "me", label: "我" }, { value: "wang", label: "小王" }, { value: "li", label: "小李" }] },
  { key: "stage", label: "阶段", options: [{ value: "s1", label: "首通" }, { value: "s2", label: "需求确认" }, { value: "s3", label: "报价" }] },
];
const DEFAULT_FILTERS: DashboardFilterValue = { time: "month", compare: "mom", dims: {} };
const REPORT_DEFAULT: ReportFilter = { start: "2026-10-01", end: "2026-10-07", source: "all" };

export function ChartsShowcase() {
  const notify = useNotify();
  const { palette, mode } = useAdminTheme();
  const colors = useMemo(() => chartColors(palette), [palette]);
  const [state, setState] = useState<ChartStateKind | "ready">("ready");
  const [view, setView] = useState("all");
  const [dashboard, setDashboard] = useState<string | null>("overview");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [report, setReport] = useState(REPORT_DEFAULT);
  const options = useMemo(
    () => ({
      status: barOption({ categories: ["待分配", "跟进中", "已成交", "无效"], values: [15, 117, 28, 8], name: "客户数", unit: "位" }),
      ranking: barOption({ categories: ["小王", "我", "小李", "阿杰"], values: [1_500_000, 1_090_000, 1_230_000, 860_000], name: "成交额", unit: "元", horizontal: true, highlight: 1 }),
      source: donutOption({ items: [{ name: "官网表单", value: 62 }, { name: "LINE", value: 48 }, { name: "转介绍", value: 31 }, { name: "展会", value: 17 }, { name: "电话", value: 6 }, { name: "其他渠道", value: 4 }], unit: "位", centerLabel: "新客户" }),
      stacked: stackedBarOption({ categories: ["首通", "需求确认", "报价", "谈判"], series: [{ name: "小王", values: [12, 8, 5, 3], color: vizOptionColor("blue") }, { name: "我", values: [8, 6, 4, 2], color: vizOptionColor("orange") }, { name: "小李", values: [5, 4, 2, 1], color: vizOptionColor("teal") }], unit: "位" }),
      target: targetBarOption({ categories: ["6 月", "7 月", "8 月", "9 月", "10 月"], values: [1080, 1165, 1020, 1248, 204], targets: [1100, 1100, 1200, 1200, 1200], inProgress: true, name: "实际", targetName: "目标", unit: "万", mode }),
      trend: timeSeriesOption({ series: [{ id: "in", name: "新进线", points: [64, 71, 69, 80, 77, 92, 58, 42].map((v, i) => [Date.UTC(2026, 7, 17 + i * 7), v] as [number, number]) }, { id: "won", name: "成交", points: [6, 8, 7, 9, 11, 12, 7, 3].map((v, i) => [Date.UTC(2026, 7, 17 + i * 7), v] as [number, number]) }], unit: " 位", expectedIntervalMs: 7 * 86_400_000, inProgress: true, mode }),
    }),
    [mode],
  );
  const stateProps = state === "ready" ? {} : state === "loading" ? { loading: true } : state === "empty" ? { empty: true } : state === "no-match" ? { noMatch: true, onClearFilters: () => setState("ready") } : state === "error" ? { error: "服务器没响应", onRetry: () => setState("ready") } : state === "stale" ? { stale: "刷新失败，显示的是 14:05 的数据", onRetry: () => setState("ready") } : { forbidden: true };
  return (
    <>
      <PageHeader title="图表与仪表盘" description="组件库审阅 06：颜色全从色卡来，类别用选项标签色、单系列用主色；10 种图表同一套样子；7 种状态和图一样高；数字卡 3 档；仪表盘标签带范围图标；筛选行不套卡、一行；报表选了就查。右上角换色卡 / 深色看颜色怎么跟。" />
      <PageBody>
        <DashboardSection title="仪表盘标签 · 筛选行 · 报表工具条" description="视图和仪表盘同一种标签；团队默认 = 楼，我的 = 人；筛选改过才出「重置」">
          <Panel flush>
            <ViewTabs
              views={VIEWS}
              activeId={dashboard ? "" : view}
              onSelect={(id) => { setDashboard(null); setView(id); }}
              trailing={
                <DashboardTabs
                  tabs={TABS}
                  activeId={dashboard}
                  onSelect={setDashboard}
                  tabMenu={(tab) => [{ items: [{ key: "copy", label: "复制成我的", onSelect: () => notify(`已复制「${tab.label}」`) }, { key: "rename", label: "改名…", disabled: tab.scope === "company", disabledReason: "团队默认仪表盘由表管理员维护", onSelect: () => undefined }] }]}
                  createSections={[{ items: [{ key: "mine", label: "新建我的仪表盘…", onSelect: () => notify("新建我的仪表盘") }, { key: "copy", label: "复制当前为我的", onSelect: () => notify("复制当前为我的") }, { key: "company", label: "新建公司仪表盘…", onSelect: () => notify("新建公司仪表盘（管理员）") }] }]}
                />
              }
            />
            <div style={{ padding: "10px 16px" }}>
              <DashboardFilterBar value={filters} onChange={setFilters} defaultValue={DEFAULT_FILTERS} timeOptions={TIMES} compareOptions={COMPARES} dimensions={DIMS} />
            </div>
          </Panel>
          <ReportToolbar
            value={report}
            defaultValue={REPORT_DEFAULT}
            sources={[{ value: "all", label: "全部来源" }, { value: "web", label: "官网表单" }, { value: "line", label: "LINE" }]}
            presets={[{ label: "近 7 天", start: "2026-10-01", end: "2026-10-07" }, { label: "本月", start: "2026-10-01", end: "2026-10-31" }, { label: "上月", start: "2026-09-01", end: "2026-09-30" }]}
            onApply={(next) => { setReport(next); notify(`已按 ${next.start} ~ ${next.end} 重新统计`); }}
            onReset={() => setReport(REPORT_DEFAULT)}
            freshness="数据截至 14:05"
          />
        </DashboardSection>

        <DashboardSection title="数字卡：3 档 + 变化值" description="大 28（北极星）/ 标准 24 / 紧凑 20；变化值和选项标签同形（圆角 6、无边框软底），颜色按好坏">
          <div style={grid}>
            <KpiCard size="lg" title="本月成交额" tag="北极星" value="382.0" unit="万元" delta={computeDelta(382, 340)} comparison="比上月同期" target={{ value: 382, target: 1200 }} timeProgress={0.23} />
            <KpiCard title="本月新客户" value="168" unit="位" delta={computeDelta(168, 179)} comparison="比上月同期" trend={[150, 162, 171, 166, 179, 168]} trendPlacement="inline" />
            <KpiCard size="sm" title="成交周期" value="34" unit="天 · 中位" delta={computeDelta(34, 38, { better: "down", mode: "absolute" })} comparison="比上月同期" trend={[41, 39, 38, 34]} />
          </div>
          <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DeltaBadge delta={computeDelta(0.65, 0.61, { mode: "points" })} comparison="比上周" />
            <DeltaBadge delta={computeDelta(22, 27, { better: "down", mode: "absolute" })} unit="分" comparison="首响中位" />
            <DeltaBadge delta={computeDelta(9, 31)} comparison="进线" />
            <DeltaBadge delta={computeDelta(12, 0)} comparison="新增" />
            <DeltaBadge delta={null} comparison="没有对比数据" />
          </p>
        </DashboardSection>

        <DashboardSection title="图表类型" description="柱（单系列主色）· 条形（排行，突出「我」）· 环（≤ 5 片 + 其他，中间写合计）· 堆叠（按选项标签色，提示带合计）· 实际 vs 目标 · 折线（进行中虚线）">
          <div style={grid}>
            <Panel title="客户状态分布" count="全部 · 位"><AdminChart option={options.status} label="客户状态分布" height={240} table={{ columns: ["状态", "客户数"], rows: [["待分配", 15], ["跟进中", 117], ["已成交", 28], ["无效", 8]] }} /></Panel>
            <Panel title="谁本月成交最多" count="万元"><AdminChart option={options.ranking} label="每人本月成交额" height={240} /></Panel>
            <Panel title="新客户从哪来" count="本月 · 位"><AdminChart option={options.source} label="新客户来源" height={240} /></Panel>
            <Panel title="各阶段客户数" count="按负责人堆叠 · 位"><AdminChart option={options.stacked} label="各阶段客户数按负责人" height={240} /></Panel>
            <Panel title="每月成交额 vs 目标" count="万元 · 10 月进行中"><AdminChart option={options.target} label="每月成交额和目标" height={240} /></Panel>
            <Panel title="每周新进线和成交" count="近 8 周 · 位 · 本周进行中"><AdminChart option={options.trend} label="每周新进线和成交" height={240} /></Panel>
          </div>
        </DashboardSection>

        <DashboardSection title="7 种状态（都和图一样高）" description="点按钮切换：下面的卡片不跳">
          <SegmentedControl size="sm" label="图表状态" value={state} options={STATES} onValueChange={setState} />
          <div style={grid}>
            <Panel title="各阶段客户数" count="跟进中 · 位"><AdminChart option={options.status} label="各阶段客户数" height={240} {...stateProps} /></Panel>
            <Panel title="同样的状态，单独用 ChartState" count="宿主自己画图时">{state === "ready" ? <ChartState kind="empty" height={240} message="这里演示的是没有数据" /> : state === "stale" ? <ChartState kind="stale" height={240} message="刷新失败，显示的是 14:05 的数据"><div style={{ height: 200, display: "grid", placeItems: "center" }}>旧图</div></ChartState> : <ChartState kind={state} height={240} onRetry={() => setState("ready")} onClearFilters={() => setState("ready")} />}</Panel>
          </div>
        </DashboardSection>

        <DashboardSection title="色板（跟着色卡和深浅走）" description="类别 = 选项标签 10 色里固定顺序的 8 个（蓝 橙 青 粉 橄榄 紫 黄 红），灰 = 其他，主色绿留给单系列；顺序色 = 面板色 → 主色 13 档">
          <div className="starter-viz-swatches" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} aria-label="类别色">
              {colors.categorical.map((c, i) => <span key={c + i} data-swatch={c} style={{ width: 44, height: 28, borderRadius: 6, background: c }} />)}
              <span data-swatch={colors.other} style={{ width: 44, height: 28, borderRadius: 6, background: colors.other }} />
              <span data-swatch={colors.brand} style={{ width: 44, height: 28, borderRadius: 6, background: colors.brand, outline: "2px solid var(--aui-line)" }} />
            </div>
            <div style={{ display: "flex", gap: 2 }} aria-label="顺序色">
              {colors.sequential.map((c, i) => <span key={i} style={{ flex: 1, height: 18, borderRadius: 4, background: c }} />)}
            </div>
          </div>
        </DashboardSection>
      </PageBody>
    </>
  );
}
