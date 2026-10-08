"use client";
/**
 * GanttView (bt/views V7, demo D10): left list pane (fields as columns, up to two group levels that
 * arrive grouped from the host) | resizable, collapsible splitter | timeline with scales 周 / 两周 / 季 / 年,
 * host non-working days hatched / shaded and make-up days marked 「班」, today line, milestones, bars
 * coloured by an option field (7 tones) with the title + up to two extra fields, drag to move, drag
 * the ends to resize (select a bar first), off-screen bars as edge pills, and the row under the pointer
 * highlighted on both sides. Durations can count working days only. Keyboard on a bar: ← / → move a
 * day, Shift+← / → change the end, Alt+← / → change the start, Enter opens. Changes go to
 * `onDateChange(id, { start, end, duration })`; reject to put the bar back. Narrow containers get a list.
 * By default the 「两周」 scale shows `visibleDays` (15) days starting two days before the anchor and the
 * list takes the rest of the width; a host `listWidth` or a splitter drag fixes the list width instead
 * (double-click the splitter to go back). Pure layout lives in gantt-core.ts.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { Button } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { HelpTip } from "../help-tip.tsx";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { fieldText, readField, type GridField } from "../grid-core.ts";
import { FIELD_ICONS, renderGridCell } from "../grid-cells.tsx";
import { CellBudgetContext } from "../cell-budget.ts";
import type { OptionTone } from "../option-tone.ts";
import { viewRecordTone } from "./view-color-core.ts";
import type { GridColorRule } from "../grid-view-v2.ts";
import type { ConditionContext } from "../condition-core.ts";
import { initialOf } from "../atoms-core.ts";
import { todayKey, toDay, type DayKey, type Weekday, type WorkCalendar } from "./date-core.ts";
import { clampSplit, dragDays, dragSpan, durationText, GANTT_SCALES, GANTT_SPLIT, GANTT_VISIBLE_DAYS, ganttFrame, ganttListColumns, ganttListNeed, ganttResizable, ganttRows, ganttScaleLabel, ganttSpan, ganttTicks, revealAnchor, shiftAnchor, spanChange, spanText, windowTitle, type GanttDragKind, type GanttEndMode, type GanttGroup, type GanttRow, type GanttScale, type GanttSpan } from "./gantt-core.ts";
import { GanttBackdrop, GanttBar, GanttHeader, type GanttMilestone } from "./gantt-timeline.tsx";
import { GanttPhoneList } from "./gantt-list.tsx";
import { HoverCard, trackPointer, useAnnouncer } from "./view-parts.tsx";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

/** What the gantt reads from records; edited by GanttSettings (view-settings.tsx). */
export type GanttConfig = {
  /** Date field the bar starts on. */
  startField: string;
  endMode: GanttEndMode;
  /** endMode "field": the end date field. */
  endField?: string;
  /** endMode "duration": a number field (days). */
  durationField?: string;
  /** endMode "fixed": days. */
  fixedDays?: number;
  /** Durations skip weekends and host holidays. */
  workdaysOnly?: boolean;
  /** Bar title field (default: the primary field). */
  titleField?: string;
  /** Up to GANTT_MAX_EXTRA more fields after the title on the bar. */
  extraFields?: readonly string[];
  /** Left columns in order (default: primary + start + end). */
  listFields?: readonly string[];
  /** Colour by this single-select field's option tones; null / absent = by `colorRules`, else uniform brand. */
  colorField?: string | null;
  /** 颜色依据「按条件」 (bt/templates): the grid's 填色 rules (condition tree + tone), first match wins; whole-row rules only. */
  colorRules?: readonly GridColorRule[];
  /** A date field drawn as a diamond on the row. */
  milestoneField?: string | null;
  /** Scale when the view opens. */
  scale?: GanttScale;
};
/** Default limit of extra bar fields (a default, not a hard rule). */
export const GANTT_MAX_EXTRA = 2;

export type GanttChange = { start: DayKey; end: DayKey; duration: number };
export type GanttViewProps<T> = {
  fields: readonly GridField<T>[];
  config: GanttConfig;
  /** Records grouped by the host (≤ 2 levels), or `records` for no grouping. */
  groups?: readonly GanttGroup<T>[];
  records?: readonly T[];
  recordId: (record: T) => string;
  label: string;
  timeZone?: string;
  weekStart?: Weekday;
  workCalendar?: WorkCalendar;
  today?: DayKey;
  scale?: GanttScale;
  onScaleChange?: (scale: GanttScale) => void;
  /** The day the window is built around (default today). */
  anchor?: DayKey;
  onAnchorChange?: (day: DayKey) => void;
  onDateChange?: (id: string, change: GanttChange) => void | Promise<void>;
  canEdit?: (record: T) => boolean;
  onOpen?: (record: T) => void;
  /** Whole-chart milestones (diamond in the header + dashed line). */
  milestones?: readonly GanttMilestone[];
  /**
   * Days on the 「两周」 scale (default 15): the timeline shows exactly that many at a readable day width
   * and the list gets the rest of the width; ‹ › move by this many days.
   */
  visibleDays?: number;
  /**
   * Left pane width (px) and collapsed state; controlled or not. Without `listWidth` the list takes what
   * the `visibleDays` days leave until the user drags the splitter; with it the timeline fills the rest.
   */
  listWidth?: number;
  onListWidthChange?: (width: number) => void;
  listCollapsed?: boolean;
  onListCollapsedChange?: (collapsed: boolean) => void;
  /** 「+ 新增一行」 under the rows. */
  onAddRow?: () => void;
  /** Override the bar text (default: title · extra fields, or title · duration). */
  barText?: (record: T, span: GanttSpan) => string;
  /** Container width under which the gantt becomes a list (default 640). */
  listBelow?: number;
  rowHeight?: number;
  /** How `colorRules` resolve 「我」 / relative dates (same as BitableGrid `conditionContext`). */
  conditionContext?: ConditionContext;
};

type Live = { id: string; start: DayKey; end: DayKey };

/** See the module comment. */
export function GanttView<T>(props: GanttViewProps<T>) {
  const { fields, config, recordId, label, workCalendar, onDateChange, canEdit, onOpen, milestones = [], onAddRow, barText, listBelow = 640, rowHeight = 36 } = props;
  const defaults = useAdminDefaults();
  const tz = props.timeZone ?? defaults.timeZone;
  const today = props.today ?? todayKey(Date.now(), tz);
  const [ownScale, setOwnScale] = useState<GanttScale>(config.scale ?? "month");
  const scale = props.scale ?? ownScale;
  const setScale = (s: GanttScale) => (props.onScaleChange ? props.onScaleChange(s) : setOwnScale(s));
  const [ownAnchor, setOwnAnchor] = useState<DayKey>(today);
  const anchor = props.anchor ?? ownAnchor;
  const setAnchor = (d: DayKey) => (props.onAnchorChange ? props.onAnchorChange(d) : setOwnAnchor(d));
  const visibleDays = props.visibleDays ?? GANTT_VISIBLE_DAYS;
  // null = the default split (the list gets what the visible days leave).
  const [ownWidth, setOwnWidth] = useState<number | null>(null);
  const setListWidth = (w: number) => {
    setOwnWidth(w);
    props.onListWidthChange?.(w);
  };
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const collapsedList = props.listCollapsed ?? ownCollapsed;
  // The list width animates only while folding / unfolding (data-folding), not on first layout or drags.
  const [folding, setFolding] = useState(false);
  useEffect(() => {
    if (!folding) return;
    const t = setTimeout(() => setFolding(false), 400);
    return () => clearTimeout(t);
  }, [folding]);
  const setCollapsedList = (c: boolean) => {
    setFolding(true);
    if (props.onListCollapsedChange) props.onListCollapsedChange(c);
    else setOwnCollapsed(c);
  };
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(1100);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      setNarrow((root.current?.getBoundingClientRect().width ?? 1000) < listBelow);
      // clientWidth: without the vertical scrollbar, so the visible days fit exactly.
      const w = body.current?.clientWidth;
      if (w) setBodyWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, [listBelow, narrow]);

  const fieldOf = (key: string | null | undefined) => (key ? fields.find((f) => f.key === key) : undefined);
  const primary = fields.find((f) => f.primary) ?? fields[0];
  const titleField = fieldOf(config.titleField) ?? primary;
  const listFields = (config.listFields ?? [primary?.key, config.startField, config.endMode === "field" ? config.endField : config.durationField]).map((k) => fieldOf(k)).filter((f): f is GridField<T> => Boolean(f));
  const extra = (config.extraFields ?? []).slice(0, GANTT_MAX_EXTRA).map((k) => fieldOf(k)).filter((f): f is GridField<T> => Boolean(f));
  const colorField = fieldOf(config.colorField);
  const spanOptions = { endMode: config.endMode, workdaysOnly: config.workdaysOnly, fixedDays: config.fixedDays };
  const [pending, setPending] = useState<Record<string, { start: DayKey; end: DayKey }>>({});
  const records = props.records;
  const groups = props.groups;
  useEffect(() => setPending({}), [records, groups]);
  const spanOf = (r: T): GanttSpan | null => {
    const id = recordId(r);
    const p = pending[id];
    if (p) return ganttSpan(p.start, p.end, null, { ...spanOptions, endMode: "field" }, workCalendar);
    const start = toDay(readField(fieldOf(config.startField) ?? { key: config.startField }, r) as string | null, tz);
    const end = config.endMode === "field" ? toDay(readField(fieldOf(config.endField) ?? { key: config.endField ?? "" }, r) as string | null, tz) : null;
    const durationRaw = config.endMode === "duration" ? Number(readField(fieldOf(config.durationField) ?? { key: config.durationField ?? "" }, r)) : null;
    return ganttSpan(start, end, Number.isFinite(durationRaw) ? durationRaw : null, spanOptions, workCalendar);
  };
  const toneOf = (r: T): OptionTone => viewRecordTone(r, fields, { colorField: colorField?.key, colorRules: config.colorRules }, props.conditionContext);
  const textOf = (r: T, span: GanttSpan) => {
    if (barText) return barText(r, span);
    const title = titleField ? fieldText(titleField, r) : recordId(r);
    const parts = extra.map((f) => fieldText(f, r)).filter(Boolean);
    return [title, ...(parts.length ? parts : [config.workdaysOnly ? `${span.workdays} 天` : `${span.days} 天`])].join(" · ");
  };
  const rows: GanttRow<T>[] = useMemo(
    () => (groups ? ganttRows(groups, recordId, collapsedGroups) : (records ?? []).map((r) => ({ kind: "record" as const, key: recordId(r), depth: 0 as const, record: r }))),
    [groups, records, recordId, collapsedGroups],
  );
  const frame = ganttFrame({ anchor, scale, bodyWidth, visibleDays, weekStart: props.weekStart ?? 1, listWidth: props.listWidth ?? ownWidth, collapsed: collapsedList, listNeed: ganttListNeed(listFields) });
  const dw = frame.dayWidth;
  const win = frame.window;
  const ticks = useMemo(() => ganttTicks(win, scale, today, workCalendar, props.weekStart ?? 1, dw), [win.start, win.days, scale, today, workCalendar, props.weekStart, dw]);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  liveRef.current = live;
  const suppress = useRef(false);
  const [tip, setTip] = useState<{ id: string; target: HTMLElement } | null>(null);
  const [liveRegion, announce] = useAnnouncer();
  const editable = (r: T) => Boolean(onDateChange) && (!canEdit || canEdit(r));
  const byId = useMemo(() => new Map(rows.flatMap((row) => (row.kind === "record" ? [[row.key, row.record] as const] : []))), [rows]);

  const resizable = ganttResizable(spanOptions);
  const keep = { options: spanOptions, calendar: workCalendar };
  const commit = (id: string, next: { start: DayKey; end: DayKey }) => {
    if (!onDateChange) return;
    setPending((p) => ({ ...p, [id]: next }));
    const change = spanChange(next, spanOptions, workCalendar);
    announce(`改为 ${spanText(next)}，${change.duration} 天`);
    Promise.resolve(onDateChange(id, change)).catch((error: unknown) => {
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)));
      announce(`没改成：${error instanceof Error ? error.message : "请重试"}`);
    });
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>, r: T, span: GanttSpan, kind: GanttDragKind) => {
    const id = recordId(r);
    if (!editable(r)) return;
    trackPointer(event, {
      onStart: () => setTip(null),
      onMove: (_e, dx) => setLive({ id, ...dragSpan(span, kind, dragDays(dx, dw), keep) }),
      onEnd: ({ cancelled, started }) => {
        const l = liveRef.current;
        setLive(null);
        if (!started) return;
        suppress.current = true;
        setTimeout(() => (suppress.current = false), 0);
        if (!cancelled && l && (l.start !== span.start || l.end !== span.end)) commit(id, { start: l.start, end: l.end });
      },
    });
  };
  const onBarKey = (event: KeyboardEvent<HTMLButtonElement>, r: T, span: GanttSpan) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen?.(r);
      return;
    }
    if ((event.key !== "ArrowLeft" && event.key !== "ArrowRight") || !editable(r)) return;
    const kind: GanttDragKind = event.shiftKey ? "end" : event.altKey ? "start" : "move";
    if (kind !== "move" && !resizable) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    commit(recordId(r), dragSpan(span, kind, delta, keep));
  };
  // Dates read 「10-09」 in the list (the year is in the header); everything else uses the grid renderer.
  const listCell = (f: GridField<T>, r: T) => {
    if (f.type !== "date" && f.type !== "datetime") return renderGridCell(f, r);
    const day = toDay(readField(f, r) as string | null, f.timeZone ?? tz);
    return day ? <span data-tip={fieldText(f, r)}>{f.type === "date" ? day.slice(5) : fieldText(f, r).slice(5)}</span> : <span className="aui-cell-empty">—</span>;
  };
  const toggleGroup = (key: string) => setCollapsedGroups((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set([...s, key])));

  const tipRecord = tip ? byId.get(tip.id) : undefined;
  const tipSpan = tipRecord ? spanOf(tipRecord) : null;
  const makeupIn = (span: GanttSpan) => Object.keys(workCalendar?.workdays ?? {}).filter((d) => d >= span.start && d <= span.end);

  const toolbar = (
    <div className="aui-gantt-bar-row">
      <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>今天</Button>
      <IconButton label="往前" variant="outline" className="aui-cal-nav" onClick={() => setAnchor(shiftAnchor(anchor, scale, -1, visibleDays))} icon={<ChevronLeft size={15} aria-hidden="true" />} />
      <IconButton label="往后" variant="outline" className="aui-cal-nav" onClick={() => setAnchor(shiftAnchor(anchor, scale, 1, visibleDays))} icon={<ChevronRight size={15} aria-hidden="true" />} />
      <h3 className="aui-cal-title" aria-live="polite">{windowTitle(win, scale)}</h3>
      <SegmentedControl size="sm" label="时间刻度" value={scale} onValueChange={setScale} options={GANTT_SCALES.map((s) => ({ value: s, label: ganttScaleLabel(s, visibleDays) }))} />
      <span className="aui-cal-bar-end">
        <span className="aui-gantt-key"><i aria-hidden="true" />周末</span>
        {workCalendar?.holidays && Object.keys(workCalendar.holidays).length > 0 && <span className="aui-gantt-key"><i data-holiday="" aria-hidden="true" />假日</span>}
        {workCalendar?.workdays && Object.keys(workCalendar.workdays).length > 0 && <span className="aui-gantt-key"><span className="aui-cal-badge" data-kind="workday">班</span>补班日</span>}
        {config.workdaysOnly && <span className="aui-gantt-wdc"><Check size={13} aria-hidden="true" />工期只算工作日</span>}
        <HelpTip label="甘特图说明">
          {resizable ? "拖动条形改日期，先点选条形再拖两端改开始 / 结束；键盘：← → 移动一天，Shift+← → 改结束，Alt+← → 改开始。" : "工期固定，拖动条形只改开始日期；键盘：← → 移动一天。"}
          屏幕外的条在左右边缘显示箭头，点一下跳过去。
        </HelpTip>
      </span>
    </div>
  );

  if (narrow) {
    const owner = listFields.find((f) => f.type === "user" && f !== titleField);
    return (
      <div ref={root} className="aui-gantt" data-narrow="" role="region" aria-label={label}>
        {toolbar}
        <GanttPhoneList
          rows={rows}
          window={scale === "week" || scale === "month" ? { start: win.start, days: scale === "week" ? 7 : visibleDays } : win}
          today={today}
          label={label}
          workdaysOnly={Boolean(config.workdaysOnly)}
          onOpen={onOpen}
          onToggleGroup={toggleGroup}
          item={(r) => ({
            title: titleField ? fieldText(titleField, r) : recordId(r),
            tone: toneOf(r),
            chip: colorField ? fieldText(colorField, r) || undefined : undefined,
            owner: owner ? fieldText(owner, r) || undefined : undefined,
            span: spanOf(r),
          })}
        />
      </div>
    );
  }

  const width = frame.listWidth;
  // A drag must leave the timeline at least GANTT_SPLIT.timelineMin px.
  const maxList = Math.max(200, bodyWidth - GANTT_SPLIT.splitter - GANTT_SPLIT.timelineMin);
  const columns = ganttListColumns(listFields);
  return (
    <div ref={root} className="aui-gantt" role="region" aria-label={label} data-dragging={live ? "" : undefined} data-folding={folding || undefined} style={{ "--aui-gantt-row": `${rowHeight}px` } as CSSProperties}>
      {toolbar}
      <div ref={body} className="aui-gantt-body">
        <div className="aui-gantt-list" style={{ width }} data-collapsed={collapsedList || undefined} aria-hidden={collapsedList || undefined}>
          <div className="aui-gantt-lh" style={{ gridTemplateColumns: columns }}>
            {listFields.map((f) => {
              const Icon = FIELD_ICONS[f.type];
              return (
                <span key={f.key}>
                  <Icon size={14} aria-hidden="true" />
                  {f.title}
                </span>
              );
            })}
          </div>
          <CellBudgetContext.Provider value={{ lines: 1, clamped: true, compact: true }}>
            {rows.map((row) =>
              row.kind === "group" ? (
                <div key={row.key} className="aui-gantt-lrow aui-gantt-grp" data-depth={row.depth} data-hover={hoverKey === row.key || undefined} onPointerEnter={() => setHoverKey(row.key)}>
                  <button type="button" className="aui-gantt-grp-toggle" aria-expanded={!row.collapsed} onClick={() => toggleGroup(row.key)}>
                    {row.collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                    {row.person && <span className="aui-cal-avatar" aria-hidden="true">{initialOf(row.label)}</span>}
                    <span>{row.label}</span>
                    <small>{row.count} 条</small>
                  </button>
                </div>
              ) : (
                <div key={row.key} className="aui-gantt-lrow" style={{ gridTemplateColumns: columns }} data-depth={row.depth} data-hover={hoverKey === row.key || undefined} data-selected={selected === row.key || undefined} onPointerEnter={() => setHoverKey(row.key)} onClick={() => setSelected(row.key)} onDoubleClick={() => onOpen?.(row.record)}>
                  {listFields.map((f) => (
                    <span key={f.key} className="aui-gantt-cell" data-type={f.type}>{listCell(f, row.record)}</span>
                  ))}
                </div>
              ),
            )}
          </CellBudgetContext.Provider>
          {onAddRow && (
            <button type="button" className="aui-gantt-add" onClick={onAddRow}>
              <Plus size={13} aria-hidden="true" />
              新增一行
            </button>
          )}
        </div>
        <div
          className="aui-gantt-split"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左侧宽度"
          aria-valuenow={width}
          aria-valuemin={0}
          aria-valuemax={maxList}
          tabIndex={0}
          onPointerDown={(e) => {
            if (collapsedList) return;
            const start = width;
            trackPointer(e, { threshold: 1, onMove: (_ev, dx) => setListWidth(clampSplit(start + dx, 200, maxList)), onEnd: () => undefined });
          }}
          // The second click of a double-click must not select the header text next to the splitter.
          onMouseDown={(e) => {
            if (e.detail > 1) e.preventDefault();
          }}
          onDoubleClick={() => {
            if (!collapsedList && props.listWidth === undefined) setOwnWidth(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            if (collapsedList) setCollapsedList(false);
            else setListWidth(clampSplit(width + (e.key === "ArrowLeft" ? -24 : 24), 200, maxList));
          }}
        >
          <IconButton label={collapsedList ? "展开左侧字段" : "收起左侧字段"} variant="outline" className="aui-gantt-fold" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCollapsedList(!collapsedList)} icon={collapsedList ? <ChevronsRight size={14} aria-hidden="true" /> : <ChevronsLeft size={14} aria-hidden="true" />} />
        </div>
        <div className="aui-gantt-tl" onPointerLeave={() => setHoverKey(null)}>
          <GanttHeader ticks={ticks} window={win} dayWidth={dw} today={today} milestones={milestones} />
          <div className="aui-gantt-rows">
            <GanttBackdrop ticks={ticks} window={win} dayWidth={dw} today={today} milestones={milestones} />
            {rows.map((row) => {
              if (row.kind === "group") return <div key={row.key} className="aui-gantt-trow aui-gantt-grp" data-depth={row.depth} data-hover={hoverKey === row.key || undefined} onPointerEnter={() => setHoverKey(row.key)} />;
              const r = row.record;
              const base = spanOf(r);
              const l = live?.id === row.key ? live : null;
              const span = base && l ? { ...base, start: l.start, end: l.end } : base;
              const milestone = config.milestoneField ? toDay(readField(fieldOf(config.milestoneField) ?? { key: config.milestoneField }, r) as string | null, tz) : null;
              return (
                <div key={row.key} className="aui-gantt-trow" data-hover={hoverKey === row.key || undefined} data-selected={selected === row.key || undefined} onPointerEnter={() => setHoverKey(row.key)}>
                  {span ? (
                    <GanttBar
                      span={span}
                      window={win}
                      dayWidth={dw}
                      tone={toneOf(r)}
                      text={textOf(r, span)}
                      label={titleField ? fieldText(titleField, r) : row.key}
                      selected={selected === row.key}
                      dragging={Boolean(l)}
                      editable={editable(r)}
                      resizable={resizable}
                      hatch={Boolean(config.workdaysOnly) && scale !== "year"}
                      calendar={workCalendar}
                      milestone={milestone}
                      onPointerDown={(e, kind) => startDrag(e, r, span, kind)}
                      onKeyDown={(e) => onBarKey(e, r, span)}
                      onClick={() => {
                        if (suppress.current) return;
                        setSelected(row.key);
                      }}
                      onReveal={() => setAnchor(revealAnchor(span, scale))}
                      onHover={(target) => setTip(target && !live ? { id: row.key, target } : null)}
                    />
                  ) : (
                    <span className="aui-gantt-nodate">未排期</span>
                  )}
                </div>
              );
            })}
            {onAddRow && <div className="aui-gantt-trow aui-gantt-addrow" />}
          </div>
        </div>
      </div>
      <HoverCard target={tip && !live ? tip.target : null} label="条形详情" className="aui-vhover aui-gantt-tip" placement={{ side: "bottom", align: "start", gap: 6 }}>
        {tipRecord && tipSpan && (
          <>
            <div className="aui-vhover-head">
              <strong>{titleField ? fieldText(titleField, tipRecord) : tip?.id}</strong>
            </div>
            <dl className="aui-vhover-rows">
              <div>
                <dt>时间</dt>
                <dd>{spanText(tipSpan)}（{tipSpan.days} 天）</dd>
              </div>
              <div>
                <dt>工期</dt>
                <dd>{durationText(tipSpan, Boolean(config.workdaysOnly))}</dd>
              </div>
              {config.workdaysOnly && makeupIn(tipSpan).length > 0 && (
                <div>
                  <dt>说明</dt>
                  <dd>{makeupIn(tipSpan).map((d) => d.slice(5)).join("、")} 补班照常计入</dd>
                </div>
              )}
            </dl>
          </>
        )}
      </HoverCard>
      {liveRegion}
    </div>
  );
}
