"use client";
/**
 * CellHistoryPopover (bt/share H3, demo D25): the versions of one cell — or of the whole
 * record — in a 380-wide bubble under the cell: a vertical timeline, each version old → new (ChangeValue),
 * then who · when · a grey source tag (表格 / 粘贴 / 导入 / 表单 / API / AI / 自动化) and the operation id;
 * the current version has the primary dot + 「当前」. 「恢复」 shows on the hovered row (always on touch)
 * and asks in place 「恢复成 X？会记成一个新版本」. A 「这一格 / 整条记录」 switch. Anchored to any element, or to a viewport box for grids that draw
 * cells themselves. Data and restore go through props / callbacks; restoring writes a new version
 * on the server (the host reloads `versions`).
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useState, type ReactNode } from "react";
import { Bot, Check, ChevronRight, Info, Undo2, X, History } from "lucide-react";
import { Button } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import type { LayerRect } from "./menu-core.ts";
import { SOURCE_LABELS, relativeDay, shortTime, type CellVersionSource } from "./share-core.ts";
import { ChangeValue } from "./change-value.tsx";
import { avatarTone } from "./avatar-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/cell-history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/cell-history.css";

export type CellVersion = {
  id: string;
  /** Epoch ms. */
  at: number;
  /** A person (avatar letter) or a bot (automation / AI name). */
  actor: { name: string; avatar?: string; bot?: boolean };
  source: CellVersionSource;
  /** Operation id (「OP-20261005-0151」) to find it in the operation log. */
  opId?: string;
  /** Field name — shown in the whole-record scope. */
  field?: string;
  /** null = empty before (created). */
  before: ReactNode | null;
  after: ReactNode;
  note?: ReactNode;
  /** The value now in the cell (no restore button). */
  current?: boolean;
  /** Cannot restore, with the reason (「这个字段现在只读」). */
  restoreBlocked?: string;
};

export type CellHistoryScope = "cell" | "record";
export type CellHistoryPopoverProps = {
  open: boolean;
  /**
   * `returnFocus` is true for Esc / the ✕ button: with `anchor` focus goes back to it by itself; with only
   * `anchorRect` (a drawn cell) the host puts focus back on its cell. False for an outside click / scroll.
   */
  onClose: (returnFocus: boolean) => void;
  /** The cell element … */
  anchor?: HTMLElement | null;
  /** … or its viewport box (canvas / virtual grids). */
  anchorRect?: LayerRect | null;
  /** 「黄淑芬 · 预计金额」 */
  subject: string;
  versions: readonly CellVersion[];
  scope: CellHistoryScope;
  /** Omit to hide the 「这一格 / 整条记录」 switch. */
  onScopeChange?: (scope: CellHistoryScope) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Restore; resolve = done (host reloads versions), reject = message shown. */
  onRestore?: (version: CellVersion) => Promise<void> | void;
  /** Footer note (「保留 180 天，超过 3 天的版本也能在这里逐条恢复」). */
  retentionNote?: ReactNode;
  /** Footer link to the operation log. */
  onOpenLog?: () => void;
  timeZone?: string;
  /** Clock for 「今天 15:05」 (default Date.now). */
  now?: () => number;
};

/** Version history of a cell / record, anchored under the cell. */
export function CellHistoryPopover({ open, onClose, anchor = null, anchorRect, subject, versions, scope, onScopeChange, loading, error, onRetry, onRestore, retentionNote, onOpenLog, timeZone: timeZoneProp, now = Date.now }: CellHistoryPopoverProps) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [pending, setPending] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const restore = async (version: CellVersion) => {
    if (!onRestore || pending) return;
    setPending(version.id);
    setFailure(null);
    try {
      await onRestore(version);
      setAsking(null);
    } catch (e) {
      setFailure({ id: version.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(null);
    }
  };
  const close = (back: boolean) => {
    setAsking(null);
    onClose(back);
    if (back) anchor?.focus({ preventScroll: true });
  };
  const clock = now();
  return (
    <PopoverLayer open={open} anchor={anchor} anchorRect={anchorRect} label={`修改历史：${subject}`} onClose={close} className="aui-popover aui-cell-history" align="end">
      <div className="aui-popover-header aui-cell-history-head">
        <History aria-hidden="true" />
        <span className="aui-cell-history-title">
          <strong className="aui-popover-title">修改历史</strong>
          <small>
            {subject} · {versions.length} 个版本
          </small>
        </span>
        <span className="aui-cell-history-tools">
          {onScopeChange && (
            <SegmentedControl
              size="sm"
              label="看哪一部分的历史"
              value={scope}
              onValueChange={onScopeChange}
              options={[
                { value: "cell", label: "这一格" },
                { value: "record", label: "整条记录" },
              ]}
            />
          )}
          <IconButton label="关闭修改历史" tooltip="关闭（Esc）" onClick={() => close(true)} icon={<X />} />
        </span>
      </div>
      <div className="aui-popover-body aui-cell-history-body" data-flush>
        {loading ? (
          <p className="aui-cell-history-state" role="status">正在加载…</p>
        ) : error ? (
          <p className="aui-cell-history-state" role="alert">
            {error}
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                重试
              </Button>
            )}
          </p>
        ) : versions.length === 0 ? (
          <p className="aui-cell-history-state">还没有改过</p>
        ) : (
          <ol className="aui-cell-versions">
            {versions.map((v) => (
              <li key={v.id} className="aui-cell-version" data-current={v.current || undefined} data-asking={asking === v.id || undefined}>
                <span className="aui-cell-version-dot" aria-hidden="true" />
                <div className="aui-cell-version-l2">
                  {v.field && scope === "record" && <span className="aui-cell-version-field">{v.field}</span>}
                  <ChangeValue before={v.before} after={v.after} />
                </div>
                <div className="aui-cell-version-l1">
                  <span className="aui-cell-version-who" data-bot={v.actor.bot || undefined}>
                    <span className="aui-avatar" data-size="20" data-tone={v.actor.bot ? undefined : avatarTone(v.actor.name)} aria-hidden="true">
                      {v.actor.bot ? <Bot /> : v.actor.avatar ?? v.actor.name.slice(0, 1)}
                    </span>
                    {v.actor.name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={new Date(v.at).toISOString()}>{relativeDay(v.at, clock, timeZone)}</time>
                  <span className="aui-cell-version-source">{SOURCE_LABELS[v.source]}</span>
                  {v.opId && <code>{v.opId}</code>}
                  {v.note && <small>{v.note}</small>}
                </div>
                <div className="aui-cell-version-act">
                  {v.current ? (
                    <span className="aui-cell-version-now">
                      <Check aria-hidden="true" />
                      当前
                    </span>
                  ) : onRestore ? (
                    <span data-tip={v.restoreBlocked ?? "恢复本身也会记一个新版本"}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(v.restoreBlocked) || pending !== null}
                        aria-label={`恢复到 ${shortTime(v.at, timeZone)} 的版本`}
                        aria-expanded={asking === v.id}
                        onClick={() => setAsking((a) => (a === v.id ? null : v.id))}
                      >
                        <Undo2 />
                        恢复
                      </Button>
                    </span>
                  ) : null}
                </div>
                {asking === v.id && (
                  <div className="aui-cell-version-confirm" role="group" aria-label="确认恢复">
                    <span>
                      恢复成 <b>{v.after}</b>？会记成一个新版本
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setAsking(null)}>
                      取消
                    </Button>
                    <Button size="sm" disabled={pending !== null} onClick={() => void restore(v)}>
                      {pending === v.id ? "正在恢复…" : "恢复"}
                    </Button>
                  </div>
                )}
                {failure?.id === v.id && (
                  <p className="aui-share-error aui-cell-version-error" role="alert">
                    {failure.message}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      {(retentionNote || onOpenLog) && (
        <div className="aui-popover-footer aui-cell-history-foot">
          {retentionNote && (
            <span>
              <Info aria-hidden="true" />
              {retentionNote}
            </span>
          )}
          {onOpenLog && (
            <Button size="sm" variant="ghost" onClick={onOpenLog}>
              操作记录
              <ChevronRight />
            </Button>
          )}
        </div>
      )}
    </PopoverLayer>
  );
}
