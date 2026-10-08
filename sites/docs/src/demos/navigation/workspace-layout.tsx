// 三栏工作区 WorkspaceLayout + Pane：栏头 48px 一条线、栏间一条线、每栏自己滚。
// 窄屏（≤ 760）narrow="steps"：先列表，点一行进详情，左上「← 返回列表」；右栏跟在详情下面。
import { useState } from "react";
import { Copy, Pencil, Plus } from "lucide-react";
import { DescriptionList, IconButton, Pane, PaneSection, SelectList, StatusBadge, WorkspaceLayout } from "@adminui/react";
import { CUSTOMERS, formatAmount, personName, stageLabel } from "../../data/demo-data";

export function Demo() {
  const [selected, setSelected] = useState(CUSTOMERS[0]?.id ?? "");
  const [detailOpen, setDetailOpen] = useState(false);
  const customer = CUSTOMERS.find((c) => c.id === selected) ?? CUSTOMERS[0];
  return (
    <div style={{ minHeight: 560 }}>
      <WorkspaceLayout
        narrow="steps"
        detailOpen={detailOpen}
        onBack={() => setDetailOpen(false)}
        backLabel="返回客户列表"
        left={
          <Pane title="客户" count={CUSTOMERS.length} actions={<IconButton label="新建客户" icon={<Plus />} />}>
            <SelectList
              label="客户"
              search="搜客户"
              items={CUSTOMERS.slice(0, 14).map((c) => ({ key: c.id, title: c.name, hint: `${c.city} · ${c.industry}`, group: c.active ? "跟进中" : "已停用" })).sort((a, b) => a.group.localeCompare(b.group))}
              selected={selected}
              onSelect={(key) => { setSelected(key); setDetailOpen(true); }}
            />
          </Pane>
        }
        right={
          <Pane title="动态" padding="md">
            <p className="aui-note">昨天 陈一鸣 电话回访；3 天前 发送报价单。</p>
          </Pane>
        }
      >
        {customer && (
          <Pane
            title={customer.name}
            hint={`${customer.city} · 负责人 ${personName(customer.owner)}`}
            actions={<>
              <IconButton label="改名" icon={<Pencil />} />
              <IconButton label="复制" icon={<Copy />} />
            </>}
          >
            <PaneSection title="基本信息">
              <DescriptionList items={[
                { label: "阶段", value: <StatusBadge tone="brand">{stageLabel(customer.stage)}</StatusBadge> },
                { label: "金额", value: formatAmount(customer.amount) },
                { label: "席位", value: `${customer.seats} 席` },
                { label: "下次跟进", value: customer.nextFollowUp },
              ]} />
            </PaneSection>
            <PaneSection title="联系人" count={2}>
              <p className="aui-note">采购负责人、IT 负责人。</p>
            </PaneSection>
          </Pane>
        )}
      </WorkspaceLayout>
    </div>
  );
}
