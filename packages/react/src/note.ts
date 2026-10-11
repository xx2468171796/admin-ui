import { createElement, type HTMLAttributes } from "react";

export type NoteTone = "default" | "danger" | "warning" | "success" | "info";
export type NoteProps = HTMLAttributes<HTMLElement> & {
  /** Element: p (default, a line of its own), span (inline after a label), div (wraps blocks). */
  as?: "p" | "span" | "div";
  /** default = the note grey; danger / warning / success / info colour the text (never the only signal: say it in words). */
  tone?: NoteTone;
};

/**
 * Secondary text (`.aui-note`: 12px, note colour): help under a block, a hint after a label, 「只显示前 50 条」.
 * Replaces hand-written `<p className="aui-note">`; container rules (panel heads, dialog footers) still apply.
 */
export function Note({ as = "p", tone = "default", className, style, ...rest }: NoteProps) {
  const color = tone === "default" ? undefined : `var(--aui-${tone})`;
  return createElement(as, {
    ...rest,
    className: className ? `aui-note ${className}` : "aui-note",
    "data-note-tone": color ? tone : undefined,
    style: color ? { color, ...style } : style,
  });
}
