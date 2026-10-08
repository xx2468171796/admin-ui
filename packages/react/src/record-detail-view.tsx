"use client";
/**
 * RecordDetail (owner's pick: mockup C 「卡片分区」): a record arranged by a saved spec
 * (record-detail-spec.ts) — stage path and up to 4 key numbers on top, a wide main column (host blocks:
 * activity, comments …) and a side column of section cards; presets `single` (one column) and `split`
 * (fields left, activity right). Phones (≤ 760px, or a container narrower than 720px) read one column:
 * top, main, side. Fields are the record-detail rows (RecordFieldRow: hover tools, in-place editing);
 * empty fields fold into 「N 个空字段已收起 · 显示」. 「编辑布局」 (record-detail-editor.tsx) rearranges it.
 *
 * - RecordDetailBody: the arranged body only (RecordLayout.cards uses it inside the record dialog / page).
 * - RecordDetail: header (RecordHeader flat + 编辑布局 + 关注) + edit bar + body, for hosts with their own frame.
 */
import { createContext, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronRight, Star } from "lucide-react";
import { Button } from "./primitives.tsx";
import { RecordHeader, recordInitial } from "./kit.tsx";
import { StagePath } from "./stage-path.tsx";
import { RecordEditingProvider, RecordFieldRows, RecordScopeContext } from "./record-field-list.tsx";
import { AddSectionButton, BlockTools, FieldOrganizer, HiddenTray, RecordLayoutBar, RecordLayoutButton, useBlockDrag, useRecordLayoutEditor, type RecordLayoutEditing } from "./record-detail-editor.tsx";
import { isRecordFieldEmpty, recordFieldText, sectionFields, type RecordBadge, type RecordMetaPart, type RecordLayout, type RecordSectionContext, type RecordField, type RecordFollow, type RecordKeyNumber, type RecordLayoutEditor, type RecordStage, type RecordDetailSlot } from "./record-detail-core.ts";
import {
  defaultRecordDetailSpec,
  foldRecordDetailFields,
  pickKeyNumbers,
  normalizeRecordDetailSpec,
  recordDetailPlacement,
  resolveStagePath,
  type RecordDetailBlock,
  type RecordDetailCatalog,
  type RecordDetailSpec,
} from "./record-detail-spec.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

export type RecordDetailBodyProps<T> = {
  row: T;
  /** Every field sections may hold (RecordField: value / text / edit / lockedReason / copy / actions / reveal …). */
  fields: readonly RecordField<T>[];
  /** Normalized arrangement (normalizeRecordDetailSpec / useRecordDetailSpec). */
  spec: RecordDetailSpec;
  stage?: RecordStage | null;
  keyNumbers?: readonly RecordKeyNumber[];
  slots?: Readonly<Record<string, RecordDetailSlot>>;
  /** Edit state (useRecordLayoutEditor); leave out for a read-only arrangement. */
  editing?: RecordLayoutEditing;
  /** Record title: a field repeating it is left out. */
  title?: string;
  /** Banners above the blocks (record alerts). */
  before?: ReactNode;
};

/** The catalog of what a host can draw (for normalizeRecordDetailSpec). */
export function recordDetailCatalog<T>(input: { fields: readonly RecordField<T>[]; slots?: Readonly<Record<string, unknown>>; stage?: boolean; keyNumbers?: boolean | readonly RecordKeyNumber[] }): RecordDetailCatalog {
  const keys = Array.isArray(input.keyNumbers) ? (input.keyNumbers as readonly RecordKeyNumber[]).map((k) => k.key) : undefined;
  return { fields: [...new Set(input.fields.map((f) => f.key))], slots: Object.keys(input.slots ?? {}), stage: input.stage, keyNumbers: Boolean(input.keyNumbers), ...(keys ? { keyNumberKeys: keys } : {}) };
}

/** The saved spec normalized for this catalog (memoized by content). */
export function useRecordDetailSpec(spec: unknown, catalog: RecordDetailCatalog, fallback?: RecordDetailSpec): RecordDetailSpec {
  const key = JSON.stringify([spec ?? null, catalog, fallback ?? null]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => normalizeRecordDetailSpec(spec, catalog, fallback), [key]);
}

// ---------------------------------------------------------------- blocks

/** Card header: a fold toggle with the title, a count, buttons (view) or edit tools (edit mode). */
function CardHead({ id, title, count, actions, folded, onFold, tools }: { id: string; title: string; count?: ReactNode; actions?: ReactNode; folded: boolean; onFold: () => void; tools?: ReactNode }) {
  return (
    <div className="aui-dcard-head">
      <h3 id={id}>
        <button type="button" className="aui-dcard-fold" aria-expanded={!folded} onClick={onFold}>
          {title}{folded && <ChevronRight aria-hidden="true" />}
        </button>
      </h3>
      {count !== undefined && count !== null && <span className="aui-dcard-count">{count}</span>}
      <span className="aui-dcard-grow" />
      {tools ?? (actions && <span className="aui-dcard-actions">{actions}</span>)}
    </div>
  );
}

function SectionCard<T>({ block, row, fields, title, hidden, editing, tools }: { block: RecordDetailBlock; row: T; fields: ReadonlyMap<string, RecordField<T>>; title?: string; hidden: ReadonlySet<string>; editing: boolean; tools?: ReactNode }) {
  const headId = useId();
  const [folded, setFolded] = useState(Boolean(block.collapsed));
  const [showEmpty, setShowEmpty] = useState(false);
  const repeat = title?.trim();
  const list = (block.fields ?? []).flatMap((key) => {
    const field = fields.get(key);
    if (!field || hidden.has(key)) return [];
    if (field.hideEmpty && isRecordFieldEmpty(field, row)) return [];
    if (repeat && recordFieldText(field, row)?.trim() === repeat) return [];
    return [field];
  });
  const { shown, folded: empties } = foldRecordDetailFields(list.map((f) => f.key), (key) => isRecordFieldEmpty(fields.get(key)!, row), { hideEmpty: block.hideEmpty !== false, keep: (key) => Boolean(fields.get(key)?.showEmpty) });
  if (!list.length && !editing) return null;
  const visibleKeys = showEmpty ? list.map((f) => f.key) : shown;
  const name = block.title ?? "分区";
  return (
    <section className="aui-dcard" data-kind="section" aria-labelledby={headId}>
      <CardHead id={headId} title={name} folded={folded} onFold={() => setFolded((v) => !v)} tools={tools} />
      {!folded && (
        <div className="aui-dcard-body">
          {visibleKeys.length > 0 && <RecordFieldRows fields={visibleKeys.map((key) => fields.get(key)!)} row={row} prefix={block.id} />}
          {!list.length && <p className="aui-dcard-empty">还没有字段：点「整理字段」把字段拖进来</p>}
          {empties.length > 0 && (
            <p className="aui-dcard-folded">
              {showEmpty ? "空字段已显示" : `${empties.length} 个空字段已收起`}
              {" · "}
              <button type="button" className="aui-dcard-link" aria-expanded={showEmpty} aria-label={showEmpty ? `收起「${name}」的空字段` : `显示「${name}」的 ${empties.length} 个空字段`} onClick={() => setShowEmpty((v) => !v)}>{showEmpty ? "收起" : "显示"}</button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function SlotCard({ block, slot, tools, editing }: { block: RecordDetailBlock; slot: RecordDetailSlot | undefined; tools?: ReactNode; editing: boolean }) {
  const headId = useId();
  const [folded, setFolded] = useState(Boolean(block.collapsed));
  if (!slot) return null;
  return (
    <section className="aui-dcard" data-kind="slot" data-slot={block.id} aria-labelledby={headId}>
      <CardHead id={headId} title={block.title ?? slot.title ?? block.id} count={slot.count} actions={editing ? undefined : slot.actions} folded={folded} onFold={() => setFolded((v) => !v)} tools={tools} />
      {!folded && <div className="aui-dcard-body" inert={editing || undefined}>{slot.render()}</div>}
    </section>
  );
}

function StageCard({ stage, variant, tools, editing }: { stage: RecordStage; variant: "segments" | "chevrons"; tools?: ReactNode; editing: boolean }) {
  const { path, current, position, next } = resolveStagePath(stage.steps, stage.current);
  const exited = current && current.kind !== "normal";
  const labels = stage.labels ?? {};
  return (
    <section className="aui-dcard aui-rstage" data-kind="stage" aria-label={labels.path ?? "阶段"}>
      <div className="aui-rstage-top">
        {current && !exited && <span className="aui-rstage-pos">{position} / {path.length}</span>}
        {current && <b className="aui-rstage-name" data-exited={exited || undefined}>{current.label}</b>}
        {current?.days !== undefined && !exited && <span className="aui-rstage-days">· 已 {current.days} 天</span>}
        <span className="aui-dcard-grow" />
        {tools}
        {!editing && stage.onMarkLost && !exited && <Button size="sm" variant="ghost" className="aui-rstage-lost" onClick={stage.onMarkLost}>{labels.markLost ?? "标记失败"}</Button>}
        {!editing && stage.onAdvance && next && !exited && <Button size="sm" variant="outline" onClick={stage.onAdvance}>{labels.advance ?? `进入${next.label}`}<ArrowRight aria-hidden="true" /></Button>}
      </div>
      <div inert={editing || undefined}>
        <StagePath steps={stage.steps} current={stage.current} onSelect={stage.onSelect} readOnly={stage.readOnly || editing} variant={variant} label={labels.path ?? "阶段"} moreLabel={labels.more} />
      </div>
    </section>
  );
}

function KeyNumbers({ items, spec, tools }: { items: readonly RecordKeyNumber[]; spec: RecordDetailSpec; tools?: ReactNode }) {
  const list = pickKeyNumbers(items, spec);
  return (
    <div className="aui-rkeys-wrap" data-kind="keyNumbers">
      {tools && <div className="aui-rkeys-tools">{tools}</div>}
      <dl className="aui-rkeys" data-count={list.length} aria-label="关键数">
        {list.map((item) => (
          <div key={item.key} className="aui-dcard aui-rkey">
            <dt>{item.label}</dt>
            <dd>
              <b>{item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}</b>
              {item.hint && <small data-tone={item.tone}>{item.hint}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------- body

export function RecordDetailBody<T>({ row, fields, spec: given, stage, keyNumbers, slots, editing, title, before }: RecordDetailBodyProps<T>) {
  const spec = editing?.spec ?? given;
  const inEdit = Boolean(editing?.editing);
  const box = useRef<HTMLDivElement>(null);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const hidden = new Set(spec.hidden);
  const blockName = (block: RecordDetailBlock) =>
    block.kind === "stage" ? stage?.labels?.path ?? "阶段" : block.kind === "keyNumbers" ? "关键数" : block.kind === "slot" ? block.title ?? slots?.[block.id]?.title ?? block.id : block.title ?? "分区";
  const fieldName = (key: string) => byKey.get(key)?.label ?? key;
  const fallbackEditing = useRecordLayoutEditor(spec);
  const drag = useBlockDrag(editing ?? fallbackEditing, box, blockName);
  const { top, first, second } = recordDetailPlacement(spec);
  const visible = (list: RecordDetailBlock[]) => list.filter((b) => !hidden.has(b.id));
  const draw = (block: RecordDetailBlock) => {
    const tools = inEdit && editing ? <BlockTools editing={editing} block={block} name={blockName(block)} grip={drag.grip(block)} keyNumbers={keyNumbers} /> : undefined;
    let content: ReactNode = null;
    if (block.kind === "stage") content = stage ? <StageCard stage={stage} variant={spec.preset === "single" ? "chevrons" : "segments"} tools={tools} editing={inEdit} /> : inEdit ? <Placeholder name="阶段" tools={tools} /> : null;
    else if (block.kind === "keyNumbers") content = keyNumbers?.length ? <KeyNumbers items={keyNumbers} spec={spec} tools={tools} /> : inEdit ? <Placeholder name="关键数" tools={tools} /> : null;
    else if (block.kind === "slot") content = <SlotCard block={block} slot={slots?.[block.id]} tools={tools} editing={inEdit} />;
    else content = <SectionCard block={block} row={row} fields={byKey} title={title} hidden={hidden} editing={inEdit} tools={tools} />;
    if (content === null) return null;
    return <div key={block.id} className="aui-rblock" data-block-id={block.id} data-kind={block.kind} data-dragging={drag.dragging === block.id || undefined}>{content}</div>;
  };
  const firstColumn = spec.preset === "split" ? "side" : "main";
  const secondColumn = spec.preset === "split" ? "main" : "side";
  return (
    <div ref={box} className="aui-rdetail" data-preset={spec.preset} data-editing={inEdit || undefined}>
      {before}
      {(visible(top).length > 0) && <div className="aui-rdetail-top" data-lane="top" data-lane-column="main">{visible(top).map(draw)}</div>}
      <div className="aui-rdetail-cols">
        <div className="aui-rdetail-col" data-lane="first" data-lane-column={spec.preset === "single" ? "mixed" : firstColumn}>
          {visible(first).map(draw)}
          {inEdit && editing && (spec.preset === "single" || firstColumn === "side") && <AddSectionButton editing={editing} column={spec.preset === "single" ? "side" : firstColumn} />}
        </div>
        {spec.preset !== "single" && (
          <div className="aui-rdetail-col" data-lane="second" data-lane-column={secondColumn}>
            {visible(second).map(draw)}
            {inEdit && editing && secondColumn === "side" && <AddSectionButton editing={editing} column="side" />}
          </div>
        )}
      </div>
      {inEdit && editing && <HiddenTray editing={editing} blockName={blockName} fieldName={fieldName} />}
      {inEdit && editing && <FieldOrganizer editing={editing} fieldName={fieldName} />}
      {drag.indicator && <div className="aui-rlayout-line" aria-hidden="true" style={{ top: drag.indicator.top, left: drag.indicator.left, width: drag.indicator.width }} />}
      <div className="aui-sr-only" aria-live="assertive" aria-atomic="true">{drag.announcement}</div>
    </div>
  );
}

function Placeholder({ name, tools }: { name: string; tools?: ReactNode }) {
  return (
    <section className="aui-dcard" data-kind="placeholder" aria-label={name}>
      <div className="aui-dcard-head"><h3>{name}</h3><span className="aui-dcard-grow" />{tools}</div>
      <p className="aui-dcard-empty">这条记录没有可显示的{name}</p>
    </section>
  );
}

// ---------------------------------------------------------------- header pieces

/** The quiet star 「关注」 / 「已关注」. */
export function FollowButton({ follow }: { follow: RecordFollow }) {
  const label = follow.label ?? (follow.on ? "已关注" : "关注");
  return (
    <Button size="sm" variant="ghost" className="aui-rfollow" aria-pressed={follow.on} data-on={follow.on || undefined} onClick={follow.onToggle}>
      <Star aria-hidden="true" />{label}
    </Button>
  );
}

// ---------------------------------------------------------------- whole detail

export type RecordDetailProps<T> = Omit<RecordDetailBodyProps<T>, "spec" | "editing" | "title"> & {
  /** The saved arrangement (any JSON; normalized against fields / slots / stage / key numbers). */
  spec: unknown;
  /** Used when `spec` is empty (default: stage, key numbers, slots in the main column, one section with every field). */
  defaultSpec?: RecordDetailSpec;
  title: string;
  /** Letter tile left of the title (default: the title's first character; null = none). */
  avatar?: ReactNode;
  status?: ReactNode;
  /** Coloured chips after the title (「跟进中」, 「A 类」). */
  badges?: readonly RecordBadge[];
  tags?: readonly ReactNode[];
  /** The grey line under the title: a node, or parts joined by 「·」 (`{ person }` = initial avatar + name). */
  meta?: ReactNode | readonly (RecordMetaPart | null | undefined | false)[];
  crumb?: ReactNode;
  nav?: { index: number; total: number; onMove: (delta: -1 | 1) => void };
  /** Header buttons (record actions, ⋯, close) after 「编辑布局」 and 「关注」. */
  actions?: ReactNode;
  follow?: RecordFollow | null;
  /** Enables 「编辑布局」. */
  layoutEditor?: RecordLayoutEditor;
  /** Id of the record: an open in-place editor closes when it changes. */
  recordKey?: string;
};

/** A whole arranged record (header + body) for pages and host frames; inside table dialogs use RecordLayout.cards. */
export function RecordDetail<T>({ spec: saved, defaultSpec, title, avatar, status, badges, tags, meta, crumb, nav, actions, follow, layoutEditor, recordKey, ...body }: RecordDetailProps<T>) {
  const catalog = recordDetailCatalog({ fields: body.fields, slots: body.slots, stage: body.stage !== undefined, keyNumbers: body.keyNumbers });
  const spec = useRecordDetailSpec(saved, catalog, defaultSpec);
  const editing = useRecordLayoutEditor(spec, layoutEditor);
  return (
    <RecordScopeContext.Provider value={recordKey}>
      <RecordEditingProvider resetKey={recordKey}>
        <div className="aui-record-detail" data-editing={editing.editing || undefined}>
          <RecordLayoutBar editing={editing} />
          <RecordHeader avatar={avatar === undefined ? recordInitial(title) ?? undefined : avatar ?? undefined} title={title} status={status} badges={badges} tags={tags} meta={meta} crumb={crumb} nav={nav}
            actions={<RecordDetailHeaderTools editing={editing} follow={follow} after={actions} />} />
          <RecordDetailBody {...body} spec={spec} editing={editing} title={title} />
        </div>
      </RecordEditingProvider>
    </RecordScopeContext.Provider>
  );
}

/** 「编辑布局」 + 「关注」 + the host's buttons, for record headers. */
export function RecordDetailHeaderTools({ editing, follow, after }: { editing?: RecordLayoutEditing | null; follow?: RecordFollow | null; after?: ReactNode }) {
  return (
    <>
      {editing && <RecordLayoutButton editing={editing} />}
      {follow && <FollowButton follow={follow} />}
      {after}
    </>
  );
}

// ---------------------------------------------------------------- RecordLayout.cards

/** What RecordLayout.cards draws for one record, plus its edit state (dialog / page provide it to RecordBody). */
export type RecordCardsState<T> = { body: RecordDetailBodyProps<T>; editing: RecordLayoutEditing; follow: RecordFollow | null };
export const RecordCardsContext = /* @__PURE__ */ createContext<RecordCardsState<unknown> | null>(null);

/**
 * RecordLayout.cards for one record: fields (default: every field of `sections` / `aside`), slots
 * (sections drawn by `block` / `render` become slots automatically, the host's `slots` win), stage, key
 * numbers, the normalized spec (nothing saved → `sections` / `aside` as starting section cards) and
 * the edit state. Null without `cards` or row; call it unconditionally.
 */
export function useRecordCards<T>(layout: Pick<RecordLayout<T>, "cards" | "sections" | "aside">, row: T | undefined, context: RecordSectionContext): RecordCardsState<T> | null {
  const cards = layout.cards;
  const groups = [...layout.sections, ...(layout.aside ?? [])];
  const has = cards !== undefined && row !== undefined;
  const r = row as T;
  const fields: readonly RecordField<T>[] = has ? dedupe<T>(cards.fields?.(r) ?? groups.flatMap((section) => (section.block ? [] : sectionFields<T>(section, r)))) : [];
  const auto: Record<string, RecordDetailSlot> = {};
  if (has)
    for (const section of groups)
      if ((section.block || section.render) && !sectionFields(section, row).length)
        auto[section.key] = { title: section.title, render: () => (section.block ? section.block(row, context) : section.render?.(row, context)) };
  const slots = has ? { ...auto, ...(cards.slots?.(row, context) ?? {}) } : {};
  const keyNumbers = has ? cards.keyNumbers?.(r) : undefined;
  const catalog = recordDetailCatalog({ fields, slots, stage: Boolean(cards?.stage), keyNumbers: keyNumbers ?? Boolean(cards?.keyNumbers) });
  const seeds = has
    ? groups.flatMap((section, i) => {
        const keys = section.block ? [] : sectionFields(section, row).map((f) => f.key);
        return keys.length ? [{ id: section.key, title: section.title ?? (i === 0 ? "基本信息" : "字段"), fields: keys, collapsed: section.collapsed }] : [];
      })
    : [];
  const fallback = defaultRecordDetailSpec({ ...catalog, sections: seeds });
  const spec = useRecordDetailSpec(cards?.spec, catalog, fallback);
  const editing = useRecordLayoutEditor(spec, cards?.editor);
  if (!has) return null;
  return {
    body: { row, fields, spec, slots, stage: cards.stage?.(row) ?? null, keyNumbers, editing, title: undefined },
    editing,
    follow: cards.follow?.(row) ?? null,
  };
}
const dedupe = <T,>(fields: readonly RecordField<T>[]) => {
  const seen = new Set<string>();
  return fields.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
};
