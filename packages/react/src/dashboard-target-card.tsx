"use client";
/**
 * The 「目标进度」 dashboard card (widget kind `targetProgress`): actual / target, 完成率, a bullet bar with the
 * 「按时间应完成」 marker (the share of the period passed), then 「还差 X · 剩 N 天」 or 「已超额 X」, and a grey line with
 * the period and whose target it is (「本月 · 全公司目标」). No target: the actual value and 「还没有目标」 + 「设目标」.
 * Values format like the other cards: a currency symbol, a unit, or durations (unit "duration", seconds).
 * Rules: dashboard-target-core.ts.
 */
import { Goal } from "lucide-react";
import { Button } from "./primitives.tsx";
import { BulletBar } from "./bullet-bar.tsx";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { chartValueText } from "./chart-options-kinds.ts";
import { currencySymbol } from "./number-input-core.ts";
import { formatDuration, isDurationUnit } from "./duration-format.ts";
import { targetProgress, type TargetPeriod } from "./dashboard-target-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

/** What the host returns for a 「目标进度」 card (`loadWidgetData` → `{ kind: "targetProgress", ... }`). */
export type TargetProgressData = {
  /** The actual value in the period (null = no data, shown 「—」, never 0). */
  value: number | null;
  /** The period's target (null = none set → 「设目标」). */
  target: number | null;
  /** The target's period (「本月」: the month's first and last day, both included). */
  period?: TargetPeriod;
  /** Whose target it is (「全公司目标」), after the period label. */
  targetNote?: string;
  /** Unit after the values (「单」); "duration" = seconds shown as 「3.2 小时」 / 「1.5 天」. */
  unit?: string;
  /** Money metrics: ISO code (「CNY」) or symbol before the values. */
  currency?: string;
  /** Decimals below 1 万 (default 0). */
  digits?: number;
  /** 「Now」 for the time marker (epoch ms; default the current time). */
  now?: number;
};

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export function TargetProgressCard({ title, data, onSetTarget }: { title: string; data: TargetProgressData; onSetTarget?: () => void }) {
  const { timeZone } = useAdminDefaults();
  const symbol = currencySymbol(data.currency);
  const text = (v: number | null) => {
    if (isDurationUnit(data.unit)) return formatDuration(v);
    if (v === null || !Number.isFinite(v)) return "—";
    return `${symbol}${chartValueText(v, data.digits ?? 0)}${data.unit ? ` ${data.unit}` : ""}`;
  };
  const p = targetProgress({ value: data.value, target: data.target, period: data.period, now: data.now, timeZone });
  const hasTarget = typeof data.target === "number" && data.target > 0;
  const note = [data.period?.label, data.targetNote].filter(Boolean).join(" · ");
  const left = p.daysLeft !== null ? ` · 剩 ${p.daysLeft} 天` : "";
  const status = p.over !== null ? `已超额 ${text(p.over)}` : p.gap !== null ? `还差 ${text(p.gap)}${left}` : p.ratio !== null ? `已完成${left}` : "";
  return (
    <div className="aui-dbb-target" data-state={!hasTarget ? "none" : p.over !== null || (p.ratio ?? 0) >= 1 ? "done" : undefined}>
      <div className="aui-dbb-target-head">
        <p className="aui-dbb-big">
          <strong>{text(data.value)}</strong>
          {hasTarget && <small>/ 目标 {text(data.target)}</small>}
        </p>
        {p.ratio !== null && <span className="aui-dbb-target-rate">完成率 <b>{percent(p.ratio)}</b></span>}
      </div>
      {hasTarget ? (
        <>
          <BulletBar value={data.value} target={data.target} timeProgress={p.elapsed} expectedLabel={p.elapsed !== null ? `按时间应完成 ${percent(p.elapsed)}` : undefined} format={(n) => text(n)} label={`${title}目标进度`} size="sm" />
          {status && <p className="aui-dbb-target-status">{status}</p>}
        </>
      ) : (
        <p className="aui-dbb-target-empty">
          <Goal aria-hidden="true" />
          还没有目标
          {onSetTarget && <Button size="sm" variant="outline" onClick={onSetTarget}>设目标</Button>}
        </p>
      )}
      {note && <p className="aui-dbb-detail">{note}</p>}
    </div>
  );
}
