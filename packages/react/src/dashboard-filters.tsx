"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Filter, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { BottomSheet } from "./sheets.tsx";
import { useIsMobile } from "./media-query.ts";
import { SegmentedControl } from "./choices.tsx";
import { DateRangePicker } from "./date-range-picker.tsx";
import { useAdminTheme } from "./theme.tsx";
import { HelpTip } from "./help-tip.tsx";
import {
  CUSTOM_TIME,
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_TIME_OPTIONS,
  decodeFilterContext,
  encodeFilterContext,
  filterChangeCount,
  validCustomRange,
  withDimension,
  type DashboardFilterValue,
  type FilterOption,
} from "./dashboard-filters-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

export {
  CUSTOM_TIME,
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_TIME_OPTIONS,
  RESERVED_FILTER_KEYS,
  carryFilterContext,
  decodeFilterContext,
  encodeFilterContext,
  filterChangeCount,
  validCustomRange,
  withDimension,
} from "./dashboard-filters-core.ts";
export type { DashboardFilterValue, FilterOption, FilterContextSpec, FilterDimensionSpec } from "./dashboard-filters-core.ts";

export type DashboardDimension = {
  key: string;
  /** Pill prefix (「业务线」). */
  label: string;
  options: readonly FilterOption[];
  /** Text for 「no filter」, default 「全部」 (「全部 5 人」). */
  allLabel?: string;
};

export type DashboardFilterBarProps = {
  value: DashboardFilterValue;
  onChange: (next: DashboardFilterValue) => void;
  /** What 「重置」 returns to (the dashboard's standard view). */
  defaultValue: DashboardFilterValue;
  /** Time segments; default 今天 / 本周 / 本月 / 自定义. The custom one shows two date inputs. */
  timeOptions?: readonly FilterOption[];
  /** Comparison bases with a one-line explanation each; default 环比 / 同比 / 目标. */
  compareOptions?: readonly FilterOption[];
  /** Why the comparison is what it is right now (「9-28 放假，自动改比 9-21 周一同时段」): a 「?」 next to the picker. */
  compareNote?: ReactNode;
  dimensions?: readonly DashboardDimension[];
  /** Slot for the 「+ 添加筛选」 control (nested condition builder lives elsewhere). */
  renderAddFilter?: (api: { value: DashboardFilterValue; onChange: (next: DashboardFilterValue) => void }) => ReactNode;
  /** 「保存为我的筛选」; a rejected promise keeps the bar as is and shows the message. */
  onSaveMine?: (value: DashboardFilterValue) => void | Promise<void>;
  saveLabel?: string;
  /** Filters the page cannot apply (labels), shown as 「未应用：渠道」 (DASHBOARDS.md §3). */
  unapplied?: readonly string[];
  /** Accessible name of the bar, default 「看板筛选」. */
  label?: string;
  /** Id of the custom-range segment, default 「custom」. */
  customTime?: string;
  /** Phones: time pill + 「筛选 · n」 bottom sheet (default: below 760px). Pass false to keep the row. */
  compactOnPhone?: boolean;
};

const ALL = "__aui_all__";

/**
 * A pill that opens a single-choice list (Radix Select with a pill trigger, in the Provider portal):
 * 30px, radius 8; no value = outline, a value = soft primary without border + bold + an 「×」 that clears
 * it (when there is an 「all」 choice); open = primary border + focus ring. A list with one option is a
 * plain text pill (no dropdown for nothing to choose).
 */
function FilterPill({ prefix, value, options, allLabel, onChange, describe }: { prefix: string; value: string | undefined; options: readonly FilterOption[]; allLabel?: string; onChange: (next: string | undefined) => void; describe?: boolean }) {
  const { portal } = useAdminTheme();
  const current = options.find((o) => o.value === value);
  const on = Boolean(current && allLabel !== undefined);
  if (options.length <= 1 && allLabel === undefined)
    return (
      <span className="aui-dfilter-pill" data-static="" data-tip={describe ? current?.description : undefined}>
        <span className="aui-dfilter-prefix">{prefix}</span>
        <b>{current?.label ?? options[0]?.label}</b>
      </span>
    );
  const list = allLabel !== undefined ? [{ value: ALL, label: allLabel }, ...options] : options;
  return (
    <span className="aui-dfilter-pillbox" data-on={on || undefined}>
      <SelectPrimitive.Root value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectPrimitive.Trigger className="aui-dfilter-pill" data-on={on ? "" : undefined} aria-label={`${prefix}：${current?.label ?? allLabel ?? ""}`} data-tip={describe ? current?.description : undefined}>
          <span className="aui-dfilter-prefix">{prefix}</span>
          <b>{current?.label ?? allLabel}</b>
          {!on && <ChevronDown aria-hidden="true" />}
        </SelectPrimitive.Trigger>
        {portal && (
          <SelectPrimitive.Portal container={portal}>
            <SelectPrimitive.Content className="aui-select-content aui-dfilter-menu" position="popper" sideOffset={4} align="start">
              <SelectPrimitive.Viewport>
                {list.map((o) => (
                  <SelectPrimitive.Item key={o.value} value={o.value} className="aui-select-item" data-described={describe && "description" in o && o.description ? "" : undefined}>
                    <span className="aui-dfilter-option">
                      <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                      {describe && "description" in o && o.description && <small>{o.description}</small>}
                    </span>
                    <SelectPrimitive.ItemIndicator>
                      <Check size={14} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        )}
      </SelectPrimitive.Root>
      {on && (
        <button type="button" className="aui-dfilter-clear" aria-label={`清除${prefix}筛选`} onClick={() => onChange(undefined)}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Phone: one choice list per filter inside the 「筛选」 bottom sheet (rows 40px). */
function SheetChoices({ title, value, options, allLabel, onChange }: { title: string; value: string | undefined; options: readonly FilterOption[]; allLabel?: string; onChange: (next: string | undefined) => void }) {
  const list = allLabel !== undefined ? [{ value: ALL, label: allLabel }, ...options] : options;
  return (
    <section className="aui-dfilter-sheet-sec" aria-label={title}>
      <h4>{title}</h4>
      <div className="aui-dfilter-sheet-list">
        {list.map((o) => {
          const picked = (value ?? ALL) === o.value;
          return (
            <button key={o.value} type="button" aria-pressed={picked} className="aui-dfilter-sheet-item" onClick={() => onChange(o.value === ALL ? undefined : o.value)}>
              <span>{o.label}</span>
              {picked && <Check aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Dashboard filter row (DASHBOARDS.md §3 skeleton, §5 filter context, §6 comparison; 审阅 06): one
 * unboxed line — time segments · comparison (each basis explained; a single basis is plain text) ·
 * dimension pills (a value = soft primary + 「×」) · the 「+ 筛选字段」 slot · 「重置」 only once something
 * differs from the dashboard's standard filters. Phones get the time pill + 「筛选 · n」 bottom sheet. The
 * whole state is one `DashboardFilterValue` — put it in the URL with `useDashboardFilters` /
 * `encodeFilterContext` and pass it on every drill with `carryFilterContext`.
 */
export function DashboardFilterBar({
  value,
  onChange,
  defaultValue,
  timeOptions = DEFAULT_TIME_OPTIONS,
  compareOptions = DEFAULT_COMPARE_OPTIONS,
  compareNote,
  dimensions = [],
  renderAddFilter,
  onSaveMine,
  saveLabel = "保存为我的筛选",
  unapplied,
  label = "看板筛选",
  customTime = CUSTOM_TIME,
  compactOnPhone = true,
}: DashboardFilterBarProps) {
  const id = useId();
  const mobile = useIsMobile();
  const compact = compactOnPhone && mobile;
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState({ from: value.from ?? "", to: value.to ?? "" });
  // The applied range changed from outside (Back button, reset, a saved filter): show it in the inputs.
  // A half-typed range never reaches `value`, so it is not overwritten while the user is still picking.
  const [shownFor, setShownFor] = useState({ from: value.from, to: value.to });
  if (shownFor.from !== value.from || shownFor.to !== value.to) {
    setShownFor({ from: value.from, to: value.to });
    setRange({ from: value.from ?? "", to: value.to ?? "" });
  }
  const changes = filterChangeCount(value, defaultValue);
  const custom = value.time === customTime;
  const pickTime = (time: string) => {
    if (time === customTime) {
      // Wait for both dates before applying a custom range; keep the previous range meanwhile.
      setRange({ from: value.from ?? "", to: value.to ?? "" });
      if (validCustomRange(value.from, value.to)) onChange({ ...value, time });
      else onChange({ ...value, time, from: undefined, to: undefined });
      return;
    }
    onChange({ time, compare: value.compare, dims: value.dims });
  };
  const applyRange = (next: { from: string; to: string }) => {
    setRange(next);
    if (validCustomRange(next.from, next.to)) onChange({ ...value, time: customTime, from: next.from, to: next.to });
  };
  const save = async () => {
    if (!onSaveMine) return;
    setSaving(true);
    setError("");
    try {
      await onSaveMine(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };
  const active = Object.values(value.dims).filter(Boolean).length + (compareOptions.length > 1 && value.compare !== defaultValue.compare ? 1 : 0);
  const reset = changes > 0 && (
    <Button size="sm" variant="ghost" className="aui-dfilter-reset" onClick={() => onChange(defaultValue)}>
      重置
    </Button>
  );
  const rangeBox = custom && (
    <span className="aui-dfilter-range">
      <DateRangePicker size="sm" aria-label="自定义时间范围" value={range} onChange={applyRange} />
      {!validCustomRange(range.from, range.to) && <span className="aui-dfilter-hint">选好开始和结束日期后生效</span>}
    </span>
  );
  if (compact)
    return (
      <div className="aui-dfilter" data-compact="" role="group" aria-label={label}>
        <div className="aui-dfilter-row">
          <FilterPill prefix="时间" value={value.time} options={timeOptions} onChange={(v) => v && pickTime(v)} />
          {rangeBox}
          {(dimensions.length > 0 || compareOptions.length > 1) && (
            <Button size="sm" variant="outline" className="aui-dfilter-more" aria-haspopup="dialog" onClick={() => setSheet(true)}>
              <Filter />
              筛选{active > 0 ? ` · ${active}` : ""}
            </Button>
          )}
          {reset}
        </div>
        <BottomSheet open={sheet} title="筛选" onClose={() => setSheet(false)} footer={<><Button variant="outline" disabled={changes === 0} onClick={() => onChange(defaultValue)}>重置</Button><Button onClick={() => setSheet(false)}>看结果</Button></>}>
          {compareOptions.length > 1 && <SheetChoices title="对比" value={value.compare} options={compareOptions} onChange={(v) => v && onChange({ ...value, compare: v })} />}
          {dimensions.map((d) => (
            <SheetChoices key={d.key} title={d.label} value={value.dims[d.key]} options={d.options} allLabel={d.allLabel ?? "全部"} onChange={(v) => onChange(withDimension(value, d.key, v))} />
          ))}
        </BottomSheet>
      </div>
    );
  return (
    <div className="aui-dfilter" role="group" aria-label={label}>
      <div className="aui-dfilter-row">
        <span className="aui-sr-only" id={`${id}-time`}>时间</span>
        <SegmentedControl size="sm" label="时间范围" value={value.time} onValueChange={pickTime} options={timeOptions.map((o) => ({ value: o.value, label: o.label }))} />
        {rangeBox}
        <FilterPill prefix="对比" value={value.compare} options={compareOptions} onChange={(v) => v && onChange({ ...value, compare: v })} describe />
        {compareNote && <HelpTip label="对比说明">{compareNote}</HelpTip>}
        {dimensions.map((d) => (
          <FilterPill key={d.key} prefix={d.label} value={value.dims[d.key]} options={d.options} allLabel={d.allLabel ?? "全部"} onChange={(v) => onChange(withDimension(value, d.key, v))} />
        ))}
        {renderAddFilter?.({ value, onChange })}
        {unapplied && unapplied.length > 0 && <span className="aui-dfilter-unapplied">未应用：{unapplied.join("、")}</span>}
        {reset}
        <span className="aui-dfilter-actions">
          {onSaveMine && (
            <Button size="sm" variant="outline" onClick={save} disabled={saving} aria-busy={saving || undefined}>
              <Filter />
              {saveLabel}
            </Button>
          )}
          {/* The page's own buttons (刷新 / 复制为我的看板) and its 「?」 land here when the bar opens the page. */}
          <span className="aui-page-actions-slot" />
        </span>
      </div>
      {error && (
        <p className="aui-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Filter context in the URL (DASHBOARDS.md §5): reads the initial value from `location.search`
 * (unknown values dropped), writes changes back with `history.pushState` so the back button returns
 * to the previous filters, and follows `popstate`. Other query keys on the page are kept.
 */
export function useDashboardFilters(
  defaults: DashboardFilterValue,
  spec: { times?: readonly FilterOption[]; compares?: readonly FilterOption[]; dimensions?: readonly DashboardDimension[]; url?: boolean; customTime?: string } = {},
) {
  const { url = true } = spec;
  const specRef = useRef(spec);
  specRef.current = spec;
  const read = useCallback(() => {
    const s = specRef.current;
    if (!url || typeof window === "undefined") return defaults;
    return decodeFilterContext(window.location.search, defaults, {
      times: s.times ?? DEFAULT_TIME_OPTIONS,
      compares: s.compares ?? DEFAULT_COMPARE_OPTIONS,
      dimensions: s.dimensions ?? [],
      customTime: s.customTime,
    });
  }, [url]); // defaults are the page's constants

  const [value, setValue] = useState<DashboardFilterValue>(read);
  useEffect(() => {
    if (!url) return;
    const onPop = () => setValue(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [url, read]);
  const change = useCallback(
    (next: DashboardFilterValue) => {
      setValue(next);
      if (!url || typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const known = ["t", "from", "to", "cmp", ...(specRef.current.dimensions ?? []).map((d) => d.key)];
      for (const key of known) params.delete(key);
      encodeFilterContext(next, defaults, { customTime: specRef.current.customTime }).forEach((v, k) => params.set(k, v));
      const search = params.toString();
      window.history.pushState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
    },
    [url], // defaults are the page's constants
  );
  return [value, change] as const;
}
