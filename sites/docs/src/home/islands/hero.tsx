import { CalendarDays, Columns3, FileText, Sheet } from "lucide-react";
import { AdminShell, StatePanel, type NavItem } from "@adminui/react";
import { Demo as GridDemo } from "../../demos/data/grid-customers";
import { CRM_PAGES, isCrmPage, type CrmPage } from "../content";
import { loadIsland, useIslandPart } from "../islands";
import { useHome } from "../store";
import { defineIsland } from "./runtime";
import "./hero.css";

const ICONS = { grid: Sheet, kanban: Columns3, calendar: CalendarDays, detail: FileText } as const;
const NAV: NavItem[] = CRM_PAGES.map((p) => ({ id: p.id, title: p.title, icon: ICONS[p.id], group: "销售" }));

/**
 * The other three CRM pages (kanban, calendar, detail) live in the `crm` island: it loads the first time the reader
 * opens one of them, or points at the CRM (warm-up), so the first screen only carries the shell + grid.
 */
function MorePage({ id }: { id: Exclude<CrmPage, "grid"> }) {
  const View = useIslandPart("crm", id);
  if (View === null) return <StatePanel kind="error" title="这一页没加载出来" message="网络不稳时会这样，换一页再回来试试。" />;
  if (!View) return <StatePanel kind="loading" title="加载中…" />;
  return <View />;
}

/** Starts loading the other CRM pages once the reader shows interest (pointer over the CRM, focus inside it). */
const warmUp = () => void loadIsland("crm").catch(() => undefined);

/** The hero: a small CRM built only from the library. The top-bar command palette switches its pages too. */
function LiveCrm() {
  const { crm, set } = useHome();
  const page = NAV.find((n) => n.id === crm) ?? NAV[0];
  const content = crm === "grid" ? <GridDemo /> : <MorePage id={crm} />;
  return (
    <div className="h-crm" onPointerEnter={warmUp} onFocusCapture={warmUp}>
      <AdminShell
        logo="北"
        brand="北辰云"
        navigation={NAV}
        activeId={crm}
        onNavigate={(id) => isCrmPage(id) && set({ crm: id })}
        onCloseTab={() => undefined}
        account={{ name: "林晓", detail: "销售总监" }}
        onSignOut={() => undefined}
        tabs={page ? [{ id: page.id, title: page.title, icon: page.icon, closable: false, content: <div className="h-crm-page">{content}</div> }] : []}
      />
    </div>
  );
}

defineIsland("hero", { main: { view: LiveCrm } });
