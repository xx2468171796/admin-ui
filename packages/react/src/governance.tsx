"use client";
import { useId, useState } from 'react';
import { Button, Checkbox, Choice, Input } from './primitives.tsx';
import { Dialog, FormDialog, FormField } from './forms.tsx';
import { DatePicker } from './date-picker.tsx';
import { InlineAlert, PageHeader, ResourcePanel } from './layout.tsx';
import { DataTable } from './data.tsx';
import { AuditTimeline } from './operations.tsx';
import { useAdminResource } from './workflow-hooks.ts';
import { buildCsv, downloadCsv } from './reports.tsx';
import { effectivePermissions, type AccessAdapter, type AdminRole, type AdminMember, type AuditAdapter, type AuditQuery, type AuditRecord } from './governance-core.ts';
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export function AccessManager({ scope, adapter, canManage = false, active = true }: { scope: string; adapter: AccessAdapter; canManage?: boolean; active?: boolean }) {
  return <AccessManagerScope key={scope} scope={scope} adapter={adapter} canManage={canManage} active={active} />;
}
function AccessManagerScope({ scope, adapter, canManage, active }: { scope: string; adapter: AccessAdapter; canManage: boolean; active: boolean }) {
  const resource = useAdminResource(scope, signal => adapter.load(signal), 0, active);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [original, setOriginal] = useState('');
  const [member, setMember] = useState<AdminMember | null>(null);
  const [removing, setRemoving] = useState<AdminRole | null>(null);
  const fieldId = useId();
  const [rolePage, setRolePage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [size, setSize] = useState(10);
  const snapshot = resource.data;
  const editable = canManage && !resource.loading && !resource.error;
  const editRole = (value: AdminRole) => { setRole(value); setOriginal(JSON.stringify(value)); };
  const requireEdit = () => { if (!editable) throw Error('权限已变化或数据已过期，请刷新后重试'); };
  return <div className="aui-governance aui-workflow-stack">
    <PageHeader title="角色与权限" description="管理角色权限和成员授权；修改后以服务端返回结果为准。" actions={<Button disabled={!editable} onClick={() => editRole({ id: '', name: '', permissions: [], version: '' })}>新增角色</Button>} />
    {!canManage && <InlineAlert title="只读权限">当前账号不能修改角色或成员授权。</InlineAlert>}
    {resource.error && <InlineAlert tone="error" title="加载失败，当前数据可能已过期">{resource.error}</InlineAlert>}
    <div className="aui-workflow-bar"><Button variant="outline" disabled={resource.loading} onClick={() => void resource.refresh()}>刷新权限</Button></div>
    <ResourcePanel title="角色" count={snapshot?.roles.length}>
      <DataTable caption="Roles" pagination={{ mode: "page", page: rolePage, pageSize: size, total: snapshot?.roles.length ?? 0, onPageChange: setRolePage, onPageSizeChange: n => { setSize(n); setRolePage(1); setMemberPage(1); } }} rows={(snapshot?.roles ?? []).slice((rolePage - 1) * size, rolePage * size)} rowKey={r => r.id} loading={resource.loading} columns={[
        { key: 'name', minWidth: 150, title: '角色', render: r => <>{r.name}{r.protected ? '（受保护）' : ''}</> },
        { key: 'permissions', title: '权限数', numeric: true, render: r => r.permissions.length },
        { key: 'members', title: '成员数', numeric: true, render: r => snapshot?.members.filter(m => m.roleIds.includes(r.id)).length ?? 0 },
        { key: 'actions', title: '操作', kind: 'actions', render: r => <><Button variant="ghost" disabled={!editable || r.protected} onClick={() => editRole(r)}>编辑 {r.name}</Button><Button variant="ghost" disabled={!editable || r.protected || snapshot?.members.some(m => m.roleIds.includes(r.id))} onClick={() => setRemoving(r)}>删除 {r.name}</Button></> },
      ]} />
    </ResourcePanel>
    <ResourcePanel title="成员授权" count={snapshot?.members.length}>
      <DataTable caption="Members" pagination={{ mode: "page", page: memberPage, pageSize: size, total: snapshot?.members.length ?? 0, onPageChange: setMemberPage, onPageSizeChange: n => { setSize(n); setRolePage(1); setMemberPage(1); } }} rows={(snapshot?.members ?? []).slice((memberPage - 1) * size, memberPage * size)} rowKey={m => m.id} loading={resource.loading} columns={[
        { key: 'name', minWidth: 150, title: '成员', render: m => m.name },
        { key: 'roles', minWidth: 180, title: '角色', wrap: true, render: m => snapshot?.roles.filter(r => m.roleIds.includes(r.id)).map(r => r.name).join('、') || '无角色' },
        { key: 'effective', minWidth: 280, title: '有效权限', wrap: true, render: m => effectivePermissions(m, snapshot?.roles ?? []).map(id => snapshot?.permissions.find(p => p.id === id)?.label ?? id).join('、') || '无权限' },
        { key: 'actions', title: '操作', kind: 'actions', render: m => <Button variant="ghost" disabled={!editable} onClick={() => setMember(m)}>授权 {m.name}</Button> },
      ]} />
    </ResourcePanel>
    <FormDialog description="" open={role !== null} title={role?.id ? '编辑角色' : '新增角色'} dirty={!!role && JSON.stringify(role) !== original} onClose={() => setRole(null)} onSubmit={async () => {
      requireEdit(); if (!role?.name.trim()) throw Error('请填写角色名称');
      await adapter.saveRole({ ...role, name: role.name.trim() }, new AbortController().signal); await resource.refresh();
    }}>
      <FormField label="角色名称" htmlFor={fieldId} required><Input id={fieldId} value={role?.name ?? ''} onChange={e => setRole(r => r && ({ ...r, name: e.target.value }))} /></FormField>
      {[...new Set(snapshot?.permissions.map(p => p.group))].map(group => <fieldset className="aui-permission-group" key={group}><legend>{group}</legend><div className="aui-workflow-stack">{snapshot?.permissions.filter(p => p.group === group).map(p => <label className="aui-permission-option" key={p.id}><Checkbox aria-label={`${p.label} (${p.id})`} checked={role?.permissions.includes(p.id) ?? false} onCheckedChange={checked => setRole(r => r && ({ ...r, permissions: checked === true ? [...r.permissions, p.id] : r.permissions.filter(id => id !== p.id) }))} /><span>{p.label} ({p.id})</span></label>)}</div></fieldset>)}
    </FormDialog>
    <FormDialog description="" open={member !== null} title={`成员授权：${member?.name ?? ''}`} dirty={!!member && JSON.stringify(member) !== JSON.stringify(snapshot?.members.find(m => m.id === member.id))} onClose={() => setMember(null)} onSubmit={async () => { requireEdit(); if (!member) return; await adapter.assignRoles(member, new AbortController().signal); await resource.refresh(); }}>
      <p>保存后将改变此成员的访问范围。请保留至少一名可管理权限的管理员。</p>
      {snapshot?.roles.map(r => <label className="aui-permission-option" key={r.id}><Checkbox aria-label={r.name} checked={member?.roleIds.includes(r.id) ?? false} onCheckedChange={checked => setMember(m => m && ({ ...m, roleIds: checked === true ? [...m.roleIds, r.id] : m.roleIds.filter(id => id !== r.id) }))} /><span>{r.name}</span></label>)}
    </FormDialog>
    <FormDialog description="" open={removing !== null} title="删除角色" destructive submitLabel="确认删除角色" onClose={() => setRemoving(null)} onSubmit={async () => { requireEdit(); if (!removing) return; await adapter.deleteRole(removing, new AbortController().signal); await resource.refresh(); }}><p>确认删除「{removing?.name}」？已分配成员的角色必须先解除授权。</p></FormDialog>
  </div>;
}

export function AuditLogPage({ scope, adapter, active = true }: { scope: string; adapter: AuditAdapter; active?: boolean }) {
  return <AuditLogScope key={scope} scope={scope} adapter={adapter} active={active} />;
}
function AuditLogScope({ scope, adapter, active }: { scope: string; adapter: AuditAdapter; active: boolean }) {
  const [query, setQuery] = useState<AuditQuery>({ search: '', result: '', from: '', until: '', page: 1, pageSize: 20 });
  const [detail, setDetail] = useState<AuditRecord | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const invalid = !!query.from && !!query.until && query.from > query.until;
  const resource = useAdminResource(JSON.stringify([scope, query]), signal => adapter.list(query, signal), 0, active && !invalid);
  const change = (patch: Partial<AuditQuery>) => setQuery(q => ({ ...q, ...patch, page: 1 }));
  const labels = { success: '成功', denied: '拒绝', failed: '失败' };
  return <div className="aui-governance aui-workflow-stack">
    <PageHeader title="审计日志" description="按操作、对象、结果和时间检索，查看变更前后及请求标识。" />
    {(resource.error || error || invalid) && <InlineAlert tone="error" title="日志未能更新">{invalid ? '开始时间不能晚于结束时间' : error || resource.error}</InlineAlert>}
    <ResourcePanel title="操作记录" count={resource.data?.total} filters={<div className="aui-workflow-bar aui-audit-filters">
      <Input aria-label="检索日志" placeholder="操作人、动作、对象、请求 ID" value={query.search} onChange={e => change({ search: e.target.value })} />
      <div className="aui-audit-field"><span aria-hidden="true">操作结果</span><Choice label="操作结果" value={query.result || 'all'} options={[{ value: 'all', label: '全部结果' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} onChange={v => change({ result: v === 'all' ? '' : v as AuditQuery['result'] })} /></div>
      <label>开始日期（UTC）<DatePicker aria-label="日志开始日期" clearable value={query.from} max={query.until || undefined} onChange={from => change({ from })} /></label>
      <label>结束日期（UTC）<DatePicker aria-label="日志结束日期" clearable value={query.until} min={query.from || undefined} onChange={until => change({ until })} /></label>
      <Button variant="outline" onClick={() => change({ search: '', result: '', from: '', until: '' })}>清空日志筛选</Button>
      <Button variant="outline" disabled={invalid || resource.loading} onClick={() => void resource.refresh()}>刷新日志</Button>
      {adapter.exportPage && <Button disabled={invalid || exporting || resource.loading || !!resource.error} onClick={async () => {
        if (exporting) return; setExporting(true); setError('');
        try { const rows = await adapter.exportPage!(query, new AbortController().signal); downloadCsv('audit-page', buildCsv(rows, (['id', 'actor', 'action', 'target', 'at', 'result', 'requestId', 'detail'] as const).map(key => ({ title: key, value: r => r[key] ?? '' })))); }
        catch (e) { setError(e instanceof Error ? e.message : '导出失败'); } finally { setExporting(false); }
      }}>{exporting ? '导出中…' : '导出当前页日志'}</Button>}
    </div>}>
      <DataTable<AuditRecord> caption="Audit" rows={invalid ? [] : resource.data?.rows ?? []} rowKey={r => r.id} loading={!invalid && resource.loading} columns={[
        { key: 'at', minWidth: 170, title: '时间（UTC）', render: r => r.at },
        { key: 'actor', minWidth: 130, title: '操作人', render: r => r.actor },
        { key: 'action', minWidth: 280, title: '动作', wrap: true, render: r => r.action },
        { key: 'target', minWidth: 180, title: '对象', wrap: true, render: r => r.target ?? '—' },
        { key: 'result', minWidth: 90, title: '结果', render: r => labels[r.result] },
        { key: 'actions', title: '详情', kind: 'actions', render: r => <Button variant="ghost" onClick={() => setDetail(r)}>查看日志 {r.id}</Button> },
      ]} pagination={{ mode: 'page', page: query.page, pageSize: query.pageSize, total: resource.data?.total ?? 0, onPageChange: page => setQuery(q => ({ ...q, page })), onPageSizeChange: pageSize => change({ pageSize }) }} />
    </ResourcePanel>
    <Dialog open={detail !== null} title="日志详情" onClose={() => setDetail(null)}>{detail && <><p>结果：{labels[detail.result]} · 来源：{detail.source ?? '—'}</p><p>请求 ID：{detail.requestId ?? '—'}</p><AuditTimeline events={[detail]} /></>}</Dialog>
  </div>;
}
