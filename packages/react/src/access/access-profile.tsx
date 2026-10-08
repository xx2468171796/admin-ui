"use client";
/**
 * AccessProfileHeader — the top of a person's access page (D15 「按人员」): avatar, name, role / team
 * tags, a reporting line (组长 · 主管 · 经理) and a stat strip on the right (角色 / 单独加 / 单独减 /
 * 共享记录, from `accessProfileStats`). A stat with `onSelect` is a button (e.g. filter the table to
 * 「只看单独加减」). Presentational; styles in styles/access.css (.aui-access-profile-*).
 */
import type { ReactNode } from "react";
import { Button } from "../primitives.tsx";
import type { AccessProfileStat } from "./profile-core.ts";
import { avatarTone } from "../avatar-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type AccessProfileHeaderProps = {
  name: string;
  /** Avatar text (default the first character of the name). */
  avatar?: string;
  /** Small tags after the name: 「销售」「智能家居 · 一组」. */
  tags?: readonly ReactNode[];
  /** Grey line under the name: 「组长 周组长 · 主管 陈主管」. */
  meta?: ReactNode;
  stats?: readonly AccessProfileStat[];
  /** Make a stat clickable (filter the table …); `active` marks the one in use. */
  onStatSelect?: (stat: AccessProfileStat) => void;
  activeStat?: string | readonly string[] | null;
};

export function AccessProfileHeader({ name, avatar, tags = [], meta, stats = [], onStatSelect, activeStat }: AccessProfileHeaderProps) {
  return (
    <div className="aui-access-profile">
      <span className="aui-avatar" data-size="40" data-tone={avatarTone(name)} aria-hidden="true">{avatar ?? name.slice(0, 1)}</span>
      <div className="aui-access-profile-text">
        <div className="aui-access-profile-name">
          <b>{name}</b>
          {tags.map((t, i) => <span key={i} className="aui-access-profile-tag" data-first={i === 0 || undefined}>{t}</span>)}
        </div>
        {meta && <div className="aui-access-profile-meta">{meta}</div>}
      </div>
      {stats.length > 0 && (
        <ul className="aui-access-profile-stats" aria-label={`${name}的权限构成`}>
          {stats.map((s) => {
            const body = <><b>{s.value}</b><span>{s.label}</span></>;
            return (
              <li key={s.key} data-tone={s.tone}>
                {onStatSelect ? (
                  <Button variant="outline" className="aui-access-profile-stat" aria-pressed={Array.isArray(activeStat) ? activeStat.includes(s.key) : activeStat === s.key} aria-label={`${s.label} ${s.value}`} onClick={() => onStatSelect(s)}>{body}</Button>
                ) : (
                  <span className="aui-access-profile-stat">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
