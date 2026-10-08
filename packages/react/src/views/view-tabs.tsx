"use client";
/**
 * ViewTabs (bt/views V1): ONE line above a table's
 * toolbar — view tabs → 「+」 新建视图 → on the right 「视图」 (view management) and the host's `trailing`
 * (dashboard group). A tab = kind icon + name + tier mark (standard = small lock, shared = two people, mine = none)
 * + an attention dot when the user changed a standard / shared view for themselves (`modified`); the active tab is
 * bold with a 2px primary underline and a ⋯ menu (also right-click / Shift+F10 on any tab); double-click a view
 * the user owns to rename it in place (`onRename`). Tabs that don't fit go into 「更多 N」, grouped 标准 / 共享 /
 * 我的, with 「管理视图…」 at the bottom; the active tab always stays in the bar. Phones: every tab in one row that
 * scrolls sideways (edges fade, the active tab scrolls to the middle); the dashboard group moves into 「视图」.
 *
 * Buttons with aria-current (a view switcher, not page-section tabs): ←/→ move between tabs, Enter / Space opens.
 * Views and their order come from the host (view-core `tabViews`).
 */
import { createContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, Lock, Plus, Settings2, Users } from "lucide-react";
import { Button, cn } from "../primitives.tsx";
import { ContextMenu, MenuButton, type MenuSection } from "../menu.tsx";
import { PopoverPanel } from "../popover-panel.tsx";
import { useIsMobile } from "../media-query.ts";
import { fitTabs, managerCountText, overflowGroups, tabViews, VIEW_KIND_LABELS, VIEW_KINDS, VIEW_TIER_LABELS, type NewViewDraft, type ViewAudience, type ViewKind, type ViewSummary } from "./view-core.ts";
import { ViewKindIcon } from "./view-parts.tsx";
import { NewViewPanel } from "./view-create.tsx";
import { MoreMenu } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type ViewTabsProps = {
  /** All views (hidden ones are left out of the bar). */
  views: readonly ViewSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Accessible name (default 「视图」). */
  label?: string;
  /** ⋯ menu of a tab (rename, duplicate, share, hide, delete …). */
  tabMenu?: (view: ViewSummary) => readonly MenuSection[];
  /**
   * 「+ 新建视图」: called with the chosen kind and — new — the draft (name, audience) from the 「新建视图」 panel.
   * Prefer `onCreateView`; this stays for 7.x hosts.
   */
  onCreate?: (kind: ViewKind, draft?: NewViewDraft) => void | Promise<void>;
  /** 「+ 新建视图」 with the six kind cards + name + audience; the panel closes when it resolves. */
  onCreateView?: (draft: NewViewDraft) => void | Promise<void>;
  /** Audiences offered in 「新建视图」 (default only 「只有我」; add "shared" when the user may share with a group). */
  createAudiences?: readonly ViewAudience[];
  /** One line in the 「新建视图」 footer, e.g. 「建好后从当前视图带上筛选和排序」. */
  createNote?: ReactNode;
  kinds?: readonly ViewKind[];
  /** Rename in place: double-click a tab the user may rename (default: their own views). */
  onRename?: (id: string, name: string) => void | Promise<void>;
  canRename?: (view: ViewSummary) => boolean;
  /** Body of the 「视图管理」 panel (usually <ViewManager />); adds the 「视图」 button on the right. */
  manager?: ReactNode;
  /** Controlled open state of the manager panel. */
  managerOpen?: boolean;
  onManagerOpenChange?: (open: boolean) => void;
  /** Right end of the strip (the dashboard group …); on phones it moves into the 「视图」 panel. */
  trailing?: ReactNode;
};

/** What ViewTabs tells the ViewManager inside its panel: 「+ 新建视图」 there opens the same create panel. */
export const ViewTabsContext = /* @__PURE__ */ createContext<{ openCreate?: () => void } | null>(null);

type Fit = { shown: number[]; overflow: number[] };
const TIER_MARK = { standard: Lock, shared: Users } as const;

/** Tier mark after the name: lock = standard, two people = shared, nothing = mine. */
function TierMark({ view }: { view: ViewSummary }) {
  if (view.tier === "mine") return null;
  const Icon = TIER_MARK[view.tier];
  return <Icon size={12} className="aui-vtab-tier" data-tier={view.tier} aria-hidden="true" />;
}

function tabTip(view: ViewSummary): string {
  const tier = view.tier === "standard" ? " · 业务线标准视图（条件锁定）" : view.tier === "shared" ? " · 共享视图" : "";
  return `${VIEW_KIND_LABELS[view.kind]}视图${tier}${view.modified ? " · 你改过，只对你生效" : ""}`;
}

function TabContent({ view }: { view: ViewSummary }) {
  return (
    <>
      <ViewKindIcon kind={view.kind} size={15} />
      <span className="aui-vtab-name">{view.name}</span>
      <TierMark view={view} />
      {view.modified && <span className="aui-vtab-dot" aria-hidden="true" />}
    </>
  );
}

function RenameBox({ view, onDone }: { view: ViewSummary; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(view.name);
  const finish = () => onDone(value.trim() && value.trim() !== view.name ? value.trim() : null);
  return (
    <span className="aui-vtab aui-vtab-renaming">
      <ViewKindIcon kind={view.kind} size={15} />
      <input
        className="aui-vtab-rename"
        aria-label="视图名称"
        autoFocus
        maxLength={40}
        value={value}
        size={Math.max(4, value.length + 1)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") finish();
          if (e.key === "Escape") onDone(null);
        }}
      />
    </span>
  );
}

/** See the module comment. */
export function ViewTabs(props: ViewTabsProps) {
  const { views, activeId, onSelect, label = "视图", tabMenu, onCreate, onCreateView, kinds = VIEW_KINDS, manager, managerOpen, onManagerOpenChange, trailing } = props;
  const tabs = tabViews(views);
  const phone = useIsMobile();
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const managerButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const addBox = useRef<HTMLSpanElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [ownOpen, setOwnOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const open = managerOpen ?? ownOpen;
  const setOpen = (next: boolean) => (onManagerOpenChange ? onManagerOpenChange(next) : setOwnOpen(next));
  const [fit, setFit] = useState<Fit | null>(null);
  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  const signature = tabs.map((t) => `${t.id}:${t.name}:${t.tier}:${t.modified ? 1 : 0}`).join("|");
  const canCreate = Boolean(onCreateView || onCreate);
  const renamable = (view: ViewSummary) => Boolean(props.onRename) && (props.canRename ? props.canRename(view) : view.tier === "mine");

  useLayoutEffect(() => {
    const el = box.current;
    const m = measure.current;
    if (!el || !m || phone) return;
    const run = () => {
      const items = Array.from(m.querySelectorAll<HTMLElement>(":scope > .aui-vtab-wrap"));
      const widths = items.map((c) => c.getBoundingClientRect().width);
      const moreWidth = m.querySelector<HTMLElement>(".aui-vtabs-overflow")?.getBoundingClientRect().width ?? 92;
      const available = el.getBoundingClientRect().width - (addBox.current?.getBoundingClientRect().width ?? 0) - 8;
      const next = fitTabs(widths, available, moreWidth + 4, activeIndex, 2);
      setFit((old) => (old && old.shown.join() === next.shown.join() ? old : next));
    };
    run();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [signature, activeIndex, canCreate, phone]);

  // Phones: the strip scrolls sideways; bring the active tab to the middle.
  useLayoutEffect(() => {
    if (!phone) return;
    const button = buttons.current.get(activeId);
    const strip = box.current?.querySelector<HTMLElement>(".aui-vtabs-list");
    if (!button || !strip) return;
    const b = button.getBoundingClientRect();
    const r = strip.getBoundingClientRect();
    const left = strip.scrollLeft + (b.left - r.left) - (r.width - b.width) / 2;
    strip.scrollTo?.({ left: Math.max(0, left) });
  }, [phone, activeId, signature]);

  const shown = phone ? tabs : (fit?.shown ?? tabs.map((_, i) => i)).map((i) => tabs[i]).filter((t): t is ViewSummary => Boolean(t));
  const overflow = phone ? [] : (fit?.overflow ?? []).map((i) => tabs[i]).filter((t): t is ViewSummary => Boolean(t));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "Home" ? -index : event.key === "End" ? shown.length - 1 - index : 0;
    if (event.key === "F2" && shown[index] && renamable(shown[index])) {
      event.preventDefault();
      setRenaming(shown[index].id);
      return;
    }
    if (!step) return;
    event.preventDefault();
    const next = shown[Math.max(0, Math.min(shown.length - 1, index + step))];
    if (next) buttons.current.get(next.id)?.focus();
  };
  const overflowSections: MenuSection[] = [
    ...overflowGroups(overflow).map((group) => ({
      key: group.tier,
      title: VIEW_TIER_LABELS[group.tier],
      items: group.views.map((v) => ({ key: v.id, label: v.name, icon: <ViewKindIcon kind={v.kind} />, onSelect: () => onSelect(v.id) })),
    })),
    ...(manager !== undefined ? [{ key: "manage", items: [{ key: "manage", label: "管理视图…", icon: <Settings2 size={15} />, onSelect: () => setOpen(true) }] }] : []),
  ];
  const create = async (draft: NewViewDraft) => {
    if (onCreateView) await onCreateView(draft);
    else await onCreate?.(draft.kind, draft);
    setCreating(false);
  };
  const tabNode = (view: ViewSummary, index: number) => {
    const active = view.id === activeId;
    const menu = tabMenu?.(view);
    if (renaming === view.id)
      return (
        <span key={view.id} className="aui-vtab-wrap" data-active={active || undefined}>
          <RenameBox
            view={view}
            onDone={(name) => {
              setRenaming(null);
              if (name) void props.onRename?.(view.id, name);
              requestAnimationFrame(() => buttons.current.get(view.id)?.focus());
            }}
          />
        </span>
      );
    return (
      <span key={view.id} className="aui-vtab-wrap" data-active={active || undefined}>
        <ContextMenu label={`「${view.name}」视图菜单`} sections={() => menu ?? null} disabled={!menu?.length}>
          <button
            ref={(el) => {
              if (el) buttons.current.set(view.id, el);
              else buttons.current.delete(view.id);
            }}
            type="button"
            className="aui-vtab"
            data-tier={view.tier}
            data-modified={view.modified || undefined}
            aria-current={active ? "page" : undefined}
            data-tip={tabTip(view)}
            aria-description={tabTip(view)}
            tabIndex={active || (activeIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onSelect(view.id)}
            onDoubleClick={() => renamable(view) && setRenaming(view.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            <TabContent view={view} />
          </button>
        </ContextMenu>
        {active && menu && menu.length > 0 && (
          <MoreMenu sections={menu} label={`「${view.name}」视图菜单`} className="aui-vtab-more" />
        )}
      </span>
    );
  };
  return (
    <ViewTabsContext.Provider value={canCreate ? { openCreate: () => { setOpen(false); setCreating(true); } } : {}}>
      <div className="aui-vtabs" data-phone={phone || undefined}>
        <div ref={box} className="aui-vtabs-strip">
          <nav className="aui-vtabs-list" aria-label={label}>
            {shown.map(tabNode)}
            {overflow.length > 0 && (
              <MenuButton variant="ghost" size="sm" className="aui-vtabs-overflow" label={`更多视图（${overflow.length} 个）`} align="start" sections={overflowSections}>
                更多 {overflow.length}
                <ChevronDown size={14} aria-hidden="true" />
              </MenuButton>
            )}
          </nav>
          {canCreate && (
            <span ref={addBox} className="aui-vtabs-addbox">
              <Button ref={addButton} variant="ghost" size="sm" className="aui-vtabs-add" aria-label="新建视图" aria-haspopup="dialog" aria-expanded={creating} data-tip="新建视图" onClick={() => setCreating((v) => !v)}>
                <Plus size={15} aria-hidden="true" />
              </Button>
            </span>
          )}
          <div ref={measure} className={cn("aui-vtabs-list", "aui-vtabs-measure")} aria-hidden="true">
            {tabs.map((view) => (
              <span key={view.id} className="aui-vtab-wrap" data-active={view.id === activeId || undefined}>
                <span className="aui-vtab" data-tier={view.tier}>
                  <TabContent view={view} />
                </span>
                {view.id === activeId && tabMenu && <span className="aui-vtab-more-space" />}
              </span>
            ))}
            <span className="aui-button aui-button-ghost aui-button-sm aui-vtabs-overflow">
              更多 {tabs.length}
              <ChevronDown size={14} />
            </span>
          </div>
        </div>
        {manager !== undefined && (
          <Button ref={managerButton} variant="ghost" size="sm" className="aui-vtabs-manage" aria-label={phone ? "视图管理" : undefined} aria-expanded={open} aria-haspopup="dialog" data-tip="视图管理" onClick={() => setOpen(!open)}>
            <Settings2 size={15} aria-hidden="true" />
            <span className="aui-vtabs-managetext">视图</span>
          </Button>
        )}
        {trailing && !(phone && manager !== undefined) && <div className="aui-vtabs-trailing">{trailing}</div>}
        {manager !== undefined && (
          <PopoverPanel open={open} anchor={managerButton.current} onClose={() => setOpen(false)} title="视图管理" align="end" sheet
            help="标准视图由业务线负责人维护，所有人看到的一样；必看视图不能隐藏。想改条件就复制为我的视图。" headerExtra={managerCountText(views)} width={380}>
            {phone && trailing && <div className="aui-vtabs-phone-trailing">{trailing}</div>}
            {manager}
          </PopoverPanel>
        )}
        {canCreate && (
          <PopoverPanel open={creating} anchor={addButton.current} onClose={() => setCreating(false)} title="新建视图" width={440} sheet>
            <NewViewPanel
              kinds={kinds}
              existingNames={views.map((v) => v.name)}
              audiences={props.createAudiences}
              note={props.createNote}
              nameable={Boolean(onCreateView)}
              onCreate={create}
              onCancel={() => setCreating(false)}
            />
          </PopoverPanel>
        )}
      </div>
    </ViewTabsContext.Provider>
  );
}
