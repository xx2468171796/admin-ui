"use client";
/**
 * The calendar's event card (bt/views V5 / V6, review 08): a click on an event opens it next to the
 * event — title, option badge + time, the host's detail rows, primary 「打开详情」 + 「清除日期」. A
 * double-click on the event opens the record directly. Esc, × or a click outside closes it; opened
 * from the keyboard it moves focus to 「打开详情」. Positioned by the shared floating-layer helpers
 * (HoverCard → useLayerPosition) in the Provider portal.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Maximize2, X } from "lucide-react";
import { Button } from "../primitives.tsx";
import { isInsideLayer } from "../floating-layer.ts";
import type { LayerPlacement } from "../menu-core.ts";
import type { CalendarEvent } from "./calendar-parts.tsx";
import { HoverCard } from "./view-parts.tsx";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type EventCardState = { id: string; target: HTMLElement; focus: boolean };

/** Which event's card is open (`open(id, target, fromKeyboard)`), closed on Esc / outside click. */
export function useEventCard() {
  const [card, setCard] = useState<EventCardState | null>(null);
  const open = useCallback((id: string, target: HTMLElement, focus = false) => setCard({ id, target, focus }), []);
  const close = useCallback(() => setCard(null), []);
  useEffect(() => {
    if (!card) return;
    const down = (event: PointerEvent) => {
      if (isInsideLayer(event.target) || (event.target instanceof Node && card.target.contains(event.target))) return;
      setCard(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setCard(null);
      if (card.target.isConnected) card.target.focus();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [card]);
  return { card, open, close };
}

/** The card itself (see the module comment). */
export function EventCard({ card, event, when, onClose, onOpen, onClearDate, placement = { side: "bottom", align: "start", gap: 6 } }: {
  card: EventCardState | null;
  event: CalendarEvent | undefined;
  when: string;
  onClose: () => void;
  onOpen?: () => void;
  onClearDate?: () => void;
  placement?: LayerPlacement;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  const shown = Boolean(card && event);
  useLayoutEffect(() => {
    if (shown && card?.focus) primary.current?.focus({ preventScroll: true });
  }, [shown, card]);
  return (
    <HoverCard target={card && event ? card.target : null} label={event ? `${event.title}详情` : "详情"} className="aui-vhover aui-evcard" placement={placement}>
      {event && (
        <>
          <div className="aui-evcard-head">
            <strong>{event.title}</strong>
            <IconButton label="关闭" className="aui-evcard-close" onClick={onClose} icon={<X size={15} aria-hidden="true" />} />
          </div>
          <p className="aui-evcard-when">
            <CalendarDays size={14} aria-hidden="true" />
            <span>{when}</span>
            {event.badge && (
              <span className="aui-chip" data-tone={event.tone ?? "brand"}>
                <span className="aui-chip-label">{event.badge}</span>
              </span>
            )}
          </p>
          {(event.details ?? []).length > 0 && (
            <dl className="aui-vhover-rows">
              {(event.details ?? []).map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {(onOpen || onClearDate) && (
            <div className="aui-evcard-actions">
              {onOpen && (
                <Button ref={primary} size="sm" onClick={onOpen}>
                  <Maximize2 size={14} aria-hidden="true" />
                  打开详情
                </Button>
              )}
              {onClearDate && (
                <Button variant="outline" size="sm" onClick={onClearDate}>
                  <CalendarDays size={14} aria-hidden="true" />
                  清除日期
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </HoverCard>
  );
}
