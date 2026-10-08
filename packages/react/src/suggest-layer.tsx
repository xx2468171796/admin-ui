"use client";
/**
 * Internal: the suggestion list of a combobox (GrantList search-to-add, CommentThread @mentions). A
 * listbox in the Provider portal (or the enclosing dialog) placed under the input — over it when there
 * is no room below; `side="top"` prefers above (a comment composer with a sub-table under it) and
 * drops below only when there is no room above — that never takes focus: the owner keeps focus in its
 * input, moves the active option with ↑ / ↓ (aria-activedescendant) and picks with Enter. Options pick
 * on mousedown so the input doesn't blur first.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAdminTheme } from "./theme.tsx";
import { LAYER_ATTR, layerHost, rectOf, useLayerPosition } from "./floating-layer.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";

export type SuggestItem = { key: string; content: ReactNode; disabled?: boolean };
export type SuggestLayerProps = {
  open: boolean;
  anchor: HTMLElement | null;
  /** id of the listbox (the input's aria-controls); options get `${id}-${index}`. */
  id: string;
  label: string;
  items: readonly SuggestItem[];
  active: number;
  onActive: (index: number) => void;
  onPick: (index: number) => void;
  /** Shown when there are no items (「没有匹配的人」). */
  empty?: ReactNode;
  /** Width of the layer: the anchor's (default) or a fixed px value. */
  width?: number;
  /** Preferred side of the anchor (default bottom); flips when only the other side has room. */
  side?: "bottom" | "top";
};

export const suggestOptionId = (id: string, index: number) => `${id}-${index}`;

export function SuggestLayer({ open, anchor, id, label, items, active, onActive, onPick, empty, width, side = "bottom" }: SuggestLayerProps) {
  const { portal } = useAdminTheme();
  const layer = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setHost(open ? layerHost(anchor, portal) : null), [open, anchor, portal]);
  const { position } = useLayerPosition(Boolean(open && host), layer, () => rectOf(anchor), host, { side, align: "start", gap: 4 });
  useLayoutEffect(() => {
    if (!open) return;
    layer.current?.querySelector(`#${CSS.escape(suggestOptionId(id, active))}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  if (!open || !host) return null;
  const w = width ?? Math.max(220, anchor?.getBoundingClientRect().width ?? 260);
  return createPortal(
    <div
      ref={layer}
      className="aui-suggest"
      {...{ [LAYER_ATTR]: "" }}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: `min(${w}px, calc(100vw - 16px))`, visibility: position ? "visible" : "hidden" }}
    >
      <ul id={id} role="listbox" aria-label={label} className="aui-suggest-list">
        {items.map((item, index) => (
          <li
            key={item.key}
            id={suggestOptionId(id, index)}
            role="option"
            aria-selected={index === active}
            aria-disabled={item.disabled || undefined}
            className="aui-suggest-option"
            onMouseDown={(event) => {
              event.preventDefault();
              if (!item.disabled) onPick(index);
            }}
            onMouseEnter={() => onActive(index)}
          >
            {item.content}
          </li>
        ))}
      </ul>
      {!items.length && empty && <p className="aui-suggest-empty" role="status">{empty}</p>}
    </div>,
    host,
  );
}

/** ↑ / ↓ / Home / End over `count` options (wrapping); null for other keys. */
export function suggestStep(active: number, key: string, count: number): number | null {
  if (!count) return null;
  if (key === "ArrowDown") return (active + 1) % count;
  if (key === "ArrowUp") return (active - 1 + count) % count;
  return null;
}
