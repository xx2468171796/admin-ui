import { DollarSign } from "lucide-react";
import { KpiCard, KpiGrid, computeDelta, formatNumber, useNotify } from "@adminui/react";
import { MRR_TREND, NEW_CUSTOMERS } from "../../data/charts-data";

/** 一行 4 张指标卡：数 + 单位 + 比什么 + 迷你趋势；「i」看口径，整张卡可下钻。 */
export function Demo() {
  const notify = useNotify();
  const drill = (name: string) => () => notify(`打开「${name}」明细，带着当前筛选`);
  return (
    <KpiGrid>
      <KpiCard
        title="MRR"
        tag="北极星"
        icon={DollarSign}
        value="226"
        unit="万元"
        delta={computeDelta(226, 214)}
        comparison="比上月末"
        trend={[...MRR_TREND]}
        trendPlacement="inline"
        definition="当月有效订阅的月费合计；年付按 12 个月摊。口径版本 v2，负责人：财务部。"
        footnote="数据截至 10-08 09:00"
        onDrill={drill("MRR")}
      />
      <KpiCard
        title="新增付费客户"
        value="15"
        unit="家"
        delta={computeDelta(15, 13)}
        comparison="比上月同期"
        trend={[...NEW_CUSTOMERS]}
        trendInProgress
        trendPlacement="inline"
        onDrill={drill("新增付费客户")}
      />
      <KpiCard
        title="付费席位"
        value={formatNumber(38_330, { compact: true })}
        fullValue="38,330"
        unit="个"
        delta={computeDelta(38_330, 35_860)}
        comparison="比上月末"
      />
      <KpiCard
        title="客户流失率"
        value="1.5"
        unit="%"
        detail="流失 18 家 / 期初 1,188 家"
        delta={computeDelta(0.015, 0.016, { mode: "points", better: "down" })}
        comparison="比上月同期"
      />
    </KpiGrid>
  );
}
