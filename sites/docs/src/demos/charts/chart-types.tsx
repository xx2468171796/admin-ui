import { useMemo, useState } from "react";
import { Panel, SegmentedControl, Sparkline, StepFunnel } from "@adminui/react";
import { AdminChart, barOption, donutOption, stackedBarOption, targetBarOption, timeSeriesOption, type EChartsOption } from "@adminui/react/charts";
import { BOOKINGS, BOOKINGS_TARGET, CHANNELS, DAU_POINTS, MONTHS, MRR_TREND, NEW_CUSTOMERS, PLANS, REP_RANKING, SEATS_BY_PLAN, TRIAL_FUNNEL } from "../../data/charts-data";

/** 10 种统一样子里的常用 9 种：切换看每种回答什么问题。 */
type Kind = "bar" | "hbar" | "line" | "area" | "donut" | "stacked" | "target" | "funnel" | "spark";
const KINDS: { value: Kind; label: string; title: string; sub: string }[] = [
  { value: "bar", label: "柱", title: "每月新增付费客户", sub: "比较几个类别 · 家" },
  { value: "hbar", label: "条形", title: "谁本月新增 MRR 最多", sub: "排行，突出一个人 · 万元" },
  { value: "line", label: "折线", title: "日活用户", sub: "近 4 周 · 人 · 今天进行中（虚线）" },
  { value: "area", label: "面积", title: "日活用户", sub: "单系列 8% 填充，不用渐变" },
  { value: "donut", label: "环", title: "新客户从哪来", sub: "占比 · ≤ 5 片 + 其他 · 家" },
  { value: "stacked", label: "堆叠", title: "各套餐付费席位", sub: "按第二个维度拆开 · 个" },
  { value: "target", label: "实际 vs 目标", title: "每月新签合同额", sub: "万元 · 横线 = 当月目标" },
  { value: "funnel", label: "漏斗", title: "9 月试用卡在哪一步", sub: "30 天读数 · 横条" },
  { value: "spark", label: "迷你趋势", title: "表格里的趋势", sub: "SVG，不开图表实例" },
];

function optionOf(kind: Kind): EChartsOption | null {
  if (kind === "bar") return barOption({ categories: [...MONTHS], values: [...NEW_CUSTOMERS], name: "新增付费客户", unit: "家" });
  if (kind === "hbar") return barOption({ categories: REP_RANKING.map((r) => r.name), values: REP_RANKING.map((r) => r.value), name: "新增 MRR", unit: "万元", digits: 1, horizontal: true, highlight: 1 });
  if (kind === "line" || kind === "area") return timeSeriesOption({ series: [{ id: "dau", name: "日活用户", points: DAU_POINTS }], unit: "人", expectedIntervalMs: 86_400_000, inProgress: true, area: kind === "area" });
  if (kind === "donut") return donutOption({ items: CHANNELS.map((c) => ({ ...c })), unit: "家", centerLabel: "新客户" });
  if (kind === "stacked") return stackedBarOption({ categories: [...MONTHS], series: PLANS.map((p) => ({ name: p, values: SEATS_BY_PLAN[p] })), unit: "个" });
  if (kind === "target") return targetBarOption({ categories: [...MONTHS], values: [...BOOKINGS], targets: [...BOOKINGS_TARGET], inProgress: true, name: "新签合同额", targetName: "目标", unit: "万元" });
  return null;
}

export function Demo() {
  const [kind, setKind] = useState<Kind>("bar");
  const meta = KINDS.find((k) => k.value === kind) ?? KINDS[0];
  const option = useMemo(() => optionOf(kind), [kind]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <SegmentedControl size="sm" label="图表类型" value={kind} options={KINDS} onValueChange={setKind} />
      </div>
      <Panel title={meta?.title} count={meta?.sub}>
        {option ? (
          <AdminChart key={kind} option={option} label={meta?.title ?? ""} height={260} />
        ) : kind === "funnel" ? (
          <StepFunnel steps={TRIAL_FUNNEL} label="9 月试用卡在哪一步" comparison="比 8 月同天龄" firstNote="9 月注册的试用" />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { name: "MRR", values: [...MRR_TREND] },
              { name: "新增付费客户", values: [...NEW_CUSTOMERS.slice(0, 5)] },
              { name: "日活用户", values: DAU_POINTS.slice(-14).map(([, v]) => v) },
            ].map((row) => (
              <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: 120 }}>{row.name}</span>
                <Sparkline values={row.values} width={120} height={24} label={`${row.name}趋势`} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
