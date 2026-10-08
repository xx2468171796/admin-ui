"use client";
/**
 * WorkspaceTitleBar + ScopePill (bt/templates L2, page template T15, demo D01): the 48px title bar of a
 * RailShell work area — the table / board name (T15 is the one template that shows the page name: the
 * rail has no page names), its 「?」 and ☆, then on the right the business-line pill,
 * who is looking at it (AvatarStack), icon tools (comments, automation, permissions), the main actions
 * (分享) and ⋯. Inside RailShell it also carries the 「展开目录」 / 「目录」 button when the tree is
 * folded away or on phones. Phones keep the name, the pill (icon only) and the main actions.
 */
import type { ReactNode } from "react";
import { ChevronDown, PanelLeftOpen, Settings2, Star } from "lucide-react";
import { HelpTip } from "./help-tip.tsx";
import { AvatarStack, type StackPerson } from "./avatar.tsx";
import { MenuButton, type MenuSection } from "./menu.tsx";
import { useRailShell } from "./rail-shell.tsx";
import { IconButton, MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";

export type ScopeOption = { value: string; label: string; hint?: string };
export type ScopePillProps = {
  /** Current scope, e.g. 「智能家居」. */
  value: string;
  options: readonly ScopeOption[];
  onChange: (value: string) => void;
  /** What kind of scope this is, shown small after the name (default 「业务线」). */
  kind?: string;
  /** Extra entries under the options (「管理业务线」). */
  extra?: readonly MenuSection[];
  icon?: ReactNode;
};
/** The business-line (or company / space) pill of a title bar: a soft primary chip that opens a menu to switch. */
export function ScopePill({ value, options, onChange, kind = "业务线", extra = [], icon }: ScopePillProps) {
  const current = options.find((o) => o.value === value);
  const sections: MenuSection[] = [
    { title: `切换${kind}`, items: options.map((o) => ({ key: o.value, label: o.label, hint: o.hint, checked: o.value === value, onSelect: () => o.value !== value && onChange(o.value) })) },
    ...extra,
  ];
  return (
    <MenuButton sections={sections} label={`当前${kind}：${current?.label ?? value}，点一下切换`} variant="secondary" size="sm" align="end" className="aui-scope-pill">
      {icon ?? <Settings2 aria-hidden="true" />}
      <span className="aui-scope-pill-name">{current?.label ?? value}</span>
      <small aria-hidden="true">· {kind}</small>
      <ChevronDown className="aui-scope-pill-chevron" aria-hidden="true" />
    </MenuButton>
  );
}

export type WorkspaceTitleBarProps = {
  /** The table / board / page name (shown: T15 allows a visible title). */
  title: string;
  /** Intro behind the 「?」. */
  description?: ReactNode;
  /** ☆ / ★ (收藏): pass both to show it. */
  favorite?: boolean;
  onFavoriteChange?: (favorite: boolean) => void;
  /** Small things right after the title (a lock tag, 「草稿」). */
  meta?: ReactNode;
  /** Business-line pill (ScopePill). */
  scope?: ReactNode;
  /** Who is looking at it now. */
  presence?: readonly StackPerson[];
  presenceLabel?: string;
  /** Icon buttons (评论、自动化、权限); hidden on phones (put them in `more` too if phones need them). */
  tools?: ReactNode;
  /** Main actions (分享): one primary at most. */
  actions?: ReactNode;
  /** ⋯ menu (导入、导出、历史版本 …). */
  more?: readonly MenuSection[];
};

/** See the module comment. */
export function WorkspaceTitleBar({ title, description, favorite, onFavoriteChange, meta, scope, presence, presenceLabel = "正在看的人", tools, actions, more }: WorkspaceTitleBarProps) {
  const shell = useRailShell();
  const showTreeButton = Boolean(shell?.hasSidebar && (shell.mobile || shell.collapsed));
  return (
    <header className="aui-wtitle">
      {showTreeButton && shell && (
        <IconButton label={shell.mobile ? "打开目录" : "展开目录"} className="aui-wtitle-tree" aria-expanded={shell.mobile ? shell.drawerOpen : false} onClick={() => (shell.mobile ? shell.setDrawerOpen(true) : shell.setCollapsed(false))} icon={<PanelLeftOpen />} />
      )}
      <h1 className="aui-wtitle-name" data-tip={title}>{title}</h1>
      {description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}
      {onFavoriteChange && (
        <IconButton label={favorite ? "取消收藏" : "收藏"} className="aui-wtitle-star" aria-pressed={Boolean(favorite)} data-on={favorite || undefined} onClick={() => onFavoriteChange(!favorite)} icon={<Star />} />
      )}
      {meta && <span className="aui-wtitle-meta">{meta}</span>}
      <div className="aui-wtitle-acts">
        {scope}
        {presence && presence.length > 0 && <span className="aui-wtitle-presence"><AvatarStack people={presence} label={presenceLabel} size={32} /></span>}
        {tools && <span className="aui-wtitle-tools" role="group" aria-label={`${title}工具`}>{tools}</span>}
        {actions}
        {more && more.length > 0 && (
          <MoreMenu sections={more} label="更多操作" className="aui-wtitle-more" />
        )}
      </div>
    </header>
  );
}
