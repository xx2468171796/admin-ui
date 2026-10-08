"use client";
/**
 * 「编辑布局」 of RecordDetail: edit state (useRecordLayoutEditor), the bar above the
 * header (scope 团队默认 / 只改我的, preset, 恢复团队默认, 取消, 完成), block dragging on the canvas
 * (useBlockDrag: pointer between and within the columns; keyboard Alt + arrows, or Space to lift),
 * the per-block tools (move, 整理字段, 默认收起, 隐藏), the hidden tray and the field organizer
 * (SortableList: sections as groups, fields as items — drag fields between sections, rename / add /
 * delete sections, hide fields). Pure rules: record-detail-spec.ts.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Eye, EyeOff, FoldVertical, GripVertical, LayoutTemplate, ListChecks, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { SideSheet } from "./sheets.tsx";
import { SortableList } from "./sortable.tsx";
import {
  addRecordDetailSection,
  applyRecordDetailFieldTree,
  moveRecordDetailBlock,
  recordDetailFieldTree,
  recordDetailPlacement,
  recordDetailHiddenItems,
  RECORD_DETAIL_PRESETS,
  RECORD_DETAIL_PRESET_LABELS,
  RECORD_DETAIL_SCOPE_LABELS,
  RECORD_SECTION_TITLE_MAX,
  pickKeyNumbers,
  RECORD_KEY_NUMBER_LIMIT,
  removeRecordDetailSection,
  setRecordDetailHidden,
  setRecordDetailKeyNumbers,
  setRecordDetailPreset,
  stepRecordDetailBlock,
  updateRecordDetailBlock,
  type RecordDetailBlock,
  type RecordDetailColumn,
  type RecordDetailFieldNode,
  type RecordDetailPreset,
  type RecordDetailScope,
  type RecordDetailSpec,
} from "./record-detail-spec.ts";
import type { RecordKeyNumber, RecordLayoutEditor } from "./record-detail-core.ts";
import { MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

// ---------------------------------------------------------------- state

export type RecordLayoutEditing = {
  editor?: RecordLayoutEditor;
  /** In edit mode: `spec` is the draft (live preview). */
  editing: boolean;
  /** The arrangement to draw: the draft while editing, else the saved one. */
  spec: RecordDetailSpec;
  scope: RecordDetailScope;
  busy: boolean;
  error: string | null;
  start: () => void;
  cancel: () => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  change: (next: RecordDetailSpec) => void;
  setScope: (scope: RecordDetailScope) => void;
  /** The field organizer (null = closed; a section id = scrolled to that section). */
  organizer: string | null;
  setOrganizer: (section: string | null) => void;
};

const message = (error: unknown) => (error instanceof Error && error.message ? error.message : "保存失败，请重试");

/** Edit state of an arranged record detail; `spec` = the saved (normalized) arrangement. */
export function useRecordLayoutEditor(spec: RecordDetailSpec, editor?: RecordLayoutEditor): RecordLayoutEditing {
  const [draft, setDraft] = useState<RecordDetailSpec | null>(null);
  const [scope, setScope] = useState<RecordDetailScope>(editor?.scope ?? "mine");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<string | null>(null);
  const editing = draft !== null && Boolean(editor);
  const run = async (task: () => void | Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      setDraft(null);
      setOrganizer(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return {
    editor,
    editing,
    spec: editing && draft ? draft : spec,
    scope: editor?.canEditDefault ? scope : "mine",
    busy,
    error,
    start: () => {
      setDraft(spec);
      setError(null);
      setScope(editor?.scope ?? "mine");
    },
    cancel: () => {
      setDraft(null);
      setError(null);
      setOrganizer(null);
    },
    save: () => run(() => editor?.onSave(draft ?? spec, editor.canEditDefault ? scope : "mine")),
    reset: () => run(() => editor?.onReset?.()),
    change: (next) => setDraft(next),
    setScope,
    organizer: editing ? organizer : null,
    setOrganizer,
  };
}

// ---------------------------------------------------------------- bar

/** The bar above the header in edit mode. */
export function RecordLayoutBar({ editing }: { editing: RecordLayoutEditing }) {
  if (!editing.editing) return null;
  const { editor } = editing;
  return (
    <div className="aui-rlayout-bar" role="toolbar" aria-label="编辑布局">
      <span className="aui-rlayout-bar-title"><LayoutTemplate aria-hidden="true" />编辑布局</span>
      {editor?.canEditDefault && (
        <SegmentedControl<RecordDetailScope> size="sm" label="改给谁" value={editing.scope} onValueChange={editing.setScope}
          options={(["default", "mine"] as const).map((value) => ({ value, label: editor.labels?.[value] ?? RECORD_DETAIL_SCOPE_LABELS[value] }))} />
      )}
      <SegmentedControl<RecordDetailPreset> size="sm" label="版式" value={editing.spec.preset} onValueChange={(preset) => editing.change(setRecordDetailPreset(editing.spec, preset))}
        options={RECORD_DETAIL_PRESETS.map((value) => ({ value, label: RECORD_DETAIL_PRESET_LABELS[value] }))} />
      <span className="aui-rlayout-bar-hint">拖动卡片换位置、换栏</span>
      <span className="aui-rlayout-bar-grow" />
      {editing.error && <span className="aui-rlayout-bar-error" role="alert">{editing.error}</span>}
      {editor?.onReset && <Button size="sm" variant="ghost" disabled={editing.busy} onClick={() => void editing.reset()}><RotateCcw aria-hidden="true" />{editor.labels?.reset ?? "恢复团队默认"}</Button>}
      <Button size="sm" variant="ghost" disabled={editing.busy} onClick={editing.cancel}>取消</Button>
      <Button size="sm" disabled={editing.busy} onClick={() => void editing.save()}>完成</Button>
    </div>
  );
}

/** 「编辑布局」 in the header (when the host gives an editor and edit mode is off). */
export function RecordLayoutButton({ editing }: { editing: RecordLayoutEditing }) {
  if (!editing.editor || editing.editing) return null;
  return <Button size="sm" variant="ghost" className="aui-rlayout-open" onClick={editing.start}><LayoutTemplate aria-hidden="true" />编辑布局</Button>;
}

// ---------------------------------------------------------------- drag on the canvas

type DropTarget = { column: RecordDetailColumn; before: string | null; top: number; left: number; width: number };
type Lifted = { id: string; snapshot: RecordDetailSpec } | null;

/**
 * Moving blocks on the canvas. Each lane (`[data-lane]`: the top band, a column) holds blocks
 * (`[data-block-id]`); `data-lane-column` says which spec column a lane stands for (`mixed` in the
 * single preset: the block dropped before decides). Returns grip props, the drop line and the
 * announcement for aria-live.
 */
export function useBlockDrag(editing: RecordLayoutEditing, box: RefObject<HTMLElement | null>, names: (block: RecordDetailBlock) => string) {
  const spec = editing.spec;
  const [indicator, setIndicator] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lifted, setLifted] = useState<Lifted>(null);
  const pointer = useRef<{ id: string; x: number; y: number; started: boolean } | null>(null);
  const focusAfter = useRef<string | null>(null);
  const hidden = new Set(spec.hidden);
  const visible = (b: RecordDetailBlock) => !hidden.has(b.id);
  const announce = (text: string) => setAnnouncement((old) => (old === text ? `${text} ` : text));
  const nameOf = (id: string) => {
    const block = spec.blocks.find((b) => b.id === id);
    return block ? names(block) : "";
  };
  const where = (next: RecordDetailSpec, id: string) => {
    const { top, first, second } = recordDetailPlacement(next);
    const lanes: [string, RecordDetailBlock[]][] = [["顶部", top], [next.preset === "single" ? "" : "左栏", first], ["右栏", second]];
    for (const [name, list] of lanes) {
      const shown = list.filter((b) => b.id === id || !next.hidden.includes(b.id));
      const at = shown.findIndex((b) => b.id === id);
      if (at >= 0) return `${name}第 ${at + 1} 张，共 ${shown.length} 张`;
    }
    return "";
  };
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    box.current?.querySelector<HTMLElement>(`[data-grip-for="${CSS.escape(id)}"]`)?.focus();
  });
  const apply = (next: RecordDetailSpec | null, id: string, verb: string) => {
    if (!next || next === spec) return false;
    focusAfter.current = id;
    editing.change(next);
    announce(`${verb}「${nameOf(id)}」，${where(next, id)}`);
    return true;
  };
  /** The column on the other side (Alt + ← / →); null in the single preset or when already there. */
  const across = (block: RecordDetailBlock, key: string): RecordDetailColumn | null => {
    if (spec.preset === "single") return null;
    const left: RecordDetailColumn = spec.preset === "split" ? "side" : "main";
    const want = key === "ArrowLeft" ? left : left === "main" ? "side" : "main";
    return want === block.column ? null : want;
  };
  const step = (id: string, key: string, verb: string) => {
    const block = spec.blocks.find((b) => b.id === id);
    if (!block) return;
    if (key === "ArrowUp" || key === "ArrowDown") {
      const next = stepRecordDetailBlock(spec, id, key === "ArrowUp" ? -1 : 1, visible);
      if (!apply(next, id, verb)) announce(`「${nameOf(id)}」不能再往${key === "ArrowUp" ? "上" : "下"}了`);
      return;
    }
    const column = across(block, key);
    if (!column || !apply(moveRecordDetailBlock(spec, id, column, null), id, verb)) announce(`「${nameOf(id)}」不能再往${key === "ArrowLeft" ? "左" : "右"}了`);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const arrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
    if (lifted?.id === id) {
      event.stopPropagation();
      if (arrow) {
        event.preventDefault();
        step(id, event.key, "移到");
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setLifted(null);
        announce(`已放下「${nameOf(id)}」，${where(spec, id)}`);
      } else if (event.key === "Escape") {
        event.preventDefault();
        focusAfter.current = id;
        editing.change(lifted.snapshot);
        setLifted(null);
        announce(`已取消，「${nameOf(id)}」放回原处`);
      } else if (event.key === "Tab") setLifted(null);
      return;
    }
    if (arrow && event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      step(id, event.key, "已把");
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setLifted({ id, snapshot: spec });
      announce(`已拿起「${nameOf(id)}」，${where(spec, id)}。用方向键移动（左右换栏），空格放下，Esc 取消`);
    }
  };

  // Pointer: find the lane under the pointer, then the first block whose middle is below it.
  const measure = useCallback((x: number, y: number, id: string): DropTarget | null => {
    const root = box.current;
    if (!root) return null;
    const origin = root.getBoundingClientRect();
    const lanes = [...root.querySelectorAll<HTMLElement>("[data-lane]")].map((el) => ({ el, rect: el.getBoundingClientRect() }));
    if (!lanes.length) return null;
    const hit = lanes.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top - 8 && y <= rect.bottom + 8)
      ?? lanes.reduce((best, lane) => (distance(lane.rect, x, y) < distance(best.rect, x, y) ? lane : best));
    const blocks = [...hit.el.querySelectorAll<HTMLElement>(":scope > [data-block-id]")].filter((el) => el.dataset.blockId !== id);
    const after = blocks.find((el) => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    const before = after?.dataset.blockId ?? null;
    const laneColumn = hit.el.dataset.laneColumn;
    let column: RecordDetailColumn;
    if (laneColumn === "main" || laneColumn === "side") column = laneColumn;
    else {
      const ref = before ?? blocks[blocks.length - 1]?.dataset.blockId;
      column = spec.blocks.find((b) => b.id === ref)?.column ?? "main";
    }
    const edge = after ? after.getBoundingClientRect().top - 6 : blocks.length ? blocks[blocks.length - 1]!.getBoundingClientRect().bottom + 5 : hit.rect.top;
    return { column, before, top: edge - origin.top, left: hit.rect.left - origin.left, width: hit.rect.width };
  }, [box, spec]);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    pointer.current = { id, x: event.clientX, y: event.clientY, started: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (!p) return;
    if (!p.started) {
      if (Math.abs(event.clientX - p.x) + Math.abs(event.clientY - p.y) < 4) return;
      p.started = true;
      announce(`正在拖动「${nameOf(p.id)}」`);
    }
    setIndicator(measure(event.clientX, event.clientY, p.id));
  };
  const endPointer = (cancel: boolean) => {
    const p = pointer.current;
    pointer.current = null;
    const target = indicator;
    setIndicator(null);
    if (!p?.started) return;
    if (cancel || !target || !apply(moveRecordDetailBlock(spec, p.id, target.column, target.before), p.id, "已把")) announce(`「${nameOf(p.id)}」没有移动`);
  };
  useEffect(() => {
    if (!editing.editing) {
      setLifted(null);
      setIndicator(null);
    }
  }, [editing.editing]);
  const grip = (block: RecordDetailBlock) => (
    <button type="button" className="aui-icon-button aui-rlayout-grip" data-grip-for={block.id} data-lifted={lifted?.id === block.id || undefined} data-aui-editing={lifted?.id === block.id ? "" : undefined}
      aria-label={`移动「${names(block)}」`} aria-roledescription="可拖动" aria-pressed={lifted?.id === block.id}
      data-tip="拖动换位置；或按 Alt + 方向键（左右换栏），空格拿起"
      onKeyDown={(event) => onKeyDown(event, block.id)} onPointerDown={(event) => onPointerDown(event, block.id)} onPointerMove={onPointerMove}
      onPointerUp={() => endPointer(false)} onPointerCancel={() => endPointer(true)}
      onBlur={() => { if (lifted?.id === block.id && !focusAfter.current) setLifted(null); }}>
      <GripVertical aria-hidden="true" />
    </button>
  );
  const dragging = pointer.current?.started ? pointer.current.id : lifted?.id ?? null;
  return { grip, indicator, announcement, dragging };
}
const distance = (r: DOMRect, x: number, y: number) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

// ---------------------------------------------------------------- per-block tools

/** Tools on a block in edit mode: move, 整理字段 (sections), 选择关键数, 默认收起 (sections / slots), 隐藏. */
export function BlockTools({ editing, block, name, grip, keyNumbers }: { editing: RecordLayoutEditing; block: RecordDetailBlock; name: string; grip: ReactNode; keyNumbers?: readonly RecordKeyNumber[] }) {
  const foldable = block.kind === "section" || block.kind === "slot";
  const chosen = keyNumbers ? pickKeyNumbers(keyNumbers, editing.spec).map((k) => k.key) : [];
  return (
    <span className="aui-rlayout-tools">
      {grip}
      {block.kind === "keyNumbers" && keyNumbers && keyNumbers.length > 0 && (
        <MoreMenu label="选择关键数" tooltip={`选择关键数（最多 ${RECORD_KEY_NUMBER_LIMIT} 个）`}
          sections={[{ title: `最多 ${RECORD_KEY_NUMBER_LIMIT} 个`, items: keyNumbers.map((k) => {
            const on = chosen.includes(k.key);
            const full = !on && chosen.length >= RECORD_KEY_NUMBER_LIMIT;
            return { key: k.key, label: k.label, checked: on, disabled: full, disabledReason: full ? `已经选了 ${RECORD_KEY_NUMBER_LIMIT} 个，先去掉一个` : undefined,
              onSelect: () => editing.change(setRecordDetailKeyNumbers(editing.spec, on ? chosen.filter((x) => x !== k.key) : [...chosen, k.key])) };
          }) }]} icon={<ListChecks aria-hidden="true" />} />
      )}
      {block.kind === "section" && (
        <button type="button" className="aui-icon-button" aria-label={`整理「${name}」的字段`} data-tip="整理字段" onClick={() => editing.setOrganizer(block.id)}><Settings2 aria-hidden="true" /></button>
      )}
      {foldable && (
        <button type="button" className="aui-icon-button" aria-pressed={Boolean(block.collapsed)} aria-label={`「${name}」默认收起`} data-tip={block.collapsed ? "默认收起（点了改成默认展开）" : "默认展开（点了改成默认收起）"}
          onClick={() => editing.change(updateRecordDetailBlock(editing.spec, block.id, { collapsed: !block.collapsed }))}><FoldVertical aria-hidden="true" /></button>
      )}
      <button type="button" className="aui-icon-button" aria-label={`隐藏「${name}」`} data-tip="隐藏" onClick={() => editing.change(setRecordDetailHidden(editing.spec, block.id, true))}><Eye aria-hidden="true" /></button>
    </span>
  );
}

/** Hidden blocks and fields with a 「显示」 each (edit mode, under the canvas). */
export function HiddenTray({ editing, blockName, fieldName }: { editing: RecordLayoutEditing; blockName: (block: RecordDetailBlock) => string; fieldName: (key: string) => string }) {
  const { blocks, fields } = recordDetailHiddenItems(editing.spec);
  if (!blocks.length && !fields.length) return null;
  const show = (id: string) => editing.change(setRecordDetailHidden(editing.spec, id, false));
  return (
    <div className="aui-rlayout-tray" role="group" aria-label="已隐藏">
      <span className="aui-rlayout-tray-title"><EyeOff aria-hidden="true" />已隐藏</span>
      {blocks.map((b) => <Button key={b.id} size="sm" variant="outline" aria-label={`显示「${blockName(b)}」`} onClick={() => show(b.id)}><Plus aria-hidden="true" />{blockName(b)}</Button>)}
      {fields.map((key) => <Button key={key} size="sm" variant="outline" aria-label={`显示字段「${fieldName(key)}」`} onClick={() => show(key)}><Plus aria-hidden="true" />{fieldName(key)}</Button>)}
    </div>
  );
}

/** 「+ 添加分区」 at the end of a column in edit mode. */
export function AddSectionButton({ editing, column }: { editing: RecordLayoutEditing; column: RecordDetailColumn }) {
  return (
    <button type="button" className="aui-rlayout-add" onClick={() => {
      const { spec, id } = addRecordDetailSection(editing.spec, "新分区", column);
      editing.change(spec);
      editing.setOrganizer(id);
    }}><Plus aria-hidden="true" />添加分区</button>
  );
}

// ---------------------------------------------------------------- field organizer

/** 「整理字段」: every section with its fields; drag fields between sections, rename / add / delete sections, hide fields. */
export function FieldOrganizer({ editing, fieldName }: { editing: RecordLayoutEditing; fieldName: (key: string) => string }) {
  const spec = editing.spec;
  const box = useRef<HTMLDivElement>(null);
  const focus = editing.organizer;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const input = box.current?.querySelector<HTMLInputElement>(`input[data-section-id="${CSS.escape(focus)}"]`);
      input?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);
  const sections = new Map(spec.blocks.filter((b) => b.kind === "section").map((b) => [b.id, b]));
  const hidden = new Set(spec.hidden);
  const tree = recordDetailFieldTree(spec);
  const title = (id: string) => sections.get(id)?.title ?? id;
  const remove = (id: string) => {
    const next = removeRecordDetailSection(spec, id);
    if (!next) {
      setNotice("「其他字段」是唯一有字段的分区，不能删除");
      return;
    }
    setNotice(`已删除「${title(id)}」，字段移到了「其他字段」`);
    editing.change(next);
  };
  return (
    <SideSheet open={focus !== null} title="整理字段" description="把字段拖到别的分区；改分区名、隐藏不常看的字段。点「完成」才保存。" onClose={() => editing.setOrganizer(null)}
      footer={<>
        <Button variant="outline" onClick={() => {
          const { spec: next, id } = addRecordDetailSection(spec, "新分区");
          editing.change(next);
          editing.setOrganizer(id);
        }}><Plus aria-hidden="true" />新建分区</Button>
        <Button onClick={() => editing.setOrganizer(null)}>好了</Button>
      </>}>
      <div ref={box} className="aui-rlayout-organizer">
        <SortableList<RecordDetailFieldNode>
          label="分区和字段"
          items={tree}
          itemLabel={(node) => (node.children ? title(node.id) : fieldName(node.id))}
          onChange={(next) => editing.change(applyRecordDetailFieldTree(spec, next))}
          canDrop={(node, target) => node.children !== undefined || target.parent !== null}
          renderGroup={(group, state) => (
            <span className="aui-rlayout-group">
              <Input data-section-id={group.id} aria-label={`分区「${title(group.id)}」的名称`} defaultValue={title(group.id)} maxLength={RECORD_SECTION_TITLE_MAX}
                key={`${group.id}:${title(group.id)}`}
                onBlur={(event) => editing.change(updateRecordDetailBlock(spec, group.id, { title: event.currentTarget.value }))}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
              <span className="aui-note">{state.count} 个字段</span>
              <button type="button" className="aui-icon-button" aria-pressed={hidden.has(group.id)} aria-label={hidden.has(group.id) ? `显示分区「${title(group.id)}」` : `隐藏分区「${title(group.id)}」`}
                onClick={() => editing.change(setRecordDetailHidden(spec, group.id, !hidden.has(group.id)))}>{hidden.has(group.id) ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
              <button type="button" className="aui-icon-button" aria-label={`删除分区「${title(group.id)}」`} data-tip="删除分区（字段移到「其他字段」）" onClick={() => remove(group.id)}><Trash2 aria-hidden="true" /></button>
            </span>
          )}
          renderItem={(node) => (
            <span className="aui-rlayout-field" data-hidden={hidden.has(node.id) || undefined}>
              <span>{fieldName(node.id)}</span>
              <button type="button" className="aui-icon-button" aria-pressed={hidden.has(node.id)} aria-label={hidden.has(node.id) ? `显示字段「${fieldName(node.id)}」` : `隐藏字段「${fieldName(node.id)}」`}
                onClick={() => editing.change(setRecordDetailHidden(spec, node.id, !hidden.has(node.id)))}>{hidden.has(node.id) ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
            </span>
          )}
        />
        <p className="aui-sr-only" role="status">{notice}</p>
        {notice && <p className="aui-note aui-rlayout-notice" aria-hidden="true">{notice}</p>}
      </div>
    </SideSheet>
  );
}
