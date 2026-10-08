import { useState } from "react";
import { Panel, useNotify } from "@adminui/react";
import { DashboardTabs, ViewTabs, type ScopeTab, type ViewSummary } from "@adminui/react/views";

/** 仪表盘标签放在视图标签的 trailing：团队默认 = 楼图标，我的 = 人图标；超过 3 个收进「更多」；当前标签有 ⋯ 菜单。 */
const VIEWS: ViewSummary[] = [
  { id: "all", name: "全部客户", kind: "grid", tier: "standard" },
  { id: "stage", name: "按阶段", kind: "kanban", tier: "standard" },
  { id: "mine", name: "我负责的", kind: "grid", tier: "mine" },
];
const TABS: ScopeTab[] = [
  { id: "sales", label: "销售月度看板", scope: "company" },
  { id: "today", label: "我的今天", scope: "company" },
  { id: "weekly", label: "我的周报", scope: "personal" },
  { id: "renewal", label: "续费跟进", scope: "personal" },
];

export function Demo() {
  const notify = useNotify();
  const [view, setView] = useState("all");
  const [tab, setTab] = useState<string | null>("sales");
  const current = tab ? TABS.find((t) => t.id === tab)?.label : VIEWS.find((v) => v.id === view)?.name;
  return (
    <div style={{ display: "grid", gap: 12 }}>
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
              tabMenu={(t) => [{ items: [
                { key: "copy", label: "复制成我的", onSelect: () => notify(`已复制「${t.label}」`) },
                { key: "rename", label: "改名…", disabled: t.scope === "company", disabledReason: "团队默认仪表盘由管理员维护", onSelect: () => undefined },
              ] }]}
              createSections={[{ items: [
                { key: "mine", label: "新建我的仪表盘…", onSelect: () => notify("新建我的仪表盘") },
                { key: "copy", label: "复制当前为我的", onSelect: () => notify("已复制为我的仪表盘") },
                { key: "company", label: "新建公司仪表盘…", onSelect: () => notify("新建公司仪表盘（管理员）") },
              ] }]}
            />
          }
        />
      </Panel>
      <p className="aui-note">当前打开：{current}</p>
    </div>
  );
}
