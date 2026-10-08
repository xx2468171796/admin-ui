import { useState } from "react";
import { Button, KpiCard, KpiGrid, MetricCard, MetricGrid, computeDelta } from "@adminui/react";
import { Users } from "lucide-react";

/** 卡片自己的状态：加载、没有数据「—」、合法的 0、数据源未接、样本不足、数据过期；以及没有对比基准的 MetricCard。 */
export function Demo() {
  const [loading, setLoading] = useState(false);
  const reload = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div><Button variant="outline" size="sm" onClick={reload} loading={loading}>重新加载</Button></div>
      <KpiGrid>
        <KpiCard title="新增付费客户" value="15" unit="家" loading={loading} delta={computeDelta(15, 13)} comparison="比上月同期" />
        <KpiCard title="退款金额" value="0" unit="元" loading={loading} delta={computeDelta(0, 0)} comparison="比上月同期" />
        <KpiCard title="昨日日活" value={null} unit="人" loading={loading} delta={null} comparison="比前天" />
      </KpiGrid>
      <KpiGrid>
        <KpiCard title="应收逾期" value={null} placeholder="财务模块接入后显示" />
        <KpiCard title="企业版转化率" value="50" unit="%" detail="1 / 2 家试用" insufficient="样本不足 30 家，先不判断" />
        <KpiCard title="付费席位" value="38,330" unit="个" stale footnote="刷新失败，显示的是 09:00 的数据" />
      </KpiGrid>
      <MetricGrid>
        <MetricCard title="客户总数" value="1,206" unit="家" icon={Users} />
        <MetricCard title="今日工单" value="37" unit="张" note="只计数，没有对比基准" />
        <MetricCard title="待续费" value={null} unit="家" note="还没有数据" />
      </MetricGrid>
    </div>
  );
}
