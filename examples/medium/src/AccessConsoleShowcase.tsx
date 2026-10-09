import {
  AccessConsole,
  ACCESS_CONSOLE_CODES,
  type AccessApi,
  type AccessCatalogDto,
  type AccessSnapshot,
  type DeptDto,
  type DirectoryUser,
  type PostDto,
  type RoleDto,
} from "@adminui/react/access";

// 8.6.1 权限控制台（AccessConsole，中档）示例：一个只读的内存假服务端，只为看页面——部门 / 岗位 / 角色 / 人员授权 / 用户组 /
// 权限解释 / 授权审计都在页面流里贴边（左右分栏一条竖线、列表贴边、没有只放「?」的一行）。改动一律返回「演示只读」。
// 生产里用 createAccessApi({ baseUrl: "/api/qx" })，由 quanxian/fastify 提供。

const AT = "2026-10-09T09:00:00+08:00";
const dept = (id: string, name: string, parentId: string | null, sort: number, leaderIds: string[] = []): DeptDto => ({
  id, name, parentId, sort, leaderIds, path: parentId ? `/hq/${id}/` : `/${id}/`, status: "enabled", version: 1,
});
const DEPTS: DeptDto[] = [
  dept("hq", "集团总部", null, 1, ["u1"]),
  dept("sales", "大客户部", "hq", 2, ["u2"]),
  dept("direct", "直营组", "hq", 3, ["u3"]),
  dept("fin", "财务部", "hq", 4),
];
const POSTS: PostDto[] = [
  { id: "p-mgr", deptId: "sales", code: "mgr", name: "部门主管", sort: 1, status: "enabled", version: 1 },
  { id: "p-rep", deptId: "direct", code: "rep", name: "销售", sort: 2, status: "enabled", version: 1 },
];
const USERS: DirectoryUser[] = [
  { id: "u1", name: "管理员", deptIds: ["hq"], hint: "admin" },
  { id: "u2", name: "周经理", deptIds: ["sales"], hint: "部门主管" },
  { id: "u3", name: "小赵", deptIds: ["direct"], hint: "销售" },
  { id: "u4", name: "小孙", deptIds: ["sales"], hint: "销售" },
];
const role = (id: string, name: string, sort: number, extra: Partial<RoleDto> = {}): RoleDto => ({
  id, code: id, name, description: "", builtin: false, superuser: false, disabled: false, baseRoleId: null, grantable: [], sort, version: 1,
  permissions: { grants: { "customer:view": { scope: { tier: "dept" } } } }, updatedAt: AT, updatedBy: "u1", ...extra,
});
const ROLES: RoleDto[] = [
  role("admin", "系统管理员", 1, { builtin: true, superuser: true, description: "全部权限" }),
  role("leader", "部门主管", 2, { description: "管本部门客户" }),
  role("staff", "员工", 3, { description: "只看自己的客户" }),
];
const CATALOG: AccessCatalogDto = {
  resources: [{ id: "customer", label: "客户", group: "CRM", actions: ["view", "update", "export"] }],
  actions: [{ id: "view", label: "查看", scoped: true }, { id: "update", label: "编辑", scoped: true }, { id: "export", label: "导出" }],
  codes: [
    { code: "customer:view", label: "查看客户", group: "CRM", risk: "normal", grantable: true, adminOnly: false },
    { code: "customer:update", label: "编辑客户", group: "CRM", risk: "normal", grantable: true, adminOnly: false },
    { code: "customer:export", label: "导出客户", group: "CRM", risk: "high", grantable: true, adminOnly: false },
  ],
};
const SNAPSHOT: AccessSnapshot = { userId: "u1", roles: ["admin"], superuser: true, codes: Object.values(ACCESS_CONSOLE_CODES) };

const readOnly = () => Promise.reject(new Error("演示只读：这个示例不保存改动"));
const DEMO_API: AccessApi = {
  me: async () => SNAPSHOT,
  catalog: async () => CATALOG,
  listDepts: async () => DEPTS,
  deptTree: async () => [],
  createDept: readOnly,
  updateDept: readOnly,
  deleteDept: readOnly,
  setDeptLeaders: readOnly,
  listPosts: async () => POSTS,
  createPost: readOnly,
  updatePost: readOnly,
  deletePost: readOnly,
  getUserOrg: async (userId) => ({ userId, depts: (USERS.find((u) => u.id === userId)?.deptIds ?? []).map((deptId, i) => ({ deptId, primary: i === 0 })), postIds: [], groupIds: [], leads: [] }),
  setUserDepts: readOnly,
  setUserPosts: readOnly,
  listRoles: async () => ROLES,
  getRole: async (id) => ROLES.find((r) => r.id === id) ?? ROLES[0]!,
  createRole: readOnly,
  updateRole: readOnly,
  deleteRole: readOnly,
  listAssignments: async () => [],
  assign: readOnly,
  unassign: readOnly,
  listOverrides: async () => [],
  setOverride: readOnly,
  removeOverride: readOnly,
  listGroups: async () => [],
  createGroup: readOnly,
  updateGroup: readOnly,
  deleteGroup: readOnly,
  setGroupMembers: readOnly,
  listRecordGrants: async () => [],
  grantRecord: readOnly,
  revokeRecordGrant: readOnly,
  transferOwner: readOnly,
  effective: async () => [],
  explain: readOnly,
  viewAs: readOnly,
  viewAsGet: readOnly,
  listAudit: async () => [],
};

export function AccessConsoleShowcase({ active }: { active: boolean }) {
  return <AccessConsole api={DEMO_API} snapshot={SNAPSHOT} users={USERS} active={active} title="权限控制台" now={new Date(AT)} />;
}
