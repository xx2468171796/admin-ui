import { Button, DisabledReason } from "@adminui/react";

/**
 * 不能用的功能要说为什么：按钮自带 disabledReason（悬停 / 聚焦出气泡）；
 * 一整块区域不可用时，用 DisabledReason 在下面写一行原因。
 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "start" }}>
      <Button disabled disabledReason="本月导出次数已用完，下月 1 日恢复">导出全部客户</Button>
      <DisabledReason reason="只有表管理员能改公海规则，找林晓申请。">
        <Button variant="outline" disabled>编辑公海规则</Button>
      </DisabledReason>
    </div>
  );
}
