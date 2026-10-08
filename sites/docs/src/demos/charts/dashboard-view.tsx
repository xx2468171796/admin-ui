import { useState } from "react";
import { SegmentedControl } from "@adminui/react";
import { DashboardView } from "@adminui/react/dashboard-builder";
import { BUILDER_METRICS, BUILDER_SOURCES, DEFAULT_FILTERS, DIMENSIONS, INITIAL_DASHBOARD, loadWidgetData } from "../../data/charts-data";

/** 只读看板：存下来的 JSON 直接交给 DashboardView。「按阅读顺序」= 手机上的样子（数字卡两列、其他一张一行）。 */
export function Demo() {
  const [layout, setLayout] = useState<"grid" | "stacked">("grid");
  const sourceLabel = (id: string) => BUILDER_SOURCES.find((s) => s.id === id)?.label;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SegmentedControl
        size="sm"
        label="排列"
        value={layout}
        onValueChange={setLayout}
        options={[{ value: "grid", label: "6 列网格" }, { value: "stacked", label: "按阅读顺序" }]}
      />
      <div style={layout === "stacked" ? { maxWidth: 390 } : undefined}>
        <DashboardView
          widgets={INITIAL_DASHBOARD.widgets}
          context={DEFAULT_FILTERS}
          load={loadWidgetData}
          decor={{ metrics: BUILDER_METRICS, dimensions: DIMENSIONS, sourceLabel }}
          stacked={layout === "stacked"}
          label={INITIAL_DASHBOARD.title}
        />
      </div>
    </div>
  );
}
