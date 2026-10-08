/**
 * ChangeValue: the one way to write 「改前 → 改后」 — the old value grey with a strikethrough,
 * an arrow, the new value bold. Used by cell / record history, operation logs, AI suggestions, conflict
 * tables, permission diffs and share access logs; hosts use it for any before → after of their own.
 * An empty old value (created) reads 「空」 without a strikethrough; `before === undefined` shows only the
 * new value (nothing to compare). Screen readers hear 「A 改成 B」.
 */
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";

export type ChangeValueProps = {
  /** Old value as displayed (a string, a tag, an avatar chip). `null` / "" = empty before; `undefined` = no old value shown. */
  before?: ReactNode;
  /** New value as displayed. `null` / "" = cleared (reads 「空」). */
  after: ReactNode;
  /** Unit after both values (「元」「%」). */
  unit?: string;
  /** Text for an empty value (default 「空」). */
  emptyLabel?: string;
  /** Screen-reader word between the two (default 「改成」). */
  arrowLabel?: string;
  /** Wrap the two values onto separate lines when narrow (default: one line that wraps naturally). */
  stacked?: boolean;
  className?: string;
};

const blank = (v: ReactNode) => v === null || v === "" || v === false;

/** See the module comment. */
export function ChangeValue({ before, after, unit, emptyLabel = "空", arrowLabel = "改成", stacked, className }: ChangeValueProps) {
  const value = (v: ReactNode) => (blank(v) ? emptyLabel : <>{v}{unit && <span className="aui-change-value-unit">{unit}</span>}</>);
  return (
    <span className={["aui-change-value", className].filter(Boolean).join(" ")} data-stacked={stacked || undefined}>
      {before !== undefined && (
        <>
          {blank(before) ? <span className="aui-change-value-before" data-empty="">{emptyLabel}</span> : <s className="aui-change-value-before">{value(before)}</s>}
          <ArrowRight className="aui-change-value-arrow" aria-hidden="true" />
          <span className="aui-sr-only">{arrowLabel}</span>
        </>
      )}
      <b className="aui-change-value-after" data-empty={blank(after) || undefined}>{value(after)}</b>
    </span>
  );
}
