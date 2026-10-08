"use client";
/**
 * 外观: one small popover from the top bar — 浅色 / 深色 / 跟随系统, the six
 * approved palettes as swatches, the font size, and 「自定义品牌色…」 last (the only part that still opens a
 * dialog). The same 浅 / 深 / 跟随系统 row sits in the AccountMenu (`ColorModeChoice`). Choices persist per
 * AdminProvider storageKey (`:mode`, `:palette`, `:font-size`).
 */
import { useId, useRef, useState } from "react";
import { Check, Moon, Palette, RotateCcw, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { FormDialog, FormField } from "./forms.tsx";
import { SegmentedControl } from "./choices.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { COLOR_MODES, FONT_SIZE_PRESETS, useAdminTheme, type AdminColorMode, type AdminFontSize } from "./theme.tsx";
import { DEFAULT_PALETTE, isPaletteId, PALETTES, validColor } from "./palette.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/shell.css";

const FONT_SHORT: Record<AdminFontSize, string> = { small: "小", medium: "中", mediumLarge: "中大", large: "大", xlarge: "特大" };
const MODE_ICON: Record<AdminColorMode, LucideIcon> = { light: Sun, dark: Moon, system: SunMoon };

/** 浅色 / 深色 / 跟随系统 as one segmented row (AccountMenu, AppearancePopover). */
export function ColorModeChoice({ label = "外观", size = "sm" }: { label?: string; size?: "sm" | "md" }) {
  const { modeChoice, setMode } = useAdminTheme();
  return <SegmentedControl label={label} size={size} value={modeChoice} onValueChange={setMode} options={COLOR_MODES.map((m) => ({ value: m.id, label: m.name }))} />;
}

/** The custom brand colour dialog (the last row of the appearance popover). */
function BrandColorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const colorId = useId();
  const { paletteChoice, setPalette } = useAdminTheme();
  const current = typeof paletteChoice === "string" && validColor(paletteChoice) ? paletteChoice : "";
  const [draft, setDraft] = useState(current);
  return (
    <FormDialog
      open={open}
      title="自定义品牌色"
      size="sm"
      description="只换主色系，点缀色沿用森林绿那三种；主色会自动调深浅，保证白字清晰。"
      dirty={draft !== current}
      onClose={onClose}
      submitLabel="应用"
      onSubmit={() => {
        if (!validColor(draft)) throw Error("写成 # 加六位十六进制，例如 #357450");
        setPalette(draft);
      }}
    >
      <FormField label="品牌色" htmlFor={colorId}>
        <Input id={colorId} value={draft} placeholder="#357450" onChange={(e) => setDraft(e.target.value)} maxLength={7} />
      </FormField>
      <Button variant="ghost" onClick={() => { setPalette(DEFAULT_PALETTE.id); onClose(); }}>
        <RotateCcw />
        恢复默认色卡
      </Button>
    </FormDialog>
  );
}

/** The popover body: 外观 · 色卡 · 字号 · 自定义品牌色…. Exported for hosts that put it in their own layer. */
export function AppearancePanel({ onCustomColor, fontSize: showFontSize = true }: { onCustomColor?: () => void; /** Show the 字号 row (default true). */ fontSize?: boolean }) {
  const { paletteChoice, setPalette, fontSize, setFontSize } = useAdminTheme();
  return (
    <div className="aui-appearance">
      <div className="aui-appearance-row">
        <span className="aui-appearance-label">外观</span>
        <ColorModeChoice />
      </div>
      <div className="aui-appearance-row">
        <span className="aui-appearance-label">色卡</span>
        <div className="aui-appearance-swatches" role="group" aria-label="色卡">
          {PALETTES.map((p) => {
            const on = paletteChoice === p.id;
            return (
              <button key={p.id} type="button" className="aui-appearance-swatch" aria-pressed={on} aria-label={p.name} data-tip={p.name} style={{ background: p.primary }} onClick={() => setPalette(p.id)}>
                {on && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
      {showFontSize && (
        <div className="aui-appearance-row">
          <span className="aui-appearance-label">字号</span>
          <SegmentedControl label="字号" size="sm" value={fontSize} onValueChange={setFontSize} options={FONT_SIZE_PRESETS.map((f) => ({ value: f.id, label: FONT_SHORT[f.id] }))} />
        </div>
      )}
      {onCustomColor && (
        <button type="button" className="aui-appearance-custom" onClick={onCustomColor}>
          <Palette aria-hidden="true" />
          自定义品牌色…
          {typeof paletteChoice === "string" && !isPaletteId(paletteChoice) && <span className="aui-appearance-custom-chip" style={{ background: paletteChoice }} aria-label={`当前 ${paletteChoice}`} />}
        </button>
      )}
    </div>
  );
}

export type AppearanceButtonProps = {
  /** Accessible name / tooltip (default 「外观」). */
  label?: string;
  /** Show the 字号 row (default true). */
  fontSize?: boolean;
  /** Offer 「自定义品牌色…」 (default true). */
  customColor?: boolean;
  /** Button icon: the current mode (sun / moon, default) or the palette icon. */
  icon?: "mode" | "palette";
};
/**
 * The top bar's appearance button (sun / moon) → a small popover: 浅色 / 深色 / 跟随系统, six palette swatches,
 * 字号, 自定义品牌色…. Replaces the big palette dialog and the separate font size dialog.
 */
export function AppearanceButton({ label = "外观", fontSize = true, customColor = true, icon = "mode" }: AppearanceButtonProps) {
  const { mode, modeChoice } = useAdminTheme();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const Icon = icon === "palette" ? Palette : modeChoice === "system" ? MODE_ICON[mode] : MODE_ICON[modeChoice];
  return (
    <>
      <IconButton label={label} ref={trigger} aria-haspopup="dialog" aria-expanded={open} data-active={open || undefined} onClick={() => setOpen((v) => !v)} icon={<Icon />} />
      <PopoverLayer open={open} anchor={trigger.current} label={label} className="aui-popover aui-appearance-pop" align="end" onClose={(back) => { setOpen(false); if (back) trigger.current?.focus(); }}>
        <div className="aui-popover-body">
          <AppearancePanel fontSize={fontSize} onCustomColor={customColor ? () => { setOpen(false); setCustom(true); } : undefined} />
        </div>
      </PopoverLayer>
      {custom && <BrandColorDialog open onClose={() => { setCustom(false); trigger.current?.focus(); }} />}
    </>
  );
}
