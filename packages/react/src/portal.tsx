"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, CircleCheck, Circle } from "lucide-react";
import { Button } from "./primitives.tsx";
import { quotaPercent, quotaTone } from "./portal-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
export { quotaTone, quotaPercent, type QuotaTone } from "./portal-core.ts";

/**
 * Customer self-service building blocks (portal variant of AdminShell). Research basis and usage
 * rules: DESIGN.md「客户门户」— home answers "am I OK, how much is left, what next"; quotas are
 * horizontal bars with used / total and when they reset, never gauges or bare big numbers.
 */

/**
 * One quota as a labelled horizontal bar: 「label ··· 已用 X / Y」, the bar, then when it resets.
 * total null / ≤ 0 means unlimited (no bar). Pass `format` for money / bytes; values are numbers
 * the host already converted (display only, never used for billing).
 */
export function QuotaMeter({
  label,
  used,
  total,
  format = (n: number) => String(n),
  reset,
  hint,
  warnAt = 0.8,
  unlimitedText = "不限",
}: {
  label: ReactNode;
  used: number | null;
  total: number | null;
  format?: (n: number) => string;
  /** When it refills, in the customer's words: 「2 小时 13 分后恢复（14:30）」「10-07 重置」. */
  reset?: ReactNode;
  /** Extra line under the bar, e.g. what to do when it runs out. */
  hint?: ReactNode;
  warnAt?: number;
  unlimitedText?: string;
}) {
  const limited = total !== null && total > 0;
  const ratio = limited && used !== null ? used / total : null;
  const tone = quotaTone(ratio, warnAt);
  const percent = quotaPercent(used, total);
  return (
    <div className="aui-quota" data-tone={tone}>
      <div className="aui-quota-head">
        <span className="aui-quota-label">{label}</span>
        <span className="aui-quota-value">
          {used === null ? "—" : `已用 ${format(used)}`}
          <small> / {limited ? format(total) : unlimitedText}</small>
        </span>
      </div>
      {limited && (
        <div
          className="aui-quota-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent === null ? undefined : Math.round(percent)}
          aria-label={typeof label === "string" ? label : undefined}
        >
          <span style={{ width: `${percent ?? 0}%` }} />
        </div>
      )}
      {(reset || percent !== null) && (
        <div className="aui-quota-foot">
          <span>{reset}</span>
          {percent !== null && <span>{percent}%</span>}
        </div>
      )}
      {hint && <p className="aui-quota-hint">{hint}</p>}
    </div>
  );
}

export type SetupStep = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Detect it from real data when you can (first request seen, client imported) instead of asking. */
  done: boolean;
  /** Shown on unfinished steps: the button that does the step right here. */
  action?: ReactNode;
};

/**
 * Collapsible first-run checklist with progress (Shopify setup guide pattern), in place of
 * pop-up tutorials. Collapsed / dismissed state is kept per browser under storageKey. Once every
 * step is done it shrinks to one line with 「不再显示」.
 */
export function SetupChecklist({
  title = "快速上手",
  description,
  steps,
  storageKey,
}: {
  title?: ReactNode;
  description?: ReactNode;
  steps: readonly SetupStep[];
  storageKey: string;
}) {
  const [state, setState] = useState<{ collapsed: boolean; dismissed: boolean }>(() => {
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey);
      const v = raw ? (JSON.parse(raw) as { collapsed?: boolean; dismissed?: boolean }) : {};
      return { collapsed: !!v.collapsed, dismissed: !!v.dismissed };
    } catch {
      return { collapsed: false, dismissed: false };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* private mode: state just is not remembered */
    }
  }, [storageKey, state]);
  const done = steps.filter((s) => s.done).length;
  const all = steps.length > 0 && done === steps.length;
  if (state.dismissed || steps.length === 0) return null;
  const toggle = () => setState((s) => ({ ...s, collapsed: !s.collapsed }));
  const open = !state.collapsed && !all;
  return (
    <section className="aui-panel aui-setup" data-complete={all}>
      <div className="aui-setup-head">
        <div className="aui-setup-title">
          <strong>{all ? "都设置好了" : title}</strong>
          <span className="aui-note">
            {all ? "以后可以在菜单里随时找到这些操作。" : description}
          </span>
        </div>
        <span className="aui-setup-count">
          {done} / {steps.length}
        </span>
        {all ? (
          <Button variant="ghost" size="sm" onClick={() => setState((s) => ({ ...s, dismissed: true }))}>
            不再显示
          </Button>
        ) : (
          <IconButton label={open ? "收起" : "展开"} aria-expanded={open} onClick={toggle} icon={open ? <ChevronUp /> : <ChevronDown />} />
        )}
      </div>
      <div className="aui-setup-bar" aria-hidden="true">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {open && (
        <ol className="aui-setup-steps">
          {steps.map((s, i) => {
            const current = !s.done && steps.slice(0, i).every((p) => p.done);
            return (
              <li key={s.id} data-done={s.done} data-current={current}>
                {s.done ? <CircleCheck size={20} aria-label="已完成" /> : <Circle size={20} aria-label="未完成" />}
                <div className="aui-setup-text">
                  <strong>{s.title}</strong>
                  {s.description && !s.done && <p className="aui-note">{s.description}</p>}
                </div>
                {!s.done && s.action && <div className="aui-setup-action">{s.action}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
