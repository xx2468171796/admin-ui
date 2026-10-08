/**
 * Large-tier (multi-tenant / governance) permission pages for quanxian 2.0 (large tier), exported from
 * `@adminui/react/access`. Pattern: every page takes `api` (createGovernanceApi() or any object
 * implementing GovernanceApi) + optional `can` flags + host lookups, and loads / saves by itself.
 * Values are listed explicitly (what hosts, ACCESS.md and the samples use; internal helpers stay in
 * their modules for the pages and tests); every type stays public.
 */
export type * from "./contracts.ts";
export { GOV_PERMISSIONS, GOV_PLATFORM_PERMISSIONS } from "./contracts.ts";
export { createGovernanceApi, GovernanceApiError, parseGovError } from "./api.ts";
export type { GovernanceApi, GovernanceApiOptions, GovCallOptions, GovCollection, GovRuleCollection } from "./api.ts";
export { condToText, condLabelsFrom, validateCond, draftToCond, condToDraft } from "./cond-core.ts";
export type { CondDraft, CondRow, CondValueSource, CondDraftResult, CondLabels } from "./cond-core.ts";
export {
  govRequestActions,
  chainSteps,
  chainProgressText,
  validateRequestInput,
  validateEmergency,
  emergencyCountdown,
  campaignProgress,
  campaignDeadline,
  campaignCloseImpact,
  toReviewItem,
  stepsText,
  validatePolicy,
} from "./request-core.ts";
export type { GovRequestAction, GovActionMeta, ChainStepView, GovFieldErrors, CountdownState, DeadlineView } from "./request-core.ts";
export {
  governanceCan,
  governanceSections,
  impactSummary,
  quotaState,
  quotaAlerts,
  effectiveQuotas,
  groupHealth,
  healthSummary,
  rlsSummary,
} from "./governance-core.ts";
export type { GovCan, QuotaState, QuotaStateKind, GovernanceSection } from "./governance-core.ts";
export type { GovPageBaseProps, GovLoadState } from "./shared.tsx";
export { CondBuilder, RuleImpactView } from "./cond-builder.tsx";
export type { CondBuilderProps, RuleImpactViewProps } from "./cond-builder.tsx";
export { TenantMembersPage, TenantQuotas } from "./members-page.tsx";
export type { TenantMembersPageProps, MemberOrgPickerOptions } from "./members-page.tsx";
export { ShareRulesPage, RestrictionRulesPage } from "./rules-page.tsx";
export type { ShareRulesPageProps, RestrictionRulesPageProps, RuleSubjects } from "./rules-page.tsx";
export { SodRulesPage } from "./sod-page.tsx";
export type { SodRulesPageProps } from "./sod-page.tsx";
export { AccessRequestsPage, ApprovalChain } from "./requests-page.tsx";
export type { AccessRequestsPageProps, AccessRequestsView } from "./requests-page.tsx";
export { ApprovalPoliciesPage } from "./policies-page.tsx";
export type { ApprovalPoliciesPageProps } from "./policies-page.tsx";
export { EmergencyAccessPage, EmergencyCountdown } from "./emergency-page.tsx";
export type { EmergencyAccessPageProps, EmergencyTarget } from "./emergency-page.tsx";
export { ReviewsPage } from "./reviews-page.tsx";
export type { ReviewsPageProps } from "./reviews-page.tsx";
export { SecurityHealthPage } from "./health-page.tsx";
export type { SecurityHealthPageProps } from "./health-page.tsx";
export { TenantsPage, PackagesPage } from "./platform-page.tsx";
export type { TenantsPageProps, PackagesPageProps } from "./platform-page.tsx";
export { GovernanceConsole } from "./console.tsx";
export type { GovernanceConsoleProps, GovLookups } from "./console.tsx";
// bt/builders-a：嵌套条件（条件组）草稿 ⇄ condition-core 条件树
export { condDraftToTree, treeToCondDraft, condRowToCondition, conditionToCondRow, countDraftRows, draftKey } from "./cond-core.ts";
export type { CondDraftGroup } from "./cond-core.ts";
