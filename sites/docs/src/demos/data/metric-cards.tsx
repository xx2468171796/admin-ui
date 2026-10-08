import { Building2, Receipt, Users } from "lucide-react";
import { KpiCard, KpiGrid, MetricCard, MetricGrid, computeDelta } from "@adminui/react";

/**
 * 指标带放不下时：MetricCard 是只有数值的简单卡（列表页上方 3–4 张）；KpiCard 多了对比、趋势和缺数据的说明。
 * 缺数据写「—」+ 原因，不写 0。
 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <MetricGrid>
        <MetricCard title="在用席位" value="1,284" unit="个" note="共 24 家客户" icon={Users} />
        <MetricCard title="本月签约" value="7" unit="家" note="其中续约 3 家" icon={Building2} />
        <MetricCard title="待开发票" value={null} note="财务系统还没接入" icon={Receipt} />
      </MetricGrid>
      <KpiGrid>
        <KpiCard title="本月签约金额" value="128,000" unit="元" delta={computeDelta(128_000, 112_000)} comparison="比上月" trend={[82, 90, 96, 101, 112, 128]} footnote="数据截至今天 09:00" />
        <KpiCard title="平均首次响应" value="42" unit="分钟" delta={computeDelta(42, 49, { mode: "absolute", better: "down" })} comparison="比上周" trend={[55, 52, 49, 47, 44, 42]} />
        <KpiCard title="续约率" value={null} placeholder="续约数据下月开始统计" />
      </KpiGrid>
    </div>
  );
}
