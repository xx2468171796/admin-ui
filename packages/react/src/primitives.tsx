"use client";
// shadcn/ui composition, adapted to scoped CSS tokens. See THIRD-PARTY.md.
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { ScrollStrip } from "./scroll-strip.tsx";
import { MenuButton } from "./menu.tsx";
import { tipProps } from "./tooltip.tsx";
export const cn = clsx;

/**
 * Give a component its DevTools name without a module-level statement (`X.displayName = …` is a side effect that
 * keeps every component of this file in a consumer's bundle, used or not).
 */
/* @__NO_SIDE_EFFECTS__ */
function named<C extends { displayName?: string }>(component: C, name: string): C {
  component.displayName = name;
  return component;
}
const buttonVariants = cva("aui-button", {
  variants: {
    variant: {
      default: "aui-button-primary",
      secondary: "aui-button-secondary",
      outline: "aui-button-outline",
      ghost: "aui-button-ghost",
      text: "aui-button-text",
      destructive: "aui-button-destructive",
      "destructive-outline": "aui-button-destructive-outline",
    },
    size: {
      lg: "aui-button-lg",
      default: "",
      sm: "aui-button-sm",
      xs: "aui-button-xs",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;
export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> & {
  /**
   * default = primary (solid, one per area) · secondary (soft, the second most important) · outline (the usual
   * button) · ghost (grey text: toolbars, card corners) · text (green text: in-row / inline actions) ·
   * destructive (solid red, confirm dialogs only) · destructive-outline (delete on a page). Navigation is a `Link`;
   * an icon-only button is an `IconButton`.
   */
  variant?: ButtonVariant | null;
  /** lg 40 · default 36 (40 on phones) · sm 28 · xs 24. */
  size?: ButtonSize | null;
  asChild?: boolean;
  /** Saving / loading: a spinner replaces the left icon, the width stays, clicks are ignored (aria-busy). */
  loading?: boolean;
  /** Label while loading (「保存中…」); default keeps the label. */
  loadingText?: React.ReactNode;
  /**
   * Why it can't be clicked: the button stays focusable (aria-disabled) and the dark Tooltip says why.
   * Use instead of `disabled` whenever the reason isn't obvious.
   */
  disabledReason?: string;
  /** Tooltip text (one sentence) and its shortcut keycaps. */
  tooltip?: string;
  shortcut?: string;
  children?: React.ReactNode;
};
export const Button = /* @__PURE__ */ named(/* @__PURE__ */ React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type = "button", loading, loadingText, disabledReason, tooltip, shortcut, disabled, onClick, children, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const own = React.useRef<HTMLButtonElement | null>(null);
    const width = React.useRef<number | null>(null);
    React.useLayoutEffect(() => {
      if (!loading && own.current) width.current = own.current.offsetWidth;
    });
    const blocked = Boolean(disabledReason) && Boolean(disabled ?? true);
    const tipText = blocked ? disabledReason : tooltip;
    const setRef = (node: HTMLButtonElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };
    const lockedStyle = loading && width.current ? { ...style, minWidth: width.current } : style;
    return (
      <Comp
        ref={setRef}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={blocked ? undefined : disabled}
        aria-disabled={blocked || loading ? true : props["aria-disabled"]}
        aria-busy={loading || undefined}
        data-loading={loading ? "" : undefined}
        style={lockedStyle}
        {...tipProps(tipText, blocked ? undefined : shortcut)}
        {...props}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          if (blocked || loading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        {asChild ? children : loading ? (
          <>
            <span className="aui-spinner" aria-hidden="true" />
            {loadingText ?? stripIcon(children)}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
), "Button");
/** While loading the spinner takes the icon's place: drop a leading icon element (svg) from the label. */
function stripIcon(children: React.ReactNode): React.ReactNode {
  const list = React.Children.toArray(children);
  const first = list[0];
  if (React.isValidElement(first) && typeof first.type !== "string" && list.length > 1) return list.slice(1);
  if (React.isValidElement(first) && first.type === "svg" && list.length > 1) return list.slice(1);
  return children;
}
export type InputProps = Omit<React.ComponentProps<"input">, "size" | "prefix"> & {
  /** sm 28 (filters, cells) · md 36 (default; 40 on phones, 44 on public pages). */
  size?: "sm" | "md";
  /** Inside the box on the left: an icon or a unit in the note colour (「https://」 is a `segment`). */
  prefix?: React.ReactNode;
  /** Inside the box on the right: a unit (「元」「%」), an icon or a small button. */
  suffix?: React.ReactNode;
  /** A part of the box you pick (country code, currency): a button / span with a line after it. */
  segment?: React.ReactNode;
  /** The light circled × while there is a value and the box is hovered / focused; calls `onClear` (or empties via onChange). */
  clearable?: boolean;
  onClear?: () => void;
  /** 「12/20」 at the right end (needs `maxLength`; a single-line FormField can show it under the box instead). */
  showCount?: boolean;
  /** Monospace (codes, tokens, passwords). */
  mono?: boolean;
  /** Classes on the outer box when the input is wrapped (prefix / suffix / segment / clear / count). */
  boxClassName?: string;
};
/** Count level: 90% → warn, over the limit → over. */
export function countLevel(length: number, max: number | undefined): "warn" | "over" | undefined {
  if (!max || max <= 0) return undefined;
  if (length > max) return "over";
  return length >= Math.ceil(max * 0.9) ? "warn" : undefined;
}
/**
 * The text box: same border / focus ring / error look as the approved selects and dates.
 * Plain props render the bare `<input class="aui-input">` exactly as before; `prefix` / `suffix` / `segment` /
 * `clearable` / `showCount` wrap it in one box (the input stays the element that gets the ref, id and aria props).
 */
export const Input = /* @__PURE__ */ named(/* @__PURE__ */ React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, prefix, suffix, segment, clearable, onClear, showCount, mono, boxClassName, ...props }, ref) => {
    const own = React.useRef<HTMLInputElement | null>(null);
    const setRef = (node: HTMLInputElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };
    const boxed = prefix !== undefined || suffix !== undefined || segment !== undefined || clearable || showCount;
    if (!boxed)
      return <input ref={setRef} className={cn("aui-input", className)} data-size={size === "sm" ? "sm" : undefined} data-mono={mono || undefined} {...props} />;
    const text = props.value === undefined || props.value === null ? "" : String(props.value);
    const filled = text.length > 0;
    const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
    const max = typeof props.maxLength === "number" ? props.maxLength : undefined;
    const clear = () => {
      if (onClear) onClear();
      else if (own.current) {
        // Empty a controlled input through React's own value setter so onChange fires.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(own.current, "");
        own.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
      own.current?.focus({ preventScroll: true });
    };
    return (
      <span
        className={cn("aui-input aui-input-box", boxClassName)}
        data-size={size === "sm" ? "sm" : undefined}
        data-segmented={segment !== undefined || undefined}
        data-filled={filled || undefined}
        data-invalid={invalid || undefined}
        data-disabled={props.disabled || undefined}
        data-readonly={props.readOnly || undefined}
        data-mono={mono || undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            own.current?.focus();
          }
        }}
      >
        {segment}
        {prefix !== undefined && <span className="aui-input-affix">{prefix}</span>}
        <input ref={setRef} className={className} {...props} />
        {clearable && !props.disabled && !props.readOnly && (
          <button type="button" className="aui-input-clear" tabIndex={-1} aria-label="清空" onClick={clear}>
            <X aria-hidden="true" />
          </button>
        )}
        {showCount && max !== undefined && (
          <span className="aui-input-count" data-level={countLevel(text.length, max)} aria-live="polite">
            {text.length}/{max}
          </span>
        )}
        {suffix !== undefined && <span className="aui-input-affix">{suffix}</span>}
      </span>
    );
  },
), "Input");

export type TextareaProps = React.ComponentProps<"textarea"> & {
  /** Grow with the text between `minRows` (3) and `maxRows` (10), then scroll; no resize handle. Default true. */
  autoGrow?: boolean;
  minRows?: number;
  maxRows?: number;
  /** 「120/500」 in the box's bottom row (needs maxLength). */
  showCount?: boolean;
  /** Tools in the bottom row inside the box (attach, @, send); keyboard hints (「Ctrl Enter 发送」). */
  footer?: React.ReactNode;
};
/** Multi-line text: auto-grows 3–10 rows, no drag handle; count and tools in the bottom row. */
export const Textarea = /* @__PURE__ */ named(/* @__PURE__ */ React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoGrow = true, minRows = 3, maxRows = 10, showCount, footer, style, ...props }, ref) => {
    const own = React.useRef<HTMLTextAreaElement | null>(null);
    const setRef = (node: HTMLTextAreaElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };
    const grow = React.useCallback(() => {
      const el = own.current;
      if (!el || !autoGrow) return;
      const cs = getComputedStyle(el);
      const line = parseFloat(cs.lineHeight) || 20;
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      el.style.height = "auto";
      const min = line * minRows + pad;
      const max = line * maxRows + pad;
      el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)))}px`;
      el.style.overflowY = el.scrollHeight + pad > max + 1 ? "auto" : "hidden";
    }, [autoGrow, minRows, maxRows]);
    React.useLayoutEffect(grow, [grow, props.value]);
    const text = props.value === undefined || props.value === null ? "" : String(props.value);
    const max = typeof props.maxLength === "number" ? props.maxLength : undefined;
    const onInput = (event: Parameters<NonNullable<React.ComponentProps<"textarea">["onInput"]>>[0]) => {
      grow();
      props.onInput?.(event);
    };
    const rowsStyle = style;
    if (!footer && !showCount)
      return <textarea ref={setRef} rows={props.rows ?? minRows} className={cn("aui-input aui-textarea", className)} style={rowsStyle} {...props} onInput={onInput} />;
    const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
    return (
      <span className="aui-input aui-input-box aui-textarea-box" data-invalid={invalid || undefined} data-disabled={props.disabled || undefined} data-readonly={props.readOnly || undefined}>
        <textarea ref={setRef} rows={props.rows ?? minRows} className={cn("aui-textarea", className)} style={rowsStyle} {...props} onInput={onInput} />
        <span className="aui-textarea-foot">
          {footer}
          <span className="aui-grow" />
          {showCount && max !== undefined && (
            <span className="aui-input-count" data-level={countLevel(text.length, max)}>
              {text.length}/{max}
            </span>
          )}
        </span>
      </span>
    );
  },
), "Textarea");
/**
 * Radix renders a hidden bubble <input type=checkbox> as a SIBLING of the control when a
 * form ancestor exists. With no positioned ancestor its containing block is <html>, so no
 * inner scroll container can clip it (clipping follows the containing block, not the DOM
 * chain) and it silently widens the whole document. This shell gives it a containing
 * block that hugs the control, so `position:relative` on the control itself would not
 * help — the input is not its descendant.
 */
function ControlShell({ children }: { children: React.ReactNode }) {
  return <span className="aui-control-shell">{children}</span>;
}
export const Checkbox = /* @__PURE__ */ named(/* @__PURE__ */ React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ControlShell>
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn("aui-checkbox", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="aui-checkbox-mark">
        {props.checked === "indeterminate" ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  </ControlShell>
)), "Checkbox");
// Switch lives in its own module so a bundle that only renders buttons / inputs / checkboxes does not carry it.
export { Switch } from "./switch.tsx";
export type TabItem = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Icon before the label (lucide icon element). */
  icon?: React.ReactNode;
  /** Number after the label (related records, open problems). */
  count?: number | string;
  /** danger = the number means something to fix (e.g. 「6 未填」); attention = to look at (「邀请 2」). */
  countTone?: "neutral" | "attention" | "danger";
};
export type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly TabItem[];
  label: string;
  /** Rendered inside an owned tabpanel. Omit and pass panelId when the host renders its own panel. */
  children?: React.ReactNode;
  panelId?: string;
  actions?: React.ReactNode;
  /** Stable id prefix; each tab's id is `${idBase}tab-${value}` so host panels can aria-labelledby it. */
  idBase?: string;
  /** Height: 40px (default, page / record sections) or 36px (inside a pane / card). */
  size?: "md" | "sm";
};
/**
 * In-page sections: underline only — never a filled block — so they read differently
 * from the AdminShell work tabs (pills). Selected = dark primary text + bold + a 2px line as wide as the text;
 * counts are grey pills (primary soft when selected; attention / danger when they need handling). Tabs that do
 * not fit: edge fades + wheel, and 「更多 ⌄」 at the right lists every section (no round arrows). Roving
 * tabindex with arrows / Home / End.
 */
export function Tabs({
  value,
  onValueChange,
  items,
  label,
  children,
  panelId,
  actions,
  idBase,
  size = "md",
}: TabsProps) {
  const generated = React.useId();
  const base = idBase ?? generated;
  const tabId = (item: string) => `${base}tab-${item}`;
  const ownedPanelId = children === undefined ? undefined : `${base}panel`;
  const controls = panelId ?? ownedPanelId;
  const enabled = items.filter((item) => !item.disabled);
  const move = (event: React.KeyboardEvent, offset: number | "home" | "end") => {
    if (!enabled.length) return;
    event.preventDefault();
    const index = enabled.findIndex((item) => item.value === value);
    const next =
      offset === "home"
        ? enabled[0]
        : offset === "end"
          ? enabled[enabled.length - 1]
          : enabled[
              (Math.max(index, 0) + offset + enabled.length) % enabled.length
            ];
    // Every item can be disabled, in which case there is nothing to move to: stay put.
    if (!next) return;
    onValueChange(next.value);
    document.getElementById(tabId(next.value))?.focus();
  };
  return (
    <div className="aui-section-tabs-wrap" data-size={size === "sm" ? "sm" : undefined}>
      <div className="aui-section-tabs-bar">
        <ScrollStrip
          className="aui-section-tabs-scroll"
          listClassName="aui-section-tabs"
          label={label}
          activeKey={value}
          trailingWhen="overflow"
          trailing={
            <MenuButton
              label={`${label}：更多`}
              aria-label={`${label}：更多`}
              size="sm"
              className="aui-section-tabs-more"
              align="end"
              sections={[{ items: items.map((item) => ({ key: item.value, label: item.label, disabled: item.disabled, checked: item.value === value, hint: item.count === undefined ? undefined : String(item.count), onSelect: () => onValueChange(item.value) })) }]}
            >
              更多
              <ChevronDown aria-hidden="true" />
            </MenuButton>
          }
        >
          {items.map((item) => (
            <button
              key={item.value}
              id={tabId(item.value)}
              role="tab"
              type="button"
              aria-selected={value === item.value}
              aria-controls={value === item.value ? controls : undefined}
              disabled={item.disabled}
              tabIndex={value === item.value ? 0 : -1}
              className={cn(
                "aui-section-tab",
                value === item.value && "aui-active",
              )}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown")
                  move(event, 1);
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                  move(event, -1);
                else if (event.key === "Home") move(event, "home");
                else if (event.key === "End") move(event, "end");
              }}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && <span className="aui-count" data-tone={item.countTone === "neutral" ? undefined : item.countTone}>{item.count}</span>}
            </button>
          ))}
        </ScrollStrip>
        {actions && <div className="aui-section-tabs-actions">{actions}</div>}
      </div>
      {children !== undefined && (
        <div
          id={ownedPanelId}
          role="tabpanel"
          aria-labelledby={tabId(value)}
          className="aui-section-panel"
          tabIndex={0}
        >
          {children}
        </div>
      )}
    </div>
  );
}
// Choice moved to select.tsx (one select look, no Radix Select); re-exported here so
// `import { Choice } from "./primitives.tsx"` keeps working inside the SDK.
export { Choice, type ChoiceProps } from "./select.tsx";
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand" | "info";
/**
 * A status. Two densities: `dot` = dot + text, no background (tables and lists —
 * inside a DataTable / grid cell / CompactTable it is automatically `dot`); `soft` = soft background + dot,
 * 22px (record heads, next to a card title). Semantic colours only: success / brand = normal, warning =
 * needs attention, danger = broken, info = info / in progress, neutral = stopped / off. `pulse` = 「同步中」.
 */
export function StatusBadge({
  children,
  tone = "neutral",
  variant,
  pulse,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  /** dot (tables, lists) · soft (heads, card titles). Default: dot inside tables, soft elsewhere. */
  variant?: "dot" | "soft";
  pulse?: boolean;
}) {
  return <span className={`aui-badge aui-badge-${tone}`} data-variant={variant} data-pulse={pulse || undefined}>{children}</span>;
}
