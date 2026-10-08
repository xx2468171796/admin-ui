import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import { Button, DashboardFilterBar, DashboardSection, IconButton, Panel, useNotify } from "@adminui/react";
import { DashboardView } from "@adminui/react/dashboard-builder";
import { DashboardTabs, ViewTabs, type ScopeTab, type ViewSummary } from "@adminui/react/views";
import { BUILDER_METRICS, DEFAULT_FILTERS, DIMENSIONS, INITIAL_DASHBOARD, COMPARE_OPTIONS, TIME_OPTIONS, loadWidgetData } from "../../data/charts-data";

/** 看板页：视图和仪表盘同一条标签 → 不套卡的筛选行（右侧数据截至 · 刷新 · 编辑）→ 6 列网格的部件。 */
const VIEWS: ViewSummary[] = [
  { id: "all", name: "全部客户", kind: "grid", tier: "standard" },
  { id: "renewal", name: "待续费", kind: "grid", tier: "standard" },
];
const TABS: ScopeTab[] = [
  { id: "sales", label: "销售月度看板", scope: "company" },
  { id: "mine", label: "我的周报", scope: "personal" },
];

export function Demo() {
  const notify = useNotify();
  const [view, setView] = useState("all");
  const [tab, setTab] = useState<string | null>("sales");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [asOf, setAsOf] = useState("09:00");
  const widgets = tab === "mine" ? INITIAL_DASHBOARD.widgets.slice(0, 2) : INITIAL_DASHBOARD.widgets;
  return (
    <div style={{ height: 640, overflow: "auto", display: "grid", alignContent: "start", gap: 12, padding: 16 }}>
      <Panel flush>
        <ViewTabs
          views={VIEWS}
          activeId={tab ? "" : view}
          onSelect={(id) => { setTab(null); setView(id); }}
          trailing={
            <DashboardTabs
              tabs={TABS}
              activeId={tab}
              onSelect={setTab}
              createSections={[{ items: [
                { key: "mine", label: "新建我的仪表盘…", onSelect: () => notify("新建我的仪表盘") },
                { key: "copy", label: "复制当前为我的", onSelect: () => notify("已复制为我的仪表盘") },
                { key: "company", label: "新建公司仪表盘…", disabled: true, disabledReason: "只有管理员可以新建公司仪表盘" },
              ] }]}
            />
          }
        />
      </Panel>
      {tab === null ? (
        <Panel title="表格视图">这里是「{VIEWS.find((v) => v.id === view)?.name}」的表格。点右侧「仪表盘」回到看板。</Panel>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DashboardFilterBar value={filters} onChange={setFilters} defaultValue={DEFAULT_FILTERS} timeOptions={TIME_OPTIONS} compareOptions={COMPARE_OPTIONS} dimensions={DIMENSIONS.slice(0, 2)} />
            </div>
            <span className="aui-note">数据截至 {asOf}</span>
            <IconButton label="刷新" icon={<RefreshCw />} onClick={() => setAsOf("10:05")} />
            <Button variant="outline" size="sm" onClick={() => notify("打开看板搭建器")}><Pencil aria-hidden="true" />编辑</Button>
          </div>
          <DashboardSection title={tab === "mine" ? "我这周的数" : "这个月卖得怎么样"} description="看板筛选作用于全部部件；部件自己改了筛选会在卡头标「覆盖看板筛选」">
            <DashboardView key={`${tab}-${asOf}`} widgets={widgets} context={filters} load={loadWidgetData} decor={{ metrics: BUILDER_METRICS, dimensions: DIMENSIONS }} label="销售月度看板" />
          </DashboardSection>
        </>
      )}
    </div>
  );
}
