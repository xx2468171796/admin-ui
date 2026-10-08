"use client";
/**
 * The state one OrgPicker shares between its panes: the draft value (only handed to the host on
 * 「确定」), how picking behaves (mode, max, selectable kinds, 「含下级」 default), availability and the
 * 「已授权」 marks, and the derived half-checked / covered states. Pure rules live in org-picker-core.ts.
 */
import { useMemo } from "react";
import {
  availabilityOf,
  canAdd,
  coveredBy,
  hasSubTree,
  mixedIds,
  sameSubject,
  setIncludeSub,
  subjectKey,
  togglePick,
  unpickSubject,
  type Availability,
  type OrgIndex,
  type OrgPerson,
  type OrgUnit,
  type PickedSubject,
  type SubjectKind,
  type SubjectRef,
} from "./org-picker-core.ts";
import { fillText, orgPickerMessages, type OrgPickerLocale, type OrgPickerMessages } from "./org-picker-text.ts";

/** Options every picker surface shares (OrgPicker, OrgPickerField, GrantList / ShareDialog pass-through). */
export type OrgPickOptions = {
  /** multiple (default) · single = one pick, radio rows, no right column. */
  mode?: "single" | "multiple";
  /** Kinds the user may pick; default person + dept + company. ["person"] = people only (no ticks on the tree). */
  selectable?: readonly SubjectKind[];
  /** A picked department / company includes its sub-departments (default true). */
  includeSubDefault?: boolean;
  max?: number;
  /** Viewer's scope: locked (grey + lock + reason) / partial / hidden per subject; the host decides. */
  availability?: (ref: SubjectRef) => Availability | undefined;
  /** Already on the list: subjectKey (`person:u1`) or plain id → 「已授权 · 可读写」; shown grey, not pickable again. */
  existing?: Readonly<Record<string, string>>;
  locale?: OrgPickerLocale;
  /** Override any wording (i18n): see ORG_PICKER_MESSAGES. */
  messages?: Partial<OrgPickerMessages>;
};

export type PickerModel = {
  m: OrgPickerMessages;
  locale: OrgPickerLocale;
  t: (template: string, params?: Readonly<Record<string, string | number>>) => string;
  value: readonly PickedSubject[];
  setValue: (next: PickedSubject[]) => void;
  index: OrgIndex;
  single: boolean;
  max?: number;
  full: boolean;
  includeSubDefault: boolean;
  mixed: ReadonlySet<string>;
  canSelect: (kind: SubjectKind) => boolean;
  avail: (ref: SubjectRef, own?: Availability) => Availability;
  existingNote: (ref: SubjectRef) => string | undefined;
  isPicked: (ref: SubjectRef) => boolean;
  covered: (ref: SubjectRef & { ancestors?: readonly string[]; deptIds?: readonly string[] }) => PickedSubject | null;
  toggle: (subject: PickedSubject) => void;
  remove: (ref: SubjectRef) => void;
  setSub: (ref: SubjectRef, on: boolean) => void;
};

export function usePickerModel(options: OrgPickOptions, value: readonly PickedSubject[], setValue: (next: PickedSubject[]) => void, index: OrgIndex): PickerModel {
  const { mode = "multiple", selectable, includeSubDefault = true, max, availability, existing, locale = "zh-CN", messages } = options;
  const m = useMemo(() => orgPickerMessages(locale, messages), [locale, messages]);
  // The index is a live map that grows as nodes load, so this is derived on every render (cheap: walks the picks).
  const mixed = mixedIds(value, index);
  const kinds = selectable ?? ["person", "dept", "company"];
  const single = mode === "single";
  const pickOptions = { mode, max };
  return {
    m,
    locale,
    t: (template, params = {}) => fillText(template, params, locale),
    value,
    setValue,
    index,
    single,
    max,
    full: !single && !canAdd(value, pickOptions),
    includeSubDefault,
    mixed,
    canSelect: (kind) => kinds.includes(kind),
    avail: (ref, own) => availabilityOf(ref, availability, own),
    existingNote: (ref) => existing?.[subjectKey(ref)] ?? existing?.[ref.id],
    isPicked: (ref) => value.some((s) => sameSubject(s, ref)),
    covered: (ref) => coveredBy(ref, value, index),
    // Single mode behaves like radio buttons: clicking the picked row again keeps it.
    toggle: (subject) => {
      if (single && value.some((s) => sameSubject(s, subject))) return;
      setValue(togglePick(value, hasSubTree(subject.kind) && subject.includeSub === undefined ? { ...subject, includeSub: includeSubDefault } : subject, index, pickOptions));
    },
    remove: (ref) => {
      if (!single) setValue(unpickSubject(value, ref));
    },
    setSub: (ref, on) => setValue(setIncludeSub(value, ref, on, index)),
  };
}

/** Why a row can't be ticked (null = it can): not selectable, locked, departed, already granted, covered, full. */
export function blockedReason(model: PickerModel, ref: SubjectRef & { ancestors?: readonly string[]; deptIds?: readonly string[] }, own?: Availability, status?: OrgPerson["status"]): { reason: string; kind: "locked" | "partial" | "left" | "existing" | "covered" | "full" | "kind" } | null {
  const a = model.avail(ref, own);
  if (a.state === "locked") return { reason: a.reason ?? model.m.locked, kind: "locked" };
  if (a.state === "partial") return { reason: a.reason ?? model.m.partial, kind: "partial" };
  if (status === "left") return { reason: model.m.departed, kind: "left" };
  if (status === "disabled") return { reason: model.m.disabledPerson, kind: "left" };
  if (!model.canSelect(ref.kind)) return { reason: "", kind: "kind" };
  const note = model.existingNote(ref);
  if (note) return { reason: note, kind: "existing" };
  const by = model.covered(ref);
  if (by) return { reason: model.t(model.m.coveredIn, { name: by.label }), kind: "covered" };
  if (model.full && !model.isPicked(ref)) return { reason: model.t(model.m.maxReached, { n: model.max ?? 0 }), kind: "full" };
  return null;
}

/** A unit is hidden from the viewer (another company they can't grant to). */
export const isHidden = (model: PickerModel, unit: OrgUnit) => model.avail({ kind: unit.kind, id: unit.id }, unit.availability).state === "hidden";
