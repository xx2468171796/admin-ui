import { Panel, CohortTable } from "@adminui/react";
import { RETENTION, RETENTION_PERIODS } from "../../data/charts-data";

/** 席位活跃留存：行 = 首次付费月份，列 = 付费后第 N 个月；颜色 = 量级，没到月龄的格写「未到期」。 */
export function Demo() {
  return (
    <Panel title="每批客户的席位还有多少在用" count="按首次付费月份 · 活跃席位占比">
      <CohortTable
        label="各月首次付费客户在 1 到 4 个月后的活跃席位占比"
        rowHeader="首次付费"
        periods={[...RETENTION_PERIODS]}
        rows={RETENTION}
      />
      <p className="aui-note">「未到期」= 还没到这个月龄，不算 0 · 只拿同月龄比较</p>
    </Panel>
  );
}
