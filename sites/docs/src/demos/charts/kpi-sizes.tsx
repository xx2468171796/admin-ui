import { DeltaBadge, KpiCard, computeDelta } from "@adminui/react";

/** 3 档数字：大 28（北极星，可带子弹图）/ 标准 24 / 紧凑 20（窄格，不画趋势）；下面是变化值的几种写法。 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, alignItems: "start" }}>
        <KpiCard
          size="lg"
          title="本月新签合同额"
          tag={["北极星", { label: "进行中", tone: "info" }]}
          value="58"
          unit="万元"
          target={{ value: 58, target: 240 }}
          timeProgress={0.26}
          delta={computeDelta(58, 52)}
          comparison="比上月同期"
        />
        <KpiCard title="新增付费客户" value="15" unit="家" delta={computeDelta(15, 13)} comparison="比上月同期" trend={[9, 11, 12, 13, 15]} />
        <KpiCard size="sm" title="平均回款周期" value="21" unit="天" delta={computeDelta(21, 25, { better: "down", mode: "absolute" })} comparison="比上月" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <DeltaBadge delta={computeDelta(226, 214)} comparison="比上月" />
        <DeltaBadge delta={computeDelta(0.374, 0.351, { mode: "points" })} comparison="试用转付费" />
        <DeltaBadge delta={computeDelta(0.021, 0.016, { mode: "points", better: "down" })} comparison="流失率" />
        <DeltaBadge delta={computeDelta(6, 0)} comparison="从 0 增长" />
        <DeltaBadge delta={computeDelta(18, 18)} comparison="持平" />
        <DeltaBadge delta={computeDelta(4, 7, { mode: "absolute" })} unit="家" comparison="绝对值" size="sm" />
        <DeltaBadge delta={null} comparison="没有对比数据" />
      </div>
    </div>
  );
}
