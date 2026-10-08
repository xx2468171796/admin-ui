"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import { useAdminTheme } from "./theme.tsx";
import { useCellBudget } from "./cell-budget.ts";
import { fitChips, type ChipFit } from "./table-rows.ts";
import { safeDownloadUrl } from "./workflow-core.ts";
import { colorTone, optionTone, type OptionTone } from "./option-tone.ts";


const textOf = (node: ReactNode, explicit?: string) =>
  explicit ?? (typeof node === "string" || typeof node === "number" ? String(node) : undefined);
const present = (node: ReactNode) => node !== undefined && node !== null && node !== "" && node !== false;

/**
 * A table cell with a main line and one muted secondary line (name + address, name + note…). Each
 * line is clamped (ellipsis, full text on hover). In rows of two or more lines the secondary text
 * may use the remaining lines; in rows under 40px (short / sm / xs) only the main line shows and the
 * secondary text moves into its hover title. Outside a table both lines render in full.
 */
export function CellText({ primary, secondary, primaryTitle, secondaryTitle }: { primary: ReactNode; secondary?: ReactNode; primaryTitle?: string; secondaryTitle?: string }) {
  const budget = useCellBudget();
  const hasSecondary = present(secondary);
  const primaryText = textOf(primary, primaryTitle);
  const secondaryText = textOf(secondary, secondaryTitle);
  if (budget?.clamped && budget.compact) {
    const title = [primaryText, hasSecondary ? secondaryText : undefined].filter(Boolean).join("\n") || undefined;
    return (
      <span className="aui-cell-text" data-compact="true">
        <span className="aui-cell-line" data-tip={title} data-tip-truncated="">{primary}</span>
      </span>
    );
  }
  const secondaryLines = budget?.clamped ? Math.max(1, budget.lines - 1) : undefined;
  return (
    <span className="aui-cell-text" data-full={budget?.clamped ? undefined : "true"}>
      <span className="aui-cell-line" data-tip={primaryText} data-tip-truncated="">{primary}</span>
      {hasSecondary ? (
        <span
          className="aui-cell-line aui-cell-secondary"
          data-lines={secondaryLines && secondaryLines > 1 ? secondaryLines : undefined}
          style={secondaryLines && secondaryLines > 1 ? ({ "--aui-clamp": secondaryLines } as CSSProperties) : undefined}
          data-tip={secondaryText}
          data-tip-truncated=""
        >
          {secondary}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Long text (notes, descriptions, addresses): clamped to the row's line budget with an ellipsis and
 * the full text on hover. `lines` lowers the clamp further. Give the column a `width` or `maxWidth`
 * so the text wraps instead of widening the table. Outside a table (expand record) it renders in
 * full, keeping line breaks.
 */
export function CellLongText({ text, lines }: { text: string | null | undefined; lines?: number }) {
  const budget = useCellBudget();
  if (!text) return <span className="aui-cell-empty">—</span>;
  if (!budget?.clamped) return <span className="aui-cell-long" data-full="true">{text}</span>;
  const clamp = Math.max(1, Math.min(budget.lines, lines ?? budget.lines));
  return (
    <span className="aui-cell-long" data-tip={text} data-tip-truncated="" style={{ "--aui-clamp": clamp } as CSSProperties}>
      {text}
    </span>
  );
}

/** Chip tones: the ten option hues and their solid variants (`OPTION_TONES`). */
export type CellTagTone = OptionTone;
export type CellTagItem = {
  label: string;
  /** Colour of the chip (default gray). */
  tone?: CellTagTone;
  /**
   * Stored category colour (a colour name or hex): used only when `tone` is missing, mapped to the nearest
   * of the ten hues (`colorTone`) — raw colours are never painted.
   */
  color?: string;
  /** Stable key when labels repeat. */
  key?: string;
};
export type CellPerson = { name: string; /** Shown in the hover title / popover, e.g. a department. */ hint?: string; key?: string };

type ChipModel = { key: string; label: string; title: string; tone: CellTagTone; avatar?: string };

function Chip({ chip, style }: { chip: ChipModel; style?: CSSProperties }) {
  return (
    <span className="aui-chip" data-tone={chip.tone} data-person={chip.avatar !== undefined || undefined} data-tip={chip.title} style={style} role="listitem">
      {chip.avatar !== undefined ? <span className="aui-chip-avatar" aria-hidden="true">{chip.avatar}</span> : null}
      <span className="aui-chip-label">{chip.label}</span>
    </span>
  );
}

type Position = { top: number; left: number };

/** The `+N` chip: hover title lists the hidden items; click opens a popover (Provider portal) listing them. */
function MoreChip({ hidden, noun }: { hidden: readonly ChipModel[]; noun: string }) {
  const { portal } = useAdminTheme();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const names = hidden.map((chip) => chip.label).join("、");
  const close = (returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) trigger.current?.focus();
  };
  const place = () => {
    const button = trigger.current?.getBoundingClientRect();
    const box = panel.current?.getBoundingClientRect();
    if (!button || !box) return true;
    if (button.bottom < 0 || button.top > window.innerHeight) return false;
    const margin = 8;
    const left = Math.min(Math.max(margin, button.left), window.innerWidth - box.width - margin);
    let top = button.bottom + 4;
    if (top + box.height > window.innerHeight - margin && button.top - box.height - 4 >= margin) top = button.top - box.height - 4;
    const next = { top: Math.max(margin, top), left: Math.max(margin, left) };
    setPosition((old) => (old && old.top === next.top && old.left === next.left ? old : next));
    return true;
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  useLayoutEffect(() => {
    if (open) placeRef.current();
  }, [open, hidden.length]);
  useEffect(() => {
    if (open && position) panel.current?.focus({ preventScroll: true });
  }, [open, position]);
  useEffect(() => {
    if (!open) return;
    const inside = (node: EventTarget | null) => node instanceof Node && (panel.current?.contains(node) || trigger.current?.contains(node));
    const onPointerDown = (event: PointerEvent) => { if (!inside(event.target)) close(false); };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      if (!placeRef.current()) close(false);
    };
    const onResize = () => { if (!placeRef.current()) close(false); };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="aui-chip aui-chip-more"
        data-tip={names}
        aria-label={`另外 ${hidden.length} ${noun}：${names}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        +{hidden.length}
      </button>
      {open && portal && createPortal(
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={`另外 ${hidden.length} ${noun}`}
          tabIndex={-1}
          className="aui-chip-popover"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            } else if (event.key === "Tab") close(true);
          }}
        >
          <span className="aui-chip-list" role="list">
            {hidden.map((chip) => <Chip key={chip.key} chip={chip} />)}
          </span>
        </div>,
        portal,
      )}
    </>
  );
}

/** Chips laid out in the row's lines; the rest collapse into `+N`. Unclamped outside a table. */
function ChipList({ chips, label, noun }: { chips: readonly ChipModel[]; label?: string; noun: string }) {
  const budget = useCellBudget();
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const clamped = Boolean(budget?.clamped);
  const lines = budget?.lines ?? Number.POSITIVE_INFINITY;
  const [fit, setFit] = useState<ChipFit>({ visible: chips.length, squeezeLast: false });
  const signature = chips.map((chip) => chip.key + "\u0000" + chip.label).join("\u0001");
  useLayoutEffect(() => {
    if (!clamped) return;
    const node = box.current;
    const layer = measure.current;
    if (!node || !layer) return;
    const run = () => {
      const widths = [...layer.querySelectorAll<HTMLElement>("[data-measure=chip]")].map((el) => el.getBoundingClientRect().width);
      const plus = [...layer.querySelectorAll<HTMLElement>("[data-measure=plus]")].map((el) => el.getBoundingClientRect().width);
      const gap = parseFloat(getComputedStyle(node).columnGap) || 4;
      const next = fitChips(widths, node.clientWidth, lines, {
        gap,
        plusWidth: (hidden) => plus[Math.min(plus.length - 1, String(hidden).length - 1)] ?? 32,
      });
      setFit((old) => (old.visible === next.visible && old.squeezeLast === next.squeezeLast && old.lastWidth === next.lastWidth ? old : next));
    };
    run();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(run);
    observer.observe(node);
    return () => observer.disconnect();
  }, [clamped, lines, signature]);
  if (!chips.length) return <span className="aui-cell-empty">—</span>;
  if (!clamped) {
    return (
      <span className="aui-chip-list" role="list" aria-label={label} data-full="true">
        {chips.map((chip) => <Chip key={chip.key} chip={chip} />)}
      </span>
    );
  }
  const visible = Math.min(fit.visible, chips.length);
  const hidden = chips.slice(visible);
  return (
    <span ref={box} className="aui-chip-list aui-cell-chips" role="list" aria-label={label} style={{ "--aui-clamp": lines } as CSSProperties}>
      {chips.slice(0, visible).map((chip, index) => (
        <Chip key={chip.key} chip={chip} style={fit.squeezeLast && index === visible - 1 && fit.lastWidth ? { maxWidth: fit.lastWidth } : undefined} />
      ))}
      {hidden.length > 0 && <MoreChip hidden={hidden} noun={noun} />}
      <span ref={measure} className="aui-chip-measure" aria-hidden="true">
        {chips.map((chip) => (
          <span key={chip.key} className="aui-chip" data-tone={chip.tone} data-person={chip.avatar !== undefined || undefined} data-measure="chip">
            {chip.avatar !== undefined ? <span className="aui-chip-avatar">{chip.avatar}</span> : null}
            <span className="aui-chip-label">{chip.label}</span>
          </span>
        ))}
        {["+8", "+88", "+888"].map((text) => <span key={text} className="aui-chip aui-chip-more" data-measure="plus">{text}</span>)}
      </span>
    </span>
  );
}

const keyed = <T extends { key?: string }>(items: readonly T[], labelOf: (item: T) => string) => {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = item.key ?? labelOf(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}#${count}` : base;
  });
};

/**
 * Multi-select / labels / linked records as chips. In a table they fill the row's lines and the
 * rest collapse into a `+N` chip (hover lists them, click opens a popover); give the column a
 * `width`. Outside a table (expand record) every chip shows, wrapping.
 */
export function CellTags({ items, label }: { items: readonly CellTagItem[]; /** Accessible name of the list, e.g. 「标签」. */ label?: string }) {
  const keys = keyed(items, (item) => item.label);
  const chips = items.map((item, index): ChipModel => ({ key: keys[index]!, label: item.label, title: item.label, tone: optionTone(item.tone) ?? colorTone(item.color) ?? "gray" }));
  return <ChipList chips={chips} label={label} noun="项" />;
}

/** People (owners, assignees, members) as name chips with an initial; overflow like CellTags. */
export function CellPeople({ people, label }: { people: readonly CellPerson[]; label?: string }) {
  const keys = keyed(people, (person) => person.name);
  const chips = people.map((person, index): ChipModel => ({
    key: keys[index]!,
    label: person.name,
    title: person.hint ? `${person.name} · ${person.hint}` : person.name,
    tone: "gray",
    avatar: Array.from(person.name.trim())[0] ?? "?",
  }));
  return <ChipList chips={chips} label={label} noun="人" />;
}

const displayUrl = (href: string) => href.replace(/^https?:\/\//i, "").replace(/^mailto:/i, "").replace(/\/$/, "");

/**
 * A URL in a cell: one line with an ellipsis, full address on hover, opens in a new tab
 * (noopener). Only http(s) and mailto become links; anything else shows as plain text.
 */
export function CellLink({ href, children }: { href: string | null | undefined; children?: ReactNode }) {
  const budget = useCellBudget();
  const full = budget?.clamped ? undefined : "true";
  if (!href) return <span className="aui-cell-empty">—</span>;
  const safe = /^mailto:/i.test(href) ? href : safeDownloadUrl(href);
  const text = children ?? displayUrl(href);
  if (!safe) return <span className="aui-cell-link" data-full={full} data-tip={href}><span className="aui-cell-link-text">{text}</span></span>;
  return (
    <a className="aui-cell-link" data-full={full} href={safe} target="_blank" rel="noopener noreferrer" data-tip={href}>
      <span className="aui-cell-link-text">{text}</span>
      <ExternalLink aria-hidden="true" />
      <span className="aui-sr-only">（在新标签页打开）</span>
    </a>
  );
}
