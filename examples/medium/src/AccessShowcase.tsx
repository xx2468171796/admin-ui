import { useMemo, useState } from "react";
import { Button, ConfirmDialog, ChangeList, InlineAlert, PageBody, Panel, FormField, TabbedPage, useNotify } from "@adminui/react";
import {
  AccessRequestList,
  AuditDiff,
  CheckableTree,
  DataScopeDialog,
  EffectiveAccessTable,
  ExplainPanel,
  OrgTreePicker,
  PermissionMatrix,
  RecordTeamPanel,
  ReviewList,
  UserTransfer,
  describeScope,
  diffMatrix,
  fullPath,
  indexTree,
  matrixChangeItems,
  type AccessRequest,
  type AccessUser,
  type DataScope,
  type EffectiveAccessRow,
  type ExplainQuery,
  type ExplainResult,
  type MatrixAction,
  type MatrixResource,
  type OrgNode,
  type PermissionMatrixValue,
  type RecordTeamMember,
  type ReviewItem,
  type TreeNode,
} from "@adminui/react/access";

import { PersonAccessDemo } from "./PersonAccessDemo";

// 权限管理组件示例（@adminui/react/access）：一个小型 CRM 的演示数据，全部在内存里，刷新后恢复。
// 组件只负责展示和收集改动；保存 / 审批 / 解释在生产里由宿主调接口（quanxian/server），服务端再逐条鉴权。

const ORG: OrgNode[] = [
  {
    id: "hq",
    label: "Acme 总部",
    children: [
      {
        id: "sales",
        label: "销售中心",
        children: [
          { id: "east", label: "华东区", hint: "12 人", children: [{ id: "east-a", label: "上海一组" }, { id: "east-b", label: "杭州组" }] },
          { id: "south", label: "华南区", hint: "8 人" },
          { id: "north", label: "华北区", hint: "6 人" },
        ],
      },
      { id: "cs", label: "客户成功部", hint: "5 人" },
      { id: "fin", label: "财务部", hint: "3 人" },
    ],
  },
];
const orgIndex = indexTree(ORG);
const deptName = (id: string) => fullPath(orgIndex, id);

const USERS: AccessUser[] = [
  { id: "u1", name: "陈晓", deptIds: ["east-a"], hint: "销售经理" },
  { id: "u2", name: "林宁", deptIds: ["south"], hint: "销售" },
  { id: "u3", name: "周敏", deptIds: ["east-b"], hint: "售前" },
  { id: "u4", name: "王磊", deptIds: ["north"], hint: "大客户经理" },
  { id: "u5", name: "赵一鸣", deptIds: ["cs"], hint: "客户成功" },
  { id: "u6", name: "孙悦", deptIds: ["fin"], hint: "会计" },
  { id: "u7", name: "吴桐", deptIds: ["east-a", "cs"], hint: "兼岗" },
  { id: "u8", name: "郑凯", deptIds: ["sales"], hint: "销售总监" },
  { id: "u9", name: "离职-刘洋", deptIds: ["south"], hint: "已停用", disabled: true },
];

const MENU: TreeNode[] = [
  {
    id: "m-crm",
    label: "客户管理",
    children: [
      { id: "m-customer", label: "客户", children: [{ id: "customer:read", label: "查看", hint: "customer:read" }, { id: "customer:create", label: "新建", hint: "customer:create" }, { id: "customer:update", label: "编辑", hint: "customer:update" }, { id: "customer:delete", label: "删除", hint: "customer:delete" }] },
      { id: "m-deal", label: "商机", keywords: "shangji", children: [{ id: "deal:read", label: "查看", hint: "deal:read" }, { id: "deal:update", label: "编辑", hint: "deal:update" }] },
      { id: "m-pool", label: "公海", children: [{ id: "pool:claim", label: "领取", hint: "pool:claim" }] },
    ],
  },
  { id: "m-fin", label: "财务", children: [{ id: "invoice:read", label: "发票查看", hint: "invoice:read" }, { id: "invoice:export", label: "发票导出", hint: "invoice:export", disabled: true }] },
  { id: "m-sys", label: "系统设置", children: [{ id: "role:manage", label: "角色管理", hint: "role:manage" }, { id: "audit:read", label: "审计日志", hint: "audit:read" }] },
];

const ACTIONS: MatrixAction[] = [
  { id: "read", label: "查看", scoped: true },
  { id: "update", label: "编辑", scoped: true },
  { id: "delete", label: "删除", scoped: true, tiers: ["own", "dept", "all"] },
  { id: "export", label: "导出" },
  { id: "transfer", label: "转移" },
];
const RESOURCES: MatrixResource[] = [
  {
    id: "customer",
    label: "客户",
    group: "客户管理",
    description: "公司客户档案",
    actions: ["read", "update", "delete", "export", "transfer"],
    fields: [
      { id: "name", label: "客户名称", defaultPolicy: { read: true, write: true, export: true, mask: false } },
      { id: "phone", label: "联系电话", sensitive: true },
      { id: "credit", label: "授信额度", sensitive: true },
    ],
  },
  { id: "contact", label: "联系人", group: "客户管理", actions: ["read", "update", "delete", "export"], fields: [{ id: "mobile", label: "手机号", sensitive: true }, { id: "email", label: "邮箱" }] },
  { id: "deal", label: "商机", group: "客户管理", actions: ["read", "update", "delete", "transfer"] },
  { id: "invoice", label: "发票", group: "财务", actions: ["read", "export"] },
  { id: "payment", label: "回款", group: "财务", actions: ["read", "update"] },
];
const SAVED: PermissionMatrixValue = {
  grants: {
    "customer:read": { scope: { tier: "dept_tree" } },
    "customer:update": { scope: { tier: "own" } },
    "customer:export": {},
    "contact:read": { scope: { tier: "dept" } },
    "deal:read": { scope: { tier: "subordinates", includeUnassigned: true } },
    "invoice:read": { scope: { tier: "custom", deptIds: ["east", "south"] } },
  },
  fields: { "customer.phone": { read: true, write: false, export: false, mask: true } },
};

const EFFECTIVE: EffectiveAccessRow[] = [
  { code: "customer:read", label: "查看客户", group: "客户管理", allowed: true, scope: { tier: "dept_tree" }, sources: [{ kind: "role", id: "r-sales-mgr", label: "销售经理", scope: { tier: "dept_tree" } }, { kind: "post", id: "p-east", label: "华东区负责人岗", scope: { tier: "dept" } }], blocks: [] },
  { code: "customer:update", label: "编辑客户", group: "客户管理", allowed: true, scope: { tier: "own" }, sources: [{ kind: "role", id: "r-sales-mgr", label: "销售经理", scope: { tier: "own" } }], blocks: [{ kind: "restriction", id: "rs-1", label: "已冻结客户不可编辑", detail: "只在冻结的记录上拦截" }] },
  { code: "customer:delete", label: "删除客户", group: "客户管理", allowed: false, risk: "high", sources: [{ kind: "personal", label: "清理重复客户", expiresAt: "2026-10-05T00:00:00Z" }], blocks: [{ kind: "step_up", label: "需要短信二次验证" }] },
  { code: "customer:export", label: "导出客户", group: "客户管理", allowed: false, risk: "high", sources: [{ kind: "role", id: "r-sales-mgr", label: "销售经理" }], blocks: [{ kind: "denied", label: "试用期员工不可导出" }] },
  { code: "deal:read", label: "查看商机", group: "客户管理", allowed: true, scope: { tier: "subordinates", includeUnassigned: true }, sources: [{ kind: "role", id: "r-sales-mgr", label: "销售经理" }, { kind: "record_grant", id: "g-17", label: "商机 D-1024 的编辑者", level: "editor", expiresAt: "2026-12-31T00:00:00Z" }, { kind: "share_rule", id: "sh-2", label: "华东区共享给客户成功部" }], blocks: [] },
  { code: "invoice:read", label: "查看发票", group: "财务", allowed: false, sources: [], blocks: [{ kind: "feature_off", label: "本租户未开通「财务」模块" }] },
  { code: "audit:read", label: "查看审计日志", group: "系统设置", allowed: false, sources: [], blocks: [{ kind: "not_granted", label: "未授予" }] },
  { code: "tenant:switch", label: "切换租户", group: "系统设置", allowed: false, sources: [{ kind: "superuser", label: "平台超管（只读模式）" }], blocks: [{ kind: "tenant", label: "只能访问本租户" }] },
];

function explain(query: ExplainQuery): ExplainResult {
  const subject = USERS.find((u) => u.id === query.subjectId) ?? USERS[0]!;
  const base = { query, subject: { id: subject.id, label: subject.name }, evaluatedAt: new Date().toISOString() };
  if (!query.resourceId) {
    return {
      ...base,
      decision: "conditional",
      condition: "负责人 = 本人 或 部门 ∈ 华东区及以下 或 有记录授权（查看者及以上）",
      allowedBy: [{ kind: "role", id: "r-sales-mgr", label: "销售经理", scope: { tier: "dept_tree" } }, { kind: "record_grant", label: "记录授权（逐条）" }],
      blockedBy: [],
      steps: [
        { stage: "tenant", outcome: "pass", label: "租户：Acme（本租户）" },
        { stage: "feature", outcome: "pass", label: "「客户管理」模块已开通" },
        { stage: "catalog", outcome: "pass", label: `权限码 ${query.resourceType}:${query.action} 存在` },
        { stage: "grant", outcome: "pass", label: "角色「销售经理」授予，范围 本部门及以下" },
        { stage: "restriction", outcome: "skip", label: "没有适用的收窄规则" },
        { stage: "condition", outcome: "skip", label: "没有指定记录：按条件过滤列表" },
      ],
      fields: [
        { id: "name", label: "客户名称", read: true, write: true, export: true, mask: false },
        { id: "phone", label: "联系电话", read: true, write: false, export: false, mask: true },
        { id: "credit", label: "授信额度", read: false, write: false, export: false, mask: false },
      ],
    };
  }
  if (query.resourceId.toUpperCase().includes("NULL")) {
    return {
      ...base,
      decision: "deny",
      allowedBy: [{ kind: "role", id: "r-sales-mgr", label: "销售经理", scope: { tier: "own" } }],
      blockedBy: [{ kind: "condition", label: "负责人 = 本人" }],
      unknown: [{ field: "owner_id", label: "负责人", note: "这条记录还没有负责人（公海）" }],
      steps: [
        { stage: "tenant", outcome: "pass", label: "租户：Acme（本租户）" },
        { stage: "grant", outcome: "pass", label: "角色「销售经理」授予，范围 仅本人" },
        { stage: "record", outcome: "fail", label: "没有这条记录的记录授权" },
        { stage: "condition", outcome: "unknown", label: "负责人 = 本人", detail: "owner_id 为 NULL，比较结果未知" },
      ],
    };
  }
  return {
    ...base,
    decision: query.action === "delete" ? "deny" : "allow",
    allowedBy: [{ kind: "role", id: "r-sales-mgr", label: "销售经理", scope: { tier: "dept_tree" } }],
    blockedBy: query.action === "delete" ? [{ kind: "step_up", label: "删除需要短信二次验证" }] : [],
    condition: "部门 ∈ 华东区及以下",
    steps: [
      { stage: "tenant", outcome: "pass", label: "租户：Acme（本租户）" },
      { stage: "feature", outcome: "pass", label: "「客户管理」模块已开通" },
      { stage: "grant", outcome: "pass", label: "角色「销售经理」授予，范围 本部门及以下" },
      { stage: "restriction", outcome: "pass", label: "收窄规则「已冻结客户不可编辑」不适用（记录未冻结）" },
      { stage: "condition", outcome: "pass", label: `记录 ${query.resourceId} 属于 上海一组 ∈ 华东区及以下` },
      { stage: "step_up", outcome: query.action === "delete" ? "fail" : "skip", label: query.action === "delete" ? "本会话 15 分钟内没有二次验证" : "这个动作不需要二次验证" },
    ],
  };
}

const TEAM: RecordTeamMember[] = [
  { id: "g1", subject: { type: "user", id: "u1", name: "陈晓", hint: "销售经理" }, level: "owner", grantedBy: "系统", grantedAt: "2026-06-01T00:00:00Z" },
  { id: "g2", subject: { type: "user", id: "u3", name: "周敏", hint: "售前" }, level: "editor", expiresAt: "2026-10-05T00:00:00Z", grantedBy: "陈晓", reason: "出方案" },
  { id: "g3", subject: { type: "user", id: "u5", name: "赵一鸣", hint: "客户成功" }, level: "viewer", grantedBy: "陈晓" },
  { id: "g4", subject: { type: "dept", id: "east", name: "华东区" }, level: "viewer", inheritedFrom: "集团客户「远山集团」" },
  { id: "g5", subject: { type: "user", id: "u2", name: "林宁", hint: "销售" }, level: "viewer", expiresAt: "2026-09-20T00:00:00Z", grantedBy: "郑凯", reason: "临时协助" },
];

const REQUESTS: AccessRequest[] = [
  { id: "q1", requester: { id: "u2", name: "林宁", hint: "华南区" }, target: { kind: "role", id: "r-fin-view", label: "财务只读" }, reason: "月底对账需要查看回款", status: "pending", createdAt: "2026-09-30T09:12:00Z", expiresAt: "2026-10-07T00:00:00Z", step: { current: 1, total: 2, label: "部门负责人" } },
  { id: "q2", requester: { id: "u3", name: "周敏", hint: "华东区" }, target: { kind: "record", id: "C-1024", label: "客户 远山精密制造" }, level: "editor", reason: "协助出方案", status: "active", createdAt: "2026-09-28T02:00:00Z", expiresAt: "2026-10-15T00:00:00Z", decidedBy: "陈晓" },
  { id: "q3", requester: { id: "u7", name: "吴桐", hint: "兼岗" }, target: { kind: "permission", id: "customer:export", label: "导出客户" }, scope: { tier: "dept" }, reason: "", status: "rejected", createdAt: "2026-09-25T02:00:00Z", decidedBy: "郑凯", decisionNote: "导出请走数据申请流程" },
  { id: "q4", requester: { id: "u4", name: "王磊", hint: "华北区" }, target: { kind: "post", id: "p-north", label: "华北区负责人岗" }, scope: { tier: "dept_tree" }, reason: "岗位调整", status: "pending", createdAt: "2026-10-01T01:00:00Z", expiresAt: null, step: { current: 2, total: 2, label: "人事" } },
  { id: "q5", requester: { id: "u6", name: "孙悦", hint: "财务部" }, target: { kind: "role", id: "r-audit", label: "审计查看" }, reason: "季度审计", status: "expired", createdAt: "2026-07-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z", decidedBy: "郑凯" },
];

const REVIEW: ReviewItem[] = [
  { id: "v1", subject: { id: "u1", name: "陈晓", hint: "销售经理" }, grant: { kind: "role", label: "销售经理", scope: { tier: "dept_tree" } }, grantedAt: "2026-01-10T00:00:00Z", lastUsedAt: "2026-09-30T08:00:00Z", decision: "keep" },
  { id: "v2", subject: { id: "u2", name: "林宁", hint: "销售" }, grant: { kind: "role", label: "财务只读" }, grantedAt: "2026-03-01T00:00:00Z", lastUsedAt: null },
  { id: "v3", subject: { id: "u4", name: "王磊", hint: "大客户经理" }, grant: { kind: "permission", label: "导出客户", scope: { tier: "all" } }, grantedAt: "2025-11-20T00:00:00Z", lastUsedAt: "2026-04-02T00:00:00Z", expiresAt: "2026-10-03T00:00:00Z" },
  { id: "v4", subject: { id: "u7", name: "吴桐", hint: "兼岗" }, grant: { kind: "post", label: "客户成功岗", scope: { tier: "dept" } }, grantedAt: "2026-08-01T00:00:00Z", lastUsedAt: "2026-09-29T00:00:00Z" },
  { id: "v5", subject: { id: "u6", name: "孙悦", hint: "会计" }, grant: { kind: "record", label: "客户 北辰物流（编辑者）" }, grantedAt: "2026-05-01T00:00:00Z", lastUsedAt: "2026-06-15T00:00:00Z", decision: "revoke", note: "已不负责" },
];

const AUDIT_BEFORE = { name: "销售", permissions: ["customer:read", "customer:update", "deal:read"], scope: { customer: "dept" }, members: [{ id: "u1", level: "viewer" }, { id: "u3", level: "editor" }], webhookToken: "tok_live_old" };
const AUDIT_AFTER = { name: "销售经理", permissions: ["customer:read", "customer:update", "deal:read", "deal:update"], scope: { customer: "dept_tree" }, members: [{ id: "u3", level: "owner" }, { id: "u1", level: "viewer" }, { id: "u5", level: "viewer" }], webhookToken: "tok_live_new", note: "季度调整" };

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export function AccessShowcase({ active = true }: { active?: boolean }) {
  const notify = useNotify();
  const [section, setSection] = useState("matrix");
  // 角色矩阵
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState(SAVED);
  const [readOnly, setReadOnly] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const changes = useMemo(() => diffMatrix(saved, draft, RESOURCES, ACTIONS), [saved, draft]);
  // 树与范围
  const [menu, setMenu] = useState<string[]>(["customer:read", "customer:update", "deal:read"]);
  const [linked, setLinked] = useState(true);
  const [scope, setScope] = useState<DataScope | null>({ tier: "dept", includeUnassigned: false });
  const [scopeOpen, setScopeOpen] = useState(false);
  // 部门与人员
  const [dept, setDept] = useState<string[]>(["east-a"]);
  const [depts, setDepts] = useState<string[]>(["east", "cs"]);
  const [people, setPeople] = useState<string[]>(["u1", "u5"]);
  // 解释
  const [query, setQuery] = useState<ExplainQuery>({ subjectId: "u1", action: "update", resourceType: "customer", resourceId: "C-1024" });
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  // 团队 / 申请 / 复核
  const [team, setTeam] = useState(TEAM);
  const [requests, setRequests] = useState(REQUESTS);
  const [review, setReview] = useState(REVIEW);
  const now = useMemo(() => new Date(), []);

  return (
    <TabbedPage
      title="权限组件"
      description="@adminui/react/access 的全部组件，用一个小型 CRM 的演示数据；只在浏览器内存里，刷新后恢复，不代表生产授权。"
      value={section}
      onValueChange={setSection}
      active={active}
      sections={[
        { id: "matrix", label: "角色矩阵" },
        { id: "tree", label: "勾选树与范围" },
        { id: "org", label: "部门与人员" },
        { id: "effective", label: "有效权限与解释" },
        { id: "team", label: "协作成员" },
        { id: "requests", label: "申请与复核" },
        { id: "audit", label: "审计差异" },
        { id: "person", label: "按人员" },
      ]}
      render={(id) => {
        if (id === "matrix")
          return (
            <PageBody>
              <PermissionMatrix
                caption="销售经理的功能与数据权限"
                resources={RESOURCES}
                actions={ACTIONS}
                value={draft}
                savedValue={saved}
                onChange={setDraft}
                readOnly={readOnly}
                orgTree={ORG}
                disabledTiers={{ all: "委派管理员不能授予「全部」：不能宽于自己的范围" }}
                toolbar={
                  <>
                    <Button variant="outline" onClick={() => setReadOnly((v) => !v)}>{readOnly ? "切回编辑" : "只读预览"}</Button>
                    <Button disabled={readOnly || changes.length === 0} onClick={() => setConfirming(true)}>保存</Button>
                  </>
                }
              />
              <ConfirmDialog
                open={confirming}
                title="保存角色权限"
                size="md"
                impact={`将修改「销售经理」的 ${changes.length} 处权限，拥有该角色的 6 人立即生效。`}
                reason={{ label: "修改原因", required: true }}
                onClose={() => setConfirming(false)}
                onConfirm={async () => {
                  await wait();
                  setSaved(draft);
                  notify("已保存（演示）", "success");
                }}
              >
                <ChangeList items={matrixChangeItems(changes, deptName)} />
              </ConfirmDialog>
            </PageBody>
          );
        if (id === "tree")
          return (
            <PageBody>
              <Panel title="菜单与按钮权限" description="三态勾选；关掉「父子联动」后每个节点各管各的（若依 menu_check_strictly）。灰色节点不可改。">
                <CheckableTree label="菜单权限" nodes={MENU} value={menu} linked={linked} onLinkedChange={setLinked} onValueChange={setMenu} defaultExpanded="all" />
                <p className="aui-note">已选权限码：{menu.filter((m) => m.includes(":")).join("、") || "无"}</p>
              </Panel>
              <Panel title="数据范围" description="五档 + 指定部门 + 是否包含无部门的记录。" actions={<Button variant="outline" onClick={() => setScopeOpen(true)}>设置范围</Button>}>
                <p>当前：{describeScope(scope, deptName)}</p>
              </Panel>
              <DataScopeDialog
                open={scopeOpen}
                value={scope}
                orgTree={ORG}
                subject="销售经理 · 客户 · 查看"
                disabledTiers={{ all: "不能宽于你自己的范围（本部门及以下）" }}
                onClose={() => setScopeOpen(false)}
                onSubmit={async (next) => {
                  await wait(300);
                  setScope(next);
                  notify(`范围已改为：${describeScope(next, deptName)}`, "success");
                }}
              />
            </PageBody>
          );
        if (id === "org")
          return (
            <PageBody>
              <Panel title="部门选择" description="回显完整路径；弹窗里搜索，点「确定」才生效。">
                <div className="aui-form-grid">
                  <FormField label="所属部门（单选）" htmlFor="demo-dept">
                    <OrgTreePicker id="demo-dept" label="部门" nodes={ORG} value={dept} onChange={setDept} isSelectable={(n) => n.id !== "hq"} />
                  </FormField>
                  <FormField label="可见部门（多选）" htmlFor="demo-depts">
                    <OrgTreePicker id="demo-depts" label="部门" multiple nodes={ORG} value={depts} onChange={setDepts} />
                  </FormField>
                </div>
              </Panel>
              <Panel title="按部门找人" description="左边选部门（可含下级），中间勾选，右边是已选；离职账号不能选。">
                <UserTransfer orgTree={ORG} users={USERS} value={people} onChange={setPeople} max={6} />
              </Panel>
            </PageBody>
          );
        // bt/history：P4 有效权限扩展（样稿 D15）
        if (id === "person") return <PageBody><PersonAccessDemo /></PageBody>;
        if (id === "effective")
          return (
            <PageBody>
              <Panel title="陈晓的有效权限" description="每个权限码：能不能、范围、来自哪里、被什么拦住。点行首展开看完整来源。">
                <EffectiveAccessTable subject="陈晓" rows={EFFECTIVE} deptName={deptName} now={now} onSourceClick={(s) => notify(`打开 ${s.label}（演示）`, "info")} />
              </Panel>
              <ExplainPanel
                subjects={USERS.filter((u) => !u.disabled).map((u) => ({ id: u.id, label: u.name, hint: u.hint }))}
                actions={[{ id: "read", label: "查看" }, { id: "update", label: "编辑" }, { id: "delete", label: "删除" }]}
                resources={[{ id: "customer", label: "客户" }, { id: "deal", label: "商机" }]}
                query={query}
                onQueryChange={setQuery}
                loading={evaluating}
                result={result}
                deptName={deptName}
                onEvaluate={async (q) => {
                  setEvaluating(true);
                  await wait(300);
                  setResult(explain(q));
                  setEvaluating(false);
                }}
              />
              <InlineAlert title="试一试">记录 ID 留空看列表级条件；填「C-NULL」看「负责人为空 → 未知按拒绝」；动作选「删除」看二次验证拦截。</InlineAlert>
            </PageBody>
          );
        if (id === "team")
          return (
            <PageBody>
              <RecordTeamPanel
                recordLabel="客户：远山精密制造"
                members={team}
                canManage
                canTransfer
                candidates={USERS.filter((u) => !u.disabled)}
                orgTree={ORG}
                now={now}
                onAdd={async (inputs) => {
                  await wait();
                  setTeam((t) => [...t, ...inputs.map((i, n) => ({ id: `n${Date.now()}-${n}`, subject: i.subject, level: i.level, expiresAt: i.expiresAt, reason: i.reason, grantedBy: "我" }))]);
                  notify(`已添加 ${inputs.length} 人`, "success");
                }}
                onUpdate={async (member, patch) => {
                  await wait();
                  setTeam((t) => t.map((m) => (m.id === member.id ? { ...m, ...patch } : m)));
                }}
                onRemove={async (member) => {
                  await wait();
                  setTeam((t) => t.filter((m) => m.id !== member.id));
                }}
                onTransferOwner={async ({ toUserId, keepPreviousAs }) => {
                  await wait();
                  const user = USERS.find((u) => u.id === toUserId);
                  if (!user) throw new Error("找不到这个人");
                  setTeam((t) => {
                    const rest = t
                      .filter((m) => !(m.subject.type === "user" && m.subject.id === toUserId))
                      .flatMap((m) => (m.level === "owner" ? (keepPreviousAs ? [{ ...m, level: keepPreviousAs }] : []) : [m]));
                    return [{ id: `o${Date.now()}`, subject: { type: "user", id: user.id, name: user.name, hint: user.hint }, level: "owner", grantedBy: "我" }, ...rest];
                  });
                  notify(`负责人已转给 ${user.name}`, "success");
                }}
              />
            </PageBody>
          );
        if (id === "requests")
          return (
            <PageBody>
              <Panel title="权限申请" description="待审批的可以批准（可改期限）或驳回；生效中的可以收回。">
                <AccessRequestList
                  requests={requests}
                  can={{ approve: true, reject: true, revoke: true }}
                  deptName={deptName}
                  now={now}
                  onAction={async (request, action, input) => {
                    await wait();
                    const status = action === "approve" ? (request.step && request.step.current < request.step.total ? "pending" : "active") : action === "reject" ? "rejected" : action === "revoke" ? "revoked" : "cancelled";
                    setRequests((list) =>
                      list.map((r) =>
                        r.id === request.id
                          ? { ...r, status, step: action === "approve" && r.step && r.step.current < r.step.total ? { ...r.step, current: r.step.current + 1 } : r.step, expiresAt: input.expiresAt !== undefined ? input.expiresAt : r.expiresAt, decidedBy: "我", decisionNote: input.reason || undefined }
                          : r,
                      ),
                    );
                  }}
                />
              </Panel>
              <Panel title="2026 Q3 权限复核" description="逐条确认保留还是收回；从没用过或 90 天没用的会标出来。">
                <ReviewList
                  items={review}
                  dueAt="2026-10-10T00:00:00Z"
                  deptName={deptName}
                  now={now}
                  onDecide={async (ids, decision, note) => {
                    await wait(250);
                    setReview((list) => list.map((i) => (ids.includes(i.id) ? { ...i, decision, note } : i)));
                  }}
                  onSubmit={async () => {
                    await wait();
                    notify("复核已提交（演示）", "success");
                  }}
                />
              </Panel>
            </PageBody>
          );
        return (
          <PageBody>
            <Panel title="角色「销售」被修改" description="2026-10-01 10:24 · 操作人 郑凯 · 请求 req_7f3a">
              <AuditDiff
                before={AUDIT_BEFORE}
                after={AUDIT_AFTER}
                labels={{ name: "角色名称", permissions: "权限", "scope.customer": "客户范围", members: "成员", note: "备注" }}
              />
            </Panel>
          </PageBody>
        );
      }}
    />
  );
}
