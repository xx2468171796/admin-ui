import { useState } from "react";
import { AlarmClock, Building2, Clock, Trophy, UserPlus } from "lucide-react";
import { DeltaBadge, SegmentedControl, StatStrip, computeDelta } from "@adminui/react";

type Range = "week" | "month";

// 本期 / 上期（假数据）；真实页面由服务端一起返回
const DATA: Record<Range, { total: [number, number]; added: [number, number]; overdue: number; response: [number, number]; winRate: [number, number] }> = {
  week: { total: [24, 22], added: [3, 5], overdue: 3, response: [42, 49], winRate: [31.5, 30.2] },
  month: { total: [24, 19], added: [7, 7], overdue: 3, response: [46, 44], winRate: [29.8, 33.0] },
};

/** 列表页顶上的指标带：一张卡细线分格，每格说明 + 数值 + 单位 + 一行脚注；变化值的好坏由「越大越好 / 越小越好」决定。 */
export function Demo() {
  const [range, setRange] = useState<Range>("week");
  const d = DATA[range];
  const vs = range === "week" ? "比上周" : "比上月";
  return (
    <StatStrip
      title="客户概况"
      count={range === "week" ? "本周" : "本月"}
      actions={<SegmentedControl<Range> size="sm" label="时间范围" value={range} onValueChange={setRange} options={[{ value: "week", label: "本周" }, { value: "month", label: "本月" }]} />}
      items={[
        { key: "total", label: "客户总数", icon: <Building2 />, value: d.total[0], unit: "家",
          note: <><DeltaBadge size="sm" delta={computeDelta(d.total[0], d.total[1], { mode: "absolute" })} comparison={vs} /> {vs}</> },
        { key: "added", label: "新增客户", icon: <UserPlus />, value: d.added[0], unit: "家",
          note: <><DeltaBadge size="sm" delta={computeDelta(d.added[0], d.added[1], { mode: "absolute" })} comparison={vs} /> {vs}</> },
        { key: "overdue", label: "逾期未跟进", icon: <AlarmClock />, value: d.overdue, unit: "家", tone: "attention", note: "最早的已逾期 5 天", noteTone: "attention" },
        { key: "response", label: "平均首次响应", icon: <Clock />, value: d.response[0], unit: "分钟",
          note: <><DeltaBadge size="sm" better="down" unit="分钟" delta={computeDelta(d.response[0], d.response[1], { mode: "absolute", better: "down" })} comparison={vs} /> {vs}</> },
        { key: "win", label: "赢单率", icon: <Trophy />, value: d.winRate[0].toFixed(1), unit: "%",
          note: <><DeltaBadge size="sm" delta={computeDelta(d.winRate[0] / 100, d.winRate[1] / 100, { mode: "points" })} comparison={vs} /> {vs}</> },
      ]}
    />
  );
}
