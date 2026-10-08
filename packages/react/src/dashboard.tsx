"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronRight, Info, type LucideIcon } from "lucide-react";
import { Panel } from "./layout.tsx";
import { HelpTip } from "./help-tip.tsx";
import { DeltaBadge } from "./delta-badge.tsx";
import { BulletBar, type BulletBarProps } from "./bullet-bar.tsx";
import {
  freshnessOf,
  pollDelayMs,
  sparklinePath,
  type Delta,
  type Freshness,
} from "./dashboard-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

export {
  computeDelta,
  deltaTone,
  formatNumber,
  roundShares,
  effectiveSampleSize,
  toleranceBand,
  roundsForTolerance,
  judgeAgainstBand,
  funnelLimits,
  freshnessOf,
  pickBucketMs,
  pollDelayMs,
  sparklinePath,
} from "./dashboard-core.ts";
export type { Better, Delta, DeltaMode, Freshness, BandVerdict } from "./dashboard-core.ts";
export { VIZ_BRAND, vizBrandStep } from "./viz-palette.ts";
export { VIZ_CATEGORY_HUES, VIZ_OTHER, VIZ_SURFACE, VIZ_TEXT, VIZ_SECONDARY, VIZ_NOTE, VIZ_TRACK, vizCategory, vizOptionColor, chartColors, resolveVizToken, type ChartColors } from "./viz-palette.ts";
export { ChartState, type ChartStateKind, type ChartStateProps } from "./chart-state.tsx";

/**
 * KpiCard's plain-SVG trend line (no chart instance: dozens of canvases exhaust mobile memory, and SVG follows
 * CSS colour tokens in dark mode). Decorative by default because the card already states the value;
 * pass `label` when the trend is the only carrier of the information.
 */
function KpiTrend({
  values,
  height = 32,
  inProgress = false,
  label,
  inline = false,
}: {
  values: readonly (number | null | undefined)[];
  height?: number;
  inProgress?: boolean;
  label?: string;
  inline?: boolean;
}) {
  const { main, tail } = sparklinePath(values, 100, height, { inProgress });
  if (!main && !tail) return null;
  return (
    <svg
      className="aui-sparkline"
      data-inline={inline || undefined}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      height={height}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {main && <path d={main} vectorEffect="non-scaling-stroke" />}
      {tail && <path d={tail} vectorEffect="non-scaling-stroke" className="aui-sparkline-tail" />}
    </svg>
  );
}

export type KpiTag = string | { label: string; tone?: "brand" | "info" | "neutral" };
/** Bullet inside a KPI card: current vs target on one scale (see BulletBar). */
export type KpiTarget = Omit<BulletBarProps, "label" | "timeProgress" | "size" | "inProgress">;

export type KpiCardProps = {
  title: string;
  /** Pre-formatted value (use formatNumber / formatMinorMoney). null renders "—", never 0.
   *  Keep it short: ≥ 1万 use formatNumber(..., { compact: true }) and pass the exact figure as fullValue. */
  value: ReactNode | null;
  /** Exact value shown on hover / read by screen readers when `value` is abbreviated (万/亿). */
  fullValue?: string;
  unit?: string;
  /** From computeDelta(). null renders "—" (comparison defined but data missing); omit for cards without a comparison. */
  delta?: Delta | null;
  /** What the delta compares against — always say it: "比上周同一天", "比目标", "理论 95.0%". */
  comparison?: string;
  trend?: readonly (number | null | undefined)[];
  /** Last trend point belongs to an unfinished bucket → dashed. */
  trendInProgress?: boolean;
  /** inline = 96px trend to the right of the value (D29 cards); below (default) = full card width. */
  trendPlacement?: "below" | "inline";
  /** Metric definition from the host's metric dictionary (formula, owner, source). */
  definition?: ReactNode;
  /** e.g. "数据截至 14:03:27" — pass freshness for anything not obviously realtime. */
  footnote?: ReactNode;
  /** One grey line under the value — the denominator of a ratio (「32 / 49 个到期计划 · 目标全天 80%」). */
  detail?: ReactNode;
  /** Small pills after the title: 「北极星」 (brand, the default for a string), 「进行中」 ({ tone: "info" }). */
  tag?: KpiTag | readonly KpiTag[];
  /** Target completion as a bullet graph next to the value (DASHBOARDS.md §1: bullets, not gauges). */
  target?: KpiTarget;
  /** Share of the period already elapsed (0..1): draws the 「expected by now」 marker on the target bullet. */
  timeProgress?: number | null;
  /** The value itself is bad (逾期 5 位): value in the danger colour. Delta colours stay good/bad. */
  valueTone?: "default" | "bad";
  /** Metric not available yet (data source not connected / module not live): 「—」 muted + this reason. */
  placeholder?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  /** Sample too small to judge: value is shown muted, delta hidden, message explains. */
  insufficient?: string;
  /** Data is stale (refresh failing / pipeline late): value greyed, kept on screen. */
  stale?: boolean;
  /** Drill-through to the detail view (keeps the host's filter context). */
  onDrill?: () => void;
  drillLabel?: string;
  /** lg = 28px north-star number (may carry a bullet), md = 24px (default), sm = 20px for rollups and narrow cells (no trend). */
  size?: "lg" | "md" | "sm";
};

const tagList = (tag: KpiCardProps["tag"]): readonly KpiTag[] => (tag === undefined ? [] : typeof tag === "string" || !Array.isArray(tag) ? [tag as KpiTag] : tag);

/**
 * KPI tile per DASHBOARDS.md §4: value + unit, what-it-compares-to, good/bad-coloured delta with
 * arrow, sparkline, freshness, definition on demand. Layout never shifts between loading and loaded.
 * Optional: tags (北极星 / 进行中), a target bullet with an 「expected by now」 marker, a denominator
 * line, and a placeholder state for metrics whose data source is not live yet.
 */
export function KpiCard({
  title,
  value,
  fullValue,
  unit,
  delta,
  comparison,
  trend,
  trendInProgress,
  trendPlacement = "below",
  definition,
  footnote,
  detail,
  tag,
  target,
  timeProgress,
  valueTone = "default",
  placeholder,
  icon: Icon,
  loading,
  insufficient,
  stale,
  onDrill,
  drillLabel = "查看明细",
  size = "md",
}: KpiCardProps) {
  const id = useId();
  const [showDefinition, setShowDefinition] = useState(false);
  const pending = placeholder !== undefined && placeholder !== null;
  const muted = Boolean(insufficient || stale || pending);
  const shown = pending ? null : value;
  const trendValues = !pending && size !== "sm" && trend && trend.length > 1 ? trend : null;
  const inlineTrend = trendValues && trendPlacement === "inline" && !target;
  return (
    <Panel>
      <div className="aui-kpi" data-size={size === "md" ? undefined : size} data-muted={muted || undefined} data-placeholder={pending || undefined} aria-busy={loading || undefined}>
        <div className="aui-kpi-head">
          <h3 className="aui-kpi-title" id={`${id}-title`}>
            {title}
          </h3>
          {tagList(tag).map((t) => {
            const item = typeof t === "string" ? { label: t, tone: "brand" as const } : t;
            return (
              <span key={item.label} className="aui-kpi-tag" data-tone={item.tone ?? "brand"}>
                {item.label}
              </span>
            );
          })}
          {definition && (
            <button
              type="button"
              className="aui-kpi-info"
              aria-label={`${title}的口径说明`}
              aria-expanded={showDefinition}
              aria-controls={`${id}-def`}
              onClick={() => setShowDefinition((v) => !v)}
            >
              <Info size={15} aria-hidden="true" />
            </button>
          )}
          {Icon && <Icon className="aui-kpi-icon" size={18} aria-hidden="true" />}
        </div>
        {loading ? (
          <div className="aui-kpi-skeleton" role="status" aria-label={`${title}加载中`}>
            <span className="aui-skeleton-line" style={{ width: "55%", height: 30 }} />
            <span className="aui-skeleton-line" style={{ width: "40%" }} />
          </div>
        ) : (
          <>
            <div className="aui-kpi-main">
              <p className="aui-kpi-value" aria-labelledby={`${id}-title`} data-tone={valueTone === "bad" && !muted ? "bad" : undefined}>
                <strong data-tip={fullValue} aria-label={fullValue && !pending ? `${fullValue}${unit ?? ""}` : undefined}>{shown ?? "—"}</strong>
                {unit && shown != null && <small>{unit}</small>}
                {stale && <span className="aui-kpi-flag">已过期</span>}
              </p>
              {target && !pending && <BulletBar {...target} label={title} timeProgress={timeProgress} size="sm" />}
              {inlineTrend && <KpiTrend values={trendValues} inProgress={trendInProgress} inline />}
            </div>
            {pending ? <p className="aui-kpi-detail">{placeholder}</p> : detail ? <p className="aui-kpi-detail">{detail}</p> : null}
            {!pending && (
              <div className="aui-kpi-compare">
                {insufficient ? (
                  <span className="aui-kpi-flag">{insufficient}</span>
                ) : (
                  <>
                    {/* undefined = this card has no comparison; null = comparison exists but data is missing */}
                    {delta !== undefined && <DeltaBadge delta={delta} comparison={comparison} />}
                    {comparison && <span className="aui-kpi-comparison">{comparison}</span>}
                  </>
                )}
              </div>
            )}
            {trendValues && !inlineTrend && <KpiTrend values={trendValues} inProgress={trendInProgress} />}
          </>
        )}
        {showDefinition && definition && (
          <div className="aui-kpi-definition" id={`${id}-def`}>
            {definition}
          </div>
        )}
        {(footnote || onDrill) && (
          <div className="aui-kpi-foot">
            {footnote && <span>{footnote}</span>}
            {onDrill && (
              <button type="button" className="aui-kpi-drill" onClick={onDrill}>
                {drillLabel}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * Row of KPI tiles. Columns follow the card count so a row never ends with a lone orphan:
 * ≤5 → one row, 6 → 3×2, 7–8 → 4 per row, 9 → 3×3. Narrow screens drop to 2 columns, then 1.
 * First screen should hold 3–5 headline KPIs (DASHBOARDS.md §1); more belong in a second section.
 */
export function KpiGrid({ children }: { children: ReactNode }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  const cols = count <= 5 ? Math.max(count, 1) : count === 6 || count === 9 ? 3 : 4;
  return (
    <div className="aui-kpi-grid" data-cols={cols} data-odd={count % 2 === 1 && count > 1 ? "" : undefined}>
      {children}
    </div>
  );
}

const STATE_TEXT: Record<Freshness, string> = {
  live: "实时",
  delayed: "延迟",
  down: "实时中断",
  unknown: "等待数据",
};
const clock = (t: number, timeZone?: string) =>
  new Date(t).toLocaleTimeString("zh-CN", { hour12: false, timeZone });

/**
 * Freshness strip for realtime panels. Only the state word lives in the polite live region, so a
 * screen reader hears "延迟" / "实时中断" once when the state changes — not a number every 3 seconds.
 */
export function LiveStatus({
  state,
  dataTime,
  ageMs,
  timeZoneLabel = "",
  timeZone,
  failures = 0,
}: {
  state: Freshness;
  dataTime?: number | null;
  ageMs?: number | null;
  timeZoneLabel?: string;
  timeZone?: string;
  failures?: number;
}) {
  const at = dataTime != null ? clock(dataTime, timeZone) : null;
  const detail =
    state === "live" && at
      ? `数据截至 ${at}${timeZoneLabel ? ` ${timeZoneLabel}` : ""}`
      : state === "delayed" && ageMs != null
        ? `${Math.round(ageMs / 1000)} 秒前${at ? ` · ${at}` : ""}`
        : state === "down" && at
          ? `最后数据 ${at}${failures >= 3 ? " · 重连中" : ""}`
          : state === "down"
            ? "重连中"
            : "";
  return (
    <div className={`aui-live aui-live-${state}`}>
      <span className="aui-live-dot" aria-hidden="true" />
      <span role="status" aria-live="polite" className="aui-live-state">
        {STATE_TEXT[state]}
      </span>
      {detail && <span className="aui-live-detail">{detail}</span>}
    </div>
  );
}

export type LiveResource<T> = {
  data?: T;
  error?: string;
  loading: boolean;
  failures: number;
  state: Freshness;
  ageMs: number | null;
  dataTime: number | null;
  refresh: () => void;
};

/**
 * Realtime polling (DASHBOARDS.md §7.1 — owner standard: 3 s). One request in flight at a time;
 * paused while the tab is hidden and fetched immediately on return; keeps the last data on
 * failure; backs off 3→6→12…30 s after 3 consecutive failures; freshness is judged from the
 * data's own timestamp (`dataTime`) corrected by `serverTime` (e.g. HTTP Date), not fetch time.
 * The server side should serve a pre-computed Redis snapshot — never a database query per tick.
 */
export function useLiveResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  options: {
    intervalMs?: number;
    enabled?: boolean;
    dataTime?: (data: T) => string | number | Date | null | undefined;
    serverTime?: (data: T) => number | null | undefined;
    downAfterMs?: number;
  } = {},
): LiveResource<T> {
  const { intervalMs = 3000, enabled = true, downAfterMs } = options;
  const loader = useRef(load);
  loader.current = load;
  const opts = useRef(options);
  opts.current = options;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean; failures: number; offset: number; fetchedAt?: number }>({ key, loading: true, failures: 0, offset: 0 });
  const [now, setNow] = useState(() => Date.now());
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;
    let inFlight = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(tick, pollDelayMs(intervalMs, failures));
    };
    const tick = async () => {
      if (stopped || inFlight) return;
      if (document.visibilityState === "hidden") return schedule();
      inFlight = true;
      controller = new AbortController();
      try {
        const data = await loader.current(controller.signal);
        if (stopped) return;
        failures = 0;
        const server = opts.current.serverTime?.(data);
        setState({ key, data, loading: false, failures: 0, offset: typeof server === "number" && Number.isFinite(server) ? server - Date.now() : 0, fetchedAt: Date.now() });
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        failures++;
        const message = error instanceof Error ? error.message : String(error);
        setState((old) => ({ ...(old.key === key ? old : { key, offset: 0 }), loading: false, error: message, failures }));
      } finally {
        inFlight = false;
        schedule();
      }
    };
    kick.current = () => {
      clearTimeout(timer);
      void tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") kick.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(clockTimer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, intervalMs, enabled]);

  const current = state.key === key ? state : { key, loading: true, failures: 0, offset: 0 } as typeof state;
  const rawTime = current.data !== undefined ? (opts.current.dataTime?.(current.data) ?? current.fetchedAt) : undefined;
  const parsed = rawTime instanceof Date ? rawTime.getTime() : typeof rawTime === "string" ? Date.parse(rawTime) : rawTime;
  const dataTime = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  const fresh = freshnessOf(dataTime, intervalMs, { now, clockOffsetMs: current.offset, downAfterMs });
  const refresh = useCallback(() => kick.current(), []);
  return {
    data: current.data,
    error: current.error,
    loading: current.loading && current.data === undefined,
    failures: current.failures,
    state: fresh.state,
    ageMs: fresh.ageMs,
    dataTime,
    refresh,
  };
}

/** Section wrapper for a dashboard row: title states the question it answers. */
export function DashboardSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="aui-dash-section" aria-labelledby={id}>
      <div className="aui-dash-section-head">
        <div className="aui-panel-title">
          <h2 id={id}>{title}</h2>
          {description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}
        </div>
        <div className="aui-header-actions">{actions}<span className="aui-page-actions-slot" /></div>
      </div>
      {children}
    </section>
  );
}
