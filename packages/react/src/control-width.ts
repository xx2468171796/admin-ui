import type { CSSProperties } from "react";

/** A control's `width` prop (Input, Choice, MultiChoice, AsyncChoice): a number = px, or any CSS length. */
export type ControlWidth = number | string;

/**
 * `style` plus the control width as `inline-size`, never wider than its container (phones). Unchanged when no
 * width is given — hosts used to write `.x > .aui-select { width }` overrides for this.
 */
export function withWidth(style: CSSProperties | undefined, width: ControlWidth | undefined): CSSProperties | undefined {
  if (width === undefined || width === "") return style;
  return { ...style, inlineSize: typeof width === "number" ? `${width}px` : width, maxInlineSize: "100%" };
}
