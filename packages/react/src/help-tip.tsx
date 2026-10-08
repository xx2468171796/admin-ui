"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { useAdminTheme } from "./theme.tsx";
import { placeCard, type TipPlacement } from "./tooltip-core.ts";
import { Link } from "./buttons.tsx";

export type HelpTipProps = {
  /** The explanation shown on hover / focus / tap. */
  children: ReactNode;
  /** Accessible name of the 「?」 button (default 「说明」; e.g. 「机器页说明」). */
  label?: string;
  /** Bold first line of the card (「客户质量怎么算」). */
  title?: string;
  /** One 「了解更多」 link at the bottom of the card. */
  more?: { label?: string; href: string; external?: boolean };
};

/**
 * The 「?」 next to a title: a 16px icon with a 24px hit area. Its light card opens
 * BELOW the 「?」, left-aligned with it and with an arrow (so a title on the left never covers the side menu),
 * shifting back only at the viewport edge; at most 320px wide, may have a title and one 「了解更多」 link.
 * Hover / focus opens it, a click pins it, clicking outside or Esc closes it; tap on phones. A one-sentence
 * hint on a button is a Tooltip, not a HelpTip. PageHeader / Panel / ResourcePanel turn their `description` into one.
 */
export function HelpTip({ children, label = "说明", title, more }: HelpTipProps) {
  const { portal } = useAdminTheme();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [place, setPlace] = useState<TipPlacement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => {
    if (!open) return setPlace(null);
    const b = button.current?.getBoundingClientRect();
    const p = bubble.current?.getBoundingClientRect();
    if (!b || !p) return;
    setPlace(placeCard(b, { width: p.width, height: p.height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        button.current?.focus({ preventScroll: true });
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || (!button.current?.contains(event.target) && !bubble.current?.contains(event.target))) close();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && bubble.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Moving from the 「?」 into the card (to click 「了解更多」) must not close it: a short grace period.
  const leave = () => {
    if (pinned) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };
  const enter = () => clearTimeout(closeTimer.current);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="aui-help-tip"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          enter();
          setOpen(true);
        }}
        onPointerLeave={(event) => event.pointerType === "mouse" && leave()}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (event.relatedTarget instanceof Node && bubble.current?.contains(event.relatedTarget)) return;
          if (!pinned) setOpen(false);
        }}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <CircleHelp aria-hidden="true" />
      </button>
      {open &&
        portal &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className="aui-help-bubble"
            data-side={place?.side ?? "bottom"}
            onPointerEnter={enter}
            onPointerLeave={leave}
            style={{ top: place?.top ?? 0, left: place?.left ?? 0, visibility: place ? "visible" : "hidden", ["--aui-tip-arrow" as string]: `${place?.arrow ?? 24}px` }}
          >
            {title && <b className="aui-help-title">{title}</b>}
            {children}
            {more && (
              <div>
                <Link className="aui-help-more" href={more.href} kind={more.external ? "external" : "next"}>
                  {more.label ?? "了解更多"}
                </Link>
              </div>
            )}
          </div>,
          portal,
        )}
    </>
  );
}
