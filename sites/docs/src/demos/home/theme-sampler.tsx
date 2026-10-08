import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Choice, InlineAlert, Input, StatusBadge, Switch, Tag } from "@adminui/react";

/** One of each: every colour on this card comes from the current palette's tokens. */
export function Demo() {
  const [on, setOn] = useState(true);
  const [plan, setPlan] = useState("pro");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Button><Plus aria-hidden="true" />新建客户</Button>
        <Button variant="secondary">保存草稿</Button>
        <Button variant="outline">导出</Button>
        <Button variant="destructive-outline">删除</Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusBadge tone="success">已签约</StatusBadge>
        <StatusBadge tone="warning">待续费</StatusBadge>
        <StatusBadge tone="danger">已逾期</StatusBadge>
        <StatusBadge tone="info">试用中</StatusBadge>
        <Tag>制造业</Tag>
        <Switch checked={on} onCheckedChange={setOn} aria-label="自动续费" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Input placeholder="客户名称" aria-label="客户名称" />
        <Choice label="套餐" value={plan} onChange={setPlan} options={[{ value: "basic", label: "基础版" }, { value: "pro", label: "专业版" }, { value: "ent", label: "企业版" }]} />
      </div>
      <InlineAlert tone="warning" title="3 家客户的合同 30 天内到期">续约提醒已发给负责人。</InlineAlert>
    </div>
  );
}
