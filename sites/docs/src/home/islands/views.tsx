import { useEffect, useRef, useState, type ComponentType } from "react";
import { Pause, Play } from "lucide-react";
import { IconButton, useNotify } from "@adminui/react";
import { BitableGrid, type GridCellChange } from "@adminui/react/grid";
import { Demo as KanbanDemo } from "../../demos/views/kanban-playground";
import { Demo as CalendarDemo } from "../../demos/views/calendar-month";
import { Demo as GanttDemo } from "../../demos/views/gantt-basic";
import { Demo as GalleryDemo } from "../../demos/views/gallery-basic";
import { dealFields, initialDeals, type Deal } from "../../data/views-data";
import { useHome } from "../store";
import { defineIsland } from "./runtime";
import "./views.css";

const WIDTHS = [180, 120, 110, 130, 90, 180, 120, 90];
const GRID_FIELDS = dealFields(["name", "stage", "ownerName", "amount", "city", "modules", "nextFollowUp", "seats"]).map((f, i) => ({ ...f, editable: true, width: WIDTHS[i] ?? 120 }));

function DealGrid() {
  const notify = useNotify();
  const [rows, setRows] = useState<Deal[]>(() => initialDeals());
  const save = async (changes: GridCellChange<Deal>[]) => {
    await new Promise((r) => setTimeout(r, 200));
    setRows((list) => list.map((row) => changes.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
    notify(`已保存 ${changes.length} 处改动`, "success");
  };
  return <BitableGrid caption="商机" rows={rows} getRowId={(r) => r.id} fields={GRID_FIELDS} height={500} frozenColumns={1} summary onCellsChange={save} />;
}

const CalendarFit = () => <div className="h-morph-cal"><CalendarDemo /></div>;
const VIEWS: readonly { id: string; label: string; fig: string; view: ComponentType }[] = [
  { id: "grid", label: "表格", fig: "BitableGrid", view: DealGrid },
  { id: "kanban", label: "看板", fig: "KanbanBoard", view: KanbanDemo },
  { id: "calendar", label: "日历", fig: "CalendarMonth", view: CalendarFit },
  { id: "gantt", label: "甘特", fig: "GanttView", view: GanttDemo },
  { id: "gallery", label: "画册", fig: "GalleryView", view: GalleryDemo },
];
const CYCLE_MS = 6000;

/** True while at least a third of the element is on screen and the tab is visible. */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(Boolean(e?.isIntersecting)), { threshold: 0.33 });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return [ref, seen && tabVisible] as const;
}

/**
 * The same 18 deals as table → kanban → calendar → gantt → gallery, switching every 6 s.
 * Pauses on hover, while focused inside, and when off screen; stops for good once the reader picks a tab or presses
 * pause; never starts under prefers-reduced-motion.
 */
function Morph() {
  const { reduced } = useHome();
  const [i, setI] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hover, setHover] = useState(false);
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const auto = !reduced && !stopped;
  const running = auto && !hover && onScreen;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % VIEWS.length), CYCLE_MS);
    return () => window.clearTimeout(t);
  }, [i, running]);
  const v = VIEWS[i] ?? VIEWS[0];
  if (!v) return null;
  const View = v.view;
  return (
    <div
      ref={ref}
      className="h-morph"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <div className="h-morph-tabs" role="tablist" aria-label="同一份数据，换一种视图">
        {VIEWS.map((x, n) => (
          // admin-ui-audit-ignore raw-control: 轮换视图的标签下面带倒计时进度条，是首页展示件，不是后台表单控件
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={n === i}
            className="h-mtab"
            onClick={() => {
              setI(n);
              setStopped(true);
            }}
          >
            <span>{x.label}</span>
            <i aria-hidden="true">{n === i && auto && <b key={`${i}-${running}`} data-paused={running ? undefined : "1"} style={{ animationDuration: `${CYCLE_MS}ms` }} />}</i>
          </button>
        ))}
        <span className="h-morph-note">
          {v.fig} · 18 条商机，同一个字段清单
          {!reduced && (
            <IconButton
              size="sm"
              label={stopped ? "自动轮换" : "停在这一个"}
              icon={stopped ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              onClick={() => setStopped((s) => !s)}
            />
          )}
        </span>
      </div>
      <div className="h-morph-stage" key={v.id} role="tabpanel" aria-label={v.label}>
        <View />
      </div>
    </div>
  );
}

defineIsland("views", { main: { view: Morph, dark: true } });
