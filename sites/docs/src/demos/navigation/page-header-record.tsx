// 记录页：面包屑一行 → 头部（头像块 + 名字 + 状态 + 一行灰字 + 右侧 次按钮 / 主按钮 / ⋯）→ 下划线分区标签。
import { useState } from "react";
import { Breadcrumbs, Button, MoreMenu, RecordHeader, StatusBadge, Tabs } from "@adminui/react";
import { CUSTOMERS, personName, stageLabel } from "../../data/demo-data";

export function Demo() {
  const [tab, setTab] = useState("info");
  const c = CUSTOMERS[2];
  if (!c) return null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Breadcrumbs items={[{ label: "客户", onClick: () => undefined }, { label: "华东销售组", onClick: () => undefined }, { label: c.name }]} />
      <RecordHeader
        avatar={c.name.slice(0, 1)}
        title={c.name}
        status={<StatusBadge tone="brand">{stageLabel(c.stage)}</StatusBadge>}
        meta={[{ person: personName(c.owner), suffix: "负责" }, c.city, `更新于 ${c.createdAt}`]}
        actions={<>
          <Button size="sm" variant="outline">写跟进</Button>
          <Button size="sm">发起报价</Button>
          <MoreMenu size="sm" label="更多操作" sections={[{ items: [{ key: "transfer", label: "转给别人" }, { key: "archive", label: "归档" }] }]} />
        </>}
        tabs={
          <Tabs label="客户分区" value={tab} onValueChange={setTab} items={[
            { value: "info", label: "资料" },
            { value: "follow", label: "跟进", count: 12 },
            { value: "deals", label: "商机", count: 2 },
            { value: "files", label: "附件" },
          ]} />
        }
      />
    </div>
  );
}
