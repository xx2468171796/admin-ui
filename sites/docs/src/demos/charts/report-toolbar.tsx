import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, IconButton, ReportToolbar, useNotify, type ReportFilter } from "@adminui/react";

/** 报表工具条：和筛选行同一条，选了就查（没有「查询」按钮）；结束早于开始、超过上限时留在输入框里并写原因。 */
const DEFAULT: ReportFilter = { start: "2026-10-01", end: "2026-10-08", source: "all" };
const PRESETS = [
  { label: "本月", start: "2026-10-01", end: "2026-10-08" },
  { label: "上月", start: "2026-09-01", end: "2026-09-30" },
  { label: "近 90 天", start: "2026-07-11", end: "2026-10-08" },
];
const SOURCES = [
  { value: "all", label: "全部来源" },
  { value: "web", label: "官网注册" },
  { value: "partner", label: "渠道伙伴" },
  { value: "referral", label: "转介绍" },
];

export function Demo() {
  const notify = useNotify();
  const [value, setValue] = useState(DEFAULT);
  const [asOf, setAsOf] = useState("09:00");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <ReportToolbar
        value={value}
        defaultValue={DEFAULT}
        sources={SOURCES}
        presets={PRESETS}
        onApply={(next) => { setValue(next); notify(`已按 ${next.start} ~ ${next.end} 重新统计`); }}
        onReset={() => setValue(DEFAULT)}
        freshness={`数据截至 ${asOf}`}
        maxDays={180}
        actions={
          <>
            <IconButton label="刷新" icon={<RefreshCw />} onClick={() => setAsOf("10:05")} />
            <Button variant="outline" size="sm" onClick={() => notify("已导出 CSV")}><Download aria-hidden="true" />导出</Button>
          </>
        }
      />
      <p className="aui-note">当前统计：{value.start} ~ {value.end} · {SOURCES.find((s) => s.value === value.source)?.label}</p>
    </div>
  );
}
