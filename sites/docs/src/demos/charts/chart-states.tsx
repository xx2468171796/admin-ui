import { useMemo, useState } from "react";
import { Panel, SegmentedControl } from "@adminui/react";
import { AdminChart, barOption } from "@adminui/react/charts";
import { MONTHS, NEW_CUSTOMERS } from "../../data/charts-data";

/** 一张图的 7 种状态：都和图一样高，切换时下面的内容不跳。 */
type State = "ready" | "loading" | "empty" | "noMatch" | "error" | "stale" | "forbidden";
const STATES: { value: State; label: string }[] = [
  { value: "ready", label: "有数据" },
  { value: "loading", label: "加载中" },
  { value: "empty", label: "没有数据" },
  { value: "noMatch", label: "筛选无结果" },
  { value: "error", label: "失败" },
  { value: "stale", label: "刷新失败" },
  { value: "forbidden", label: "无权限" },
];

export function Demo() {
  const [state, setState] = useState<State>("ready");
  const option = useMemo(
    () => barOption({ categories: [...MONTHS], values: [...NEW_CUSTOMERS], name: "新增付费客户", unit: "家" }),
    [],
  );
  const back = () => setState("ready");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SegmentedControl size="sm" label="图表状态" value={state} options={STATES} onValueChange={setState} />
      <Panel title="每月新增付费客户" count="近 6 个月 · 家 · 10 月进行中">
        <AdminChart
          option={option}
          label="每月新增付费客户"
          height={240}
          loading={state === "loading"}
          empty={state === "empty"}
          noMatch={state === "noMatch"}
          onClearFilters={back}
          error={state === "error" ? "服务器没响应" : undefined}
          stale={state === "stale" ? "刷新失败，显示的是 14:05 的数据" : undefined}
          onRetry={back}
          forbidden={state === "forbidden"}
          table={{ columns: ["月份", "新增付费客户（家）"], rows: MONTHS.map((m, i) => [m, NEW_CUSTOMERS[i] ?? null]) }}
        />
      </Panel>
    </div>
  );
}
