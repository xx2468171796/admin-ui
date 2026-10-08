"use client";
/**
 * The two identity controls of the AdminShell sidebar: 「当前公司」 under the brand
 * (CompanySwitcher — the whole company / workspace switch lives top-left) and one avatar row at the bottom
 * (AccountMenu — 我的资料 / API 令牌 / 管理后台 ↗ / 外观 / 退出登录: only things about me). Collapsed (64px)
 * both shrink to an icon and their menus open to the right. Generic: the host passes the items.
 */
import { useRef, useState, type ReactNode, type Ref } from "react";
import { ArrowUpRight, Building2, Check, ChevronsUpDown, LogOut, type LucideIcon } from "lucide-react";
import { PopoverLayer } from "./popover-panel.tsx";
import { ColorModeChoice } from "./appearance.tsx";
import { avatarTone } from "./avatar-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";

export type ShellAccount = {
  name: string;
  /** Account + where (「lead01 · 华南子公司」): the head of the account menu. */
  detail?: string;
  /** Second line of the bottom row (「销售一组 · 组长」); default `detail`. */
  role?: string;
};
export type AccountMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  /** A link instead of a button. */
  href?: string;
  /** Opens in a new browser tab and shows ↗ (「管理后台」). */
  external?: boolean;
  /** Grey note on the right. */
  hint?: string;
};
export type CompanyOption = { id: string; name: string; /** Grey note on the right (「集团总部」). */ note?: string };
export type CompanySwitcherProps = {
  /** Current company id. */
  value: string;
  /** Companies this person can switch to. Empty / omitted with `onOpen`: the button opens the host's own picker. */
  options?: readonly CompanyOption[];
  onSwitch?: (id: string) => void;
  /** Without `options`: what the button does (open a picker page / dialog). */
  onOpen?: () => void;
  /** Name shown on the button when `options` does not list the current company. */
  currentName?: string;
  /** Heading of the list (default 「切换公司」). */
  label?: string;
  /** A last row under a line (「公司设置 · 管理后台」). */
  footer?: AccountMenuItem;
};

const letter = (name: string) => name.trim().slice(0, 1) || "?";

function MenuRow({ item, onDone }: { item: AccountMenuItem; onDone: () => void }) {
  const Icon = item.icon;
  const body = (
    <>
      {Icon && <Icon aria-hidden="true" />}
      <span className="aui-acct-item-label">{item.label}</span>
      {item.hint && <small>{item.hint}</small>}
      {item.external && <ArrowUpRight className="aui-acct-item-ext" aria-hidden="true" />}
    </>
  );
  if (item.href)
    return (
      <a className="aui-acct-item" href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} aria-label={item.external ? `${item.label}（新标签页打开）` : undefined} onClick={() => { item.onSelect?.(); onDone(); }}>
        {body}
      </a>
    );
  return (
    <button type="button" className="aui-acct-item" onClick={() => { onDone(); item.onSelect?.(); }}>
      {body}
    </button>
  );
}

/** A sidebar trigger + its popover: above the row when expanded, to its right when the rail is collapsed. */
function SidebarPopover({ label, className, side, trigger, children }: { label: string; className: string; side: "top" | "bottom" | "right"; trigger: (props: { ref: Ref<HTMLButtonElement>; open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger({ ref, open, toggle: () => setOpen((v) => !v) })}
      <PopoverLayer open={open} anchor={ref.current} label={label} side={side} className={`aui-popover ${className}`} onClose={(back) => { setOpen(false); if (back) ref.current?.focus(); }}>
        <div className="aui-popover-body">{children(() => setOpen(false))}</div>
      </PopoverLayer>
    </>
  );
}

/** Avatar letter (by-person colour, like everywhere else). */
export function AccountAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return <span className="aui-avatar aui-acct-avatar" data-size={size === "sm" ? "sm" : undefined} data-tone={avatarTone(name)} aria-hidden="true">{letter(name)}</span>;
}

export type AccountMenuProps = {
  account: ShellAccount;
  items?: readonly AccountMenuItem[];
  /** 「退出登录」 at the bottom (own section). */
  onSignOut?: () => void;
  signOutLabel?: string;
  /** The 外观 row (浅色 / 深色 / 跟随系统); default true. */
  appearance?: boolean;
  /** Icon-only trigger (collapsed rail): the menu opens to the right. */
  compact?: boolean;
};
/** The bottom-left avatar row of the sidebar → account menu. */
export function AccountMenu({ account, items = [], onSignOut, signOutLabel = "退出登录", appearance = true, compact = false }: AccountMenuProps) {
  const name = account.name.trim() || "账号";
  const role = account.role ?? account.detail;
  return (
    <SidebarPopover
      label={`账号：${name}`}
      className="aui-acct-pop"
      side={compact ? "right" : "top"}
      trigger={({ ref, open, toggle }) => (
        <button ref={ref} type="button" className="aui-acct-row" data-compact={compact || undefined} aria-label={compact ? `账号：${name}` : undefined} data-tip={compact ? name : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
          <AccountAvatar name={name} />
          {!compact && (
            <span className="aui-acct-row-text">
              <b>{name}</b>
              {role && <small>{role}</small>}
            </span>
          )}
          {!compact && <ChevronsUpDown className="aui-acct-row-chevron" aria-hidden="true" />}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="aui-acct-head">
            <AccountAvatar name={name} />
            <span><b>{name}</b>{account.detail && <small>{account.detail}</small>}</span>
          </div>
          {items.length > 0 && <div className="aui-acct-section">{items.map((item) => <MenuRow key={item.id} item={item} onDone={close} />)}</div>}
          {appearance && (
            <div className="aui-acct-section aui-acct-appearance">
              <span>外观</span>
              <ColorModeChoice />
            </div>
          )}
          {onSignOut && (
            <div className="aui-acct-section">
              <MenuRow item={{ id: "sign-out", label: signOutLabel, icon: LogOut, onSelect: onSignOut }} onDone={close} />
            </div>
          )}
        </>
      )}
    </SidebarPopover>
  );
}

/** 「当前公司」 button under the brand → the company list (or the host's own picker via `onOpen`). */
export function CompanySwitcher({ value, options = [], onSwitch, onOpen, currentName, label = "切换公司", footer, compact = false }: CompanySwitcherProps & { /** Icon-only (collapsed rail): opens to the right. */ compact?: boolean }) {
  const current = options.find((o) => o.id === value);
  const name = current?.name ?? currentName ?? "";
  const buttonLabel = `${label}：当前 ${name || "未选"}`;
  const trigger = ({ ref, open, toggle }: { ref?: Ref<HTMLButtonElement>; open?: boolean; toggle: () => void }) => (
    <button ref={ref} type="button" className="aui-company" data-compact={compact || undefined} aria-label={buttonLabel} data-tip={compact ? name || label : undefined} aria-haspopup={options.length ? "dialog" : undefined} aria-expanded={options.length ? Boolean(open) : undefined} onClick={toggle}>
      <Building2 aria-hidden="true" />
      {!compact && <span className="aui-company-name">{name || label}</span>}
      {!compact && <ChevronsUpDown className="aui-company-chevron" aria-hidden="true" />}
    </button>
  );
  if (!options.length) return trigger({ toggle: () => onOpen?.() });
  return (
    <SidebarPopover label={label} className="aui-company-pop" side={compact ? "right" : "bottom"} trigger={trigger}>
      {(close) => (
        <>
          <div className="aui-acct-title">{label}</div>
          <div className="aui-acct-section" role="group" aria-label={label}>
            {options.map((o) => (
              <button key={o.id} type="button" className="aui-acct-item" aria-current={o.id === value ? "true" : undefined} onClick={() => { close(); if (o.id !== value) onSwitch?.(o.id); }}>
                <span className="aui-avatar" data-size="24" data-tone={avatarTone(o.name)} aria-hidden="true">{letter(o.name)}</span>
                <span className="aui-acct-item-label">{o.name}</span>
                {o.note && <small>{o.note}</small>}
                {o.id === value && <Check className="aui-acct-item-check" aria-label="当前" />}
              </button>
            ))}
          </div>
          {(footer || onOpen) && (
            <div className="aui-acct-section">
              {footer && <MenuRow item={footer} onDone={close} />}
              {!footer && onOpen && <MenuRow item={{ id: "more", label: "全部公司…", onSelect: onOpen }} onDone={close} />}
            </div>
          )}
        </>
      )}
    </SidebarPopover>
  );
}
