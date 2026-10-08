"use client";
/**
 * AdminShell work tabs: pills, so 「已打开的页面」 never looks like an in-page underline
 * tab. 30px; current = white + thin line + bold; × only on the current / hovered tab; unsaved = amber dot that
 * turns into × on hover; a `pinned` tab (工作台) is icon-only at the far left. When they do not fit: edge fades +
 * wheel, and a 「N ⌄」 button at the right lists every open page (searchable) with 关闭其他 / 关闭右侧; right-click
 * gives the same menu, middle-click closes. Phones have no strip: the top bar's tab-count button opens the list.
 */
import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { ScrollStrip } from "./scroll-strip.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { ContextMenu, type MenuSection } from "./menu.tsx";
import { searchTabs, tabsToClose } from "./shell-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";

export type WorkTab = { id: string; title: string; icon: LucideIcon; dirty?: boolean; closable?: boolean; pinned?: boolean };
type TabActions = {
  activeId: string;
  onNavigate: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** Several at once (关闭其他 / 关闭右侧). */
  onCloseTabs: (ids: readonly string[]) => void;
};
const canClose = (t: WorkTab) => t.closable !== false && !t.pinned;

/** The 「已打开的页面」 list: search (more than 8), rows with ✓ / 未保存 / ×, then 关闭其他 · 关闭右侧. */
function OpenPagesList({ tabs, activeId, onNavigate, onCloseTab, onCloseTabs, close }: TabActions & { tabs: readonly WorkTab[]; close: () => void }) {
  const [query, setQuery] = useState("");
  const shown = searchTabs(tabs, query);
  const others = tabsToClose(tabs, activeId, "others");
  const right = tabsToClose(tabs, activeId, "right");
  return (
    <>
      <div className="aui-acct-title">已打开的页面 · {tabs.length}</div>
      {tabs.length > 8 && (
        <input className="aui-input aui-openpages-search" type="search" placeholder="搜已打开的页面" aria-label="搜已打开的页面" value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus />
      )}
      <div className="aui-acct-section aui-openpages" role="list">
        {shown.map((t) => (
          <div key={t.id} role="listitem" className="aui-openpages-row" data-current={t.id === activeId || undefined}>
            <button type="button" className="aui-acct-item" aria-current={t.id === activeId ? "page" : undefined} onClick={() => { close(); onNavigate(t.id); }}>
              <t.icon aria-hidden="true" />
              <span className="aui-acct-item-label">{t.title}</span>
              {t.dirty && <small>未保存</small>}
              {t.id === activeId && <Check className="aui-acct-item-check" aria-label="当前" />}
            </button>
            {canClose(t) && t.id !== activeId && (
              <button type="button" className="aui-openpages-close" aria-label={`关闭${t.title}`} onClick={() => onCloseTab(t.id)}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {!shown.length && <p className="aui-openpages-empty">没有找到「{query.trim()}」</p>}
      </div>
      {(others.length > 0 || right.length > 0) && (
        <div className="aui-acct-section">
          <button type="button" className="aui-acct-item" disabled={!others.length} onClick={() => { close(); onCloseTabs(others); }}><span className="aui-acct-item-label">关闭其他</span></button>
          <button type="button" className="aui-acct-item" disabled={!right.length} onClick={() => { close(); onCloseTabs(right); }}><span className="aui-acct-item-label">关闭右侧</span></button>
        </div>
      )}
    </>
  );
}

/** A button that opens the open-pages list: 「11 ⌄」 at the end of the strip, or the phone top bar's 「4」. */
export function OpenPagesButton({ tabs, variant, ...actions }: TabActions & { tabs: readonly WorkTab[]; variant: "strip" | "topbar" }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = `已打开的页面（${tabs.length}）`;
  return (
    <>
      <button ref={trigger} type="button" className={variant === "strip" ? "aui-tabs-more" : "aui-tabs-count"} aria-label={label} data-tip={variant === "strip" ? "全部已打开的页面" : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{tabs.length}</span>
        {variant === "strip" && <ChevronDown aria-hidden="true" />}
      </button>
      <PopoverLayer open={open} anchor={trigger.current} label="已打开的页面" align="end" className="aui-popover aui-acct-pop aui-openpages-pop" onClose={(back) => { setOpen(false); if (back) trigger.current?.focus(); }}>
        <div className="aui-popover-body">
          <OpenPagesList tabs={tabs} {...actions} close={() => setOpen(false)} />
        </div>
      </PopoverLayer>
    </>
  );
}

/** The pill strip under the top bar (desktop). */
export function WorkTabs({ tabs, ...actions }: TabActions & { tabs: readonly WorkTab[] }) {
  const { activeId, onNavigate, onCloseTab, onCloseTabs } = actions;
  const menuFor = (target: Element): MenuSection[] | null => {
    const id = target.closest<HTMLElement>("[data-tab-id]")?.dataset.tabId;
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    const others = tabsToClose(tabs, tab.id, "others");
    const right = tabsToClose(tabs, tab.id, "right");
    return [
      { items: [{ key: "close", label: "关闭", disabled: !canClose(tab), onSelect: () => onCloseTab(tab.id) }] },
      {
        items: [
          { key: "others", label: "关闭其他", disabled: !others.length, onSelect: () => onCloseTabs(others) },
          { key: "right", label: "关闭右侧", disabled: !right.length, onSelect: () => onCloseTabs(right) },
        ],
      },
    ];
  };
  const more: ReactNode = <OpenPagesButton tabs={tabs} variant="strip" {...actions} />;
  return (
    <ContextMenu sections={menuFor} label="工作标签菜单">
      <ScrollStrip className="aui-tabs-strip" listClassName="aui-tabs" label="工作标签" activeKey={activeId} trailing={more}>
        {tabs.map((t) => {
          const active = activeId === t.id;
          return (
            <div
              key={t.id}
              data-tab-id={t.id}
              className={`aui-tab ${active ? "aui-active" : ""}`}
              data-pinned={t.pinned || undefined}
              data-dirty={t.dirty || undefined}
              onAuxClick={(event) => {
                if (event.button === 1 && canClose(t)) {
                  event.preventDefault();
                  onCloseTab(t.id);
                }
              }}
            >
              <button id={`aui-tab-${t.id}`} role="tab" aria-controls={`aui-page-${t.id}`} aria-selected={active} aria-label={t.pinned ? t.title : undefined} data-tip={t.pinned ? t.title : undefined} onClick={() => onNavigate(t.id)}>
                <t.icon size={15} />
                {!t.pinned && <span className="aui-tab-title">{t.title}</span>}
                {t.dirty && <span className="aui-tab-dirty" aria-label="未保存" />}
              </button>
              {canClose(t) && (
                <button aria-label={`关闭${t.title}`} className="aui-tab-close" onClick={() => onCloseTab(t.id)}>
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </ScrollStrip>
    </ContextMenu>
  );
}
