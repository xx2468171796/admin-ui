import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  ApprovalDetail, ApprovalList, ApprovalProgressCard, Button, ChangeValue, Choice, ListDetailLayout, PageBody, PageHeader, Panel, filterApprovals, useNotify,
  type ApprovalRequest, type ApprovalScope,
} from "@adminui/react";

// 通用审批：列表 + 详情 + 审批进度 + 记录详情里的进度卡。组件没有业务词——
// 权限申请、报价折扣、请假都是同一套：宿主给 ApprovalRequest（申请时快照放 summary，用 renderSubject 画出来）和回调。
// 这里数据在内存里；真实项目走平台接口（GET /api/platform/approvals?scope=…、POST …/:id/decide、…/:id/withdraw）。

type Subject = { kind: "permission"; impact: string; warn?: string } | { kind: "discount"; before: string; after: string; limit: string } | { kind: "leave"; days: string };
type Req = ApprovalRequest<Subject>;

const ME = { id: "u-zheng", name: "郑凯", hint: "销售总监" };
const zhou = { id: "u-zhou", name: "周敏", hint: "销售二组" };
const lin = { id: "u-ning", name: "林宁", hint: "财务部" };
const zhao = { id: "u-zhao", name: "赵一鸣", hint: "技术部" };
const kai = { id: "u-kai", name: "阿凯", hint: "安装外包" };
const chen = { id: "u-chen", name: "陈晓", hint: "财务总监" };
const xu = { id: "u-xu", name: "许婷", hint: "人事" };
const ago = (days: number, h = 9) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(h, 12, 0, 0); return d.toISOString(); };

const FIRST: Req[] = [
  { id: "a1", title: "周敏 申请权限「导出客户」", typeLabel: "权限", requester: zhou, createdAt: ago(2), status: "pending", reason: "给客户做年度回顾报告，要导出去年成交的 48 位客户",
    summary: { kind: "permission", impact: "批准后 周敏 能导出客户表（她能看的 168 条）", warn: "和她现在的「销售」角色叠加后，能看到成交价" },
    steps: [{ key: "leader", label: "直属上级", approvers: [ME], mode: "any" }] },
  { id: "a2", title: "报价折扣 12%（赵静怡 · 徐汇区别墅）", typeLabel: "折扣", requester: { id: "u-wang", name: "小王", hint: "销售一组" }, createdAt: ago(1, 16), status: "pending", reason: "客户比了三家，对手给到 88 折",
    summary: { kind: "discount", before: "6%", after: "12%", limit: "超过业务线阈值 10%" },
    steps: [
      { key: "leader", label: "组长", approvers: [{ id: "u-chen2", name: "陈主管" }], mode: "any", decisions: [{ approver: { id: "u-chen2", name: "陈主管" }, decision: "approved", reason: "老客户转介绍，可以", at: ago(1, 18) }] },
      { key: "director", label: "销售总监 + 财务", approvers: [ME, chen], mode: "all" },
    ] },
  { id: "a3", title: "林宁 申请角色「财务只读」", typeLabel: "角色", requester: lin, createdAt: ago(1, 10), status: "pending", reason: "月底对账需要看回款明细",
    summary: { kind: "permission", impact: "批准后 林宁 能看「财务只读」能看的全部数据，30 天后自动收回" },
    steps: [{ key: "dept", label: "部门负责人", approvers: [{ id: "u-ma", name: "马丽" }], mode: "any" }, { key: "cfo", label: "财务总监", approvers: [chen], mode: "any" }] },
  { id: "a4", title: "阿凯 申请权限「看客户地址」", typeLabel: "权限", requester: kai, createdAt: ago(3), status: "rejected", reason: "上门安装要导航", closedAt: ago(3, 11),
    summary: { kind: "permission", impact: "批准后 阿凯 能看全部客户的地址" },
    steps: [{ key: "leader", label: "直属上级", approvers: [ME], mode: "any", decisions: [{ approver: ME, decision: "rejected", reason: "地址由派工单带出，不开放整表", at: ago(3, 11) }] }] },
  { id: "a5", title: "赵一鸣 紧急提权「数据库管理员」", typeLabel: "角色", requester: zhao, createdAt: ago(4, 2), status: "approved", reason: "订单库主从延迟导致下单失败，要临时处理", closedAt: ago(4, 10),
    summary: { kind: "permission", impact: "已到期自动收回" },
    steps: [{ key: "cfo", label: "值班负责人", approvers: [chen], mode: "any", decisions: [{ approver: chen, decision: "approved", reason: "先用后批，已补批", at: ago(4, 10) }] }] },
  { id: "a6", title: "郑凯 请假 2 天（10月12日 – 10月13日）", typeLabel: "请假", requester: ME, createdAt: ago(0, 8), status: "pending", reason: "家里有事",
    summary: { kind: "leave", days: "2 天 · 年假还剩 6 天" },
    steps: [{ key: "hr", label: "人事", approvers: [xu], mode: "any" }] },
];

function Subject({ subject }: { subject: Subject | undefined }) {
  if (!subject) return null;
  if (subject.kind === "discount") return <span>折扣 <ChangeValue before={subject.before} after={subject.after} /> · {subject.limit}</span>;
  if (subject.kind === "leave") return <span>{subject.days}</span>;
  return <span>{subject.impact}{subject.warn && <>；<b style={{ color: "var(--aui-warning)", fontWeight: 500 }}>{subject.warn}</b></>}</span>;
}

export function ApprovalShowcase() {
  const notify = useNotify();
  const [items, setItems] = useState(FIRST);
  const [scope, setScope] = useState<ApprovalScope>("todo");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<string | null>("a1");
  const [detailOpen, setDetailOpen] = useState(false);
  // 真实项目由服务端按 scope 查；演示在前端筛
  const shown = useMemo(() => filterApprovals(items, scope, ME.id).filter((r) => type === "all" || r.typeLabel === type), [items, scope, type]);
  const current = items.find((r) => r.id === selected) ?? shown[0];
  const update = (id: string, patch: (r: Req) => Req) => setItems((all) => all.map((r) => (r.id === id ? patch(r) : r)));
  const decide = async (r: Req, decision: "approved" | "rejected", reason: string) => {
    await new Promise((res) => setTimeout(res, 250));
    if (reason.includes("失败")) throw new Error("网络中断，没提交成功，意见已保留");
    update(r.id, (old) => {
      const at = new Date().toISOString();
      const index = old.steps.findIndex((s) => s.approvers.some((p) => p.id === ME.id) && !s.decisions?.some((d) => d.approver.id === ME.id));
      const steps = old.steps.map((s, i) => (i === index ? { ...s, decisions: [...(s.decisions ?? []), { approver: ME, decision, reason: reason || undefined, at }] } : s));
      const step = steps[index];
      const passed = step && (step.mode === "any" || step.approvers.every((p) => step.decisions?.some((d) => d.approver.id === p.id && d.decision === "approved")));
      const status = decision === "rejected" ? "rejected" : passed && index === steps.length - 1 ? "approved" : "pending";
      return { ...old, steps, status, closedAt: status === "pending" ? undefined : at };
    });
    notify(decision === "approved" ? `已批准，已通知 ${r.requester.name}` : `已驳回，已通知 ${r.requester.name}`, "success");
  };
  const counts = { todo: filterApprovals(items, "todo", ME.id).length };
  return (
    <>
      <PageHeader title="审批" description="通用审批：列表 + 详情 + 审批进度；权限申请、报价折扣、请假都用这一套。驳回必须写原因；申请人能撤回还没批完的申请。" />
      <PageBody>
        <ListDetailLayout listWidth={560} minHeight={600} detailOpen={detailOpen} onBack={() => setDetailOpen(false)} detailTitle={current?.title}
          list={
            <ApprovalList items={shown} viewerId={ME.id} scope={scope} onScopeChange={(s) => { setScope(s); setDetailOpen(false); }} counts={counts} selectedId={current?.id}
              onSelect={(r) => { setSelected(r.id); setDetailOpen(true); }}
              toolbar={<>
                <Choice size="sm" label="类型" value={type} onChange={setType} options={[{ value: "all", label: "全部类型" }, { value: "权限", label: "权限" }, { value: "角色", label: "角色" }, { value: "折扣", label: "折扣" }, { value: "请假", label: "请假" }]} />
                <Button size="sm" variant="outline" onClick={() => notify("打开「新申请」表单", "info")}><Plus aria-hidden="true" />新申请</Button>
              </>}
              footer={`共 ${shown.length} 条 · 超过 7 天没人批会自动提醒上一级`} />
          }>
          {current ? (
            <ApprovalDetail request={current} viewerId={ME.id} renderSubject={(r) => <Subject subject={r.summary} />}
              fields={current.typeLabel === "请假" ? [{ label: "时间", value: "10月12日 – 10月13日" }] : []}
              onApprove={(r, comment) => decide(r, "approved", comment)} onReject={(r, reason) => decide(r, "rejected", reason)}
              onWithdraw={async (r) => { await new Promise((res) => setTimeout(res, 200)); update(r.id, (old) => ({ ...old, status: "withdrawn", closedAt: new Date().toISOString() })); notify("已撤回", "success"); }}
              decideHint={`批准后通知 ${current.requester.name}${current.steps.length > 1 ? "，再交给下一级" : ""}`} />
          ) : null}
        </ListDetailLayout>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, marginTop: 16, alignItems: "start" }}>
          <Panel title="记录详情里的进度卡" description="ApprovalProgressCard 放进记录详情的卡片槽；点「查看详情」打开审批详情。">
            <ApprovalProgressCard request={items[1]!} viewerId={ME.id} detail={<Subject subject={items[1]!.summary} />} onOpen={() => { setScope("all"); setSelected("a2"); setDetailOpen(true); }} />
          </Panel>
          <Panel title="已驳回 / 已通过">
            <div style={{ display: "grid", gap: 12 }}>
              <ApprovalProgressCard request={items[3]!} viewerId={ME.id} />
              <ApprovalProgressCard request={items[4]!} viewerId={ME.id} />
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
