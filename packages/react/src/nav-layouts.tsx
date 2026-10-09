"use client";
/**
 * Settings side navigation and list → detail layouts.
 * - SideNavLayout (T08): a 200px list of sections straight on the canvas (no card) — small group titles, 34px
 *   rows (icon + name), current = primary soft + bold, sticky, follows the scroll; unsaved section = amber dot,
 *   invalid section = red 「!」; put the page's SaveBar in `footer`. Phones: a sticky row of pills that scrolls sideways.
 * - ListDetailLayout (T09): left list + right detail in one flush panel. With `onBack` it is a two-step layout on
 *   narrow screens (≤ 760px): the list, then — once `detailOpen` — only the detail with 「← 返回」 on top.
 *   Without `onBack` the old stack (list above detail) stays.
 */
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, CircleAlert } from "lucide-react";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";

const cssVars = (vars: Record<string, string>) => vars as CSSProperties;

export type SideNavSection = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Small grey title above this section's row when it differs from the previous one (「业务线 · 智能家居」「权限」). */
  group?: string;
  /** Unsaved changes in this section (amber dot). */
  dirty?: boolean;
  /** Something invalid in this section (red 「!」; a string is the reason). */
  error?: boolean | string;
  content: ReactNode;
};

/** See the module comment. */
export function SideNavLayout({ sections, label = "分节", navWidth = 200, footer }: { sections: readonly SideNavSection[]; label?: string; navWidth?: number; footer?: ReactNode }) {
  const base = useId().replace(/:/g, "");
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const lock = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const idOf = (id: string) => `${base}-sec-${id}`;
  const ids = sections.map((s) => s.id).join("|");
  useEffect(() => {
    let frame = 0;
    const spy = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() < lock.current) return;
        const nodes = ids.split("|").map((id) => [id, document.getElementById(idOf(id))] as const).filter(([, el]) => el && el.offsetParent !== null);
        if (!nodes.length) return;
        const scroller = document.scrollingElement;
        const atEnd = scroller ? scroller.scrollTop + window.innerHeight >= scroller.scrollHeight - 4 : false;
        let current = nodes[0]![0];
        for (const [id, el] of nodes) if (el!.getBoundingClientRect().top <= 140) current = id;
        if (atEnd && scroller && scroller.scrollTop > 0) current = nodes[nodes.length - 1]![0];
        setActive((old) => (old === current ? old : current));
      });
    };
    document.addEventListener("scroll", spy, true);
    window.addEventListener("resize", spy);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", spy, true);
      window.removeEventListener("resize", spy);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, base]);
  // Phones: the pill row scrolls sideways — keep the current pill in view.
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return;
    const box = nav.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    if (rect.left < box.left || rect.right > box.right) nav.scrollLeft += rect.left - box.left - 12;
  }, [active]);
  return (
    <div className="aui-sidenav-layout" data-aui-flow="columns" style={cssVars({ "--aui-sidenav-width": `${navWidth}px` })}>
      <nav ref={navRef} className="aui-sidenav" aria-label={label}>
        {sections.map((s, i) => (
          <Fragment key={s.id}>
            {s.group && s.group !== sections[i - 1]?.group && <div className="aui-sidenav-group" aria-hidden="true">{s.group}</div>}
            <a
              href={`#${idOf(s.id)}`}
              aria-current={s.id === active ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                lock.current = Date.now() + 700;
                setActive(s.id);
                document.getElementById(idOf(s.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {s.icon}
              <span>{s.label}</span>
              {s.error ? (
                <CircleAlert className="aui-sidenav-error" role="img" aria-label={typeof s.error === "string" ? s.error : "有填写错误"} />
              ) : (
                s.dirty && <span className="aui-sidenav-dot" role="img" aria-label="有未保存的改动" />
              )}
            </a>
          </Fragment>
        ))}
      </nav>
      <div className="aui-sidenav-body" data-aui-flow="stack">
        {sections.map((s) => <div key={s.id} id={idOf(s.id)} className="aui-sidenav-section" data-aui-flow="stack">{s.content}</div>)}
        {footer}
      </div>
    </div>
  );
}

/** 「← 返回列表」 above a detail on narrow screens (list → detail steps); hidden on wide screens. */
export function NarrowBackBar({ label = "返回列表", onBack, title, actions }: { label?: string; onBack: () => void; /** The detail's name next to the arrow. */ title?: ReactNode; /** Right side (⋯). */ actions?: ReactNode }) {
  return (
    <div className="aui-narrow-back">
      <button type="button" className="aui-narrow-back-btn" onClick={onBack} aria-label={title ? label : undefined}>
        <ArrowLeft aria-hidden="true" />
        {!title && <span>{label}</span>}
      </button>
      {title && <strong className="aui-narrow-back-title">{title}</strong>}
      {actions && <span className="aui-narrow-back-actions">{actions}</span>}
    </div>
  );
}

export type ListDetailLayoutProps = {
  list: ReactNode;
  children: ReactNode;
  listWidth?: number;
  minHeight?: number;
  /** Narrow screens (≤ 760px) with `onBack`: the detail is showing instead of the list. */
  detailOpen?: boolean;
  /** Turns on list → detail steps on narrow screens; called by 「← 返回」. */
  onBack?: () => void;
  backLabel?: string;
  /** Name in the back bar (「销售 8 人」). */
  detailTitle?: ReactNode;
  /** Right side of the back bar (⋯ that holds the right rail on phones). */
  detailActions?: ReactNode;
};
/** Left list (default 260px, e.g. SelectList) + right content, inside one flush Panel. See the module comment. */
export function ListDetailLayout({ list, children, listWidth = 260, minHeight = 560, detailOpen = false, onBack, backLabel = "返回列表", detailTitle, detailActions }: ListDetailLayoutProps) {
  const steps = Boolean(onBack);
  return (
    <div className="aui-listdetail" data-narrow={steps ? "steps" : undefined} data-step={steps ? (detailOpen ? "detail" : "list") : undefined} style={cssVars({ "--aui-list-width": `${listWidth}px`, "--aui-listdetail-min": `${minHeight}px` })}>
      <div className="aui-listdetail-list">{list}</div>
      <div className="aui-listdetail-main">
        {onBack && <NarrowBackBar label={backLabel} onBack={onBack} title={detailTitle} actions={detailActions} />}
        {children}
      </div>
    </div>
  );
}
