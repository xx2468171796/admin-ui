"use client";
/**
 * GovernanceConsole — one menu entry for the whole large-tier governance: a TabbedPage whose sections
 * follow the viewer's `qx:*` permission codes. Each section is the standalone page component, so
 * hosts can also mount the pages one by one in their own menu.
 */
import { useState, type ReactNode } from "react";
import { TabbedPage } from "../../tabbed-page.tsx";
import type { GovOption, GovResource, RlsCheckDto } from "./contracts.ts";
import { GOVERNANCE_SECTION_LABEL, governanceCan, governanceSections, type GovernanceSection } from "./governance-core.ts";
import type { GovernanceApi } from "./api.ts";
import { TenantMembersPage, type MemberOrgPickerOptions } from "./members-page.tsx";
import type { OrgDataSource } from "../../org-picker/org-picker-core.ts";
import { RestrictionRulesPage, ShareRulesPage } from "./rules-page.tsx";
import { SodRulesPage } from "./sod-page.tsx";
import { AccessRequestsPage } from "./requests-page.tsx";
import { ApprovalPoliciesPage } from "./policies-page.tsx";
import { EmergencyAccessPage, type EmergencyTarget } from "./emergency-page.tsx";
import { ReviewsPage } from "./reviews-page.tsx";
import { SecurityHealthPage } from "./health-page.tsx";
import { PackagesPage, TenantsPage } from "./platform-page.tsx";
import { defaultNow } from "./shared.tsx";

/** Labels and pickers the host loads once (from its directory / catalog) and passes to every page. */
export type GovLookups = {
  users?: readonly GovOption[];
  roles?: readonly GovOption[];
  depts?: readonly GovOption[];
  groups?: readonly GovOption[];
  /** Permission codes (SoD pickers, request targets). */
  codes?: readonly GovOption[];
  features?: readonly GovOption[];
  /** Resource types with condition fields (rule editors). */
  resources?: readonly GovResource[];
  /** What can be requested; defaults to roles / codes. */
  requestTargets?: { role?: readonly GovOption[]; permission?: readonly GovOption[] };
  /** What can be taken in an emergency. */
  emergencyTargets?: readonly EmergencyTarget[];
  quotaLabels?: Readonly<Record<string, string>>;
};

export type GovernanceConsoleProps = {
  api: GovernanceApi;
  /** The signed-in user. */
  me: { id: string; name: string };
  /** The viewer's permission codes (quanxian `qx:*`, wildcards ok): decide sections and buttons. UI only. */
  permissions: readonly string[];
  lookups?: GovLookups;
  /** Limit / order the sections (default: every section the viewer may open). */
  sections?: readonly GovernanceSection[];
  /** Controlled current section (keep it in the URL); uncontrolled when omitted. */
  value?: GovernanceSection;
  onValueChange?: (section: GovernanceSection) => void;
  title?: string;
  description?: string;
  /** Top-right of the page header (e.g. a perspective switch). */
  actions?: ReactNode;
  /** False when the console's workspace tab is hidden: every section pauses. */
  active?: boolean;
  now?: () => Date;
  /** Optional RLS self check shown on 安全体检. */
  rls?: RlsCheckDto | ((signal: AbortSignal) => Promise<RlsCheckDto>);
  /** Longest emergency elevation in minutes (default 240). */
  maxEmergencyMinutes?: number;
  /**
   * The host's directory (OrgDataSource, e.g. scoped to who the viewer may grant): 成员 → 添加成员 picks the person
   * with the OrgPicker instead of a select / a typed user id. `orgPicker` passes OrgPickerField options through.
   */
  orgSource?: OrgDataSource;
  orgPicker?: MemberOrgPickerOptions;
};

export function GovernanceConsole({
  api,
  me,
  permissions,
  lookups = {},
  sections,
  value,
  onValueChange,
  title = "权限治理",
  description,
  actions,
  active = true,
  now = defaultNow,
  rls,
  maxEmergencyMinutes,
  orgSource,
  orgPicker,
}: GovernanceConsoleProps) {
  const can = governanceCan(permissions);
  const visible = governanceSections(can, sections);
  const [inner, setInner] = useState<GovernanceSection | undefined>(undefined);
  const current = value ?? inner ?? visible[0];
  const select = (id: string) => (onValueChange ? onValueChange(id as GovernanceSection) : setInner(id as GovernanceSection));
  const l = lookups;
  if (!visible.length || !current) return null;
  return (
    <TabbedPage
      title={title}
      description={description}
      actions={actions}
      sections={visible.map((id) => ({ id, label: GOVERNANCE_SECTION_LABEL[id] }))}
      value={visible.includes(current) ? current : visible[0]!}
      onValueChange={select}
      active={active}
      render={(id, on) => {
        const base = { api, active: on, now };
        switch (id as GovernanceSection) {
          case "members":
            return <TenantMembersPage {...base} roles={l.roles} users={l.users} orgSource={orgSource} orgPicker={orgPicker} can={{ manage: can.memberManage }} />;
          case "share":
            return <ShareRulesPage {...base} resources={l.resources ?? []} subjects={{ user: l.users, group: l.groups, dept: l.depts }} can={{ manage: can.ruleManage }} />;
          case "restrictions":
            return <RestrictionRulesPage {...base} resources={l.resources ?? []} users={l.users} can={{ manage: can.ruleManage }} />;
          case "sod":
            return <SodRulesPage {...base} codes={l.codes} can={{ manage: can.ruleManage }} />;
          case "requests":
            return <AccessRequestsPage {...base} targets={l.requestTargets ?? { role: l.roles, permission: l.codes }} resources={l.resources?.map((r) => ({ id: r.id, label: r.label }))} can={{ viewAll: can.requestManage }} />;
          case "policies":
            return <ApprovalPoliciesPage {...base} roles={l.roles} users={l.users} depts={l.depts} targets={{ role: l.roles, permission: l.codes }} can={{ manage: can.requestManage }} />;
          case "emergency":
            return <EmergencyAccessPage {...base} me={me} targets={l.emergencyTargets ?? []} supervisors={l.users ?? []} maxMinutes={maxEmergencyMinutes} can={{ use: can.emergencyUse }} />;
          case "reviews":
            return <ReviewsPage {...base} roles={l.roles} users={l.users} depts={l.depts} resources={l.resources?.map((r) => ({ id: r.id, label: r.label }))} can={{ manage: can.reviewManage }} />;
          case "health":
            return <SecurityHealthPage {...base} rls={rls} />;
          case "tenants":
            return <TenantsPage {...base} users={l.users} quotaLabels={l.quotaLabels} can={{ manage: can.tenantManage }} />;
          case "packages":
            return <PackagesPage {...base} roles={l.roles} features={l.features} quotaLabels={l.quotaLabels} can={{ manage: can.packageManage }} />;
          case "platform-health":
            return <SecurityHealthPage {...base} scope="platform" />;
          default:
            return null;
        }
      }}
    />
  );
}
