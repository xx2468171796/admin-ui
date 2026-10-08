import { Panel, RollupCard, computeDelta, useNotify, type RollupMetric } from "@adminui/react";

/** 总览页里每个区域一张汇总卡：值 vs 目标子弹图（含时间进度）、异常标签、3–4 格指标条、下钻按钮。 */
const rel = (cur: number, prev: number) => computeDelta(cur, prev, { digits: 0 });
const pp = (cur: number, prev: number, better: "up" | "down" = "up") => computeDelta(cur, prev, { mode: "points", better });
const metric = (key: string, label: string, value: string | null, unit: string, delta?: ReturnType<typeof rel>, note?: string): RollupMetric => ({ key, label, value, unit, delta, note });

export function Demo() {
  const notify = useNotify();
  const drill = (name: string) => () => notify(`进入「${name}」，带着当前筛选`);
  return (
    <Panel title="各区域本月新签" count="万元 · 已过 26% 的工作日" flush>
      <RollupCard
        title="华东区"
        value="120"
        unit="万元"
        targetText="/ 目标 340 万 · 已达 35.3%"
        delta={rel(120, 104)}
        comparison="比上月同期"
        bullet={{ value: 120, target: 340, timeProgress: 0.26 }}
        metrics={[metric("new", "新客户", "7", "家", rel(7, 5)), metric("churn", "流失率", "1.2", "%", pp(0.012, 0.015, "down")), metric("ar", "应收逾期", null, "", undefined, "财务模块接入后显示")]}
        onDrill={drill("华东区")}
        drillLabel="进入区域经营"
      />
      <RollupCard
        title="华南区"
        anomaly="试用转化骤降"
        value="48"
        unit="万元"
        targetText="/ 目标 340 万 · 已达 14.1%"
        delta={rel(48, 66)}
        comparison="比上月同期"
        bullet={{ value: 48, target: 340, timeProgress: 0.26 }}
        metrics={[metric("new", "新客户", "3", "家", rel(3, 6)), metric("churn", "流失率", "2.1", "%", pp(0.021, 0.017, "down")), metric("ar", "应收逾期", null, "", undefined, "财务模块接入后显示")]}
        onDrill={drill("华南区")}
        drillLabel="进入区域经营"
      />
    </Panel>
  );
}
