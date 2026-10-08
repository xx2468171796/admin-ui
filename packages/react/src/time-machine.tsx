"use client";
/**
 * TimeMachineDialog (D24 表时光机): roll a whole table back to a moment inside the undo window.
 *
 * 退回到：date + time boxes and quick pills (1 小时前 / 今天 09:00 / 昨天 09:00 …) → a 72-hour scrubber
 * (window = 3 days by default, `windowHours`) with day ticks and one dot per operation (colour per
 * kind, tooltip on hover / focus, click = 「退到它之前」), the selected range up to now shaded with
 * 「这一刻之后 N 次操作会被退回」 → four preview cards (加回 / 改回 / 移除 + 冲突, from the host's
 * preview; nothing to roll back → 「这个时间点之后没有可回退的修改」 and 确认回滚 disabled) → the conflict table (keep other people's later edits or revert them, per row) → notes
 * and the footer (who acts · 取消 · 预览差异 · 确认回滚).
 *
 * UI only: `onPreview(target, signal)` and `onRestore(target, decisions)` are the host's server calls
 * (types in this file); the server re-checks permissions and validation, writes the audit and treats
 * the rollback as one more operation that can be undone. Styles: styles/history.css (.aui-tm-*).
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Columns3, Eye, History, RefreshCw, Rows3, ShieldCheck, Table2, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "./primitives.tsx";
import { Dialog } from "./forms.tsx";
import { DatePicker, TimeInput } from "./date-picker.tsx";
import { InlineAlert } from "./layout.tsx";
import { IconBlock } from "./kit.tsx";
import { HelpTip } from "./help-tip.tsx";
import { toTime, type DateInput } from "./format.ts";
import { ConflictChooser, type ConflictRow } from "./conflict-chooser.tsx";
import {
  DEFAULT_CONFLICT_DECISIONS,
  DEFAULT_UNDO_WINDOW_DAYS,
  clampToScale,
  justBefore,
  nothingToRollBack,
  opsAfter,
  quickTimes,
  scrubberDayTicks,
  scrubberPercent,
  scrubberScale,
  scrubberTimeAt,
  shortMoment,
  stepIndex,
  zonedClock,
  zonedTime,
  type ConflictDecisions,
} from "./history-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";

/** One operation on the scrubber. */
export type TimeMachineOp = {
  id: string;
  at: DateInput;
  /** Kind key → dot colour (see `kinds`). */
  kind?: string;
  /** Tooltip / accessible text: 「小李 改「阶段看板」分组」. */
  label: string;
  /** Operation number shown in the tooltip: 「OP-20261003-0064」. */
  code?: string;
};
/** Legend entry; `tone` colours the dots (outline = hollow, e.g. a rollback). */
export type TimeMachineKind = { key: string; label: string; tone?: "brand" | "attention" | "info" | "outline" };
export type TimeMachineCard = { key: string; icon?: ReactNode; title: ReactNode; hint?: ReactNode };
/** What the host's preview returns for a target time. */
export type TimeMachinePreview = {
  /** Records to add back (deleted after the target), change back, remove (added after it). */
  counts?: { add?: number; change?: number; remove?: number };
  /** Or the three cards in the host's own words (records / fields / views …); up to three. */
  cards?: readonly TimeMachineCard[];
  /** Cells changed by someone else after the target. */
  conflicts: readonly ConflictRow[];
  /**
   * Nothing would change (needed with `cards`; with `counts` it is worked out). Then the cards give way to
   * 「这个时间点之后没有可回退的修改」 and 「确认回滚」 is disabled.
   */
  empty?: boolean;
};
export type TimeMachineDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Grey text after the title: 「客户 · 整张表退回到某个时间点」. */
  subtitle?: ReactNode;
  /** 「?」 next to the title. */
  help?: ReactNode;
  ops: readonly TimeMachineOp[];
  kinds?: readonly TimeMachineKind[];
  /** Span of the scrubber in hours (default 72 = the 3-day undo window). */
  windowHours?: number;
  /** Left-end label (default 「3 天前」). */
  startLabel?: string;
  initialTarget?: number;
  now?: number;
  timeZone?: string;
  onPreview: (target: number, signal: AbortSignal) => Promise<TimeMachinePreview>;
  /** Resolve = done (dialog closes); reject = message in place, dialog stays. */
  onRestore: (target: number, decisions: ConflictDecisions) => Promise<void>;
  /** 「预览差异」 (e.g. open the table read-only at that moment). */
  onPreviewDiff?: (target: number) => void;
  /** Footer left: 「林经理（表管理员）· 会写入审计」. */
  actorNote?: ReactNode;
  /** Notes under the table (default: rollback can be undone; no downtime). */
  notes?: readonly ReactNode[];
  confirmLabel?: string;
};

const DEFAULT_NOTES: readonly ReactNode[] = [
  <><Undo2 aria-hidden="true" />回滚本身也是一次操作，可以再撤回</>,
  <><RefreshCw aria-hidden="true" />不停服，其他人的页面会自动刷新</>,
];

/** The standard three cards from counts (加回 / 改回 / 移除). */
export function timeMachineCards(counts: NonNullable<TimeMachinePreview["counts"]>): TimeMachineCard[] {
  return [
    { key: "change", icon: <Rows3 />, title: `改回 ${counts.change ?? 0} 条`, hint: "那之后改过的记录" },
    { key: "add", icon: <Table2 />, title: `加回 ${counts.add ?? 0} 条`, hint: "那之后删掉的记录" },
    { key: "remove", icon: <Columns3 />, title: `移除 ${counts.remove ?? 0} 条`, hint: "那之后新增的记录" },
  ];
}

const NOTHING_TEXT = "这个时间点之后没有可回退的修改";

type PreviewState = { loading: boolean; error: string | null; data: TimeMachinePreview | null; target: number | null };

export function TimeMachineDialog({
  open,
  onClose,
  title = "表时光机",
  subtitle,
  help,
  ops,
  kinds = [],
  windowHours = DEFAULT_UNDO_WINDOW_DAYS * 24,
  startLabel,
  initialTarget,
  now: nowProp,
  timeZone: timeZoneProp,
  onPreview,
  onRestore,
  onPreviewDiff,
  actorNote,
  notes = DEFAULT_NOTES,
  confirmLabel = "确认回滚",
}: TimeMachineDialogProps) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  // The clock is frozen while the dialog is open so the scrubber does not drift under the pointer.
  const [now, setNow] = useState(() => nowProp ?? Date.now());
  useEffect(() => {
    if (open) setNow(nowProp ?? Date.now());
  }, [open, nowProp]);
  const scale = useMemo(() => scrubberScale(now, windowHours), [now, windowHours]);
  const [target, setTargetRaw] = useState<number>(() => clampToScale(scale, initialTarget ?? now - 3_600_000));
  useEffect(() => {
    if (open) setTargetRaw(clampToScale(scrubberScale(nowProp ?? Date.now(), windowHours), initialTarget ?? (nowProp ?? Date.now()) - 3_600_000));
  }, [open, initialTarget, nowProp, windowHours]);
  const setTarget = (t: number) => setTargetRaw(clampToScale(scale, Math.floor(t / 60_000) * 60_000));
  const [decisions, setDecisions] = useState<ConflictDecisions>(DEFAULT_CONFLICT_DECISIONS);
  const [preview, setPreview] = useState<PreviewState>({ loading: false, error: null, data: null, target: null });
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;

  useEffect(() => {
    if (!open) return;
    setDecisions(DEFAULT_CONFLICT_DECISIONS);
    setSaveError(null);
    const ctrl = new AbortController();
    setPreview((p) => ({ ...p, loading: true, error: null }));
    const timer = setTimeout(() => {
      previewRef.current(target, ctrl.signal).then(
        (data) => !ctrl.signal.aborted && setPreview({ loading: false, error: null, data, target }),
        (e: unknown) => !ctrl.signal.aborted && setPreview((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : String(e) })),
      );
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, target, retry]);

  const sorted = useMemo(() => [...ops].map((op) => ({ op, t: toTime(op.at) })).filter((x): x is { op: TimeMachineOp; t: number } => x.t !== null && x.t >= scale.start && x.t <= scale.end).sort((a, b) => a.t - b.t), [ops, scale]);
  const undone = opsAfter(sorted, (x) => x.t, target).length;
  const clock = zonedClock(target, timeZone);
  const fresh = preview.data && preview.target === target && !preview.loading;
  const conflicts = fresh ? preview.data?.conflicts ?? [] : [];
  const cards = fresh && preview.data ? (preview.data.cards?.slice(0, 3) ?? timeMachineCards(preview.data.counts ?? {})) : null;
  const moment = shortMoment(target, now, timeZone);
  const nothing = Boolean(fresh && preview.data && nothingToRollBack(preview.data));

  const restore = async () => {
    if (saving || !fresh || nothing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onRestore(target, decisions);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      initialFocus="dialog"
      titleAdornment={<>{subtitle && <span className="aui-tm-sub">{subtitle}</span>}{help && <HelpTip label={`${title}说明`}>{help}</HelpTip>}</>}
      footer={
        <>
          {actorNote && <span className="aui-note"><ShieldCheck aria-hidden="true" />{actorNote}</span>}
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>取消</Button>
          {onPreviewDiff && <Button variant="outline" size="sm" onClick={() => onPreviewDiff(target)}><Eye aria-hidden="true" />预览差异</Button>}
          <Button size="sm" onClick={restore} aria-disabled={!fresh || saving || nothing ? true : undefined} disabledReason={nothing ? NOTHING_TEXT : undefined} aria-busy={saving || undefined}><History aria-hidden="true" />{saving ? "回滚中…" : confirmLabel}</Button>
        </>
      }
    >
      <div className="aui-tm">
        <div className="aui-tm-label">
          <b>退回到</b>
          <small>点时间轴上的操作点可以直接跳到它之前</small>
          {kinds.length > 0 && (
            <span className="aui-tm-legend" aria-label="图例">
              {kinds.map((k) => <span key={k.key}><i data-tone={k.tone ?? "brand"} aria-hidden="true" />{k.label}</span>)}
            </span>
          )}
        </div>
        <div className="aui-tm-pick">
          <DatePicker
            aria-label="日期"
            className="aui-tm-date"
            size="sm"
            value={clock.date}
            min={zonedClock(scale.start, timeZone).date}
            max={zonedClock(scale.end, timeZone).date}
            onChange={(date) => { const t = zonedTime(date, clock.time, timeZone); if (t !== null) setTarget(t); }}
          />
          <TimeInput aria-label="时间" className="aui-tm-time" size="sm" value={clock.time} onChange={(time) => { const t = zonedTime(clock.date, time, timeZone); if (t !== null) setTarget(t); }} />
          <span className="aui-tm-quicks" role="group" aria-label="常用时间点">
            {quickTimes(now, scale, timeZone).map((q) => (
              <button key={q.key} type="button" className="aui-tm-quick" aria-pressed={q.at === target} onClick={() => setTarget(q.at)}>{q.label}</button>
            ))}
          </span>
          <span className="aui-tm-range">可选 {shortMoment(scale.start, now, timeZone)} 至现在</span>
        </div>
        <Scrubber ops={sorted} kinds={kinds} scale={scale} target={target} onTarget={setTarget} undone={undone} now={now} timeZone={timeZone} startLabel={startLabel ?? `${Math.round(windowHours / 24)} 天前`} />
        {preview.error ? (
          <InlineAlert tone="error" title="预览失败" action={<Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>重试</Button>}>{preview.error}</InlineAlert>
        ) : nothing ? (
          <InlineAlert tone="info" title={NOTHING_TEXT}>选一个更早的时间点，或在时间轴上点一个操作。</InlineAlert>
        ) : (
          <div className="aui-tm-cards" aria-busy={!fresh || undefined}>
            {(cards ?? timeMachineCards({})).map((c) => (
              <div key={c.key} className="aui-tm-card" data-loading={!cards || undefined}>
                <IconBlock size="sm">{c.icon ?? <Rows3 />}</IconBlock>
                <div><b>{cards ? c.title : "…"}</b>{c.hint && <small>{c.hint}</small>}</div>
              </div>
            ))}
            <div className="aui-tm-card" data-tone={conflicts.length ? "attention" : undefined} data-loading={!cards || undefined}>
              <IconBlock size="sm" tone={conflicts.length ? "attention" : "brand"}><TriangleAlert /></IconBlock>
              <div><b>{!cards ? "…" : conflicts.length ? `${conflicts.length} 条有冲突` : "没有冲突"}</b><small>{conflicts.length ? "那之后被别人改过" : "那之后没人改过同一格"}</small></div>
            </div>
          </div>
        )}
        {fresh && conflicts.length > 0 && (
          <ConflictChooser rows={conflicts} value={decisions} onChange={setDecisions} title={`其中 ${conflicts.length} 条在 ${moment} 之后被别人改过`} thenLabel={`${moment} 时`} nowLabel="现在" disabled={saving} caption="回滚冲突" />
        )}
        {saveError && <InlineAlert tone="error" title="没有回滚">{saveError}</InlineAlert>}
        {notes.length > 0 && <div className="aui-tm-notes">{notes.map((n, i) => <span key={i}>{n}</span>)}</div>}
      </div>
    </Dialog>
  );
}

type ScrubberProps = {
  ops: readonly { op: TimeMachineOp; t: number }[];
  kinds: readonly TimeMachineKind[];
  scale: { start: number; end: number };
  target: number;
  onTarget: (t: number) => void;
  undone: number;
  now: number;
  timeZone: string;
  startLabel: string;
};
/** 72-hour track: day ticks, op dots (buttons), shaded range target → now, a slider pin. */
function Scrubber({ ops, kinds, scale, target, onTarget, undone, now, timeZone, startLabel }: ScrubberProps) {
  const track = useRef<HTMLDivElement | null>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef(false);
  const [hover, setHover] = useState<number>(-1);
  const pct = scrubberPercent(scale, target);
  const tone = (kind?: string) => kinds.find((k) => k.key === kind)?.tone ?? "brand";
  const atPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    onTarget(scrubberTimeAt(scale, ((e.clientX - box.left) / box.width) * 100));
  };
  const sliderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 * 60_000 : 3_600_000;
    const map: Record<string, number> = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -86_400_000, PageUp: 86_400_000 };
    if (e.key === "Home") onTarget(scale.start);
    else if (e.key === "End") onTarget(scale.end);
    else if (map[e.key] !== undefined) onTarget(target + map[e.key]!);
    else return;
    e.preventDefault();
  };
  const dotKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "Home" ? -ops.length : e.key === "End" ? ops.length : 0;
    if (!delta) return;
    e.preventDefault();
    dots.current[stepIndex(ops.length, i, delta)]?.focus();
  };
  const tip = hover >= 0 ? ops[hover] : undefined;
  return (
    <div className="aui-tm-scrubber">
      <span className="aui-tm-end" data-side="start">{startLabel}</span>
      <span className="aui-tm-end" data-side="end">现在 {zonedClock(now, timeZone).date.slice(5)} {zonedClock(now, timeZone).time}</span>
      <div
        className="aui-tm-track"
        ref={track}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".aui-tm-dot")) return;
          drag.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          atPointer(e);
        }}
        onPointerMove={(e) => { if (drag.current) atPointer(e); }}
        onPointerUp={() => { drag.current = false; }}
        onPointerCancel={() => { drag.current = false; }}
      >
        <span className="aui-tm-line" aria-hidden="true" />
        {scrubberDayTicks(scale, timeZone).map((d) => (
          <span key={d.at} className="aui-tm-day" style={{ left: `${d.percent}%` }} aria-hidden="true"><small>{d.label}</small></span>
        ))}
        <span className="aui-tm-sel" style={{ left: `${pct}%` }} data-flip={pct > 50 || undefined} aria-hidden="true">
          {undone > 0 && <small>这一刻之后 {undone} 次操作会被退回</small>}
        </span>
        {ops.map(({ op, t }, i) => (
          <button
            key={op.id}
            ref={(el) => {
              dots.current[i] = el;
            }}
            type="button"
            className="aui-tm-dot"
            data-tone={tone(op.kind)}
            data-after={t > target || undefined}
            style={{ left: `${scrubberPercent(scale, t)}%` }}
            aria-label={`${op.code ? `${op.code} ` : ""}${shortMoment(t, now, timeZone)} ${op.label}，退到它之前`}
            tabIndex={i === 0 ? 0 : -1}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(-1)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(-1)}
            onKeyDown={(e) => dotKey(e, i)}
            onClick={() => onTarget(justBefore(t))}
          />
        ))}
        {tip && (
          <span className="aui-tm-tip" role="tooltip" style={{ left: `${scrubberPercent(scale, tip.t)}%` }}>
            {tip.op.code && <code>{tip.op.code}</code>} {shortMoment(tip.t, now, timeZone)}
            <br />
            {tip.op.label} · 点一下退到它之前
          </span>
        )}
        <div
          className="aui-tm-pin"
          role="slider"
          tabIndex={0}
          aria-label="退回到的时间"
          aria-valuemin={scale.start}
          aria-valuemax={scale.end}
          aria-valuenow={target}
          aria-valuetext={shortMoment(target, now, timeZone)}
          style={{ left: `${pct}%` }}
          onKeyDown={sliderKey}
        >
          <b>{shortMoment(target, now, timeZone)}</b>
        </div>
      </div>
    </div>
  );
}
