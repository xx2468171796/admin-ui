// 列表页不写大标题：PageHeader 的按钮和「?」自动并进第一张卡（ResourcePanel）的标题行，右侧最多一个主按钮。
// 标题只留给读屏（h1）；页面介绍收进「?」，不写成一段话。外壳里的页面自带 <main>，这里单独演示所以自己包一层。
import { Download, Plus } from "lucide-react";
import { Button, DataTable, PageBody, PageHeader, ResourcePanel, StatusBadge, type Column } from "@adminui/react";
import { CUSTOMERS, formatAmount, stageLabel, type Customer } from "../../data/demo-data";

const COLUMNS: readonly Column<Customer>[] = [
  { key: "name", title: "客户", render: (r) => r.name, minWidth: 160 },
  { key: "city", title: "城市", render: (r) => r.city },
  { key: "stage", title: "阶段", render: (r) => <StatusBadge variant="dot">{stageLabel(r.stage)}</StatusBadge> },
  { key: "amount", title: "金额", render: (r) => formatAmount(r.amount), numeric: true, align: "right" },
];

export function Demo() {
  const rows = CUSTOMERS.slice(0, 5);
  return (
    <main>
      <PageBody>
        <PageHeader
          title="客户"
          description="公司所有客户。只看到你有权限的客户；导出按当前筛选。"
          actions={<>
            <Button variant="outline" size="sm"><Download aria-hidden="true" />导出</Button>
            <Button size="sm"><Plus aria-hidden="true" />新建客户</Button>
          </>}
        />
        <ResourcePanel title="本周新增" count={rows.length} unit="个">
          <DataTable caption="客户" rows={rows} rowKey={(r) => r.id} columns={COLUMNS} pagination={{ mode: "all" }} />
        </ResourcePanel>
      </PageBody>
    </main>
  );
}
