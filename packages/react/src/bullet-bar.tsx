"use client";
import type { CSSProperties, ReactNode } from "react";
import { bulletGeometry, bulletLabels, ringGeometry, type BulletMark } from "./dashboard-kit-core.ts";
import { formatNumber } from "./dashboard-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

export type BulletBarProps = {
  /** Current value. null = no data: an empty track and 「—」 for screen readers, never a 0-width bar. */
  value: number | null | undefined;
  /** Target tick. */
  target?: number | null;
  /** Scale end; default = the larger of target and value (the target tick then sits at the right end). */
  max?: number | null;
  /** Scale start, default 0. */
  min?: number;
  /** Share of the period elapsed (0..1) → dashed 「expected by now」 marker at min + (target − min) × timeProgress. */
  timeProgress?: number | null;
  /** Qualitative band thresholds in value units (e.g. [50, 80]): grey shades on the track, darker = worse. */
  bands?: readonly number[];
  /** The period is not over yet: the bar is drawn hollow-dashed like an in-progress chart bucket. */
  inProgress?: boolean;
  /** Accessible name — the metric (「按时有效跟进率」). */
  label: string;
  /** Formats scale labels and the spoken value; default formatNumber. */
  format?: (value: number) => string;
  /** Text under the target tick, default 「目标」 (+ the value when the tick is not at the end). */
  targetLabel?: string;
  /** Text under the expected-by-now marker, default 「时间进度」 + percent. */
  expectedLabel?: string;
  /** Show the label row under the track (default true). */
  scale?: boolean;
  /** sm = 8px track for KPI cards and rollups; md = 10px. */
  size?: "md" | "sm";
};

const pct = (ratio: number) => `${Math.round(ratio * 1000) / 10}%`;
const at = (ratio: number): CSSProperties => ({ left: pct(ratio) });
/** Labels never hang outside the track: the time label starts at its marker (its arrow points at it),
 *  a target in the right part ends at its tick, the rest centre unless they sit at an end. */
const alignOf = (m: BulletMark) =>
  m.kind === "expected" ? (m.ratio > 0.6 ? "end" : "start") : m.ratio < 0.12 ? "start" : m.ratio > 0.6 && m.kind !== "min" ? "end" : "center";

function markText(mark: BulletMark, props: BulletBarProps, fmt: (n: number) => string) {
  if (mark.kind === "target") return mark.ratio < 1 ? `${props.targetLabel ?? "目标"} ${fmt(mark.at)}` : (props.targetLabel ?? "目标");
  if (mark.kind === "expected") return `↑ ${props.expectedLabel ?? `时间进度 ${pct(props.timeProgress ?? 0)}`}`;
  return mark.kind === "min" && mark.at === 0 ? "0" : fmt(mark.at);
}

/**
 * Bullet graph (Few; DASHBOARDS.md §1): one bar for the current value, a solid tick for the target,
 * an optional dashed 「expected by now」 marker from the time progress, optional grey qualitative
 * bands. Use it wherever completion against a target is shown — not gauges, rings or pies.
 */
export function BulletBar(props: BulletBarProps) {
  const { value, label, inProgress, scale = true, size = "md" } = props;
  const fmt = props.format ?? ((n: number) => formatNumber(n, { digits: Number.isInteger(n) ? 0 : 1 }));
  const g = bulletGeometry(props);
  const marks = scale ? bulletLabels(g) : [];
  const has = typeof value === "number" && Number.isFinite(value);
  const spoken = [
    has ? fmt(value) : "—",
    props.target != null ? `目标 ${fmt(props.target)}` : "",
    g.expectedValue !== null ? `按时间进度应达 ${fmt(g.expectedValue)}${g.behind ? "，落后" : ""}` : "",
    inProgress ? "进行中" : "",
  ].filter(Boolean).join("，");
  let from = 0;
  return (
    <div
      className="aui-bullet"
      data-size={size}
      data-banded={props.bands?.length ? "" : undefined}
      role="meter"
      aria-label={label}
      aria-valuemin={g.min}
      aria-valuemax={g.max}
      aria-valuenow={has ? Math.min(Math.max(value, g.min), g.max) : undefined}
      aria-valuetext={spoken}
    >
      <div className="aui-bullet-track" aria-hidden="true">
        {props.bands?.length
          ? g.bands.map((end, i) => {
              const style = { left: pct(from), width: pct(end - from) };
              from = end;
              return <i key={i} className="aui-bullet-band" data-level={Math.min(i, 3)} style={style} />;
            })
          : null}
        {g.value !== null && <span className="aui-bullet-fill" data-progress={inProgress || undefined} style={{ width: pct(g.value) }} />}
        {g.expected !== null && <span className="aui-bullet-expected" style={at(g.expected)} />}
        {g.target !== null && <span className="aui-bullet-target" style={at(g.target)} />}
      </div>
      {marks.length > 0 && (
        <div className="aui-bullet-scale" aria-hidden="true">
          {marks.map((m) => (
            <span key={m.kind} data-kind={m.kind} data-align={alignOf(m)} style={at(m.ratio)}>
              {markText(m, props, fmt)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export type ProgressRingProps = {
  value: number | null | undefined;
  max: number;
  /** Target tick on the ring (「目标 80%」 → 0.8 × max). */
  target?: number | null;
  /** Accessible name (「已按时有效跟进」). */
  label: string;
  /** Centre content; default 「value / max」 and the percent. */
  children?: ReactNode;
  /** Spoken value; default 「value / max（percent）」. */
  valueText?: string;
  /** Pixel size, default 92 (D29m). */
  size?: number;
};

/**
 * Progress ring with a target tick — ONLY for one person's own progress on a phone (「我的今天」,
 * D29m), where a single number dominates a narrow card. Everywhere else (team, line, company,
 * desktop KPI rows, tables) use BulletBar: rings and gauges are hard to compare (DASHBOARDS.md §1).
 */
export function ProgressRing({ value, max, target, label, children, valueText, size = 92 }: ProgressRingProps) {
  const g = ringGeometry({ value, max, target, size });
  const has = typeof value === "number" && Number.isFinite(value);
  const percent = g.ratio === null ? null : Math.round(g.ratio * 100);
  return (
    <div
      className="aui-ring"
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={has ? Math.min(Math.max(value, 0), max) : undefined}
      aria-valuetext={valueText ?? (has ? `${value} / ${max}（${percent}%）${target != null ? `，目标 ${target}` : ""}` : "—")}
    >
      <svg viewBox={`0 0 ${g.size} ${g.size}`} width={g.size} height={g.size} aria-hidden="true" focusable="false">
        <circle className="aui-ring-track" cx={g.center} cy={g.center} r={g.r} strokeWidth={g.stroke} />
        {g.ratio !== null && g.ratio > 0 && (
          <circle
            className="aui-ring-fill"
            cx={g.center}
            cy={g.center}
            r={g.r}
            strokeWidth={g.stroke}
            strokeDasharray={`${g.dash} ${g.circumference}`}
            transform={`rotate(-90 ${g.center} ${g.center})`}
          />
        )}
        {g.tick && <line className="aui-ring-target" {...g.tick} />}
      </svg>
      <div className="aui-ring-center" aria-hidden="true">
        {children ?? (
          <>
            <strong>
              {has ? value : "—"}
              <small> / {max}</small>
            </strong>
            {percent !== null && <span>{percent}%</span>}
          </>
        )}
      </div>
    </div>
  );
}
