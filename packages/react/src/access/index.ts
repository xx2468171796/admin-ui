"use client";
/**
 * `@adminui/react/access` — permission management (quanxian 2.0). The single components are
 * props-driven (no data fetching); `AccessConsole` (whole page) and `RecordTeam` (detail-page tab)
 * are wired to the quanxian management API through an `AccessApi` (`createAccessApi({ baseUrl:
 * "/api/qx" })`). The server re-checks every change.
 *
 * Values are listed explicitly (what hosts, ACCESS.md and the quanxian CRM sample use); every type
 * stays public through `export type *`. Internal helpers (labels, keys, draft plumbing) are imported
 * by the components and tests from their modules and are not part of the API.
 */
export type * from "./contracts.ts";
export type * from "./console-contracts.ts";
export type * from "./tree-core.ts";
export type * from "./matrix-core.ts";
export type * from "./review-core.ts";
export type * from "./console-core.ts";
export type * from "./console-api.ts";
export type * from "./checkable-tree.tsx";
export type * from "./data-scope-dialog.tsx";
export type * from "./permission-matrix.tsx";
export type * from "./org-picker.tsx";
export type * from "./effective-access.tsx";
export type * from "./record-team.tsx";
export type * from "./requests.tsx";
export type * from "./audit-diff.tsx";

// Contracts: permission codes the host grants, the "everyone" subject, tier hints, payload shaping.
export { EVERYONE_ID, SCOPE_TIER_HINT, teamAddPayload } from "./contracts.ts";
export { ACCESS_CONSOLE_CODES } from "./console-contracts.ts";
// Pure rules (unit-tested; usable in host code and servers).
export { indexTree, fullPath, checkStates, toggleNode, normalizeLinked, halfChecked, visibleIds, visibleRows } from "./tree-core.ts";
export { describeScope, describeDims, describeAssignScope, sameAssignScope, assignKey, normalizeDims, validateScope, normalizeScope, sameScope, toggleFieldAbility, setCell, toggleRows, diffMatrix, matrixChangeItems } from "./matrix-core.ts";
export { expiryState, requestActions, reviewProgress, staleGrant, filterEffective, explainSummary } from "./review-core.ts";
export { diffJson, isSecretPath, formatJsonValue } from "./diff-core.ts";
// Single components.
export { CheckableTree } from "./checkable-tree.tsx";
export { DataScopeDialog } from "./data-scope-dialog.tsx";
export { PermissionMatrix } from "./permission-matrix.tsx";
export { OrgTreePicker, UserTransfer } from "./org-picker.tsx";
export { EffectiveAccessTable, ExplainPanel } from "./effective-access.tsx";
export { RecordTeamPanel, ExpiryBadge } from "./record-team.tsx";
export { AccessRequestList, ReviewList } from "./requests.tsx";
export { AuditDiff } from "./audit-diff.tsx";
// Wired to the quanxian API.
export { AccessApiError, createAccessApi, readAccessError } from "./console-api.ts";
export { consoleRights, snapshotHolds, errorView, assignmentActions, asDialogError, deptIndex, deptTree, roleDirty, explainActions, editsSelf, roleSaveBody, fieldCondChangeItems } from "./console-core.ts";
export { AccessConsole, type AccessConsoleProps, type AccessConsoleExtraSection } from "./access-console.tsx";
export { RecordTeam, type RecordTeamProps } from "./record-team-connected.tsx";
export * from "./governance/index.ts";
// bt/history — P4 有效权限扩展（D15）：人员权限构成条、按字段 / 指定记录 / 数据范围单独加减
export type * from "./profile-core.ts";
export type * from "./override-core.ts";
export type * from "./access-profile.tsx";
export type * from "./override-target.tsx";
export { EFFECTIVE_CATEGORY_LABEL } from "./contracts.ts";
export { accessProfileStats, personalOnly, rowExpiry } from "./profile-core.ts";
export { OVERRIDE_TARGET_LABEL, EMPTY_TARGET_DRAFT, draftToTarget, targetToDraft, targetLabel, targetKinds, scopedCodeOptions } from "./override-core.ts";
export { AccessProfileHeader } from "./access-profile.tsx";
export { OverrideTargetFields } from "./override-target.tsx";
// bt/records：表格就地权限（样稿 D13）
export type * from "./table-access-core.ts";
export type * from "./table-access-panel.tsx";
export { TableAccessPanel } from "./table-access-panel.tsx";
export { TABLE_SCOPE_TIERS, tableFieldPolicy, canToggleField, toggleTableField, tableFieldCounts, tableFieldTags, hiddenTableFields, tableAccessChanges, tableAccessDirty } from "./table-access-core.ts";
// bt/access-modules：权限按模块组织（starter「权限按模块」页 A1–A6）
export type * from "./module-core.ts";
export type * from "./data-scope-select.tsx";
export type * from "./module-permission-editor.tsx";
export type * from "./permission-diff.tsx";
export type * from "./effective-access-view.tsx";
export {
  ACCESS_LEVEL_ORDER,
  ACCESS_LEVEL_LABEL,
  ACCESS_LEVEL_HINT,
  CUSTOM_LEVEL_LABEL,
  FIELD_MODE_LABEL,
  MODULE_SOURCE_TONE,
  moduleLevels,
  levelLabel,
  levelOf,
  nearestLevel,
  normalizeGrant,
  grantedActions,
  actionState,
  toggleAction,
  resolvePending,
  setLevel,
  setScope,
  resetToLevel,
  effectiveScope,
  scopeMode,
  fieldModeOf,
  setFieldMode,
  grantChips,
  grantChanged,
  diffModuleGrant,
  diffModuleGrants,
  changeSummaryText,
  pendingCount,
  impactCounts,
  impactSentence,
} from "./module-core.ts";
export { DataScopeSelect } from "./data-scope-select.tsx";
export { ModulePermissionEditor } from "./module-permission-editor.tsx";
export { PermissionDiff } from "./permission-diff.tsx";
export { EffectiveAccessView } from "./effective-access-view.tsx";
