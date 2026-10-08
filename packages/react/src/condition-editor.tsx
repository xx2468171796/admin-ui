"use client";
/**
 * ConditionTreeEditor (bt/builders-a P1): the one editor of a condition tree
 * (condition-core), shared by the grid filter / colour panels (GridConditionTree), the governance
 * CondBuilder (share / restriction rules, TableAccessPanel 「按条件」, demo D13), rule lists (D26) and form
 * display conditions (D08).
 *
 * Generic over the operator set and the field description: the host says which operators a field
 * offers (`operators`), how a new condition looks (`createCondition`) and how a value is edited
 * (`renderValue`). A row is 「当 / 且 / 或 · 字段 · 条件 · 值 · ×」 — field, operator and value are the
 * approved 28px dropdowns; the joiner 「且 / 或」 is a button that switches its group's relation; remove is
 * an × icon button (a filter is not data, no trash can). Groups are a wash box with their own 全部满足 /
 * 任一满足 and an ×. 「添加条件 / 添加条件组」 within the limits (default: one level of groups, 50
 * conditions — CONDITION_LIMITS). Unfinished rows (`isComplete` false) say 「还没填值，这条先不生效」 in
 * grey; rows with an error are red with the message under them. `summary` goes on top (the one-sentence
 * reading, ConditionSentence).
 *
 * `density="compact"` is the D13 look for narrow cards: no prefix column, a small 「且 / 或」 chip
 * between rows, rows wrap (value under field + operator) below 420px of width.
 */
import { useMemo, type ReactNode } from "react";
import { Plus, SquarePlus, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { Choice } from "./select.tsx";
import { IconButton } from "./buttons.tsx";
import { SegmentedControl } from "./choices.tsx";
import { GridFieldPicker } from "./grid-field-picker.tsx";
import { tipProps } from "./tooltip.tsx";
import type { GridField } from "./grid-core.ts";
import {
  CONDITION_LIMITS,
  addConditionNode,
  canAddCondition,
  canAddConditionGroup,
  countConditions,
  isConditionGroup,
  nextConditionId,
  removeConditionNode,
  setConjunction,
  updateConditionNode,
  type Condition,
  type ConditionConjunction,
  type ConditionGroup,
  type ConditionLimits,
  type ConditionValue,
} from "./condition-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";

export { ConditionValuePicker, type ConditionChoice, type ConditionValuePickerProps } from "./condition-value-picker.tsx";

/** What the editor needs from a field: key, name, a type for the icon, and why it can't be used. */
export type ConditionEditorField = {
  key: string;
  title: string;
  /** Field type name; picks the icon of the searchable picker (grid type names, unknown = text). */
  type: string;
  /** Can't be picked (the reason is shown with a lock). */
  restricted?: boolean | string;
  /** Has view / edit restrictions: a lock to look at, still pickable. */
  locked?: boolean | string;
};
export type ConditionOperatorOption<Op extends string> = { value: Op; label: string };

/** What renderValue gets for one condition row. */
export type ConditionValueContext<Op extends string, F extends ConditionEditorField> = {
  condition: Condition<Op>;
  field: F | undefined;
  /** Row name for screen readers (「条件 2」). */
  label: string;
  readOnly: boolean;
  /** Set the condition's value (undefined clears it). */
  onChange: (value: ConditionValue | undefined) => void;
  /** Patch the whole condition (value + operator, e.g. a value-source switch). */
  onPatch: (patch: Partial<Omit<Condition<Op>, "id">>) => void;
};

export type ConditionTreeEditorProps<Op extends string, F extends ConditionEditorField> = {
  fields: readonly F[];
  tree: ConditionGroup<Op>;
  onChange: (tree: ConditionGroup<Op>) => void;
  /** Operators a field offers (first = default for a new condition). */
  operators: (field: F) => readonly ConditionOperatorOption<Op>[];
  /** Value editor of one row; null for operators without a value. */
  renderValue: (context: ConditionValueContext<Op, F>) => ReactNode;
  /** A new condition on a field (default: its first operator, no value). */
  createCondition?: (field: F, id: string) => Condition<Op>;
  /**
   * Apply a row edit to the tree. Default: a new field resets operator and value
   * (`createCondition`), anything else is merged.
   */
  patchCondition?: (tree: ConditionGroup<Op>, id: string, patch: Partial<Omit<Condition<Op>, "id">>) => ConditionGroup<Op>;
  /** Nesting / count limits (default CONDITION_LIMITS: one level of groups, 50 conditions). */
  limits?: Partial<ConditionLimits>;
  /** `search` (default): the searchable picker with type icons and locks; `select`: a plain select (few fields). */
  fieldPicker?: "search" | "select";
  /** Accessible names. `row` gets the index in its group and the 1-based number in the whole tree. */
  labels?: {
    row?: (at: { index: number; number: number }) => string;
    field?: (row: string) => string;
    operator?: (row: string) => string;
    group?: (conjunction: ConditionConjunction) => string;
  };
  /** 「添加条件 / 添加条件组」 under the root (default true; the grid panel puts them in its footer). */
  rootActions?: boolean;
  /** The root 「符合以下 全部满足 / 任一满足 的条件」 line (default: when there are 2+ items). */
  rootConjunction?: "auto" | "always" | "never";
  /** The last condition can't be removed (rules that must keep one). */
  keepOne?: boolean;
  /** Condition id → message, shown under the row (the row turns red). */
  errors?: Readonly<Record<string, string>>;
  /**
   * Is a condition filled in enough to take part (condition-core isConditionComplete for the field's
   * kind). False rows get the grey note `pendingText`; leave out to never show it.
   */
  isComplete?: (condition: Condition<Op>, field: F | undefined) => boolean;
  /** Note under an unfinished row (default 「还没填值，这条先不生效」). */
  pendingText?: string;
  /** On top of the rows: the one-sentence reading (ConditionSentence) or anything else. */
  summary?: ReactNode;
  readOnly?: boolean;
  density?: "default" | "compact";
  /** Accessible name of the whole editor. */
  label?: string;
  /** Shown when the tree is empty. */
  empty?: ReactNode;
  className?: string;
};

const defaultLabels = {
  row: ({ index }: { index: number; number: number }) => `条件 ${index + 1}`,
  field: () => "筛选字段",
  operator: () => "条件",
  group: (c: ConditionConjunction) => `条件组（${c === "or" ? "任一满足" : "全部满足"}）`,
};
const CONJUNCTIONS = [{ value: "and", label: "全部满足" }, { value: "or", label: "任一满足" }] as const;
const word = (c: ConditionConjunction) => (c === "or" ? "或" : "且");
const other = (c: ConditionConjunction): ConditionConjunction => (c === "or" ? "and" : "or");

/** 「当」 before the first row; 「且 / 或」 after it — a button that switches the group's relation. */
function Joiner({ conjunction, index, compact, readOnly, onToggle }: { conjunction: ConditionConjunction; index: number; compact: boolean; readOnly: boolean; onToggle: () => void }) {
  if (index === 0) return compact ? null : <span className="aui-grid-cond-prefix" aria-hidden="true">当</span>;
  const text = word(conjunction);
  const className = compact ? "aui-cond-joiner aui-gov-cond-join" : "aui-grid-cond-prefix";
  if (readOnly) return <span className={className} aria-hidden="true">{text}</span>;
  const tip = `点一下改成「${word(other(conjunction))}」`;
  return (
    <span className={className}>
      <button type="button" className="aui-cond-conj-btn" aria-label={`条件关系「${text}」，${tip}`} {...tipProps(tip)} onClick={onToggle}>{text}</button>
    </span>
  );
}

/** Tree edits of the editor: patch a row, add a condition / a group (within the limits). */
function useTreeEdits<Op extends string, F extends ConditionEditorField>(props: ConditionTreeEditorProps<Op, F>, limits: ConditionLimits) {
  const { fields, tree, onChange, operators } = props;
  const first = fields.find((field) => !field.restricted);
  const create = (field: F, id: string): Condition<Op> => props.createCondition?.(field, id) ?? { id, field: field.key, op: operators(field)[0]?.value ?? ("" as Op) };
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const patch = (id: string, change: Partial<Omit<Condition<Op>, "id">>) => {
    if (props.patchCondition) return onChange(props.patchCondition(tree, id, change));
    onChange(updateConditionNode(tree, id, (condition) => {
      if (change.field !== undefined && change.field !== condition.field) {
        const field = byKey.get(change.field);
        return field ? create(field, condition.id) : condition;
      }
      return { ...condition, ...change };
    }));
  };
  const addCondition = (groupId: string) => {
    if (first) onChange(addConditionNode(tree, groupId, create(first, nextConditionId(tree, "f"))));
  };
  const addGroup = (groupId: string) => {
    if (!first || !canAddConditionGroup(tree, groupId, limits)) return;
    const condition = create(first, nextConditionId(tree, "f"));
    onChange(addConditionNode(tree, groupId, { id: nextConditionId(tree, "g"), conjunction: "or", items: [condition] }));
  };
  return { first, byKey, patch, addCondition, addGroup };
}

/** See the module comment. */
export function ConditionTreeEditor<Op extends string, F extends ConditionEditorField>(props: ConditionTreeEditorProps<Op, F>) {
  const { fields, tree, onChange, operators, renderValue, limits: limitsProp, fieldPicker = "search", rootActions = true, rootConjunction = "auto", keepOne, errors = {}, isComplete, pendingText = "还没填值，这条先不生效", summary, readOnly = false, density = "default", label, empty, className } = props;
  const limits: ConditionLimits = { ...CONDITION_LIMITS, ...limitsProp };
  const labels = { ...defaultLabels, ...props.labels };
  const { first, byKey, patch, addCondition, addGroup } = useTreeEdits(props, limits);
  const total = countConditions(tree);
  let counter = 0;
  const compact = density === "compact";
  const joiner = (group: ConditionGroup<Op>, index: number) => (
    <Joiner conjunction={group.conjunction} index={index} compact={compact} readOnly={readOnly} onToggle={() => onChange(setConjunction(tree, group.id, other(group.conjunction)))} />
  );

  const renderRow = (condition: Condition<Op>, index: number) => {
    counter += 1;
    const rowLabel = labels.row({ index, number: counter });
    const field = byKey.get(condition.field);
    const ops = field ? operators(field) : [];
    const error = errors[condition.id];
    const pending = !error && isComplete ? !isComplete(condition, field) : false;
    const pickerFields = fields as unknown as readonly GridField<unknown>[];
    const lastOne = Boolean(keepOne && total <= 1);
    return (
      <div className="aui-grid-cond-row" role="group" aria-label={rowLabel} data-invalid={error ? "" : undefined} data-pending={pending ? "" : undefined}>
        {fieldPicker === "select" ? (
          <Choice size="sm" label={labels.field(rowLabel)} value={condition.field} disabled={readOnly} onChange={(key) => patch(condition.id, { field: key })} options={fields.map((f) => ({ value: f.key, label: f.title }))} />
        ) : (
          <GridFieldPicker fields={pickerFields} value={condition.field} label={labels.field(rowLabel)} disabled={readOnly} onChange={(key) => patch(condition.id, { field: key })} />
        )}
        <Choice size="sm" label={labels.operator(rowLabel)} value={condition.op} disabled={readOnly} options={ops.map((op) => ({ value: op.value, label: op.label }))} onChange={(op) => patch(condition.id, { op: op as Op })} />
        <div className="aui-grid-cond-value">
          {renderValue({ condition, field, label: rowLabel, readOnly, onChange: (value) => patch(condition.id, { value }), onPatch: (change) => patch(condition.id, change) })}
        </div>
        {!readOnly && (
          <IconButton size="sm" className="aui-grid-cond-remove" icon={<X />} label={`删除${rowLabel}`} disabled={lastOne} disabledReason={lastOne ? "至少保留一个条件" : undefined}
            onClick={() => onChange(removeConditionNode(tree, condition.id))} />
        )}
        {error && <p className="aui-error aui-cond-error" role="alert">{error}</p>}
        {pending && <p className="aui-cond-pending">{pendingText}</p>}
      </div>
    );
  };
  const conjunctionControl = (group: ConditionGroup<Op>, name: string) => (
    <SegmentedControl size="sm" label={name} value={group.conjunction} disabled={readOnly} options={CONJUNCTIONS} onValueChange={(v) => onChange(setConjunction(tree, group.id, v === "or" ? "or" : "and"))} />
  );
  const addButtons = (groupId: string, withGroup: boolean) => (
    <>
      <Button variant="ghost" size="sm" className="aui-cond-add-btn" disabled={!first || !canAddCondition(tree, limits)} onClick={() => addCondition(groupId)}><Plus />添加条件</Button>
      {withGroup && <Button variant="ghost" size="sm" className="aui-cond-add-btn" disabled={!first || !canAddConditionGroup(tree, groupId, limits)} onClick={() => addGroup(groupId)}><SquarePlus />添加条件组</Button>}
    </>
  );
  const renderGroup = (node: ConditionGroup<Op>, depth: number) => (
    <div className="aui-grid-cond-group" role="group" aria-label={labels.group(node.conjunction)}>
      <div className="aui-grid-cond-conj">
        <span>条件组：</span>
        {conjunctionControl(node, "条件组的关系")}
        {!readOnly && <IconButton size="sm" className="aui-grid-cond-remove" icon={<X />} label="删除条件组" onClick={() => onChange(removeConditionNode(tree, node.id))} />}
      </div>
      {renderItems(node, depth + 1)}
      {!readOnly && <div className="aui-grid-cond-add">{addButtons(node.id, canAddConditionGroup(tree, node.id, limits))}</div>}
    </div>
  );
  const renderItems = (group: ConditionGroup<Op>, depth: number): ReactNode => (
    <ol className="aui-cond-list">
      {group.items.map((node, index) => (
        <li key={node.id} className="aui-grid-cond-line" data-group={isConditionGroup(node) ? "" : undefined}>
          {joiner(group, index)}
          {isConditionGroup(node) ? renderGroup(node, depth) : renderRow(node, index)}
        </li>
      ))}
    </ol>
  );
  const showConj = tree.items.length > 0 && (rootConjunction === "always" || (rootConjunction === "auto" && tree.items.length > 1) || (rootConjunction === "auto" && !compact));
  return (
    <div className={["aui-cond-editor aui-grid-cond-tree", className].filter(Boolean).join(" ")} role="group" aria-label={label} data-density={density} data-readonly={readOnly || undefined}>
      {summary}
      {showConj && (
        <div className="aui-grid-cond-conj">
          <span>符合以下</span>
          {conjunctionControl(tree, "条件关系")}
          <span>的条件</span>
        </div>
      )}
      {tree.items.length === 0 && empty}
      {tree.items.length > 0 && renderItems(tree, 0)}
      {rootActions && !readOnly && (
        <div className="aui-cond-actions">
          {addButtons(tree.id, limits.maxDepth > 0)}
          {!canAddCondition(tree, limits) && <span className="aui-note">已到 {limits.maxConditions} 个条件的上限</span>}
        </div>
      )}
    </div>
  );
}
