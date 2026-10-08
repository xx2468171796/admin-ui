import type { AuditEvent } from './workflow-core.ts';

export type PermissionDefinition = { id: string; label: string; group: string };
export type AdminRole = { id: string; name: string; permissions: readonly string[]; version: string; protected?: boolean };
export type AdminMember = { id: string; name: string; roleIds: readonly string[]; version: string };
export type AccessSnapshot = { permissions: readonly PermissionDefinition[]; roles: readonly AdminRole[]; members: readonly AdminMember[] };
/** The host authenticates the actor and checks permissions on every operation. */
export type AccessAdapter = {
  load(signal: AbortSignal): Promise<AccessSnapshot>;
  saveRole(role: AdminRole, signal: AbortSignal): Promise<void>;
  deleteRole(role: AdminRole, signal: AbortSignal): Promise<void>;
  assignRoles(member: AdminMember, signal: AbortSignal): Promise<void>;
};
export type AuditRecord = AuditEvent & { result: 'success' | 'denied' | 'failed'; requestId?: string; source?: string };
export type AuditQuery = { search: string; result: '' | AuditRecord['result']; from: string; until: string; page: number; pageSize: number };
export type AuditAdapter = {
  list(query: AuditQuery, signal: AbortSignal): Promise<{ rows: readonly AuditRecord[]; total: number }>;
  /** Host authorizes and audits export. Return only the requested bounded page. */
  exportPage?(query: AuditQuery, signal: AbortSignal): Promise<readonly AuditRecord[]>;
};
export function effectivePermissions(member: AdminMember, roles: readonly AdminRole[]): string[] {
  return [...new Set(roles.filter(role => member.roleIds.includes(role.id)).flatMap(role => role.permissions))].sort();
}
/** Exact matching only: no implicit wildcard or administrator bypass. */
export function hasAdminPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission);
}
