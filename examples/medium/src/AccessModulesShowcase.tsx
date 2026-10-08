import { useMemo, useState } from "react";
import { Copy, Eye, FileText, Inbox, JapaneseYen, KeyRound, LayoutGrid, Search, Settings, Share2, Shield, Tag, Type, Upload, User, Users } from "lucide-react";
import { Button, ListDetailLayout, PageBody, PageHeader, Panel, SelectList, Tabs, useNotify } from "@adminui/react";
import {
  EffectiveAccessView,
  ModulePermissionEditor,
  PermissionDiff,
  diffModuleGrants,
  pendingCount,
  type EffectiveModule,
  type ModuleAccessDef,
  type ModuleGrants,
  type PermissionImpact,
} from "@adminui/react/access";

// 权限按模块组织（演示 A1–A6）：角色「销售主管」的模块权限、集团下发的「销售代表」（只读）、
// 保存前的改动和影响、「预览 / 诊断」。模块清单、角色值、影响、诊断都是演示数据；真实项目由服务端给（目录 / 试算 / 诊断接口）。
const SCOPE_LABELS = { own: "本人", dept_tree: "部门及下级" } as const;

const MODULES: ModuleAccessDef[] = [
  {
    id: "bitable",
    label: "多维表格",
    description: "表格、视图、表单、看板",
    icon: <LayoutGrid />,
    levels: [
      { id: "viewer", actions: ["record:read", "view:read"] },
      { id: "member_own", actions: ["record:read", "record:create", "record:update", "import:import", "view:read", "view:personal", "share:colleague"] },
      { id: "member_all", actions: ["record:read", "record:create", "record:update", "record:bulk_delete", "import:import", "view:read", "view:personal", "share:colleague"] },
      { id: "admin", hint: "含表结构、回收站、删表", actions: ["record:read", "record:create", "record:update", "record:delete", "record:export", "record:bulk_delete", "import:import", "view:read", "view:personal", "view:update", "schema:field", "schema:drop", "share:colleague", "share:public"] },
    ],
    resources: [
      { id: "record", label: "记录", hint: "表里的每一行", icon: <LayoutGrid />, scoped: true, actions: [
        { key: "record:read", label: "看" }, { key: "record:create", label: "加" }, { key: "record:update", label: "改" }, { key: "record:delete", label: "删" },
        { key: "record:export", label: "导出", risk: "high", stepUp: true }, { key: "record:bulk_delete", label: "批量删除", risk: "high" },
      ] },
      { id: "import", label: "导入", hint: "从 Excel / CSV 加记录", icon: <Upload />, actions: [{ key: "import:import", label: "导入记录" }] },
      { id: "view", label: "视图", hint: "表格、看板、日历…", icon: <Eye />, actions: [{ key: "view:read", label: "看共享视图" }, { key: "view:personal", label: "建个人视图" }, { key: "view:update", label: "改共享视图" }] },
      { id: "field", label: "字段", hint: "每列谁能看、谁能改", icon: <FileText />, actions: [], fieldsNote: "按表设置 · 下面是「客户」表", fields: [
        { id: "name", label: "客户名称", icon: <User /> }, { id: "deal", label: "成交价", icon: <JapaneseYen /> },
        { id: "phone", label: "手机", icon: <KeyRound />, defaultMode: "read" }, { id: "floor", label: "底价", icon: <JapaneseYen />, defaultMode: "hidden" },
      ] },
      { id: "schema", label: "表结构", hint: "加字段、改字段、删表", icon: <Settings />, actions: [{ key: "schema:field", label: "改字段", minLevel: "admin" }, { key: "schema:drop", label: "删表", risk: "high", minLevel: "admin" }] },
      { id: "share", label: "分享", hint: "对外链接、公开表单", icon: <Share2 />, actions: [{ key: "share:colleague", label: "分享给同事" }, { key: "share:public", label: "对外公开链接", risk: "high", stepUp: true }] },
    ],
  },
  {
    id: "kb",
    label: "知识库",
    description: "空间、页面、评论",
    icon: <FileText />,
    scopeNote: "按空间成员决定",
    levels: [
      { id: "viewer", actions: ["page:read", "page:comment"] },
      { id: "member_all", actions: ["page:read", "page:comment", "page:edit", "space:create"] },
      { id: "admin", actions: ["page:read", "page:comment", "page:edit", "space:create", "space:manage"], grantable: "你自己没有「知识库 · 管理员」，不能授给别人" },
    ],
    resources: [
      { id: "page", label: "页面", icon: <FileText />, actions: [{ key: "page:read", label: "看" }, { key: "page:comment", label: "评论" }, { key: "page:edit", label: "改" }] },
      { id: "space", label: "空间", icon: <Inbox />, actions: [{ key: "space:create", label: "建空间" }, { key: "space:manage", label: "管空间", minLevel: "admin" }] },
    ],
  },
  { id: "crm", label: "CRM", description: "客户、商机、跟进", icon: <Users />, levels: [], resources: [], unavailable: { label: "本公司未开通", action: { label: "去开通", onSelect: () => undefined } } },
  { id: "line", label: "LINE 客服", description: "AI 客服、会话、质检", icon: <Inbox />, levels: [], resources: [], unavailable: { label: "套餐不含", action: { label: "看套餐", onSelect: () => undefined } } },
  {
    id: "memo",
    label: "示例便签",
    description: "演示模块 · 便签与提醒",
    icon: <Tag />,
    levels: [
      { id: "viewer", actions: ["memo:read"] },
      { id: "member_own", actions: ["memo:read", "memo:create", "memo:update"] },
      { id: "member_all", actions: ["memo:read", "memo:create", "memo:update", "memo:delete"] },
      { id: "admin", actions: ["memo:read", "memo:create", "memo:update", "memo:delete", "remind:create"] },
    ],
    resources: [
      { id: "memo", label: "便签", icon: <Tag />, scoped: true, actions: [{ key: "memo:read", label: "看" }, { key: "memo:create", label: "加" }, { key: "memo:update", label: "改" }, { key: "memo:delete", label: "删" }] },
      { id: "remind", label: "提醒", icon: <Type />, actions: [{ key: "remind:create", label: "设提醒" }] },
    ],
  },
  { id: "perm", label: "权限管理", description: "角色、个人加减、预览 / 诊断", icon: <Shield />, section: "system", levels: [{ id: "viewer", actions: ["role:read"] }, { id: "admin", actions: ["role:read", "role:edit"] }], resources: [] },
  {
    id: "org",
    label: "组织管理",
    description: "成员、部门、岗位",
    icon: <User />,
    section: "system",
    levels: [{ id: "viewer", actions: ["member:read"], defaultScope: "dept_tree" }, { id: "admin", actions: ["member:read", "member:edit"] }],
    resources: [{ id: "member", label: "成员", icon: <User />, scoped: true, actions: [{ key: "member:read", label: "看" }, { key: "member:edit", label: "改", minLevel: "admin" }] }],
  },
];

const SAVED: ModuleGrants = {
  bitable: { level: "member_own", pending: ["record:bulk_delete"] },
  kb: { level: "viewer" },
  memo: { level: null, scope: "own", raw: ["memo:read", "memo:create", "memo:update", "remind:create"] },
  perm: { level: "none" },
  org: { level: "none" },
};
const DRAFT: ModuleGrants = {
  ...SAVED,
  bitable: { level: "member_all", scope: "dept_tree", add: ["record:export"], mute: ["import:import"], pending: ["record:bulk_delete"], fields: { deal: { read: true, write: false } } },
  org: { level: "viewer", scope: null },
};
const GROUP_ROLE: ModuleGrants = {
  bitable: { level: "member_own", add: ["record:export"] },
  kb: { level: "viewer" },
  memo: { level: "member_own" },
};

const ROLES = [
  { key: "lead", title: "销售主管", meta: "3 人", group: "本公司", icon: <Users /> },
  { key: "sales", title: "销售", meta: "12 人", group: "本公司", icon: <Users /> },
  { key: "rep", title: "销售代表", meta: "8 人", group: "来自集团 · 只读", icon: <KeyRound /> },
];

const IMPACT: PermissionImpact = {
  total: 3,
  people: [
    { id: "w", name: "小王", hint: "销售一部 · 一组", gains: ["多维表格 能看、能改部门及下级的记录（约多 1,180 条）", { label: "导出记录", risk: true }, "组织管理 只看"], losses: [], unchanged: [{ label: "导入记录", note: "他有个人加（到 10-31），去掉角色里的不影响他" }] },
    { id: "l", name: "小李", hint: "销售二部 · 刚调过去", gains: ["多维表格 能看、能改部门及下级的记录（约多 640 条）", "导出记录", "组织管理 只看"], losses: [{ label: "导入记录", note: "只有这个角色给过他" }] },
    { id: "z", name: "周经理", hint: "销售一部 · 经理", gains: [], losses: [], unchanged: ["他另有角色「销售总监」，这些权限都已经有了"] },
  ],
};

const PEOPLE = [
  { id: "z", name: "周经理", hint: "销售一部 · 2 个角色", group: "这个角色的人 · 3" },
  { id: "w", name: "小王", hint: "销售一部 · 加 1 减 1", group: "这个角色的人 · 3" },
  { id: "l", name: "小李", hint: "销售二部", group: "这个角色的人 · 3" },
  { id: "c", name: "陈会计", hint: "财务部", group: "最近看过" },
];
const EFFECTIVE: EffectiveModule[] = [
  {
    id: "bitable", label: "多维表格", hint: "有 14 项 · 没有 3 项", icon: <LayoutGrid />, level: "member_all", scope: "dept_tree",
    sources: [
      { kind: "role", label: "角色·销售主管「成员·按范围看」" }, { kind: "group_role", label: "集团角色·销售代表「只看自己的」" },
      { kind: "personal_add", label: "个人加：导入记录", expiresAt: "10-31" }, { kind: "personal_remove", label: "个人减：删记录" },
    ],
    rows: [
      { code: "bitable:record:read", label: "看记录", allowed: true, scope: { tier: "dept_tree" }, sources: [{ kind: "role", label: "销售主管（档位自带）" }], blocks: [] },
      { code: "bitable:record:update", label: "改记录", allowed: true, scope: { tier: "dept_tree" }, sources: [{ kind: "role", label: "销售主管（档位自带）" }], blocks: [] },
      { code: "bitable:record:export", label: "导出记录", allowed: true, risk: "high", scope: { tier: "dept_tree" }, sources: [{ kind: "role", label: "销售主管（细调加的）" }], blocks: [] },
      { code: "bitable:record:import", label: "导入记录", allowed: true, sources: [{ kind: "personal", label: "周经理加的", expiresAt: "2026-10-31" }], blocks: [] },
      { code: "bitable:record:delete", label: "删记录", allowed: false, sources: [], blocks: [{ kind: "denied", label: "个人减", detail: "周经理 10-02：误删过客户" }] },
      { code: "bitable:record:bulk_delete", label: "批量删除", allowed: false, risk: "high", sources: [], blocks: [{ kind: "not_granted", label: "待确认", detail: "新版本新增，没人确认给" }] },
    ],
  },
  { id: "kb", label: "知识库", hint: "按空间再细分", icon: <FileText />, level: "viewer", scopeText: "按空间成员", sources: [{ kind: "role", label: "角色·销售主管「只看」" }, { kind: "group_role", label: "集团角色·销售代表「只看」" }] },
  { id: "memo", label: "示例便签", hint: "对不上任何一档", icon: <Tag />, level: null, scope: "own", sources: [{ kind: "role", label: "角色·销售主管「自定义」" }, { kind: "group_role", label: "集团角色·销售代表「只看自己的」" }] },
  { id: "crm", label: "CRM", hint: "未开通", icon: <Users />, level: "none", sources: [{ kind: "unavailable", label: "本公司未开通" }] },
  { id: "org", label: "组织管理", hint: "系统管理", icon: <User />, level: "viewer", scope: "dept_tree", sources: [{ kind: "role", label: "角色·销售主管「只看」" }] },
  { id: "perm", label: "权限管理", hint: "系统管理", icon: <Shield />, level: "none", sources: [{ kind: "none", label: "没有哪个角色给" }] },
];

export function AccessModulesShowcase() {
  const notify = useNotify();
  const [role, setRole] = useState("lead");
  const [tab, setTab] = useState("modules");
  const [saved, setSaved] = useState<ModuleGrants>(SAVED);
  const [draft, setDraft] = useState<ModuleGrants>(DRAFT);
  const [confirm, setConfirm] = useState(false);
  const [person, setPerson] = useState("w");
  const group = role === "rep";
  const changes = useMemo(() => diffModuleGrants(MODULES, saved, draft, { scope: SCOPE_LABELS }), [saved, draft]);
  const roleName = ROLES.find((r) => r.key === role)?.title ?? "";
  return (
    <PageBody>
      <PageHeader title="权限按模块" description="角色页「模块权限」：每个模块一行（档位 + 能看到的数据 + 细调），保存前看改动和影响；「预览 / 诊断」看一个人每个模块的最终权限和来源。演示数据。" />
      <ListDetailLayout listWidth={220} list={<SelectList label="角色" items={ROLES} selected={role} onSelect={setRole} />}>
        <Panel
          flush
          title={roleName}
          count={group ? "来自集团 · 只读 · 本公司 8 人在用" : "本公司角色 · 3 人：周经理、小王、小李"}
          actions={group ? undefined : <Button size="sm" variant="outline"><Copy />复制</Button>}
        >
          <Tabs
            label="角色分区"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "modules", label: "模块权限", icon: <Shield />, ...(pendingCount(group ? GROUP_ROLE : draft) ? { count: pendingCount(group ? GROUP_ROLE : draft), countTone: "attention" as const } : {}) },
              { value: "preview", label: "预览 / 诊断", icon: <Eye /> },
            ]}
          >
            {tab === "modules" ? (
              group ? (
                <ModulePermissionEditor
                  modules={MODULES}
                  value={GROUP_ROLE}
                  scopeLabels={SCOPE_LABELS}
                  roleName={roleName}
                  readOnly={{ title: "来自集团 · 只读", message: "这个角色由 Acme 集团统一维护，集团改了会自动同步到这里。本公司要调整：复制成本公司角色再改，或给个人单独加 / 减。", onCopy: () => notify("已复制成「销售代表（副本）」", "success") }}
                />
              ) : (
                <ModulePermissionEditor
                  modules={MODULES}
                  value={draft}
                  savedValue={saved}
                  onChange={setDraft}
                  scopeLabels={SCOPE_LABELS}
                  roleName={roleName}
                  onDiscard={() => setDraft(saved)}
                  onSave={() => setConfirm(true)}
                />
              )
            ) : (
              <EffectiveAccessView
                people={PEOPLE}
                selectedId={person}
                onPick={setPerson}
                subject={person === "w" ? { name: "小王", hint: "销售一部 · 一组 · 角色：销售主管、销售代表（集团）· 个人加 1 · 个人减 1" } : { name: PEOPLE.find((p) => p.id === person)?.name ?? "", hint: PEOPLE.find((p) => p.id === person)?.hint }}
                modules={EFFECTIVE}
                scopeLabels={SCOPE_LABELS}
                actions={<><Button size="sm" variant="outline"><Search />查一项…</Button><Button size="sm" variant="outline"><Eye />以他身份预览</Button></>}
              />
            )}
          </Tabs>
        </Panel>
      </ListDetailLayout>
      <PermissionDiff
        open={confirm}
        title={`保存「${roleName}」的改动`}
        changes={changes}
        impact={IMPACT}
        stale={{ message: "试算之后，周经理 14:32 把小李调到了「销售二部」，下面的影响名单可能不准。", onRecompute: () => notify("已重新试算", "success") }}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setSaved(draft);
          notify("已保存，3 个人下一次操作就生效", "success");
        }}
      />
    </PageBody>
  );
}
