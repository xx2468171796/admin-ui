"use client";
/**
 * StagePath: the stages of a record as a path — `segments` (soft bars with the name
 * and days under each, the cards detail) or `chevrons` (arrow-shaped steps, the single-column detail).
 * Steps are buttons when `onSelect` is given (Tab to a step, Enter / Space picks it; the current one
 * has aria-current="step"); exits (kind lost / void: 丢单、作废) are not in the path but in a trailing
 * 「更多」 menu; when the record left the path that button shows the exit in the danger colour.
 * `readOnly` = nothing is clickable. Rules: resolveStagePath (record-detail-spec.ts).
 */
import { Check, ChevronDown } from "lucide-react";
import { MenuButton } from "./menu.tsx";
import { resolveStagePath, type ResolvedStageStep, type StagePathStep } from "./record-detail-spec.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

export type StagePathProps = {
  steps: readonly StagePathStep[];
  /** Id of the current step (else the step whose state is current / lost). */
  current?: string | null;
  onSelect?: (stepId: string) => void;
  readOnly?: boolean;
  variant?: "segments" | "chevrons";
  /** Accessible name of the path (default 「阶段」). */
  label?: string;
  /** Label of the exits menu (default 「更多」). */
  moreLabel?: string;
  /** Days under each segment (segments variant; default true). */
  showDays?: boolean;
  className?: string;
};

/** 「1 天」 under a finished step, 「第 3 天」 under the current one. */
export function stageDaysText(step: Pick<ResolvedStageStep, "state" | "days">): string | null {
  if (step.days === undefined || step.days === null) return null;
  return step.state === "current" ? `第 ${step.days} 天` : `${step.days} 天`;
}
const STATE_TEXT: Record<ResolvedStageStep["state"], string> = { done: "已完成", current: "当前", todo: "未开始", lost: "已退出" };

export function StagePath({ steps, current, onSelect, readOnly, variant = "segments", label = "阶段", moreLabel = "更多", showDays = true, className }: StagePathProps) {
  const { path, exits, current: now } = resolveStagePath(steps, current);
  const clickable = Boolean(onSelect) && !readOnly;
  const exitNow = now && now.kind !== "normal" ? now : null;
  return (
    <div className={className ? `aui-stagepath ${className}` : "aui-stagepath"} data-variant={variant} data-exited={exitNow ? true : undefined}>
      <ol className="aui-stagepath-list" aria-label={label} style={{ gridTemplateColumns: variant === "segments" ? `repeat(${Math.max(1, path.length)}, minmax(0, 1fr))` : undefined }}>
        {path.map((step, i) => {
          const days = showDays && variant === "segments" ? stageDaysText(step) : null;
          const name = `${step.label}（${STATE_TEXT[step.state]}${days ? `，${days}` : ""}）`;
          const inner = (
            <>
              {variant === "segments" && <span className="aui-stagepath-bar" aria-hidden="true" />}
              <span className="aui-stagepath-name">
                {variant === "chevrons" && (step.state === "done" ? <Check aria-hidden="true" /> : <span className="aui-stagepath-no">{i + 1}</span>)}
                {step.label}
              </span>
              {days && <span className="aui-stagepath-days">{days}</span>}
            </>
          );
          return (
            <li key={step.id} className="aui-stagepath-step" data-state={step.state} data-tone={step.tone}>
              {clickable ? (
                <button type="button" className="aui-stagepath-hit" aria-label={name} aria-current={step.state === "current" ? "step" : undefined} data-tip={step.state === "current" ? undefined : `改到「${step.label}」`} onClick={() => onSelect!(step.id)}>{inner}</button>
              ) : (
                <span className="aui-stagepath-hit" aria-current={step.state === "current" ? "step" : undefined}>{inner}<span className="aui-sr-only">（{STATE_TEXT[step.state]}）</span></span>
              )}
            </li>
          );
        })}
      </ol>
      {exits.length > 0 && (clickable ? (
        <MenuButton size="sm" variant="ghost" className="aui-stagepath-more" data-exited={exitNow ? true : undefined} label={exitNow ? `${moreLabel}：当前「${exitNow.label}」` : moreLabel}
          sections={[{ items: exits.map((step) => ({ key: step.id, label: step.label, danger: step.kind === "lost", checked: step.id === exitNow?.id, onSelect: () => onSelect!(step.id) })) }]}>
          {exitNow ? exitNow.label : moreLabel}<ChevronDown aria-hidden="true" />
        </MenuButton>
      ) : exitNow ? <span className="aui-stagepath-exit">{exitNow.label}</span> : null)}
    </div>
  );
}
