import { useMemo, useState, type ReactNode } from "react";
import { Calendar, CircleChevronDown, Coins, Paperclip, Phone, Star, Table2, Type, User } from "lucide-react";
import { ChangeList, ConfirmDialog, PageBody, PageHeader, SegmentedControl, useNotify } from "@adminui/react";
import { TableAccessPanel, tableAccessChanges, type CondFieldDef, type RuleImpactDto, type TableAccessField, type TableAccessValue, type CondDraft } from "@adminui/react/access";

// 表格就地权限示例（样稿 D13）：客户表 · 按角色。角色、字段、影响都是演示数据；
// 真实项目里影响由服务端按草稿试算（RuleImpactDto），保存要原因、写审计。
export const ROLES = [
  { id: "sales", name: "销售", members: 24 }, { id: "lead", name: "组长", members: 4 }, { id: "head", name: "主管", members: 2 },
  { id: "manager", name: "销售经理", members: 1 }, { id: "ops", name: "运营", members: 3 }, { id: "design", name: "设计", members: 3 },
  { id: "tech", name: "技术", members: 6 }, { id: "service", name: "客服", members: 4 }, { id: "finance", name: "财务", members: 2 },
  { id: "admin", name: "管理员", members: 2, admin: true },
];
export const ICONS: Record<string, ReactNode> = { name: <Type />, stage: <CircleChevronDown />, owner: <User />, phone: <Phone />, intent: <Star />, amount: <Coins />, deal: <Coins />, last: <Calendar />, follow: <Table2 />, files: <Paperclip />, region: <CircleChevronDown />, installDate: <Calendar />, installer: <User />, quality: <CircleChevronDown />, opsNote: <Type /> };
export const FIELDS: TableAccessField[] = [
  { id: "name", label: "客户名称", primary: true }, { id: "stage", label: "阶段" }, { id: "owner", label: "负责人" },
  { id: "phone", label: "手机", sensitive: true }, { id: "intent", label: "意向" }, { id: "amount", label: "预计金额" }, { id: "deal", label: "成交价" },
  { id: "last", label: "最后跟进" }, { id: "follow", label: "跟进记录（子表）" }, { id: "files", label: "现场资料" }, { id: "region", label: "地区" },
  { id: "installDate", label: "安装日期" }, { id: "installer", label: "安装负责人" },
  { id: "quality", label: "客户质量", ownedBy: "运营专用，小B 加的" }, { id: "opsNote", label: "运营备注", ownedBy: "运营专用，小B 加的" },
];
export const ACTIONS = [{ id: "read", label: "看" }, { id: "create", label: "加" }, { id: "update", label: "改" }, { id: "delete", label: "删" }, { id: "export", label: "导出" }];
export const COND_FIELDS: CondFieldDef[] = [
  { id: "stage", label: "阶段", type: "string", options: [{ value: "install", label: "安装" }, { value: "visit", label: "回访" }, { value: "quote", label: "报价" }] },
  { id: "installer", label: "安装负责人", type: "string" },
  { id: "region", label: "地区", type: "string", options: [{ value: "taipei", label: "上海" }, { value: "taichung", label: "苏州" }] },
];
const R = { read: true, write: false, export: false, mask: false };
const RW = { read: true, write: true, export: false, mask: false };
export const SAVED: TableAccessValue<CondDraft> = {
  scope: { tier: "dept", keepAfterHandover: true },
  actions: ["read", "update"],
  fields: { stage: RW, owner: R, phone: { ...R, mask: true }, intent: R, last: R, follow: RW, files: { ...RW, export: true }, region: R, installDate: RW, installer: RW },
};
export const IMPACT: RuleImpactDto = {
  resourceType: "customer",
  actions: ["read"],
  users: [
    { userId: "u1", name: "阿明", action: "read", before: 37, after: 44, gained: 7, lost: 0 },
    { userId: "u2", name: "志伟", action: "read", before: 29, after: 35, gained: 6, lost: 0 },
    { userId: "u3", name: "凯文", action: "read", before: 31, after: 40, gained: 9, lost: 0 },
  ],
  totals: { usersChecked: 6, usersGaining: 6, usersLosing: 0, rowsGained: 41, rowsLost: 0 },
  truncated: false,
  evaluatedAt: "2026-10-05T07:30:00Z",
};

export function TableAccessShowcase() {
  const notify = useNotify();
  const [role, setRole] = useState("tech");
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState<TableAccessValue<CondDraft>>({
    ...SAVED,
    scope: { tier: "condition", keepAfterHandover: true, condition: { join: "or", rows: [{ id: "c1", field: "stage", op: "in", source: "literal", value: "install, visit" }, { id: "c2", field: "installer", op: "eq", source: "userId", value: "" }] } },
  });
  const [line, setLine] = useState("home");
  const [confirm, setConfirm] = useState(false);
  const changes = useMemo(() => tableAccessChanges(saved, draft, { fields: FIELDS, actions: ACTIONS }), [saved, draft]);
  return (
    <>
      <PageHeader title="表格权限" description="样稿 D13：在表格里直接设「这个角色能看哪些记录、能做什么、每个字段能不能看 / 改 / 打码 / 导出」。" />
      <PageBody>
        <TableAccessPanel<CondDraft>
          title="客户 · 权限设置"
          help="角色对所有表通用，这里只改它在「客户」表上的权限；集中管理在管理后台的权限中心。"
          toolbarExtra={<SegmentedControl size="sm" label="业务线" value={line} onValueChange={setLine} options={[{ value: "home", label: "智能家居" }, { value: "office", label: "商用" }]} />}
          roles={ROLES.map((r) => ({ ...r, dirty: r.id === "sales" }))}
          selectedRole={role}
          onSelectRole={(id) => { setRole(id); notify(`切到「${ROLES.find((r) => r.id === id)?.name}」（演示里所有角色共用一份数据）`, "info"); }}
          onAddRole={() => notify("新建角色（可复制已有角色再改）", "info")}
          value={draft}
          savedValue={saved}
          onChange={setDraft}
          recordNoun="客户"
          conditionFields={COND_FIELDS}
          actions={ACTIONS}
          fields={FIELDS}
          fieldIcon={(f) => ICONS[f.id]}
          maskNote="打码：手机显示成 138-****-8000，点「查看」才看完整号码，并记录谁看过。"
          members={[{ name: "阿明" }, { name: "志伟" }, { name: "凯文" }, { name: "小周" }, { name: "大刘" }, { name: "Tina" }]}
          membersText="技术部 6 人"
          onManageMembers={() => notify("打开成员管理", "info")}
          impact={IMPACT}
          impactLead="技术部 6 人里 "
          onDiscard={() => setDraft(saved)}
          onPreviewAs={() => notify("选一个人，用他的身份看这张表", "info")}
          onSave={() => setConfirm(true)}
        />
        <ConfirmDialog open={confirm} title="保存「技术」在客户表上的权限" reason={{ label: "修改原因", required: true }} onClose={() => setConfirm(false)}
          onConfirm={async () => { setSaved(draft); setConfirm(false); notify("已保存，下一次操作立即生效", "success"); }}>
          <ChangeList items={changes.map((c) => ({ ...c, effect: "保存后立即生效" }))} />
        </ConfirmDialog>
      </PageBody>
    </>
  );
}
