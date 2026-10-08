"use client";
/**
 * AdminShell: sidebar 232 (collapsed rail 64), top bar 48, pill work tabs.
 * - Top-left: logo square + product, then 「当前公司」 (`company`, CompanySwitcher). Bottom-left: one avatar row
 *   (`account` + `accountMenu` + `onSignOut`, AccountMenu: 我的资料 / API 令牌 / 管理后台 ↗ / 外观 / 退出登录).
 * - Menu rows 34px, icon 18, radius 6; current = one step lighter + bold; counts are grey pills (`badge`), things
 *   to handle solid danger (`badgeTone: "danger"`); not opened = grey + lock (`locked`). Collapsed: logo, company
 *   icon, menu icons with corner badges and name bubbles, avatar; group titles become a thin line.
 * - Top bar: ⇤ · the real breadcrumb (`crumbRoot` → the tab's `crumbs` or its menu group → page; no 「工作空间 /」) ·
 *   `headerActions` (search, bell, AppearanceButton). Phones: ≡ + the page name + actions + the tab-count button;
 *   the drawer is min(304px, 84vw) with 44px rows, × at the top right, scrim / Esc close it.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, Lock, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { scrollEdges } from "./scroll-strip-core.ts";
import { groupNavigation } from "./contracts.ts";
import { AccountMenu, CompanySwitcher, type AccountMenuItem, type CompanySwitcherProps, type ShellAccount } from "./shell-account.tsx";
import { OpenPagesButton, WorkTabs } from "./work-tabs.tsx";
import { navBadgeText, railBadgeText, shellCrumbs, type ShellCrumb } from "./shell-core.ts";
import { IconButton } from "./buttons.tsx";
import { GlobalShortcutContext } from "./admin-shortcuts.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";

export type WorkspaceItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  content: ReactNode;
  dirty?: boolean;
  closable?: boolean;
  /** Icon-only pill fixed at the far left, never closed (工作台 / home). */
  pinned?: boolean;
  /** Breadcrumb steps before the title (default: the menu group of the matching nav item). */
  crumbs?: readonly ShellCrumb[];
};
export type NavItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Optional group label; grouped items render under a non-interactive heading. */
  group?: string;
  /** Portal bottom bar label when title is too long for it (≤ 4 汉字), e.g. 密钥与接入 → 接入. */
  shortTitle?: string;
  /** Extra search words for navCommands / CommandPalette (synonyms, old names); not displayed. */
  keywords?: string;
  /** Count on the right (「1,284」); collapsed: on the icon's corner. */
  badge?: number | string;
  /** neutral (default) = grey pill; danger = something to handle (「待办 3」), solid. */
  badgeTone?: "neutral" | "danger";
  /** Not opened for this company: grey + lock, not clickable; a string is the reason (bubble). */
  locked?: boolean | string;
};
export type AdminShellProps = {
  brand: ReactNode;
  /** Logo square before the brand; the only part of the brand left on the collapsed rail. Default: first letter of a string brand. */
  logo?: ReactNode;
  navigation: readonly NavItem[];
  tabs: readonly WorkspaceItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** 关闭其他 / 关闭右侧 close several at once; without it onCloseTab is called once per tab (it must not read stale state). */
  onCloseTabs?: (ids: readonly string[]) => void;
  headerActions?: ReactNode;
  /** Who is signed in: the bottom avatar row (name + `role`), the head of the account menu (name + `detail`). */
  account?: ShellAccount;
  /** Account menu rows: 我的资料 / API 令牌 / 管理后台 ↗ (`external`) … */
  accountMenu?: readonly AccountMenuItem[];
  /** 「退出登录」, the last row of the account menu. */
  onSignOut?: () => void;
  /** The 外观 row (浅 / 深 / 跟随系统) in the account menu; default true. */
  accountAppearance?: boolean;
  /** 「当前公司」 under the brand (top-left). */
  company?: CompanySwitcherProps;
  /** First breadcrumb step on every page (「管理后台」). */
  crumbRoot?: ShellCrumb | string;
  /** Sets document.title whenever the active tab changes, e.g. (t) => `${t} · 运营后台`. */
  documentTitle?: (activeTitle: string) => string;
  /**
   * "workbench" (default): staff console with closable pill work tabs and a breadcrumb.
   * "portal": customer self-service center — no tab strip, no crumb, only the active page is mounted, and
   * phones get a bottom bar (mobileNav).
   */
  variant?: "workbench" | "portal";
  /** Portal only: up to 4 nav ids for the phone bottom bar (≤760px); a 5th「更多」opens the full menu. */
  mobileNav?: readonly string[];
  /** Portal only: short brand shown in the phone top bar, where the sidebar is hidden. */
  mobileTitle?: ReactNode;
  /**
   * Default of `globalShortcut` for a CommandPalette inside the shell (e.g. in `headerActions`): Ctrl/⌘K opens it on a
   * freshly opened page with nothing focused. The palette's own prop wins.
   */
  globalShortcut?: boolean;
};

/** Phones: a crowded header row scrolls sideways; mark the edges that hide actions so CSS fades them. */
function useEdgeFade(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const e = scrollEdges(el.scrollLeft, el.scrollWidth, el.clientWidth);
      if (el.dataset.start !== String(e.start)) el.dataset.start = String(e.start);
      if (el.dataset.end !== String(e.end)) el.dataset.end = String(e.end);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(el);
    for (const child of Array.from(el.children)) observer?.observe(child);
    const mutations = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => { for (const child of Array.from(el.children)) observer?.observe(child); measure(); });
    mutations?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [ref]);
}

/**
 * PageBody fill: --aui-content-offset = the content area's top in the document + its vertical padding, so a work
 * page can be exactly one viewport tall below the top bar and tab strip. Rounded up (Windows display scaling).
 */
function useContentOffset(ref: RefObject<HTMLDivElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const content = ref.current;
    if (!content) return;
    const measure = () => {
      const style = getComputedStyle(content);
      const offset = content.getBoundingClientRect().top + window.scrollY + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      content.style.setProperty("--aui-content-offset", `${Math.ceil(offset)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    for (let node = content.previousElementSibling; node; node = node.previousElementSibling) observer.observe(node);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, key]);
}

/** The top bar trail: grey steps (links when they have onClick), small chevrons, the page dark + bold. */
function TopbarCrumbs({ crumbs }: { crumbs: readonly ShellCrumb[] }) {
  return (
    <nav className="aui-topbar-crumbs" aria-label="面包屑">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="aui-crumb-sep" aria-hidden="true" />}
            {last ? (
              <strong aria-current="page" data-tip={c.label}>{c.label}</strong>
            ) : c.onClick ? (
              <button type="button" className="aui-crumb-link" onClick={c.onClick}>{c.label}</button>
            ) : (
              <span className="aui-crumb-text">{c.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

const defaultLogo = (brand: ReactNode) => (typeof brand === "string" ? brand.trim().slice(0, 1) : null);

/** Controlled route/tab state; mounted hidden pages retain local edits. Host guards dirty tab closure. */
export function AdminShell(props: AdminShellProps) {
  const { brand, logo, navigation, tabs, activeId, onNavigate, onCloseTab, onCloseTabs, headerActions, account, accountMenu, onSignOut, accountAppearance = true, company, crumbRoot, documentTitle, variant = "workbench", mobileNav, mobileTitle, globalShortcut } = props;
  const portal = variant === "portal";
  const bottomNav = portal ? (mobileNav ?? []).slice(0, 4).flatMap((id) => navigation.filter((n) => n.id === id)) : [];
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const active = tabs.find((t) => t.id === activeId);
  const navRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEdgeFade(actionsRef);
  useContentOffset(contentRef, portal);
  const activeTitle = active?.title;
  useEffect(() => {
    if (documentTitle && activeTitle !== undefined) document.title = documentTitle(activeTitle);
  }, [documentTitle, activeTitle]);
  // Keep the current item visible in a long, scrolled menu. Only the menu scrolls: never the page.
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !item || nav.scrollHeight <= nav.clientHeight) return;
    const box = nav.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    if (rect.top < box.top) nav.scrollTop -= box.top - rect.top + 8;
    else if (rect.bottom > box.bottom) nav.scrollTop += rect.bottom - box.bottom + 8;
  }, [activeId, mobile, collapsed]);
  // Phone drawer: Esc closes it.
  useEffect(() => {
    if (!mobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setMobile(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobile]);
  const closeMany = (ids: readonly string[]) => {
    if (onCloseTabs) onCloseTabs(ids);
    else for (const id of ids) onCloseTab(id);
  };
  const newAccount = Boolean(account);
  const navButton = (n: NavItem) => {
    const locked = Boolean(n.locked);
    const badge = collapsed ? railBadgeText(n.badge) : navBadgeText(n.badge);
    const tip = collapsed ? n.title : typeof n.locked === "string" ? n.locked : undefined;
    return (
      <button
        key={n.id}
        aria-label={collapsed ? n.title : undefined}
        data-tip={tip}
        aria-current={activeId === n.id ? "page" : undefined}
        aria-disabled={locked || undefined}
        data-locked={locked || undefined}
        onClick={() => {
          if (locked) return;
          onNavigate(n.id);
          setMobile(false);
        }}
      >
        <n.icon size={18} />
        <span>{n.title}</span>
        {locked && <Lock className="aui-nav-lock" aria-label={typeof n.locked === "string" ? n.locked : "未开通"} />}
        {!locked && badge && <b className="aui-nav-badge" aria-hidden="true" data-tone={n.badgeTone === "danger" ? "danger" : undefined}>{badge}</b>}
      </button>
    );
  };
  const logoNode = logo ?? defaultLogo(brand);
  const crumbs = portal ? [] : shellCrumbs(active, navigation, crumbRoot);
  const tabActions = { activeId, onNavigate, onCloseTab, onCloseTabs: closeMany };
  return (
    <GlobalShortcutContext.Provider value={globalShortcut}>
    <div className={`aui-shell ${portal ? "aui-portal" : ""} ${bottomNav.length ? "aui-has-bottom-nav" : ""} ${collapsed ? "aui-collapsed" : ""} ${mobile ? "aui-mobile-open" : ""}`} data-account={newAccount ? "menu" : undefined}>
      {mobile && <button className="aui-sidebar-backdrop" aria-label="关闭菜单" onClick={() => setMobile(false)} />}
      <aside className="aui-sidebar">
        <div className="aui-brand">
          {logoNode !== null && <span className="aui-brand-mark" aria-hidden="true">{logoNode}</span>}
          <span className="aui-brand-text">{brand}</span>
          {mobile && (
            <IconButton label="关闭菜单" className="aui-drawer-close" onClick={() => setMobile(false)} icon={<X />} />
          )}
        </div>
        {company && (
          <div className="aui-company-slot">
            <CompanySwitcher {...company} compact={collapsed} />
          </div>
        )}
        <nav ref={navRef} aria-label="主导航">
          {groupNavigation(navigation).map((block, index) =>
            block.group === undefined ? (
              <Fragment key={`aui-nav-${index}`}>{block.items.map(navButton)}</Fragment>
            ) : (
              <div key={`aui-nav-${block.group}`} className="aui-nav-group" role="group" aria-label={block.group}>
                <h2 className="aui-nav-group-title" aria-hidden="true">{block.group}</h2>
                {block.items.map(navButton)}
              </div>
            ),
          )}
        </nav>
        {account && (
          <div className="aui-account-slot">
            <AccountMenu account={account} items={accountMenu} onSignOut={onSignOut} appearance={accountAppearance} compact={collapsed} />
          </div>
        )}
      </aside>
      <main className="aui-main">
        <header className="aui-topbar">
          <div className="aui-topbar-title">
            <IconButton label={collapsed ? "展开侧栏" : "收起侧栏"} className="aui-desktop-menu" onClick={() => setCollapsed(!collapsed)} icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />} />
            <IconButton label="打开菜单" className="aui-mobile-menu" onClick={() => setMobile(true)} icon={<Menu />} />
            {portal ? <strong className="aui-topbar-mobile-title">{mobileTitle ?? active?.title}</strong> : <TopbarCrumbs crumbs={crumbs} />}
            {!portal && active && <strong className="aui-topbar-page">{active.title}</strong>}
          </div>
          <div ref={actionsRef} className="aui-topbar-actions">{headerActions}</div>
          {!portal && tabs.length > 0 && (
            <div className="aui-topbar-tabcount">
              <OpenPagesButton tabs={tabs} variant="topbar" {...tabActions} />
            </div>
          )}
        </header>
        {portal ? (
          <div className="aui-content" ref={contentRef}>
            {active && (
              <div key={active.id} id={`aui-page-${active.id}`}>
                {active.content}
              </div>
            )}
          </div>
        ) : (
          <>
            <WorkTabs tabs={tabs} {...tabActions} />
            <div className="aui-content" ref={contentRef}>
              {tabs.map((t) => (
                <div key={t.id} id={`aui-page-${t.id}`} role="tabpanel" aria-labelledby={`aui-tab-${t.id}`} hidden={activeId !== t.id}>
                  {t.content}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      {bottomNav.length > 0 && (
        <nav className="aui-bottom-nav" aria-label="常用">
          {bottomNav.map((n) => (
            <button key={n.id} aria-current={activeId === n.id ? "page" : undefined} onClick={() => onNavigate(n.id)}>
              <n.icon size={20} />
              <span>{n.shortTitle ?? n.title}</span>
            </button>
          ))}
          <button
            aria-current={!bottomNav.some((n) => n.id === activeId) && navigation.some((n) => n.id === activeId) ? "page" : undefined}
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
            <span>更多</span>
          </button>
        </nav>
      )}
    </div>
    </GlobalShortcutContext.Provider>
  );
}
