"use client";
/**
 * Avatars: `Avatar` (5 sizes, per-person colour, photo / bot / departed / group,
 * presence dot), `AvatarStack` (overlap 6px, 「+k」 opens the rest, each avatar has a name bubble) and
 * `PersonChip` (24px grey pill for field values and collaborators; `plain` in tables). Rules in avatar-core.ts.
 */
import { useRef, useState, type ReactNode } from "react";
import { Bot, Users } from "lucide-react";
import { avatarLetter, avatarSize, avatarTone, type AvatarSize } from "./avatar-core.ts";
import { stackPeople } from "./atoms-core.ts";
import { PopoverLayer } from "./popover-panel.tsx";
import { tipProps } from "./tooltip.tsx";

export type AvatarKind = "person" | "bot" | "gone" | "group";
export type AvatarProps = {
  /** Shown as the letter and used for the colour when there is no `id`. */
  name: string;
  /** Account id: the colour follows it (same person, same colour everywhere). */
  id?: string | number;
  /** 20 · 24 · 32 (default) · 40 · 64. */
  size?: AvatarSize;
  /** Photo URL; falls back to the letter if it fails to load. */
  src?: string;
  /** person (default) · bot (rounded square + robot icon) · gone (departed / disabled: grey) · group (grey + people icon). */
  kind?: AvatarKind;
  /** on = main-colour dot · away = attention dot · off = hollow grey dot. */
  presence?: "on" | "away" | "off";
  /** Custom content instead of the letter (an emoji-free icon, two letters). */
  children?: ReactNode;
  /** Show the name in the dark bubble on hover (stacks, compact lists). */
  tooltip?: boolean | string;
  className?: string;
};

/** One person's avatar. Decorative (aria-hidden) — the name must be written next to it or in the bubble. */
export function Avatar({ name, id, size, src, kind = "person", presence, children, tooltip, className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const px = avatarSize(size);
  const bot = kind === "bot";
  const grey = kind === "gone" || kind === "group";
  const tip = tooltip === true ? name : tooltip || undefined;
  return (
    <span
      className={["aui-avatar", className].filter(Boolean).join(" ")}
      data-size={String(px)}
      data-tone={grey ? undefined : avatarTone(id ?? name)}
      data-kind={kind === "person" ? undefined : kind}
      data-bot={bot || undefined}
      data-presence={presence}
      aria-hidden={tip ? undefined : true}
      {...tipProps(tip)}
    >
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : bot ? (
        <Bot aria-hidden="true" />
      ) : kind === "group" ? (
        <Users aria-hidden="true" />
      ) : (
        (children ?? avatarLetter(name))
      )}
    </span>
  );
}

export type StackPerson = {
  name: string;
  /** Shown after the name in the bubble / list (「在编辑」「运营」). */
  hint?: string;
  /** Account id: colour and React key. */
  key?: string;
  src?: string;
  kind?: AvatarKind;
};
export type AvatarStackProps = {
  people: readonly StackPerson[];
  /** Avatars shown before 「+k」 (default 3). */
  max?: number;
  /** What the group is, for screen readers and the 「+k」 list (「正在看的人」). */
  label: string;
  /** 20 (default: title bars, cells) · 24 · 32 (cards, panels). */
  size?: 20 | 24 | 32;
};
/**
 * Overlapping avatars (6px overlap, 2px panel-colour ring). Hover one for 「名字 · 在做什么」; 「+k」 is a button
 * that opens a list of the rest (works on phones, unlike a native title).
 */
export function AvatarStack({ people, max = 3, label, size = 20 }: AvatarStackProps) {
  const px = size;
  const { shown, rest } = stackPeople(people, max);
  const more = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const text = (p: StackPerson) => (p.hint ? `${p.name} · ${p.hint}` : p.name);
  const names = people.map((p) => p.name).join("、");
  return (
    <span className="aui-avatar-stack" data-size={String(px)} role="group" aria-label={people.length ? `${label}：${names}` : `${label}：没有人`}>
      {shown.map((p, i) => (
        <Avatar key={p.key ?? `${p.name}#${i}`} name={p.name} id={p.key} src={p.src} kind={p.kind} size={px} tooltip={text(p)} />
      ))}
      {rest.length > 0 && (
        <>
          <button
            ref={more}
            type="button"
            className="aui-avatar aui-avatar-stack-more"
            data-size={String(px)}
            aria-label={`还有 ${rest.length} 人`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            +{rest.length}
          </button>
          <PopoverLayer open={open} anchor={more.current} label={label} onClose={() => setOpen(false)} className="aui-popover" align="start">
            <ul className="aui-avatar-list">
              {rest.map((p, i) => (
                <li key={p.key ?? `${p.name}#${i}`}>
                  <Avatar name={p.name} id={p.key} src={p.src} kind={p.kind} size={24} />
                  <span>{p.name}</span>
                  {p.hint && <small>{p.hint}</small>}
                </li>
              ))}
            </ul>
          </PopoverLayer>
        </>
      )}
    </span>
  );
}

export type PersonChipProps = {
  name: string;
  id?: string | number;
  src?: string;
  kind?: AvatarKind;
  /** Table cells: avatar + name without the grey pill. */
  plain?: boolean;
  /** Bubble text (「运营部 · 在编辑」). */
  hint?: string;
};
/** A person as a value: 24px grey pill with a 20px avatar (field values, collaborators). Departed people are grey + 「已离职」. */
export function PersonChip({ name, id, src, kind, plain, hint }: PersonChipProps) {
  const gone = kind === "gone";
  return (
    <span className="aui-person-chip" data-plain={plain || undefined} data-gone={gone || undefined} {...tipProps(hint)}>
      <Avatar name={name} id={id} src={src} kind={kind} size={20} />
      <span>
        {name}
        {gone && <span className="aui-sr-only">（已离职）</span>}
      </span>
    </span>
  );
}
