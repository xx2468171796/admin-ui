import { useMemo, useState } from "react";
import { ApprovalDetail, ApprovalList, ChangeValue, ListDetailLayout, filterApprovals, useNotify, type ApprovalScope } from "@adminui/react";
import { APPROVALS, APPROVER, type ApprovalSubject, type DemoApproval } from "../../data/collab-data";

/**
 * 审批中心：左列表（我的申请 / 待我审批 / 全部）+ 右详情（批准后能做什么 → 审批进度 → 意见框 → 驳回 / 批准）。
 * 驳回必须写原因；意见里写「失败」演示提交失败（意见保留）。你是 林晓（销售总监）。手机上列表 → 详情两步。
 */
function Subject({ subject }: { subject: ApprovalSubject | undefined }) {
  if (!subject) return null;
  if (subject.kind === "discount") return <span>折扣 <ChangeValue before={subject.before} after={subject.after} /> · {subject.limit}</span>;
  if (subject.kind === "leave") return <span>{subject.days}</span>;
  return <span>{subject.amount}</span>;
}

export function Demo() {
  const notify = useNotify();
  const [items, setItems] = useState(APPROVALS);
  const [scope, setScope] = useState<ApprovalScope>("todo");
  const [selected, setSelected] = useState<string | null>("a1");
  const [detailOpen, setDetailOpen] = useState(false);
  const shown = useMemo(() => filterApprovals(items, scope, APPROVER.id), [items, scope]);
  const current = shown.find((r) => r.id === selected) ?? shown[0];

  const decide = async (r: DemoApproval, decision: "approved" | "rejected", reason: string) => {
    await new Promise((res) => setTimeout(res, 300));
    if (reason.includes("失败")) throw new Error("网络中断，没提交成功，意见已保留");
    const at = new Date().toISOString();
    setItems((all) =>
      all.map((old) => {
        if (old.id !== r.id) return old;
        const index = old.steps.findIndex((s) => s.approvers.some((p) => p.id === APPROVER.id) && !s.decisions?.some((d) => d.approver.id === APPROVER.id));
        const steps = old.steps.map((s, i) => (i === index ? { ...s, decisions: [...(s.decisions ?? []), { approver: APPROVER, decision, reason: reason || undefined, at }] } : s));
        const step = steps[index];
        const passed = step && (step.mode === "any" || step.approvers.every((p) => step.decisions?.some((d) => d.approver.id === p.id && d.decision === "approved")));
        const status = decision === "rejected" ? "rejected" : passed && index === steps.length - 1 ? "approved" : "pending";
        return { ...old, steps, status, closedAt: status === "pending" ? undefined : at };
      }),
    );
    notify(decision === "approved" ? `已批准，已通知 ${r.requester.name}` : `已驳回，已通知 ${r.requester.name}`, "success");
  };

  return (
    <ListDetailLayout
      listWidth={460}
      minHeight={560}
      detailOpen={detailOpen}
      onBack={() => setDetailOpen(false)}
      detailTitle={current?.title}
      list={
        <ApprovalList
          items={shown}
          viewerId={APPROVER.id}
          scope={scope}
          onScopeChange={(s) => { setScope(s); setDetailOpen(false); }}
          counts={{ todo: filterApprovals(items, "todo", APPROVER.id).length }}
          selectedId={current?.id}
          onSelect={(r) => { setSelected(r.id); setDetailOpen(true); }}
          footer={`共 ${shown.length} 条 · 超过 7 天没人批会提醒上一级`}
        />
      }
    >
      {current ? (
        <ApprovalDetail
          request={current}
          viewerId={APPROVER.id}
          renderSubject={(r) => <Subject subject={r.summary} />}
          onApprove={(r, comment) => decide(r, "approved", comment)}
          onReject={(r, reason) => decide(r, "rejected", reason)}
          onWithdraw={async (r) => {
            await new Promise((res) => setTimeout(res, 200));
            setItems((all) => all.map((x) => (x.id === r.id ? { ...x, status: "withdrawn", closedAt: new Date().toISOString() } : x)));
            notify("已撤回", "success");
          }}
          decideHint={`批准后通知 ${current.requester.name}${current.steps.length > 1 ? "，再交给下一级" : ""}`}
        />
      ) : null}
    </ListDetailLayout>
  );
}
