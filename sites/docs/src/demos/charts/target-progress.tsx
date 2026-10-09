import { KpiCard, Panel, useNotify } from "@adminui/react";
import { TargetProgressCard } from "@adminui/react/dashboard-builder";

/** The current calendar month as the target period. */
function thisMonth() {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { start: `${ym}-01`, end: `${ym}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`, label: "本月" };
}

/**
 * 看板搭建器里的「目标进度」卡（loadWidgetData 返回 kind: "targetProgress"）：落后、超额、还没设目标三种；
 * 右边是时长单位（unit: "duration"，值是秒）的数字卡。
 */
export function Demo() {
  const notify = useNotify();
  const period = thisMonth();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, alignItems: "start" }}>
      <Panel title="本月新签金额">
        <TargetProgressCard title="本月新签金额" data={{ value: 1_286_000, target: 3_000_000, period, targetNote: "全公司目标", currency: "CNY" }} />
      </Panel>
      <Panel title="本月新增订阅">
        <TargetProgressCard title="本月新增订阅" data={{ value: 432, target: 400, period, targetNote: "华东区目标", unit: "单" }} />
      </Panel>
      <Panel title="本月退款金额">
        <TargetProgressCard title="本月退款金额" data={{ value: 18_200, target: null, period, currency: "CNY" }} onSetTarget={() => notify("演示：这里打开这张卡的设置，填目标或选表上的目标")} />
      </Panel>
      <KpiCard title="首次响应时长（中位）" value={11_520} unit="duration" comparison="比上周" />
    </div>
  );
}
