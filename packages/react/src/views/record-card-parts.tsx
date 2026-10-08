"use client";
/** RecordCard footer (bt/views V2, review 08): owner avatar + name on the left; comment count and the next follow-up pill on the right. */
import { Clock, MessageSquare } from "lucide-react";
import { Avatar } from "../avatar.tsx";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { readField, type GridField } from "../grid-core.ts";
import { cardOwner, dueState } from "./record-card-core.ts";
import { todayKey } from "./date-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export function CardFooter<T>({ record, owner, due, comments, today, timeZone }: {
  record: T;
  owner?: GridField<T>;
  due?: GridField<T>;
  comments?: number | ((record: T) => number | null | undefined);
  today?: string;
  timeZone?: string;
}) {
  const person = cardOwner(owner, record);
  const count = typeof comments === "function" ? comments(record) : comments;
  const fallbackZone = useAdminDefaults().timeZone;
  const zone = due?.timeZone ?? timeZone ?? fallbackZone;
  const state = due ? dueState(readField(due, record), today ?? todayKey(Date.now(), timeZone ?? fallbackZone), zone) : null;
  if (!person && !count && !state) return null;
  return (
    <div className="aui-rcard-foot">
      {person && (
        <span className="aui-rcard-owner" data-tip={person.name}>
          <Avatar name={person.name} id={person.id} size={20} />
          <span className="aui-rcard-owner-name">{person.name}</span>
        </span>
      )}
      <span className="aui-rcard-foot-end">
        {count ? (
          <span className="aui-rcard-comments" aria-label={`${count} 条评论`}>
            <MessageSquare aria-hidden="true" />
            {count}
          </span>
        ) : null}
        {state && (
          <span className="aui-rcard-due" data-tone={state.tone ?? undefined} aria-label={`${due?.title ?? "下次跟进"}：${state.text}`}>
            <Clock aria-hidden="true" />
            {state.text}
          </span>
        )}
      </span>
    </div>
  );
}
