import { useState } from "react";
import { useNotify } from "@adminui/react";
import { DashboardBuilder, type DashboardSchema, type WidgetKind } from "@adminui/react/dashboard-builder";
import { BUILDER_METRICS, BUILDER_SOURCES, DEFAULT_FILTERS, loadWidgetData } from "../../data/charts-data";

/**
 * 从空白开始：画布给出空状态，点或拖左边的组件加进来。kinds 只开放 5 种图；没有筛选行。
 * 第一次保存故意失败：搭建器保持原样并显示原因，再点一次就成功。
 */
const EMPTY: DashboardSchema = { version: 2, title: "新看板", widgets: [] };
const KINDS: WidgetKind[] = ["group", "kpi", "bar", "line", "donut"];

export function Demo() {
  const notify = useNotify();
  const [attempts, setAttempts] = useState(0);
  return (
    <div style={{ height: 600 }}>
      <DashboardBuilder
        value={EMPTY}
        filterContext={DEFAULT_FILTERS}
        loadWidgetData={loadWidgetData}
        sources={BUILDER_SOURCES}
        metrics={BUILDER_METRICS}
        kinds={KINDS}
        scope="personal"
        scopeLabel="我的"
        onSave={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          setAttempts((n) => n + 1);
          if (attempts === 0) throw new Error("网络断了一下，没保存上，请再点一次");
          notify("看板已保存", "success");
        }}
        height={600}
      />
    </div>
  );
}
