"use client";
/**
 * `@adminui/react/org-picker` — the organisation picker: `OrgPicker` (dialog: tree |
 * people | selected, search, pluggable tabs, phone drill-down) and `OrgPickerField` (inline box that
 * opens it). Data comes from the host's `OrgDataSource`; the components never fetch on their own. Its own
 * subpath and CSS chunk, so pages without a people picker don't ship it; GrantList / ShareDialog load it
 * lazily when given `orgSource`.
 */
export type * from "./org-picker-core.ts";
export type * from "./org-picker-text.ts";
export type * from "./org-picker-nav.ts";
export type { OrgPickOptions } from "./org-picker-model.ts";
export type { OrgShortcut } from "./org-picker-members.tsx";
export type { OrgPickerProps } from "./org-picker.tsx";
export type { OrgPickerFieldProps } from "./org-picker-field.tsx";

export { OrgPicker } from "./org-picker.tsx";
export { OrgPickerField } from "./org-picker-field.tsx";
// Pure rules (unit-tested; usable in host code and servers).
export {
  subjectKey,
  sameSubject,
  hasSubTree,
  chainOf,
  pathLabels,
  unitSubject,
  personSubject,
  coveredBy,
  mixedIds,
  nodeCheckState,
  canAdd,
  pickSubject,
  unpickSubject,
  togglePick,
  setIncludeSub,
  pickAll,
  reachOf,
  departedOf,
  diffPicks,
  toOutput,
  mergeResolved,
  groupByKind,
  groupHits,
  DEFAULT_SELECTABLE,
} from "./org-picker-core.ts";
export { ORG_PICKER_MESSAGES, orgPickerMessages, fillText, selectionSummary } from "./org-picker-text.ts";
export { visibleTreeRows, treeKey, listKey, virtualWindow } from "./org-picker-nav.ts";
