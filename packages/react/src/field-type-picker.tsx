"use client";
/**
 * FieldTypePicker (bt/records R1, demo D12): the field types as tiles (icon + name)
 * grouped 「基础 / 选择 / 人与联系 / 关联与计算 / 系统自动」 (the tile's `group`, else FIELD_TYPE_INFO), with
 * a search box. Types that are not built yet are collapsed at the end into one row 「还有 N 种在做」 —
 * open it to see them (greyed, not pickable, the reason on hover / to screen readers); a search shows
 * matching ones directly. Under the tiles a small card explains the picked type: what it stores and how
 * it looks in the table. Radio group with one tab stop: ← → move through the tiles, ↑ ↓ to the tile
 * below / above (across groups), Home / End; disabled tiles are skipped. Phones: compact 3-column tiles,
 * so the blocks under the picker stay close.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SearchField } from "./page-templates.tsx";
import { tipProps } from "./tooltip.tsx";
import { fieldTypeInfo, filterTypeTiles, groupTypeTiles, isTypeTileEnabled, type FieldTypeTile } from "./field-dialog-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";

export type FieldTypePickerProps<V extends string = string> = {
  types: readonly FieldTypeTile<V>[];
  value: V | null;
  onChange: (type: V) => void;
  /** Heading and accessible name (default 「字段类型」). */
  label?: string;
  /** Grey note after the heading. */
  hint?: ReactNode;
  /** Search box (default: shown when there are more than 12 tiles). */
  searchable?: boolean;
  /** The explanation card under the tiles for the picked type (default true). */
  explain?: boolean;
  /** Message under the grid (validation). */
  error?: string;
  disabled?: boolean;
};

/** Next tile for an arrow key, by position on screen (rows may belong to different groups). */
function stepTo(tiles: readonly (HTMLButtonElement | null)[], at: number, key: string, enabled: (i: number) => boolean): number | null {
  const n = tiles.length;
  const scan = (from: number, step: number) => {
    for (let i = from; i >= 0 && i < n; i += step) if (enabled(i)) return i;
    return null;
  };
  if (key === "ArrowRight") return scan(at + 1, 1);
  if (key === "ArrowLeft") return scan(at - 1, -1);
  if (key === "Home") return scan(0, 1);
  if (key === "End") return scan(n - 1, -1);
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const here = tiles[at]?.getBoundingClientRect();
  if (!here) return null;
  const down = key === "ArrowDown";
  let best: { i: number; dy: number; dx: number } | undefined;
  for (let i = 0; i < n; i += 1) {
    const tile = tiles[i];
    if (!tile || !enabled(i)) continue;
    const r = tile.getBoundingClientRect();
    const dy = down ? r.top - here.top : here.top - r.top;
    if (dy <= 2) continue;
    const dx = Math.abs(r.left - here.left);
    if (!best || dy < best.dy - 2 || (Math.abs(dy - best.dy) <= 2 && dx < best.dx)) best = { i, dy, dx };
  }
  return best ? best.i : scan(at + (down ? 1 : -1), down ? 1 : -1);
}

const OPTION_EXAMPLE: Readonly<Record<string, string>> = { singleSelect: "yellow", multiSelect: "blue" };

/** 「单选　从几个选项里选一个，带颜色 · 表格里：[报价]」 */
function TypeCard<V extends string>({ tile }: { tile: FieldTypeTile<V> }) {
  const known = fieldTypeInfo(tile);
  const description = tile.description ?? known?.description;
  const example = tile.example ?? known?.example;
  const tone = tile.value ? OPTION_EXAMPLE[tile.value] : undefined;
  return (
    <div className="aui-ftype-desc" role="status">
      {tile.icon && <span className="aui-ftype-icon" aria-hidden="true">{tile.icon}</span>}
      <span className="aui-ftype-desc-text"><b>{tile.label}</b>{description && <span>{description}</span>}</span>
      {example !== undefined && example !== "" && (
        <span className="aui-ftype-desc-ex">
          <span>表格里：</span>
          {typeof example === "string" && tone
            ? example.split("、").map((text) => <span key={text} className="aui-chip" data-tone={tone}><span className="aui-chip-label">{text}</span></span>)
            : <span className="aui-ftype-desc-sample">{example}</span>}
        </span>
      )}
    </div>
  );
}

export function FieldTypePicker<V extends string = string>({ types, value, onChange, label = "字段类型", hint, searchable, explain = true, error, disabled }: FieldTypePickerProps<V>) {
  const [query, setQuery] = useState("");
  const [showLater, setShowLater] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const headingId = useId();
  const errorId = useId();
  const laterId = useId();
  const searching = query.trim() !== "";
  const shown = filterTypeTiles(types, query);
  const { sections, later, grouped } = groupTypeTiles(shown);
  const laterOpen = showLater || (searching && later.length > 0);
  const allLater = types.filter((t) => !isTypeTileEnabled(t)).length;
  const flat = [...sections.flatMap((s) => s.tiles), ...(laterOpen ? later : [])];
  const canSearch = searchable ?? types.length > 12;
  const enabled = (i: number) => !disabled && Boolean(flat[i] && isTypeTileEnabled(flat[i]));
  const selected = flat.findIndex((t) => t.value === value && isTypeTileEnabled(t));
  const tabStop = selected >= 0 ? selected : flat.findIndex((_, i) => enabled(i));
  const picked = types.find((t) => t.value === value && isTypeTileEnabled(t));
  refs.current.length = flat.length;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = refs.current.findIndex((el) => el === document.activeElement);
    if (at < 0) return;
    const next = stepTo(refs.current, at, event.key, enabled);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    const tile = flat[next];
    if (tile?.value) onChange(tile.value);
  };
  const tileButton = (tile: FieldTypeTile<V>, index: number) => {
    const on = isTypeTileEnabled(tile);
    const reason = tile.later ?? "这一版先不做";
    return (
      <button key={tile.value ?? tile.label} ref={(el) => { refs.current[index] = el; }} type="button" role="radio" className="aui-ftype-tile"
        aria-checked={on && tile.value === value} aria-disabled={!on || disabled || undefined} tabIndex={index === tabStop ? 0 : -1} data-later={on ? undefined : true}
        {...tipProps(on ? null : `${tile.label}：${reason}`)}
        onClick={() => on && !disabled && tile.value && onChange(tile.value)}>
        {tile.icon && <span className="aui-ftype-icon" aria-hidden="true">{tile.icon}</span>}
        <span className="aui-ftype-name">{tile.label}</span>
        {!on && <span className="aui-ftype-soon" aria-hidden="true">在做</span>}
        {!on && <span className="aui-sr-only">（还不能用：{reason}）</span>}
      </button>
    );
  };
  let index = 0;
  return (
    <div className="aui-ftype" data-disabled={disabled || undefined} data-grouped={grouped || undefined}>
      <div className="aui-ftype-head">
        <span id={headingId} className="aui-ftype-label">{label}</span>
        {hint && <small className="aui-ftype-hint">· {hint}</small>}
        {canSearch && (
          <span className="aui-ftype-search">
            <SearchField size="sm" value={query} onChange={setQuery} placeholder="搜索字段类型" label="搜索字段类型" />
          </span>
        )}
      </div>
      <div className="aui-ftype-groups" role="radiogroup" aria-labelledby={headingId} aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} onKeyDown={onKeyDown}>
        {sections.map((section) => (
          <div key={section.group || "all"} className="aui-ftype-section" role="group" aria-label={section.group || undefined}>
            {section.group && <div className="aui-ftype-group" aria-hidden="true">{section.group}</div>}
            <div className="aui-ftype-grid">{section.tiles.map((tile) => tileButton(tile, index++))}</div>
          </div>
        ))}
        {allLater > 0 && !searching && (
          <button type="button" className="aui-ftype-more" aria-expanded={laterOpen} aria-controls={laterId} onClick={() => setShowLater((v) => !v)}>
            {laterOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}还有 {allLater} 种在做
          </button>
        )}
        {laterOpen && later.length > 0 && (
          <div id={laterId} className="aui-ftype-section" role="group" aria-label="还在做的类型">
            {searching && <div className="aui-ftype-group" aria-hidden="true">还在做</div>}
            <div className="aui-ftype-grid">{later.map((tile) => tileButton(tile, index++))}</div>
          </div>
        )}
      </div>
      {!shown.length && <p className="aui-note aui-ftype-empty" role="status">没有叫「{query.trim()}」的字段类型</p>}
      {explain && picked && <TypeCard tile={picked} />}
      {error && <p id={errorId} className="aui-error" role="alert">{error}</p>}
    </div>
  );
}
