"use client";
/**
 * Button family pieces beside `Button`: the one icon button, the connected button
 * group, the spinner and the four link kinds (item 7). Styles in styles/controls.css and styles/basics.css.
 */
import { forwardRef, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Ellipsis } from "lucide-react";
import { cn } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { Menu, openFocus, type MenuSection } from "./menu.tsx";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children" | "title"> & {
  /** Accessible name AND the hover bubble (required: an icon alone says nothing to a screen reader). */
  label: string;
  /** The Lucide icon element. */
  icon: ReactNode;
  /** md 36 · default 32 · sm 28 · xs 24 (field rows, cells). */
  size?: "md" | "default" | "sm" | "xs";
  /** ghost (default, no border) · outline (36px, when it stands alone) · danger (red on hover: remove). */
  variant?: "ghost" | "outline" | "danger";
  /** Toggle buttons (关注, 只看我的): pressed = soft main-colour background. */
  pressed?: boolean;
  /** Shortcut keycaps in the bubble ("Mod+K"). */
  shortcut?: string;
  /** Bubble text when it should differ from `label`. */
  tooltip?: string;
  /** A number badge (unread) or a dot (`true`) at the top right. */
  badge?: number | boolean;
  /** Why it can't be clicked; the button stays focusable and the bubble says why. */
  disabledReason?: string;
};

/**
 * The only icon button: square, borderless (32 / 28 / 24; outline 36 when alone), grey icon, darker on hover,
 * main colour when pressed / open. Always has an aria-label and the dark Tooltip (with an optional shortcut).
 */
export const IconButton = /* @__PURE__ */ forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "default", variant = "ghost", pressed, shortcut, tooltip, badge, disabledReason, disabled, className, onClick, type = "button", ...rest },
  ref,
) {
  const blocked = Boolean(disabledReason) && disabled !== false;
  return (
    <button
      ref={ref}
      type={type}
      className={cn("aui-icon-btn", className)}
      data-size={size === "default" ? undefined : size}
      data-variant={variant === "ghost" ? undefined : variant}
      aria-label={label}
      aria-pressed={pressed}
      disabled={blocked ? undefined : disabled}
      aria-disabled={blocked || undefined}
      {...tipProps(blocked ? disabledReason : (tooltip ?? label), blocked ? undefined : shortcut)}
      {...rest}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {icon}
      {typeof badge === "number" && badge > 0 && <span className="aui-count" data-tone="primary" aria-hidden="true">{badge > 99 ? "99+" : badge}</span>}
      {badge === true && <span className="aui-dot-badge" aria-hidden="true" />}
    </button>
  );
});

export type ButtonGroupProps = { children: ReactNode; /** Name of the group (「视图」). */ label: string; className?: string };
/** Outline buttons joined into one strip (view switch, pager); the selected one has `aria-pressed`. */
export function ButtonGroup({ children, label, className }: ButtonGroupProps) {
  return (
    <div role="group" aria-label={label} className={cn("aui-button-group", className)}>
      {children}
    </div>
  );
}

export type SpinnerProps = { /** 16 (default, in buttons / inputs) · 20 · 32 (a whole area). */ size?: 16 | 20 | 32; /** brand = main colour; default follows the text colour. */ tone?: "current" | "brand"; /** Screen-reader text (「正在搜索…」); omit when the text next to it already says so. */ label?: string };
/** Only for 「don't know how long, don't know the shape」 (opening a dialog, searching, 加载更多); content loads use skeletons. */
export function Spinner({ size = 16, tone = "current", label }: SpinnerProps) {
  return (
    <span
      className="aui-spinner"
      data-size={size === 16 ? undefined : String(size)}
      data-tone={tone === "brand" ? "brand" : undefined}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export type LinkKind = "default" | "quiet" | "anchor" | "next" | "external";
export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /**
   * default = body link (main colour, underline on hover) · quiet = a whole column of links (text colour,
   * green on hover) · anchor = scrolls to a field on this page (dotted underline) · next = 「查看全部 →」 ·
   * external = opens another site (↗, new tab). Going somewhere = a link; doing something here = Button variant="text".
   */
  kind?: LinkKind;
  disabled?: boolean;
};
/** The four link kinds. */
export const Link = /* @__PURE__ */ forwardRef<HTMLAnchorElement, LinkProps>(function Link({ kind = "default", disabled, className, children, target, rel, ...rest }, ref) {
  const external = kind === "external";
  return (
    <a
      ref={ref}
      className={cn("aui-link", className)}
      data-kind={kind === "default" ? undefined : kind}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : rest.tabIndex}
      target={target ?? (external ? "_blank" : undefined)}
      rel={rel ?? (external ? "noopener noreferrer" : undefined)}
      {...rest}
    >
      {children}
      {kind === "next" && <ArrowRight aria-hidden="true" />}
      {external && (
        <>
          <ArrowUpRight aria-hidden="true" />
          <span className="aui-sr-only">（新窗口打开）</span>
        </>
      )}
    </a>
  );
});

export type MoreMenuProps = {
  sections: readonly MenuSection[];
  /** Accessible name / bubble, default 「更多」. */
  label?: string;
  size?: IconButtonProps["size"];
  disabled?: boolean;
  /** Another icon for an icon-only menu (「+」 新建看板); default 「⋯」. */
  icon?: ReactNode;
  /** A line on top of the menu (multi-select: 「已选 3 条：赵静怡、陈冠宇…」). */
  header?: ReactNode;
  /** Bubble text when it should differ from `label`. */
  tooltip?: string;
  /** Which edge of the button the menu lines up with (default end). */
  align?: "start" | "end";
  className?: string;
};
/**
 * The 「⋯」 of a toolbar or card: the one primary button stays outside, everything rarely used goes in here
 * (表设置 / 权限 / 操作记录). An IconButton with a Menu.
 */
export function MoreMenu({ sections, label = "更多", size = "default", disabled, icon, header, tooltip, align = "end", className }: MoreMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<false | "first" | "last" | "menu">(false);
  return (
    <>
      <IconButton
        ref={trigger}
        label={label}
        tooltip={tooltip}
        className={className}
        icon={icon ?? <Ellipsis />}
        size={size}
        aria-haspopup="menu"
        aria-expanded={Boolean(open)}
        disabled={disabled || !sections.some((section) => section.items.length)}
        onClick={(event) => setOpen((v) => (v ? false : openFocus(event)))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      />
      <Menu open={Boolean(open)} anchor={trigger.current} align={align} sections={sections} label={label} header={header} initialFocus={open || "first"} onClose={() => setOpen(false)} />
    </>
  );
}
