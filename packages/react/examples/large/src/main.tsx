// Large tier starter: every subpath is available, the heavy ones (grid / views / charts /
// markdown) sit behind lazy routes, so the first screen stays inside the large-tier budget (scripts/size-budget.mjs).
// The overview page uses the core entry only; opening a route loads its chunk (JS + its CSS) on demand.
import { lazy, Suspense, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Kanban, LayoutDashboard, Table2 } from "lucide-react";
import {
  ActivityFeed,
  AdminProvider,
  AdminShell,
  AppearanceButton,
  KpiCard,
  KpiGrid,
  NotificationProvider,
  PageBody,
  PageHeader,
  Panel,
  StatePanel,
  computeDelta,
  type NavItem,
  type WorkspaceItem,
} from "@adminui/react";
import "@adminui/react/styles.css";
import { CUSTOMERS } from "./data";

const GridPage = lazy(() => import("./pages/grid-page").then((m) => ({ default: m.GridPage })));
const BoardPage = lazy(() => import("./pages/board-page").then((m) => ({ default: m.BoardPage })));
const ReportPage = lazy(() => import("./pages/report-page").then((m) => ({ default: m.ReportPage })));

type Event = { id: string; at: string; who: string; text: string };
const EVENTS: Event[] = [
  { id: "e1", at: "2026-10-08T09:12:00+08:00", who: "小王", text: "把 赵静怡 推进到「报价」" },
  { id: "e2", at: "2026-10-08T08:40:00+08:00", who: "阿杰", text: "新建客户 陈冠宇" },
  { id: "e3", at: "2026-10-07T17:05:00+08:00", who: "小美", text: "成交 孙佳宁 · ¥86 万" },
];

function Overview() {
  const won = CUSTOMERS.filter((c) => c.stage === "won").length;
  return (
    <PageBody>
      <PageHeader title="总览" />
      <KpiGrid>
        <KpiCard title="客户" value={CUSTOMERS.length} unit="位" delta={computeDelta(CUSTOMERS.length, 41)} comparison="比上周" />
        <KpiCard title="本月成交" value={won} unit="单" delta={computeDelta(won, 9)} comparison="比上月同期" />
        <KpiCard title="待跟进" value={7} unit="位" />
      </KpiGrid>
      <Panel title="最近动态">
        <ActivityFeed items={EVENTS} getId={(e) => e.id} time={(e) => e.at} title={(e) => e.text} actor={(e) => e.who} caption="最近动态" />
      </Panel>
    </PageBody>
  );
}

const NAV: NavItem[] = [
  { id: "overview", title: "总览", icon: LayoutDashboard },
  { id: "grid", title: "客户表", icon: Table2, group: "客户" },
  { id: "board", title: "客户看板", icon: Kanban, group: "客户" },
  { id: "report", title: "报表", icon: BarChart3, group: "分析" },
];
const PAGES: Record<string, () => ReactNode> = {
  overview: () => <Overview />,
  grid: () => <GridPage />,
  board: () => <BoardPage />,
  report: () => <ReportPage />,
};

function App() {
  const [open, setOpen] = useState(["overview"]);
  const [active, setActive] = useState("overview");
  const tabs: WorkspaceItem[] = open.map((id) => {
    const nav = NAV.find((n) => n.id === id)!;
    return { id, title: nav.title, icon: nav.icon, closable: id !== "overview", content: <Suspense fallback={<StatePanel kind="loading" />}>{PAGES[id]!()}</Suspense> };
  });
  return (
    <AdminShell
      brand="大项目"
      navigation={NAV}
      tabs={tabs}
      activeId={active}
      onNavigate={(id) => { setOpen((list) => (list.includes(id) ? list : [...list, id])); setActive(id); }}
      onCloseTab={(id) => { setOpen((list) => list.filter((x) => x !== id)); if (active === id) setActive("overview"); }}
      account={{ name: "陈组长", detail: "管理员" }}
      onSignOut={() => undefined}
      headerActions={<AppearanceButton />}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  // SDK 的默认值是中性的（时区跟浏览器、不带币种、电话区号按浏览器语言地区），项目在这里写自己的。
  <AdminProvider storageKey="admin-ui-large" defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </AdminProvider>,
);
