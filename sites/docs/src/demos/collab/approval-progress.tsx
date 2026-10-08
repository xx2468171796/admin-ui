import { ApprovalProgress, ApprovalProgressCard, ChangeValue, Panel, useNotify } from "@adminui/react";
import { APPROVALS, APPROVER } from "../../data/collab-data";

/**
 * 记录详情里的进度卡 ApprovalProgressCard（点「查看详情」打开审批详情），和单独的竖线审批进度 ApprovalProgress：
 * 完成 = 主色勾，当前 = 注意色钟，驳回 = 异常色叉 + 原因引用，没走到 = 灰色虚线圈。
 */
const [discount, , rejected, approved] = APPROVALS;

export function Demo() {
  const notify = useNotify();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
      <div className="aui-stack">
        {discount && (
          <ApprovalProgressCard
            request={discount}
            viewerId={APPROVER.id}
            detail={<>折扣 <ChangeValue before="8%" after="12%" /> · 超过阈值 10%</>}
            onOpen={() => notify("打开审批详情", "info")}
          />
        )}
        {rejected && <ApprovalProgressCard request={rejected} viewerId={APPROVER.id} />}
        {approved && <ApprovalProgressCard request={approved} viewerId={APPROVER.id} />}
      </div>
      <Panel title="续约折扣 12%">{discount && <ApprovalProgress request={discount} title={null} />}</Panel>
    </div>
  );
}
