import { lazy, Suspense, useState } from "react";
import { Download, Percent, ReceiptText, TrendingUp, Trophy } from "lucide-react";
import {
  BarList, Button, CellPeople, Choice, DataTable, LoadingDots, PageBody, PageHeader, Panel, RatioBar, ResourcePanel, SegmentedControl,
  SplitLayout, StatStrip, useAdminTheme, useNotify, type Column,
} from "@adminui/react";
import { formatAmount } from "../../data/demo-data";
import { DAILY_REVENUE, REPS, type RepRow } from "../../data/templates-data";

// 图表库较大：从 @adminui/react/charts 懒加载，首屏不等它。
const RevenueChart = lazy(() =>
  import("@adminui/react/charts").then((m) => ({
    default: function RevenueChart({ mode, days }: { mode: "light" | "dark"; days: number }) {
      const start = Date.UTC(2026, 8, 9);
      const points = DAILY_REVENUE.slice(-days).map((v, i) => [start + (30 - days + i) * 86_400_000, v * 1000] as [number, number]);
      const option = m.timeSeriesOption({ series: [{ id: "new", name: "新签金额", points }], mode, unit: "元", area: true, expectedIntervalMs: 86_400_000 });
      return <m.AdminChart option={option} label="每天的新签金额" height={210} />;
    },
  })),
);

/** T04 统计看板页：概况卡（范围 / 筛选 / 导出在标题行）→ 两列：趋势 | 占比 → 两列：明细 | 排行。 */
export function Demo() {
  const notify = useNotify();
  const { mode } = useAdminTheme();
  const [range, setRange] = useState("30");
  const [team, setTeam] = useState("all");
  const days = Number(range);

  const columns: Column<RepRow>[] = [
    { key: "name", title: "销售", render: (r) => <CellPeople people={[{ name: r.name }]} /> },
    { key: "deals", title: "商机", numeric: true, align: "right", render: (r) => r.deals },
    { key: "won", title: "赢单", numeric: true, align: "right", render: (r) => r.won },
    { key: "amount", title: "新签金额", numeric: true, align: "right", render: (r) => formatAmount(r.amount) },
    { key: "share", title: "占比", width: 150, render: (r) => (r.share === null ? "这段时间没有签约" : <RatioBar ratio={r.share} label={`${r.name} 占比`} />) },
  ];

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <PageHeader title="销售统计" />
      <PageBody>
        <StatStrip
          title="销售概况"
          count={days === 30 ? "9 月 9 日 – 10 月 8 日" : days === 7 ? "10 月 2 日 – 10 月 8 日" : "10 月 8 日"}
          description="新签 = 合同生效日期在这段时间内；金额按年合同额计。"
          actions={
            <>
              <SegmentedControl size="sm" label="时间范围" value={range} onValueChange={setRange} options={[{ value: "1", label: "今天" }, { value: "7", label: "7 天" }, { value: "30", label: "30 天" }]} />
              <Choice label="团队" value={team} onChange={setTeam} options={[{ value: "all", label: "团队：全部" }, { value: "east", label: "华东销售组" }, { value: "south", label: "华南销售组" }]} />
              <Button size="sm" variant="outline" onClick={() => notify("开始导出")}><Download />导出</Button>
            </>
          }
          items={[
            { key: "amount", label: "新签金额", icon: <TrendingUp />, value: "¥220.7", unit: "万", note: "比上个 30 天 +12%", noteTone: "brand" },
            { key: "won", label: "赢单", icon: <Trophy />, value: 41, unit: "单", note: "平均 ¥5.4 万 / 单" },
            { key: "rate", label: "赢单率", icon: <Percent />, value: "35", unit: "%", note: "比上期 -3 个百分点", noteTone: "attention" },
            { key: "invoice", label: "已开票", icon: <ReceiptText />, value: "¥168.2", unit: "万", note: "回款 92%" },
          ]}
        />
        <SplitLayout
          railWidth={380}
          rail={
            <Panel title="按套餐分" count="按金额" flush>
              <BarList
                label="按套餐分"
                items={[
                  { key: "ent", label: "企业版", hint: "14 单", ratio: 0.52, value: "52%" },
                  { key: "pro", label: "专业版", hint: "19 单", ratio: 0.31, value: "31%" },
                  { key: "basic", label: "基础版", hint: "6 单", ratio: 0.11, value: "11%" },
                  { key: "addon", label: "增购席位", hint: "2 单", ratio: 0.06, value: "6%" },
                ]}
              />
            </Panel>
          }
        >
          <Panel title="每天的新签金额" description="按合同生效日期汇总（北京时间）。">
            <Suspense fallback={<LoadingDots label="图表加载中" />}><RevenueChart mode={mode} days={Math.max(days, 2)} /></Suspense>
          </Panel>
        </SplitLayout>
        <SplitLayout
          railWidth={380}
          rail={
            <Panel title="新签前 5" flush>
              <BarList ranked label="新签前 5" items={REPS.slice(0, 5).map((r) => ({ key: r.id, label: r.name, avatar: r.name.slice(0, 1), ratio: (r.share ?? 0) / 0.31, value: formatAmount(r.amount) }))} />
            </Panel>
          }
        >
          <ResourcePanel title="销售明细" count={REPS.length} unit="人">
            <DataTable caption="销售明细" rows={REPS} rowKey={(r) => r.id} columns={columns} rowHeight="short" pagination={{ mode: "all" }} />
          </ResourcePanel>
        </SplitLayout>
      </PageBody>
    </div>
  );
}
