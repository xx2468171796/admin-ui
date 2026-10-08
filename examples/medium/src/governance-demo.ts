/** Browser-only teaching adapter, never an authorization or compliance boundary. */
import type { AccessAdapter, AccessSnapshot, AuditAdapter, AuditQuery, AuditRecord } from '@adminui/react';
import { effectivePermissions } from '@adminui/react';
const key = 'adminui:starter:demo:governance:v1';
type State = { access: AccessSnapshot; audit: AuditRecord[] };
const permissions = [
  { id: 'access:manage', label: '管理角色与成员', group: '系统' },
  { id: 'audit:read', label: '查看日志', group: '系统' },
  { id: 'audit:export', label: '导出日志', group: '系统' },
  { id: 'users:update', label: '编辑用户', group: '用户' },
  { id: 'orders:update', label: '维护订单', group: '业务' },
];
function initial(): State {
  return { access: { permissions, roles: [
    { id: 'admin', name: '管理员', permissions: permissions.map(p => p.id), version: '1', protected: true },
    { id: 'viewer', name: '审计员', permissions: ['audit:read'], version: '1' },
  ], members: [
    { id: 'demo-admin', name: '演示管理员', roleIds: ['admin'], version: '1' },
    { id: 'demo-viewer', name: '演示审计员', roleIds: ['viewer'], version: '1' },
  ] }, audit: [] };
}
function read(): State {
  const raw = localStorage.getItem(key);
  if (!raw) return initial();
  const value = JSON.parse(raw) as State;
  if (!Array.isArray(value.access?.roles) || !Array.isArray(value.access?.members) || !Array.isArray(value.audit)) throw Error('演示存储格式损坏，请在浏览器存储中移除演示 key 后重新加载');
  return value;
}
function write(state: State) { localStorage.setItem(key, JSON.stringify(state)); window.dispatchEvent(new Event('adminui-demo-audit')); }
function event(action: string, target?: string, changes?: AuditRecord['changes'], result: AuditRecord['result'] = 'success'): AuditRecord {
  return { id: crypto.randomUUID(), actor: '演示管理员', action, target, changes, result, at: new Date().toISOString(), source: '浏览器演示', requestId: crypto.randomUUID() };
}
export function recordDemoAudit(action: string, target?: string, changes?: AuditRecord['changes'], result: AuditRecord['result'] = 'success') {
  const state = read(); state.audit.unshift(event(action, target, changes, result)); state.audit = state.audit.slice(0, 2000); write(state);
}
export function readDemoAudit() { return read().audit; }
function mutate(action: string, target: string, update: (state: State) => AuditRecord['changes']) {
  const state = read();
  try {
    const actor = state.access.members.find(m => m.id === 'demo-admin');
    if (!actor || !effectivePermissions(actor, state.access.roles).includes('access:manage')) throw Error('没有管理权限');
    const changes = update(state);
    if (!state.access.members.some(m => effectivePermissions(m, state.access.roles).includes('access:manage'))) throw Error('不能移除最后一个管理员');
    state.audit.unshift(event(action, target, changes)); state.audit = state.audit.slice(0, 2000); write(state);
  } catch (error) {
    // Discard all staged changes; append a failure to the last committed snapshot.
    recordDemoAudit(action, target, undefined, 'failed'); throw error;
  }
}
const stale = () => { throw Error('记录已被修改，请关闭弹窗并刷新后重新编辑'); };
export const demoAccessAdapter: AccessAdapter = {
  load: async () => read().access,
  saveRole: async role => mutate('保存角色', role.name, state => {
    const old = state.access.roles.find(r => r.id === role.id);
    if (role.id && (!old || old.version !== role.version)) stale();
    if (old?.protected) throw Error('受保护角色不能修改');
    if (!role.name.trim() || state.access.roles.some(r => r.id !== role.id && r.name === role.name.trim())) throw Error('角色名称不能为空或重复');
    if (role.permissions.some(id => !permissions.some(p => p.id === id))) throw Error('存在未知权限');
    const next = { ...role, name: role.name.trim(), id: old?.id ?? crypto.randomUUID(), version: String(Number(old?.version ?? 0) + 1), protected: false };
    state.access.roles = old ? state.access.roles.map(r => r.id === old.id ? next : r) : [...state.access.roles, next];
    return [{ field: '名称', before: old?.name ?? '无', after: next.name }, { field: '权限', before: old?.permissions.join(', ') ?? '无', after: next.permissions.join(', ') || '无' }];
  }),
  deleteRole: async role => mutate('删除角色', role.id, state => {
    const old = state.access.roles.find(r => r.id === role.id);
    if (!old || old.version !== role.version) stale();
    if (old!.protected || state.access.members.some(m => m.roleIds.includes(role.id))) throw Error('角色受保护或仍有成员');
    state.access.roles = state.access.roles.filter(r => r.id !== role.id);
    return [{ field: '角色', before: old!.name, after: '已删除' }];
  }),
  assignRoles: async member => mutate('成员授权', member.id, state => {
    const old = state.access.members.find(m => m.id === member.id);
    if (!old || old.version !== member.version) stale();
    if (member.roleIds.some(id => !state.access.roles.some(r => r.id === id))) throw Error('存在未知角色');
    state.access.members = state.access.members.map(m => m.id === member.id ? { ...m, roleIds: [...new Set(member.roleIds)], version: String(Number(m.version) + 1) } : m);
    return [{ field: '角色', before: old!.roleIds.join(', '), after: member.roleIds.join(', ') || '无' }];
  }),
};
function queryAudit(query: AuditQuery) {
  const rows = read().audit.filter(e => (!query.result || e.result === query.result) && (!query.from || e.at.slice(0, 10) >= query.from) && (!query.until || e.at.slice(0, 10) <= query.until) && [e.actor, e.action, e.target, e.requestId].join(' ').toLowerCase().includes(query.search.toLowerCase()));
  return { rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length };
}
export const demoAuditAdapter: AuditAdapter = {
  list: async query => queryAudit(query),
  exportPage: async query => { const { rows } = queryAudit(query); recordDemoAudit('导出审计日志', `当前页 ${rows.length} 条`); return rows; },
};
