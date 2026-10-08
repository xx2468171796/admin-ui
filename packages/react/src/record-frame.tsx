"use client";
/**
 * The frame a record opens in from a view (review 08 item 8): right drawer 640 (default from
 * kanban / gallery / calendar / gantt — no overlay, no blur, the view stays clickable), centred dialog, or the
 * record's own page — one frame, switchable from its title bar. The title bar only holds the frame's things:
 * left ↑ ↓ previous / next with 「8 / 13 · 按阶段」, right copy link · ⋯ | the three frames | ×; business buttons
 * (关注, 记跟进) stay in the record header below.
 */
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Link2, Maximize, PanelRight, RectangleHorizontal } from "lucide-react";
import { MoreMenu, IconButton } from "./buttons.tsx";
import type { MenuSection } from "./menu.tsx";

import { RECORD_FRAMES, RECORD_FRAME_LABELS, recordFrameNavText, type RecordFrame, type RecordFrameNav } from "./record-frame-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

export { RECORD_FRAMES, RECORD_FRAME_LABELS, recordFrameNavText, type RecordFrame, type RecordFrameNav } from "./record-frame-core.ts";
const FRAME_ICONS = { drawer: PanelRight, dialog: RectangleHorizontal, page: Maximize } as const;

export type RecordFrameBarProps = {
  nav?: RecordFrameNav;
  frame: RecordFrame;
  /** Offer the three frames (drawer / dialog / page); without it the switch is not shown. */
  onFrameChange?: (frame: RecordFrame) => void;
  /** 「复制链接」. */
  onCopyLink?: () => void;
  /** The frame's ⋯ (open in a new window, history …). */
  menu?: readonly MenuSection[];
  /** The close button (Dialog hands its own in). */
  close: ReactNode;
};

/** See the module comment. */
export function RecordFrameBar({ nav, frame, onFrameChange, onCopyLink, menu, close }: RecordFrameBarProps) {
  return (
    <div className="aui-rframe-bar">
      {nav && nav.total > 0 && (
        <span className="aui-rframe-nav" role="group" aria-label="切换记录">
          <IconButton label="上一条（↑）" disabled={nav.index <= 0} onClick={() => nav.onMove(-1)} icon={<ChevronUp aria-hidden="true" />} />
          <IconButton label="下一条（↓）" disabled={nav.index >= nav.total - 1} onClick={() => nav.onMove(1)} icon={<ChevronDown aria-hidden="true" />} />
          <span className="aui-rframe-count" aria-live="polite">{recordFrameNavText(nav)}</span>
        </span>
      )}
      <span className="aui-rframe-tools">
        {onCopyLink && (
          <IconButton label="复制链接" onClick={onCopyLink} icon={<Link2 aria-hidden="true" />} />
        )}
        {menu && menu.some((section) => section.items.length > 0) && <MoreMenu sections={menu} label="更多" size="sm" />}
        {onFrameChange && (
          <span className="aui-rframe-switch" role="group" aria-label="打开方式">
            {RECORD_FRAMES.map((f) => {
              const Icon = FRAME_ICONS[f];
              return (
                <button key={f} type="button" className="aui-rframe-mode" aria-pressed={f === frame} aria-label={RECORD_FRAME_LABELS[f]} data-tip={RECORD_FRAME_LABELS[f]} onClick={() => f !== frame && onFrameChange(f)}>
                  <Icon aria-hidden="true" />
                </button>
              );
            })}
          </span>
        )}
        {close}
      </span>
    </div>
  );
}
