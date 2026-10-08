import { Bell } from "lucide-react";
import { Count, DotBadge, IconButton, StatusBadge, Tag } from "@adminui/react";

/** 两种形状：圆角 6 的软方块（标签、状态）和全圆（数字角标、圆点）；都不加描边。 */
export function Demo() {
  const row = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } as const;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={row}>
        <Tag>重点客户</Tag>
        <Tag variant="plain">销售</Tag>
        <Tag variant="plain">客户成功</Tag>
        <Tag variant="plain" size="sm" title="来自官网表单">官网</Tag>
      </div>
      <div style={row}>
        <StatusBadge tone="success" variant="soft">正常</StatusBadge>
        <StatusBadge tone="warning" variant="soft">即将到期</StatusBadge>
        <StatusBadge tone="danger" variant="soft">同步失败</StatusBadge>
        <StatusBadge tone="info" variant="soft" pulse>同步中</StatusBadge>
        <StatusBadge tone="neutral" variant="soft">已停用</StatusBadge>
      </div>
      <div style={row}>
        <StatusBadge tone="success" variant="dot">正常</StatusBadge>
        <StatusBadge tone="warning" variant="dot">即将到期</StatusBadge>
        <StatusBadge tone="neutral" variant="dot">已停用</StatusBadge>
      </div>
      <div style={row}>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>收藏 <Count label="收藏 0 条">{0}</Count></span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>未读 <Count tone="primary" label="未读 12 条">{12}</Count></span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>告警 <Count tone="danger" label="告警 128 条">{128}</Count></span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>待处理 <Count tone="attention">{3}</Count></span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>新动态 <DotBadge label="有新动态" /></span>
        <IconButton label="通知" icon={<Bell />} badge />
      </div>
    </div>
  );
}
