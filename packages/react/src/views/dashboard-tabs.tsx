"use client";
/**
 * DashboardTabs (审阅 06 第 7 项): the 「仪表盘」 group at the right end of a ViewTabs strip
 * (pass it as `trailing`), drawn with the same underline tabs as the views. Each tab carries its scope
 * icon — company default = building, personal = person (a company dashboard that counts per viewer,
 * 「我的今天」, is still a building) — the first `shown` tabs are in the bar (the active one always),
 * the rest go into 「更多 N」, the active tab has a ⋯ menu, 「+」 opens the create menu
 * (新建我的 / 复制当前为我的 / 新建团队仪表盘). Tabs and their order come from the host.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Building2, ChevronDown, LayoutDashboard, Plus, UserRound } from "lucide-react";
import { MenuButton, type MenuSection } from "../menu.tsx";
import { MoreMenu } from "../buttons.tsx";
import { revealInline } from "../scroll-reveal.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

/** Who a tab belongs to: company = shared default (building icon), personal = mine (person icon). */
export type TabScope = "company" | "personal";
export type ScopeTab = { id: string; label: string; scope?: TabScope };

export const TAB_SCOPE_LABELS: Readonly<Record<TabScope, string>> = { company: "团队默认", personal: "我的" };

/** The scope icon (building / person), 15px like the view-kind icons. */
export function TabScopeIcon({ scope, size = 15 }: { scope: TabScope; size?: number }) {
  const Icon = scope === "company" ? Building2 : UserRound;
  return <Icon size={size} aria-hidden="true" />;
}

export type DashboardTabsProps = {
  tabs: readonly ScopeTab[];
  /** Open dashboard (null = a view is open, no dashboard tab is current). */
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Group word before the tabs (default 「仪表盘」). */
  groupLabel?: string;
  /** Tabs shown in the bar before 「更多」 (default 3; the active one is always shown). */
  shown?: number;
  /** ⋯ menu of the active tab (改名 / 复制成我的 / 上移 / 下移 / 删除). */
  tabMenu?: (tab: ScopeTab) => readonly MenuSection[];
  /** 「+」 menu (新建我的 / 复制当前为我的 / 新建团队仪表盘). */
  createSections?: readonly MenuSection[];
  createLabel?: string;
  /** Extra controls after 「+」. */
  trailing?: ReactNode;
  /** Words of the two scopes (default TAB_SCOPE_LABELS: 「团队默认」 / 「我的」), e.g. `{ company: "公司默认" }`. */
  scopeLabels?: Partial<Record<TabScope, string>>;
};

export function DashboardTabs({ tabs, activeId, onSelect, groupLabel = "仪表盘", shown: limit = 3, tabMenu, createSections, createLabel = "新建仪表盘", trailing, scopeLabels }: DashboardTabsProps) {
  const scopeWord = (scope: TabScope) => scopeLabels?.[scope] ?? TAB_SCOPE_LABELS[scope];
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const shown = tabs.slice(0, limit);
  const active = tabs.find((t) => t.id === activeId);
  if (active && !shown.some((t) => t.id === active.id)) shown.push(active);
  const rest = tabs.filter((t) => !shown.some((s) => s.id === t.id));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = shown[Math.max(0, Math.min(shown.length - 1, index + step))];
    if (next) buttons.current.get(next.id)?.focus();
  };
  const menu = active && tabMenu ? tabMenu(active) : [];
  // Phones scroll the strip sideways: bring the open dashboard into view.
  useEffect(() => {
    if (activeId) revealInline(buttons.current.get(activeId), undefined, 8);
  }, [activeId]);
  return (
    <nav className="aui-dtabs" aria-label={groupLabel}>
      <span className="aui-dtabs-label">
        <LayoutDashboard size={14} aria-hidden="true" />
        {groupLabel}
      </span>
      {shown.map((tab, index) => {
        const current = tab.id === activeId;
        return (
          <span key={tab.id} className="aui-vtab-wrap" data-active={current || undefined}>
            <button
              ref={(el) => {
                if (el) buttons.current.set(tab.id, el);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              className="aui-vtab"
              data-scope={tab.scope}
              aria-current={current ? "page" : undefined}
              data-tip={tab.scope ? `${scopeWord(tab.scope)}仪表盘` : undefined}
              tabIndex={current || (!active && index === 0) ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {tab.scope && <TabScopeIcon scope={tab.scope} />}
              <span className="aui-vtab-name">{tab.label}</span>
              {tab.scope && <span className="aui-sr-only">（{scopeWord(tab.scope)}）</span>}
            </button>
            {current && menu.length > 0 && (
              <MoreMenu sections={menu} label={`「${tab.label}」的操作`} className="aui-vtab-more" />
            )}
          </span>
        );
      })}
      {rest.length > 0 && (
        <MenuButton
          variant="ghost"
          size="sm"
          className="aui-vtabs-overflow"
          label={`更多${groupLabel}（${rest.length} 个）`}
          align="start"
          sections={[{ items: rest.map((t) => ({ key: t.id, label: t.label, ...(t.scope ? { icon: <TabScopeIcon scope={t.scope} />, hint: scopeWord(t.scope) } : {}), onSelect: () => onSelect(t.id) })) }]}
        >
          更多 {rest.length}
          <ChevronDown size={14} aria-hidden="true" />
        </MenuButton>
      )}
      {createSections && createSections.some((s) => s.items.length > 0) && (
        <MoreMenu className="aui-dtabs-add" label={createLabel} align="start" sections={createSections} icon={<Plus size={15} aria-hidden="true" />} />
      )}
      {trailing}
    </nav>
  );
}
