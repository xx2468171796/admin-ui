/**
 * Demo data for the 业务组件 family: a deal record of 北辰云 (record detail) and the module permission catalog of a
 * fictional workspace (access). Everything is invented; the record reuses customers and people from demo-data.ts.
 */
import { BookOpen, FileText, LayoutGrid, Shield, Upload, User, Users } from "lucide-react";
import type { CommentItem, RecordDetailSectionSeed, RecordField, RecordKeyNumber, StagePathStep } from "@adminui/react";
import type { EffectiveModule, ModuleAccessDef, ModuleGrants, OrgNode, PermissionImpact } from "@adminui/react/access";
import { CUSTOMERS, DEPARTMENTS, formatAmount, personName } from "./demo-data";

// ---------------------------------------------------------------- record detail: a deal

export type Deal = {
  id: string;
  name: string;
  customer: string;
  owner: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  industry: string;
  seats: number;
  need: string;
  amount: number;
  winRate: number;
  closedAmount: string;
  closedOn: string;
  lostReason: string;
  code: string;
  created: string;
  updated: string;
};

const first = CUSTOMERS[0];
const second = CUSTOMERS[1];

export const DEALS: Deal[] = [
  {
    id: "D-2026-0142", name: `${first?.name ?? "远航精密制造"} · 年度订阅`, customer: first?.name ?? "远航精密制造", owner: "u02",
    contact: "郭立新", phone: "138 0000 0142", email: "guo.lixin@example.com", city: first?.city ?? "上海", industry: first?.industry ?? "制造",
    seats: 120, need: "3 个工厂统一报工和设备巡检；先上线上海厂，11 月底前要能用；预算在年度 IT 计划里。", amount: 286_000, winRate: 40,
    closedAmount: "", closedOn: "", lostReason: "", code: "D-2026-0142", created: "陈一鸣 建于 9月28日 14:02", updated: "陈一鸣 改于 今天 09:41",
  },
  {
    id: "D-2026-0157", name: `${second?.name ?? "青禾教育"} · 校区扩容`, customer: second?.name ?? "青禾教育", owner: "u03",
    contact: "苏晴", phone: "139 0000 0157", email: "", city: second?.city ?? "杭州", industry: second?.industry ?? "教育",
    seats: 60, need: "新开两个校区，想先试用 30 天。", amount: 68_000, winRate: 20,
    closedAmount: "", closedOn: "", lostReason: "", code: "D-2026-0157", created: "王佳宁 建于 10月3日 10:20", updated: "王佳宁 改于 昨天 16:05",
  },
];

/** The deal's stages: exits (输单 / 作废) sit in the 「更多」 menu, not in the path. */
export const DEAL_STEPS: StagePathStep[] = [
  { id: "lead", label: "线索" }, { id: "qualified", label: "已确认需求" }, { id: "proposal", label: "方案报价" },
  { id: "negotiation", label: "商务谈判" }, { id: "won", label: "赢单" },
  { id: "lost", label: "输单", kind: "lost" }, { id: "void", label: "作废", kind: "void" },
];
/** Days spent in each stage so far (the current one counts up). */
export const DEAL_DAYS: Record<string, number> = { lead: 2, qualified: 5, proposal: 3 };

const text = (key: keyof Deal) => (d: Deal) => String(d[key] ?? "");

/** Every field the detail can show (sections pick them by key). */
export const DEAL_FIELDS: RecordField<Deal>[] = [
  { key: "contact", label: "联系人", value: text("contact") },
  { key: "phone", label: "手机", value: text("phone"), copy: true, tel: (d) => d.phone || null, description: "联系人本人的手机" },
  { key: "email", label: "邮箱", value: text("email"), copy: true },
  { key: "city", label: "城市", value: text("city") },
  { key: "industry", label: "行业", value: text("industry") },
  { key: "seats", label: "席位数", value: (d) => `${d.seats} 个` },
  { key: "need", label: "需求说明", value: text("need"), full: true },
  { key: "closedAmount", label: "成交金额", value: text("closedAmount") },
  { key: "closedOn", label: "成交日期", value: text("closedOn"), edit: () => null, lockedReason: "赢单后才能填" },
  { key: "lostReason", label: "输单原因", value: text("lostReason") },
  { key: "code", label: "编号", value: text("code"), copy: true, mono: true },
  { key: "owner", label: "负责人", value: (d) => personName(d.owner) },
  { key: "created", label: "创建", value: text("created") },
  { key: "updated", label: "最后修改", value: text("updated") },
];

/** Starting section cards (the company default before anybody rearranges). */
export const DEAL_SECTIONS: RecordDetailSectionSeed[] = [
  { id: "contact", title: "联系方式", fields: ["contact", "phone", "email", "city"] },
  { id: "needs", title: "需求", fields: ["industry", "seats", "need"] },
  { id: "close", title: "成交", fields: ["closedAmount", "closedOn", "lostReason"] },
  { id: "system", title: "系统信息", fields: ["code", "owner", "created", "updated"], collapsed: true },
];

export const dealKeyNumbers = (d: Deal): RecordKeyNumber[] => [
  { key: "amount", label: "预计金额", value: formatAmount(d.amount), hint: `赢率 ${d.winRate}%` },
  { key: "next", label: "下次跟进", value: "10月10日", hint: "周六 · 2 天后", tone: "attention" },
  { key: "last", label: "最后跟进", value: "今天 09:40", hint: `电话 · ${personName(d.owner)}` },
  { key: "count", label: "跟进次数", value: 4, hint: "建档 10 天" },
];

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export type FollowUp = { id: string; at: string; who: string; what: string; text: string };
export const FOLLOW_UPS: FollowUp[] = [
  { id: "f1", at: ago(2), who: "陈一鸣", what: "电话 · 方案报价", text: "把报价单发给郭总，他说下周一和财务一起过；希望首年席位按 100 个算。" },
  { id: "f2", at: ago(2), who: "陈一鸣", what: "把阶段改成 方案报价", text: "" },
  { id: "f3", at: ago(50), who: "吴昊", what: "拜访 · 需求确认", text: "去上海厂看了产线，报工终端要支持离线；巡检要拍照上传。" },
];

export const FIRST_COMMENTS: CommentItem[] = [
  { id: "m1", author: { id: "u01", name: "林晓" }, createdAt: ago(3), body: "@陈一鸣 报价前先给我看一下，首年可以送实施培训。", mentions: [{ id: "u02", name: "陈一鸣" }] },
];

// ---------------------------------------------------------------- access: modules of a workspace

export const SCOPE_LABELS = { own: "本人", dept_tree: "部门及下级" } as const;

export const ACCESS_MODULES: ModuleAccessDef[] = [
  {
    id: "crm", label: "客户管理", description: "客户、商机、跟进", icon: <Users />,
    levels: [
      { id: "viewer", actions: ["deal:read"] },
      { id: "member_own", actions: ["deal:read", "deal:create", "deal:update", "import:import"] },
      { id: "member_all", actions: ["deal:read", "deal:create", "deal:update", "import:import", "deal:transfer"] },
      { id: "admin", hint: "含字段设置、删除", actions: ["deal:read", "deal:create", "deal:update", "deal:delete", "deal:export", "deal:transfer", "import:import", "schema:field"] },
    ],
    resources: [
      { id: "deal", label: "商机", hint: "每一条商机记录", icon: <LayoutGrid />, scoped: true, actions: [
        { key: "deal:read", label: "看" }, { key: "deal:create", label: "加" }, { key: "deal:update", label: "改" }, { key: "deal:delete", label: "删" },
        { key: "deal:transfer", label: "转交" }, { key: "deal:export", label: "导出", risk: "high", stepUp: true },
      ] },
      { id: "import", label: "导入", hint: "从 Excel / CSV 加记录", icon: <Upload />, actions: [{ key: "import:import", label: "导入商机" }] },
      { id: "field", label: "字段", hint: "每列谁能看、谁能改", icon: <FileText />, actions: [], fieldsNote: "下面是「商机」表", fields: [
        { id: "amount", label: "预计金额" }, { id: "phone", label: "手机", defaultMode: "read" }, { id: "cost", label: "成本价", defaultMode: "hidden" },
      ] },
      { id: "schema", label: "字段设置", icon: <FileText />, actions: [{ key: "schema:field", label: "加 / 改字段", minLevel: "admin" }] },
    ],
  },
  {
    id: "kb", label: "知识库", description: "空间、页面、评论", icon: <BookOpen />, scopeNote: "按空间成员决定",
    levels: [
      { id: "viewer", actions: ["page:read", "page:comment"] },
      { id: "member_all", actions: ["page:read", "page:comment", "page:edit"] },
      { id: "admin", actions: ["page:read", "page:comment", "page:edit", "space:manage"], grantable: "你自己没有「知识库 · 管理员」，不能授给别人" },
    ],
    resources: [
      { id: "page", label: "页面", icon: <FileText />, actions: [{ key: "page:read", label: "看" }, { key: "page:comment", label: "评论" }, { key: "page:edit", label: "改" }] },
      { id: "space", label: "空间", icon: <BookOpen />, actions: [{ key: "space:manage", label: "管空间", minLevel: "admin" }] },
    ],
  },
  { id: "tickets", label: "工单", description: "客户工单、服务记录", icon: <LayoutGrid />, levels: [], resources: [], unavailable: { label: "套餐不含", action: { label: "看套餐", onSelect: () => undefined } } },
  { id: "access", label: "权限管理", description: "角色、个人加减", icon: <Shield />, section: "system", levels: [{ id: "viewer", actions: ["role:read"] }, { id: "admin", actions: ["role:read", "role:edit"] }], resources: [] },
  {
    id: "org", label: "组织管理", description: "成员、部门", icon: <User />, section: "system",
    levels: [{ id: "viewer", actions: ["member:read"], defaultScope: "dept_tree" }, { id: "admin", actions: ["member:read", "member:edit"] }],
    resources: [{ id: "member", label: "成员", icon: <User />, scoped: true, actions: [{ key: "member:read", label: "看" }, { key: "member:edit", label: "改", minLevel: "admin" }] }],
  },
];

/** Role 「销售主管」 as saved, and a draft with a few changes (so the change bar and the diff have content). */
export const LEAD_SAVED: ModuleGrants = {
  crm: { level: "member_own", pending: ["deal:transfer"] },
  kb: { level: "viewer" },
  access: { level: "none" },
  org: { level: "none" },
};
export const LEAD_DRAFT: ModuleGrants = {
  ...LEAD_SAVED,
  crm: { level: "member_all", scope: "dept_tree", add: ["deal:export"], pending: ["deal:transfer"], fields: { amount: { read: true, write: false } } },
  org: { level: "viewer", scope: null },
};

export const LEAD_IMPACT: PermissionImpact = {
  total: 3,
  people: [
    { id: "u02", name: "陈一鸣", hint: "华东销售组", gains: ["客户管理 能看、能改部门及下级的商机（约多 420 条）", { label: "导出商机", risk: true }, "组织管理 只看"], losses: [] },
    { id: "u04", name: "赵思远", hint: "华南销售组", gains: ["客户管理 能看、能改部门及下级的商机（约多 180 条）", "组织管理 只看"], losses: [] },
    { id: "u01", name: "林晓", hint: "销售部 · 总监", gains: [], losses: [], unchanged: ["她另有角色「销售总监」，这些权限都已经有了"] },
  ],
};

/** The department tree for 「指定部门…」. */
const subtree = (parent: string | null): OrgNode[] =>
  DEPARTMENTS.filter((d) => d.parent === parent).map((d) => {
    const children = subtree(d.id);
    return children.length ? { id: d.id, label: d.name, children } : { id: d.id, label: d.name };
  });
export const ORG_TREE: OrgNode[] = subtree(null);

export const EFFECTIVE_PEOPLE = [
  { id: "u02", name: "陈一鸣", hint: "华东销售组 · 2 个角色", group: "这个角色的人 · 3" },
  { id: "u04", name: "赵思远", hint: "华南销售组", group: "这个角色的人 · 3" },
  { id: "u05", name: "周可欣", hint: "客户成功部 · 个人加 1", group: "最近看过" },
];

export const EFFECTIVE_MODULES: EffectiveModule[] = [
  {
    id: "crm", label: "客户管理", hint: "有 6 项 · 没有 2 项", icon: <Users />, level: "member_all", scope: "dept_tree",
    sources: [{ kind: "role", label: "角色·销售主管「成员·按范围看」" }, { kind: "personal_add", label: "个人加：导入商机", expiresAt: "10-31" }, { kind: "personal_remove", label: "个人减：删商机" }],
    rows: [
      { code: "crm:deal:read", label: "看商机", allowed: true, scope: { tier: "dept_tree" }, sources: [{ kind: "role", label: "销售主管（档位自带）" }], blocks: [] },
      { code: "crm:deal:export", label: "导出商机", allowed: true, risk: "high", scope: { tier: "dept_tree" }, sources: [{ kind: "role", label: "销售主管（细调加的）" }], blocks: [] },
      { code: "crm:import:import", label: "导入商机", allowed: true, sources: [{ kind: "personal", label: "林晓加的", expiresAt: "2026-10-31" }], blocks: [] },
      { code: "crm:deal:delete", label: "删商机", allowed: false, sources: [], blocks: [{ kind: "denied", label: "个人减", detail: "林晓 10-02：误删过商机" }] },
    ],
  },
  { id: "kb", label: "知识库", hint: "按空间再细分", icon: <BookOpen />, level: "viewer", scopeText: "按空间成员", sources: [{ kind: "role", label: "角色·销售主管「只看」" }] },
  { id: "tickets", label: "工单", hint: "未开通", icon: <LayoutGrid />, level: "none", sources: [{ kind: "unavailable", label: "套餐不含" }] },
  { id: "org", label: "组织管理", hint: "系统管理", icon: <User />, level: "viewer", scope: "dept_tree", sources: [{ kind: "role", label: "角色·销售主管「只看」" }] },
];
