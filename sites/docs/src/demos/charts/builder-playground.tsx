import { useState } from "react";
import { DashboardFilterBar, useNotify } from "@adminui/react";
import { DashboardBuilder, DashboardView, type DashboardSchema } from "@adminui/react/dashboard-builder";
import { BUILDER_METRICS, BUILDER_SOURCES, BUILDER_TEMPLATES, COMPARE_OPTIONS, DEFAULT_FILTERS, DIMENSIONS, INITIAL_DASHBOARD, TIME_OPTIONS, loadWidgetData } from "../../data/charts-data";

/**
 * 看板搭建器：从左边拖组件到 6 列画布，选中一张卡右边才出设置；Ctrl+Z 撤销、Delete 删除。
 * 「只读」= 同一份 JSON 交给 DashboardView。数据由宿主的 loadWidgetData 在服务端按权限聚合（这里在浏览器里造数）。
 */
type Props = { mode?: string; scope?: string; libraryCollapsed?: boolean };

export function Demo({ mode = "edit", scope = "company", libraryCollapsed = false }: Props) {
  const notify = useNotify();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [saved, setSaved] = useState<DashboardSchema>(INITIAL_DASHBOARD);
  const filterBar = <DashboardFilterBar value={filters} onChange={setFilters} defaultValue={DEFAULT_FILTERS} timeOptions={TIME_OPTIONS} compareOptions={COMPARE_OPTIONS} dimensions={DIMENSIONS.slice(0, 2)} />;
  if (mode === "view")
    return (
      <div style={{ height: 640, overflow: "auto", display: "grid", alignContent: "start", gap: 12, padding: 16 }}>
        {filterBar}
        <DashboardView widgets={saved.widgets} context={filters} load={loadWidgetData} decor={{ metrics: BUILDER_METRICS, dimensions: DIMENSIONS }} label={saved.title} />
      </div>
    );
  return (
    <div style={{ height: 640 }}>
      <DashboardBuilder
        key={`${scope}-${libraryCollapsed}`}
        value={saved}
        filterContext={filters}
        filterBar={filterBar}
        dimensions={DIMENSIONS}
        loadWidgetData={loadWidgetData}
        sources={BUILDER_SOURCES}
        metrics={BUILDER_METRICS}
        compareOptions={COMPARE_OPTIONS}
        templates={BUILDER_TEMPLATES}
        scope={scope === "personal" ? "personal" : "company"}
        scopeLabel={scope === "personal" ? "我的" : "团队默认"}
        libraryCollapsed={libraryCollapsed}
        permissionNote="你只能看到你有权限的数据：华东区 2 人"
        onSave={async (next) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          setSaved(next);
          notify("看板已保存", "success");
        }}
        onSaveAsMine={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          notify("已另存为我的看板", "success");
        }}
        onCancel={() => notify("已放弃没保存的改动", "info")}
        height={640}
      />
    </div>
  );
}
