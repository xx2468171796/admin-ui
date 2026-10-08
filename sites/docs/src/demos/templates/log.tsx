import { useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import { Button, Choice, LogTimeline, PageBody, PageHeader, QueryBar, ResourcePanel, SegmentedControl, useNotify } from "@adminui/react";
import { AUDIT, type AuditEntry } from "../../data/templates-data";

const RESULT = { ok: { label: "成功", tone: "success" }, denied: { label: "无权限", tone: "warning" }, failed: { label: "失败", tone: "danger" } } as const;

/** T06 日志 / 时间线页：一张卡 → 筛选行 → 按天分组的一行一条 → 展开看改前改后 → 加载更多。 */
export function Demo() {
  const notify = useNotify();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState("7");
  const [who, setWho] = useState("all");
  const [loaded, setLoaded] = useState(6);
  const [loading, setLoading] = useState(false);

  // 时间相对今天生成，演示里永远是「今天 / 昨天」。
  const entries = useMemo(() => {
    const d = new Date();
    const at = ([days, h, m]: AuditEntry["at"]) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - days, h, m).getTime();
    return AUDIT.map((e) => ({ ...e, time: at(e.at) }));
  }, []);
  const rows = entries
    .filter((e) => (who === "all" || (who === "ai" ? e.ai : !e.ai)) && (!q || `${e.who}${e.text}${e.target}`.includes(q)))
    .slice(0, loaded);

  const loadMore = () => {
    setLoading(true);
    setTimeout(() => { setLoaded((n) => n + 3); setLoading(false); }, 500);
  };

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <PageHeader title="操作日志" />
      <PageBody>
        <ResourcePanel
          title="操作日志"
          count={entries.length}
          unit="条"
          description="所有成员和自动化在这段时间做的事；点一行看改前改后。"
          actions={<Button size="sm" variant="outline" onClick={() => notify("开始导出 CSV")}><Download />导出 CSV</Button>}
          filters={
            <QueryBar value={draft} onChange={setDraft} onSearch={() => setQ(draft.trim())} onReset={() => { setDraft(""); setQ(""); setWho("all"); }} placeholder="搜成员、客户、发票号…">
              <SegmentedControl label="时间范围" value={range} onValueChange={setRange} options={[{ value: "1", label: "今天" }, { value: "7", label: "近 7 天" }, { value: "30", label: "近 30 天" }, { value: "pick", label: "自选", icon: CalendarDays }]} />
              <Choice label="操作人" value={who} onChange={setWho} options={[{ value: "all", label: "操作人：全部" }, { value: "people", label: "只看成员" }, { value: "ai", label: "只看自动化" }]} />
            </QueryBar>
          }
        >
          <LogTimeline
            caption="操作日志"
            items={rows}
            getId={(e) => e.id}
            time={(e) => e.time}
            actor={(e) => ({ name: e.who, ai: e.ai })}
            text={(e) => e.text}
            target={(e) => e.target}
            result={(e) => RESULT[e.result]}
            diff={(e) => ({ meta: ["来源 网页端", `请求号 ${e.id.toUpperCase()}-7F3A`], changes: e.changes ?? [] })}
            defaultExpanded={["a1"]}
            total={entries.length}
            onLoadMore={loaded < entries.length ? loadMore : undefined}
            loadingMore={loading}
          />
        </ResourcePanel>
      </PageBody>
    </div>
  );
}
