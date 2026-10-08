"use client";
/** Helpers shared by the two LogTimeline layouts (log-timeline.tsx audit, log-operations.tsx operations). Internal. */
import type { ReactNode } from "react";
import { toTime, type DateInput } from "./format.ts";
import type { LogStatus, LogUndoKind } from "./log-timeline.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";

export const letterOf = (name: ReactNode) => (typeof name === "string" ? name.trim().slice(0, 1) : "");
export const UNDO_LABEL: Readonly<Record<LogUndoKind, string>> = { batch: "撤回整批", field: "恢复字段（连数据）", revert: "撤销撤回" };

export const hhmm = (value: DateInput | null | undefined, timeZone: string) => {
  const t = toTime(value);
  if (t === null) return "—";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(t);
};


/** Small pill after the sentence. */
export function LogStatusPill({ status }: { status: LogStatus }) {
  return (
    <span className="aui-log-status" data-tone={status.tone ?? "neutral"} data-tip={status.title}>
      {status.icon}
      {status.label}
    </span>
  );
}
