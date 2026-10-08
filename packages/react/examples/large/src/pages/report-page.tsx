// Lazy route: charts (@adminui/react/charts pulls echarts) and a Markdown note (@adminui/react/markdown).
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Panel } from "@adminui/react";
import { AdminChart, barOption, timeSeriesOption } from "@adminui/react/charts";
import { MarkdownEditor } from "@adminui/react/markdown";
import { CUSTOMERS, STAGES } from "../data";

export function ReportPage() {
  const [note, setNote] = useState("## 本周重点\n\n- 报价阶段 **3 位** 本周要回访\n- 成交目标完成 72%");
  const byStage = useMemo(() => barOption({ categories: STAGES.map((s) => s.label), values: STAGES.map((s) => CUSTOMERS.filter((c) => c.stage === s.value).length), name: "客户数", unit: "位" }), []);
  const trend = useMemo(() => timeSeriesOption({ unit: "位", series: [{ id: "in", name: "新进线", points: Array.from({ length: 8 }, (_, i) => [Date.UTC(2026, 7, 10 + i * 7), 8 + ((i * 5) % 9)] as const) }] }), []);
  return (
    <PageBody>
      <PageHeader title="报表" />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Panel title="各阶段客户数"><AdminChart option={byStage} label="各阶段客户数" height={240} /></Panel>
        <Panel title="每周新进线"><AdminChart option={trend} label="每周新进线" height={240} /></Panel>
      </div>
      <Panel title="周报备注"><MarkdownEditor value={note} onChange={setNote} /></Panel>
    </PageBody>
  );
}
