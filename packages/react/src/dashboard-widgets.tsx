"use client";
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { cohortMax, cohortShade, funnelStats } from "./dashboard-kit-core.ts";
import { formatNumber, type Delta } from "./dashboard-core.ts";
import { DeltaBadge } from "./delta-badge.tsx";
import { BulletBar, type BulletBarProps } from "./bullet-bar.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

const percent = (ratio: number, digits = 1) => `${(Math.round(ratio * 100 * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
const cssVars = (vars: Record<string, string>) => vars as CSSProperties;

// ---------------------------------------------------------------- StepFunnel (D30)

export type FunnelStep = {
  key: string;
  /** Short stage code shown bold before the label (M0 / M1 …). */
  code?: string;
  label: string;
  /** People / orders that reached this step. null = unknown (「—」, never 0). */
  count: number | null;
  /** Change of this step's conversion vs the comparison period (computeDelta(..., { mode: "points" })). */
  delta?: Delta | null;
};
export type StepFunnelProps = {
  steps: readonly FunnelStep[];
  /** Accessible name of the funnel (「8 月进线客户卡在哪一步」). */
  label: string;
  /** What the deltas compare against (「比 7 月同天龄」), spoken with each change. */
  comparison?: string;
  /** Grey text in the rate column of the first step (「这批进线的客户」). */
  firstNote?: ReactNode;
  /** Mark the step that loses the most: by absolute count (default) or by the lowest step rate. */
  dropBy?: "count" | "rate";
  /** false = no 「流失最多」 badge. */
  markDrop?: boolean;
  dropLabel?: string;
  /** Counts formatter, default formatNumber. */
  format?: (count: number) => string;
  /** Decimal places of the rates, default 1. */
  digits?: number;
  /** Footer line; default 「整体转化 x%（last / first）」. Pass null to hide. */
  footer?: ReactNode;
};

/**
 * Conversion funnel as horizontal bars (DASHBOARDS.md §2.2 / D30): count per step, step conversion
 * with its denominator, overall conversion, the biggest drop flagged. Bars are the brand colour —
 * steps are an ordered magnitude, not categories or states; only the drop badge uses the attention tone.
 */
export function StepFunnel({ steps, label, comparison, firstNote, dropBy = "count", markDrop = true, dropLabel = "流失最多", format = (n) => formatNumber(n), digits = 1, footer }: StepFunnelProps) {
  const stats = funnelStats(steps, dropBy);
  const first = steps[0]?.count;
  const last = steps[steps.length - 1]?.count;
  const overall =
    footer !== undefined
      ? footer
      : stats.overall !== null && first != null && last != null
        ? `整体转化 ${percent(stats.overall, digits)}（${format(last)} / ${format(first)}）`
        : null;
  return (
    <div className="aui-funnel">
      <ol aria-label={label}>
        {steps.map((step, i) => {
          const s = stats.steps[i]!;
          const drop = markDrop && stats.biggestDrop === i;
          const prev = steps[i - 1]?.count;
          const inside = s.width > 0.3;
          const spoken = [
            `${step.code ? `${step.code} ` : ""}${step.label}`,
            step.count === null ? "—" : format(step.count),
            s.stepRate !== null && prev != null ? `上一步转化 ${percent(s.stepRate, digits)}（${format(step.count ?? 0)} / ${format(prev)}）` : "",
            s.overallRate !== null && i > 0 ? `整体 ${percent(s.overallRate, digits)}` : "",
            drop ? dropLabel : "",
          ].filter(Boolean).join("，");
          return (
            <li key={step.key} className="aui-funnel-step" data-drop={drop || undefined} aria-label={spoken}>
              <span className="aui-funnel-label">
                {step.code && <b>{step.code}</b>}
                {step.label}
              </span>
              <span className="aui-funnel-track" aria-hidden="true">
                <i style={{ width: `${Math.max(s.width * 100, step.count ? 1.5 : 0)}%` }} />
                <span className="aui-funnel-count" data-inside={inside || undefined} style={inside ? undefined : { left: `calc(${s.width * 100}% + 6px)` }}>
                  {step.count === null ? "—" : format(step.count)}
                </span>
              </span>
              <span className="aui-funnel-rate">
                {drop && <span className="aui-funnel-drop">{dropLabel}</span>}
                {i === 0 ? (
                  firstNote && <small>{firstNote}</small>
                ) : (
                  <>
                    <b data-tip={s.overallRate !== null ? `整体 ${percent(s.overallRate, digits)}` : undefined}>{s.stepRate === null ? "—" : percent(s.stepRate, digits)}</b>
                    {step.count !== null && prev != null && <small>{`${format(step.count)} / ${format(prev)}`}</small>}
                    {step.delta !== undefined && <DeltaBadge delta={step.delta} comparison={comparison} size="sm" />}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {overall && <p className="aui-funnel-foot">{overall}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- CohortTable (D30)

export type CohortRow = {
  key: string;
  /** Cohort name (「8 月」). */
  label: ReactNode;
  /** Cohort size shown after the name (「312 位」). */
  size?: ReactNode;
  /** One value per period; null = the cohort has not reached that age yet → 「未到期」, never 0. */
  values: readonly (number | null)[];
};
export type CohortTableProps = {
  /** Column heads (「7 天」「30 天」…). */
  periods: readonly string[];
  rows: readonly CohortRow[];
  /** Table caption for screen readers (「每批进线最后成交多少」). */
  label: string;
  /** Head of the first column, default 「批次」. */
  rowHeader?: string;
  /** Cell text, default ratio → 「12.6%」. */
  format?: (value: number) => string;
  /** Colour scale end; default the largest value. */
  max?: number;
  notDueLabel?: string;
};

/**
 * Cohort table (DASHBOARDS.md §12.3): rows = batches, columns = age; cells are shaded in the brand
 * hue by magnitude (single-hue sequential, 2px gaps), the text flips to white on dark cells, and an
 * age the batch has not reached yet is an outlined 「未到期」 cell — not 0, not blank-looking-like-0.
 */
export function CohortTable({ periods, rows, label, rowHeader = "批次", format = (v) => percent(v), max, notDueLabel = "未到期" }: CohortTableProps) {
  const scaleEnd = max ?? cohortMax(rows.map((r) => r.values));
  return (
    <div className="aui-cohort">
      <table>
        <caption className="aui-sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {periods.map((p) => (
              <th key={p} scope="col">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.label}
                {row.size !== undefined && <small>{row.size}</small>}
              </th>
              {periods.map((p, i) => {
                const v = row.values[i];
                // Not due only when the value is missing; a real 0 (even an all-zero table) is a floor-shaded cell.
                const shade = cohortShade(v, scaleEnd);
                if (v == null || !shade)
                  return (
                    <td key={p} data-due="no">
                      {notDueLabel}
                    </td>
                  );
                return (
                  <td key={p} data-on-brand={shade.onBrand || undefined} style={cssVars({ "--aui-heat": `${shade.percent}%` })}>
                    {format(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- RollupCard (D31)

export type RollupMetric = {
  key: string;
  label: string;
  /** null = 「—」 (no data / not applicable). */
  value: ReactNode | null;
  unit?: string;
  delta?: Delta | null;
  /** Unit after an absolute delta (「分」「位」). */
  deltaUnit?: string;
  /** Grey line instead of the delta (「假期无到期计划」「财务模块上线后显示」). */
  note?: ReactNode;
};
export type RollupCardProps = {
  /** Entity name: business line, subsidiary, region, store. */
  title: string;
  /** Anomaly pill after the name (「进线骤降」): danger tone with an icon. */
  anomaly?: string;
  /** Headline value, pre-formatted (「US$ 204.0」). */
  value: ReactNode | null;
  unit?: string;
  /** Grey text after the value (「/ 目标 1,200 万 · 已达 17.0%」). */
  targetText?: ReactNode;
  delta?: Delta | null;
  /** What the headline delta compares against — spoken with it. */
  comparison?: string;
  /** Value vs target bullet (label defaults to the title). */
  bullet?: Omit<BulletBarProps, "label" | "size">;
  /** Small metric strip (≤ 4 cells; placeholders use `value: null` + `note`). */
  metrics?: readonly RollupMetric[];
  /** Info line above the card body (「按大陆日历：国庆假期中」). */
  note?: ReactNode;
  /** Drill link (keeps the filter context — see carryFilterContext). */
  onDrill?: () => void;
  drillLabel?: string;
};

/**
 * One entity's roll-up on an overview (D31 boss overview): name + anomaly pill + drill link, the
 * headline value against its target with a bullet (incl. time progress), and a small metric strip.
 * Stack several inside a `Panel flush`; each card is separated by a line.
 */
export function RollupCard({ title, anomaly, value, unit, targetText, delta, comparison, bullet, metrics, note, onDrill, drillLabel = "查看" }: RollupCardProps) {
  return (
    <article className="aui-rollup" aria-label={title}>
      {note && <p className="aui-rollup-note">{note}</p>}
      <header className="aui-rollup-head">
        <h3>{title}</h3>
        {anomaly && (
          <span className="aui-rollup-anomaly">
            <TriangleAlert aria-hidden="true" />
            {anomaly}
          </span>
        )}
        {onDrill && (
          <button type="button" className="aui-rollup-drill" onClick={onDrill}>
            {drillLabel}
            <ChevronRight aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="aui-rollup-value">
        <strong>
          {value ?? "—"}
          {unit && value != null && <small>{unit}</small>}
        </strong>
        {targetText && <span>{targetText}</span>}
        {delta !== undefined && <DeltaBadge delta={delta} comparison={comparison} size="sm" />}
      </div>
      {bullet && <BulletBar {...bullet} label={`${title}目标完成`} size="sm" />}
      {metrics && metrics.length > 0 && (
        <dl className="aui-rollup-metrics" data-cols={Math.min(metrics.length, 4)}>
          {metrics.map((m) => (
            <div key={m.key} data-empty={m.value == null || undefined}>
              <dt data-tip={m.label}>{m.label}</dt>
              <dd>
                <strong>
                  {m.value ?? "—"}
                  {m.unit && m.value != null && <small>{m.unit}</small>}
                </strong>
                {m.note ? <span data-tip={typeof m.note === "string" ? m.note : undefined}>{m.note}</span> : m.delta !== undefined ? <DeltaBadge delta={m.delta} comparison={comparison} unit={m.deltaUnit} size="sm" /> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
