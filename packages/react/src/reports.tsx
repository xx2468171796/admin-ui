"use client";
import { useState, type ReactNode } from "react";
import { Button, Choice } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { DateRangePicker } from "./date-range-picker.tsx";
import { validateReportRange, type ReportFilter } from "./reports-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
export { validateReportRange, buildCsv, downloadCsv } from "./reports-core.ts";
export type { ReportFilter, CsvColumn } from "./reports-core.ts";

export type ReportPreset = { label: string; start: string; end: string };

export type ReportToolbarProps = {
  value: ReportFilter;
  sources: readonly { value: string; label: string }[];
  presets?: readonly ReportPreset[];
  /** Called as soon as a valid change is picked (preset, both dates, source) — there is no 「查询」 button. */
  onApply: (value: ReportFilter) => void;
  /** 「重置」: shown only while `value` differs from `defaultValue` (always shown when no default is given). */
  onReset: () => void;
  /** The report's standard filters (what 「重置」 returns to). */
  defaultValue?: ReportFilter;
  /** 「数据截至 14:05」. */
  freshness?: string;
  /** Right end: 刷新 / 导出 buttons. */
  actions?: ReactNode;
  maxDays?: number;
};

const CUSTOM = "__custom__";

/**
 * Report toolbar (审阅 06 第 8 项): the same unboxed one-line strip as the dashboard filter row —
 * date presets · date range · source · (changed) 「重置」 ‖ 数据截至 · actions. A choice applies at once;
 * an invalid range (end before start, longer than `maxDays`) stays in the inputs with the reason and is
 * not applied. The old 「查询」 button is gone.
 */
export function ReportToolbar({ value, sources, presets = [], onApply, onReset, defaultValue, freshness, actions, maxDays = 366 }: ReportToolbarProps) {
  const [range, setRange] = useState({ from: value.start, to: value.end });
  const [shown, setShown] = useState({ start: value.start, end: value.end });
  const [error, setError] = useState("");
  if (shown.start !== value.start || shown.end !== value.end) {
    setShown({ start: value.start, end: value.end });
    setRange({ from: value.start, to: value.end });
    setError("");
  }
  const apply = (next: ReportFilter) => {
    const invalid = validateReportRange(next, maxDays);
    if (invalid) return setError(invalid);
    if (!sources.some((source) => source.value === next.source)) return setError("请选择有效的统计来源");
    setError("");
    onApply(next);
  };
  const preset = presets.find((p) => p.start === value.start && p.end === value.end);
  const changed = !defaultValue || defaultValue.start !== value.start || defaultValue.end !== value.end || defaultValue.source !== value.source;
  return (
    <div className="aui-report-toolbar" role="group" aria-label="报表筛选">
      <div className="aui-report-row">
        {presets.length > 0 && (
          <SegmentedControl
            size="sm"
            label="时间范围"
            value={preset ? preset.label : CUSTOM}
            options={[...presets.map((p) => ({ value: p.label, label: p.label })), ...(preset ? [] : [{ value: CUSTOM, label: "自定义" }])]}
            onValueChange={(label) => {
              const p = presets.find((x) => x.label === label);
              if (p) apply({ ...value, start: p.start, end: p.end });
            }}
          />
        )}
        <DateRangePicker
          size="sm"
          aria-label="统计日期"
          value={range}
          onChange={(next) => {
            setRange(next);
            if (next.from && next.to) apply({ ...value, start: next.from, end: next.to });
          }}
        />
        <span className="aui-report-source">
          <Choice label="统计来源" value={value.source} options={sources} onChange={(source) => apply({ ...value, source })} />
        </span>
        {changed && (
          <Button variant="ghost" size="sm" onClick={() => { setError(""); onReset(); }}>
            重置
          </Button>
        )}
        <span className="aui-report-end">
          {freshness && <span className="aui-note">{freshness}</span>}
          {actions}
        </span>
      </div>
      {error && (
        <p role="alert" className="aui-error">
          {error}
        </p>
      )}
    </div>
  );
}
