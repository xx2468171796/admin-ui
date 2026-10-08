"use client";
/**
 * RailShell + NavTree (bt/templates L1, page template T15 表格工作区, demo D01): the shell of a module
 * workspace — a 56px icon rail with the platform's modules (labels under the icons, current one
 * highlighted, notifications / settings / account at the bottom), an optional collapsible tree sidebar
 * (base header with ⋯, search, folders with chevrons and counts, 「+ 新建」 at the bottom) and the work
 * area (title bar → view tabs → toolbar → view body; the last block takes the remaining height, the
 * page itself never scrolls). Phones (≤ 760px): the rail becomes the bottom bar (≤ 4 modules + 「更多」,
 * the same bar as AdminShell variant="portal") and the tree a drawer opened from the title bar.
 * AdminShell (228px menu + work tabs) stays the default shell for ordinary admin pages.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Menu as MenuIcon, PanelLeftClose, Plus, X, type LucideIcon } from "lucide-react";
import { Button } from "./primitives.tsx";
import { useIsMobile } from "./media-query.ts";
import { Menu, MenuButton, type MenuSection } from "./menu.tsx";
import { SearchField } from "./page-templates.tsx";
import { initialOf } from "./atoms-core.ts";
import { filterNavTree, folderCount, folderOf, initialOpenFolders, isNavFolder, nextTreeId, railBottomNav, visibleTreeIds, type NavTreeFolderShape, type NavTreeLeaf, type NavTreeShape } from "./rail-shell-core.ts";
import { IconButton, MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";

export type RailModule = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Unread / to-do count on the icon (99+ beyond 99). */
  badge?: number;
  /** Label under the icon when the title is long (≤ 3 汉字), e.g. 知识库. */
  shortTitle?: string;
};
export type RailAccount = { name: string; hint?: string; /** Menu under the avatar (个人设置、退出 …). */ menu?: readonly MenuSection[] };

export type RailShellProps = {
  /** Logo in the rail's top square (a letter or an icon). */
  brand: ReactNode;
  /** Accessible name of the logo (default 「首页」). */
  brandLabel?: string;
  onBrandClick?: () => void;
  modules: readonly RailModule[];
  /** The module this page belongs to (highlighted). */
  activeModule: string;
  onModuleChange: (id: string) => void;
  /** Bottom of the rail: 通知、设置 … (same shape as modules). */
  footer?: readonly RailModule[];
  account?: RailAccount;
  /** The tree sidebar (usually <NavTree />); omit for pages without one (T17 看板搭建器). */
  sidebar?: ReactNode;
  /** Accessible name of the sidebar (default 「目录」). */
  sidebarLabel?: string;
  /** Controlled collapsed state of the sidebar on desktop (the title bar shows 「展开目录」 then). */
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  /** Phones: module ids for the bottom bar, ≤ 4 (default the first four); the rest go behind 「更多」. */
  mobileNav?: readonly string[];
  /** Accessible name of the rail (default 「模块」). */
  label?: string;
  /** The work area: WorkspaceTitleBar, ViewTabs, the view (its last block fills the height). */
  children: ReactNode;
};

type RailContext = {
  hasSidebar: boolean;
  /** Desktop: sidebar folded away. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Phone layout (sidebar is a drawer). */
  mobile: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};
const RailShellContext = /* @__PURE__ */ createContext<RailContext | null>(null);
/** Inside RailShell: sidebar state for the title bar and the tree (null outside). */
export function useRailShell(): RailContext | null {
  return useContext(RailShellContext);
}

const useMobile = useIsMobile;
const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

function RailButton({ item, current, onSelect }: { item: RailModule; current: boolean; onSelect: (id: string) => void }) {
  const Icon = item.icon;
  return (
    <button type="button" className="aui-rail-item" data-tip={item.title} aria-label={item.badge ? `${item.title}（${item.badge}）` : item.title} aria-current={current ? "page" : undefined} onClick={() => onSelect(item.id)}>
      <Icon aria-hidden="true" />
      <span aria-hidden="true">{item.shortTitle ?? item.title}</span>
      {item.badge ? <b className="aui-rail-badge" aria-hidden="true">{badgeText(item.badge)}</b> : null}
    </button>
  );
}

function RailAvatar({ account }: { account: RailAccount }) {
  const title = account.hint ? `${account.name} · ${account.hint}` : account.name;
  if (!account.menu?.length) return <span className="aui-rail-avatar" data-tip={title} role="img" aria-label={title}>{initialOf(account.name)}</span>;
  return (
    <MoreMenu sections={account.menu} label={title} align="start" className="aui-rail-avatar" icon={initialOf(account.name)} />
  );
}

/** See the module comment. */
export function RailShell({ brand, brandLabel = "首页", onBrandClick, modules, activeModule, onModuleChange, footer = [], account, sidebar, sidebarLabel = "目录", sidebarCollapsed, onSidebarCollapsedChange, mobileNav, label = "模块", children }: RailShellProps) {
  const mobile = useMobile();
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const collapsed = sidebarCollapsed ?? ownCollapsed;
  const setCollapsed = useCallback((next: boolean) => (onSidebarCollapsedChange ? onSidebarCollapsedChange(next) : setOwnCollapsed(next)), [onSidebarCollapsedChange]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) setDrawerOpen(false);
  }, [mobile]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);
  const hasSidebar = Boolean(sidebar);
  const context = useMemo<RailContext>(() => ({ hasSidebar, collapsed, setCollapsed, mobile, drawerOpen, setDrawerOpen }), [hasSidebar, collapsed, setCollapsed, mobile, drawerOpen]);
  const select = (id: string) => {
    setMoreOpen(false);
    onModuleChange(id);
  };
  const bottom = railBottomNav(modules, activeModule, mobileNav);
  const moreItems = [...bottom.more, ...footer];
  const moreCurrent = moreItems.some((m) => m.id === activeModule);
  const sidebarState = !hasSidebar ? "none" : mobile ? (drawerOpen ? "drawer-open" : "drawer") : collapsed ? "collapsed" : "open";
  return (
    <RailShellContext.Provider value={context}>
      <div className={`aui-rail-shell${mobile ? " aui-has-bottom-nav" : ""}`} data-sidebar={sidebarState}>
        <nav className="aui-rail" aria-label={label}>
          {onBrandClick ? (
            <button type="button" className="aui-rail-brand" aria-label={brandLabel} data-tip={brandLabel} onClick={onBrandClick}>{brand}</button>
          ) : (
            <span className="aui-rail-brand" role="img" aria-label={brandLabel}>{brand}</span>
          )}
          {modules.map((m) => <RailButton key={m.id} item={m} current={m.id === activeModule} onSelect={select} />)}
          <div className="aui-rail-foot">
            {footer.map((m) => <RailButton key={m.id} item={m} current={m.id === activeModule} onSelect={select} />)}
            {account && <RailAvatar account={account} />}
          </div>
        </nav>
        {hasSidebar && mobile && drawerOpen && <button type="button" className="aui-rail-backdrop" aria-label={`关闭${sidebarLabel}`} onClick={() => setDrawerOpen(false)} />}
        {hasSidebar && (
          <aside className="aui-rail-side" aria-label={sidebarLabel} hidden={!mobile && collapsed ? true : undefined}>
            {sidebar}
          </aside>
        )}
        <main className="aui-rail-main">{children}</main>
        {mobile && (
          <nav className="aui-bottom-nav" aria-label="常用模块">
            {bottom.shown.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" aria-current={m.id === activeModule ? "page" : undefined} onClick={() => select(m.id)}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{m.shortTitle ?? m.title}</span>
                </button>
              );
            })}
            {moreItems.length > 0 && (
              <button ref={moreButton} type="button" aria-haspopup="menu" aria-expanded={moreOpen} aria-current={moreCurrent ? "page" : undefined} onClick={() => setMoreOpen((v) => !v)}>
                <MenuIcon size={20} aria-hidden="true" />
                <span>更多</span>
              </button>
            )}
          </nav>
        )}
        <Menu
          open={mobile && moreOpen}
          anchor={moreButton.current}
          align="end"
          label="更多模块"
          onClose={() => setMoreOpen(false)}
          sections={[{ items: moreItems.map((m) => { const Icon = m.icon; return { key: m.id, label: m.title, icon: <Icon aria-hidden="true" />, checked: m.id === activeModule ? true : undefined, hint: m.badge ? badgeText(m.badge) : undefined, onSelect: () => select(m.id) }; }) }]}
        />
      </div>
    </RailShellContext.Provider>
  );
}

// ---------------------------------------------------------------- NavTree

export type NavTreeItem = NavTreeLeaf & { icon?: LucideIcon };
export type NavTreeFolder = NavTreeFolderShape<NavTreeItem>;
export type NavTreeNode = NavTreeShape<NavTreeItem>;

export type NavTreeProps = {
  /** Header: the base / space this tree belongs to. */
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** ⋯ menu in the header (rename, members, recycle bin …). */
  menu?: readonly MenuSection[];
  nodes: readonly NavTreeNode[];
  /** Current row (highlighted, its folder opens). */
  activeId?: string;
  onSelect: (id: string) => void;
  /** Search box placeholder; `false` hides the search (default 「搜索」). */
  search?: string | false;
  /** 「+ 新建」 at the bottom (menu of what can be created, or a plain action). */
  createLabel?: string;
  onCreate?: () => void;
  createMenu?: readonly MenuSection[];
  /** Accessible name of the tree (default 「目录」). */
  label?: string;
};

/** The tree sidebar of RailShell: see the module comment. */
export function NavTree({ title, subtitle, icon, menu, nodes, activeId, onSelect, search = "搜索", createLabel = "新建", onCreate, createMenu, label = "目录" }: NavTreeProps) {
  const shell = useRailShell();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = initialOpenFolders(nodes);
    const holder = activeId ? folderOf(nodes, activeId) : undefined;
    if (holder) initial.add(holder);
    return initial;
  });
  useEffect(() => {
    const holder = activeId ? folderOf(nodes, activeId) : undefined;
    if (holder) setOpen((v) => (v.has(holder) ? v : new Set(v).add(holder)));
  }, [activeId, nodes]);
  const body = useRef<HTMLDivElement>(null);
  const searching = query.trim() !== "";
  const shown = filterNavTree(nodes, query);
  const toggle = (id: string, next?: boolean) => setOpen((v) => {
    const copy = new Set(v);
    if (next ?? !copy.has(id)) copy.add(id);
    else copy.delete(id);
    return copy;
  });
  const pick = (id: string) => {
    onSelect(id);
    shell?.setDrawerOpen(false);
  };
  const focusRow = (id: string | undefined) => {
    if (id) body.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-tree-id]") : null;
    const id = target?.dataset.treeId;
    if (!id) return;
    const node = shown.find((n) => n.id === id);
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusRow(nextTreeId(visibleTreeIds(shown, open, searching), id, event.key));
    } else if (event.key === "ArrowRight" && node && isNavFolder(node) && !searching) {
      event.preventDefault();
      if (!open.has(id)) toggle(id, true);
      else focusRow(node.children[0]?.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node && isNavFolder(node)) {
        if (!searching) toggle(id, false);
      } else focusRow(folderOf(shown, id));
    }
  };
  const leaf = (item: NavTreeItem, nested: boolean) => {
    const Icon = item.icon;
    return (
      <li key={item.id}>
        <button type="button" className="aui-navtree-item" data-tree-id={item.id} data-nested={nested || undefined} aria-current={item.id === activeId ? "page" : undefined} disabled={item.disabled} onClick={() => pick(item.id)}>
          {Icon && <Icon aria-hidden="true" />}
          <span className="aui-navtree-label">{item.label}</span>
          {item.count !== undefined && <span className="aui-navtree-count">{typeof item.count === "number" ? item.count.toLocaleString() : item.count}</span>}
        </button>
      </li>
    );
  };
  const folder = (node: NavTreeFolder) => {
    const isOpen = searching || open.has(node.id);
    const Chevron = isOpen ? ChevronDown : ChevronRight;
    return (
      <li key={node.id}>
        <button type="button" className="aui-navtree-folder" data-tree-id={node.id} aria-expanded={isOpen} disabled={searching} onClick={() => toggle(node.id)}>
          <Chevron aria-hidden="true" />
          <span className="aui-navtree-label">{node.label}</span>
          <span className="aui-navtree-count">{folderCount(node)}<span className="aui-sr-only"> 项</span></span>
        </button>
        {isOpen && node.children.length > 0 && <ul role="list" aria-label={node.label}>{node.children.map((c) => leaf(c, true))}</ul>}
      </li>
    );
  };
  const collapseButton = shell?.hasSidebar && (
    shell.mobile
      ? <IconButton label={`关闭${label}`} className="aui-navtree-tool" onClick={() => shell.setDrawerOpen(false)} icon={<X />} />
      : <IconButton label={`收起${label}`} className="aui-navtree-tool" onClick={() => shell.setCollapsed(true)} icon={<PanelLeftClose />} />
  );
  return (
    <div className="aui-navtree">
      {(title || menu || collapseButton) && (
        <div className="aui-navtree-head">
          {icon && <span className="aui-navtree-icon" aria-hidden="true">{icon}</span>}
          <div className="aui-navtree-title">
            {title && <b>{title}</b>}
            {subtitle && <small>{subtitle}</small>}
          </div>
          {menu && menu.length > 0 && (
            <MoreMenu sections={menu} label={typeof title === "string" ? `${title}的更多操作` : "更多操作"} className="aui-navtree-tool" />
          )}
          {collapseButton}
        </div>
      )}
      {search !== false && (
        <div className="aui-navtree-search">
          <SearchField size="sm" value={query} onChange={setQuery} placeholder={search} label={`搜索${label}`} />
        </div>
      )}
      <div ref={body} className="aui-navtree-body" onKeyDown={onKeyDown}>
        <nav aria-label={label}>
          {shown.length > 0 ? (
            <ul role="list">{shown.map((n) => (isNavFolder(n) ? folder(n) : leaf(n, false)))}</ul>
          ) : (
            <p className="aui-navtree-empty">
              没有找到「{query.trim()}」
              <Button variant="text" size="sm" onClick={() => setQuery("")}>清除</Button>
            </p>
          )}
        </nav>
      </div>
      {(onCreate || createMenu) && (
        <div className="aui-navtree-foot">
          {createMenu?.length ? (
            <MenuButton sections={createMenu} label={createLabel} variant="outline" size="sm" align="start" className="aui-navtree-new">
              <Plus aria-hidden="true" />
              {createLabel}
            </MenuButton>
          ) : (
            <Button variant="outline" size="sm" className="aui-navtree-new" onClick={onCreate}><Plus aria-hidden="true" />{createLabel}</Button>
          )}
        </div>
      )}
    </div>
  );
}
