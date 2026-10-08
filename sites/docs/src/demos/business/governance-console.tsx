import { useState } from "react";
import {
  AccessManager, AuditLogPage, Tabs, effectivePermissions,
  type AccessAdapter, type AccessSnapshot, type AuditAdapter, type AuditRecord,
} from "@adminui/react";

// 小项目的权限与审计：AccessManager（角色、分组权限、成员角色）+ AuditLogPage（筛选、分页、变更前后）。
// 这里的 adapter 是内存里的假服务端：改角色、给成员授权都会写一条审计，切到「审计日志」就能看到。
// 真实项目的 adapter 调自己的接口；鉴权、版本比对、最后一个管理员、写审计都在服务端做。

const PERMISSIONS = [
  { id: "deal:read", label: "查看商机", group: "客户管理" }, { id: "deal:update", label: "编辑商机", group: "客户管理" },
  { id: "deal:export", label: "导出商机", group: "客户管理" }, { id: "ticket:handle", label: "处理工单", group: "客服" },
  { id: "access:manage", label: "管理角色与成员", group: "系统" }, { id: "audit:read", label: "查看审计日志", group: "系统" },
];
let access: AccessSnapshot = {
  permissions: PERMISSIONS,
  roles: [
    { id: "admin", name: "管理员", permissions: PERMISSIONS.map((p) => p.id), version: "1", protected: true },
    { id: "lead", name: "销售主管", permissions: ["deal:read", "deal:update", "deal:export"], version: "1" },
    { id: "rep", name: "销售代表", permissions: ["deal:read", "deal:update"], version: "1" },
    { id: "cs", name: "客服", permissions: ["deal:read", "ticket:handle"], version: "1" },
  ],
  members: [
    { id: "u01", name: "林晓", roleIds: ["admin", "lead"], version: "1" },
    { id: "u02", name: "陈一鸣", roleIds: ["rep"], version: "1" },
    { id: "u03", name: "王佳宁", roleIds: ["rep"], version: "1" },
    { id: "u05", name: "周可欣", roleIds: ["cs"], version: "1" },
  ],
};
let audit: AuditRecord[] = [
  { id: "a2", actor: "林晓", action: "导出商机", target: "当前页 50 条", result: "success", at: "2026-10-08T01:20:00Z", requestId: "req-7f3a" },
  { id: "a1", actor: "王佳宁", action: "成员授权", target: "周可欣", result: "denied", at: "2026-10-07T09:02:00Z", detail: "没有 access:manage" },
];
const log = (action: string, target: string, changes?: AuditRecord["changes"]) => {
  audit = [{ id: `a${Date.now()}`, actor: "林晓", action, target, changes, result: "success", at: new Date().toISOString(), source: "演示" }, ...audit];
};
const wait = () => new Promise((r) => setTimeout(r, 300));
const bump = (v: string) => String(Number(v) + 1);

const accessAdapter: AccessAdapter = {
  load: async () => { await wait(); return access; },
  saveRole: async (role) => {
    await wait();
    const old = access.roles.find((r) => r.id === role.id);
    if (old && old.version !== role.version) throw new Error("记录已被别人改过，请刷新后重试");
    const next = { ...role, id: old?.id ?? `r${Date.now()}`, version: bump(old?.version ?? "0") };
    access = { ...access, roles: old ? access.roles.map((r) => (r.id === old.id ? next : r)) : [...access.roles, next] };
    log("保存角色", next.name, [{ field: "权限", before: old?.permissions.join(", ") ?? "无", after: next.permissions.join(", ") || "无" }]);
  },
  deleteRole: async (role) => {
    await wait();
    if (access.members.some((m) => m.roleIds.includes(role.id))) throw new Error("还有成员在用这个角色，先把他们换到别的角色");
    access = { ...access, roles: access.roles.filter((r) => r.id !== role.id) };
    log("删除角色", role.name);
  },
  assignRoles: async (member) => {
    await wait();
    const old = access.members.find((m) => m.id === member.id);
    const members = access.members.map((m) => (m.id === member.id ? { ...member, version: bump(m.version) } : m));
    if (!members.some((m) => effectivePermissions(m, access.roles).includes("access:manage"))) throw new Error("不能移除最后一个管理员");
    access = { ...access, members };
    log("成员授权", member.name, [{ field: "角色", before: old?.roleIds.join(", ") ?? "", after: member.roleIds.join(", ") || "无" }]);
  },
};
const auditAdapter: AuditAdapter = {
  list: async (q) => {
    await wait();
    const rows = audit.filter((e) => (!q.result || e.result === q.result) && (!q.from || e.at.slice(0, 10) >= q.from) && (!q.until || e.at.slice(0, 10) <= q.until)
      && [e.actor, e.action, e.target ?? ""].join(" ").includes(q.search));
    return { rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length };
  },
};

export function Demo() {
  const [tab, setTab] = useState("access");
  return (
    <Tabs label="权限与审计" value={tab} onValueChange={setTab} items={[{ value: "access", label: "角色与成员" }, { value: "audit", label: "审计日志" }]}>
      {tab === "access" ? <AccessManager scope="northstar" adapter={accessAdapter} canManage /> : <AuditLogPage scope="northstar" adapter={auditAdapter} />}
    </Tabs>
  );
}
