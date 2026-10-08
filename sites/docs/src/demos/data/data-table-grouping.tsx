import { useState } from "react";
import { Count, CellText, DataTable, PersonChip, compareGroupKeys, flattenGroups, groupRows, type Column } from "@adminui/react";
import { formatAmount, personName, stageLabel, type Customer } from "../../data/demo-data";
import { CUSTOMERS } from "../../data/data-data";

const columns: Column<Customer>[] = [
  { key: "name", title: "客户", width: 240, render: (r) => <CellText primary={r.name} secondary={`${r.id} · ${r.industry} · ${r.city}`} /> },
  { key: "owner", title: "负责人", width: 140, render: (r) => <PersonChip plain name={personName(r.owner)} id={r.owner} /> },
  { key: "seats", title: "席位", numeric: true, width: 88, render: (r) => r.seats },
  { key: "amount", title: "合同金额", numeric: true, render: (r) => formatAmount(r.amount) },
];

const byStage = (r: Customer) => stageLabel(r.stage);
const totals = new Map<string, number>();
for (const c of CUSTOMERS) totals.set(byStage(c), (totals.get(byStage(c)) ?? 0) + 1);

/** 两行行高（56px）：第二行的编号、行业只在这一档出现；按阶段分组、可折叠；游标分页只写「第 N 页」，不写总数。 */
export function Demo() {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 12;
  const arranged = flattenGroups(groupRows(CUSTOMERS, byStage, compareGroupKeys));
  const rows = arranged.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  return (
    <DataTable
      caption="按阶段分组的客户"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHeight="medium"
      grouping={{
        by: byStage,
        collapsed,
        onCollapsedChange: setCollapsed,
        header: (key) => <><strong>{key}</strong> <Count>{totals.get(key) ?? 0}</Count></>,
      }}
      pagination={{
        mode: "cursor",
        pageIndex,
        pageSize,
        onPageSizeChange: () => undefined,
        canPrev: pageIndex > 0,
        canNext: (pageIndex + 1) * pageSize < arranged.length,
        onPrev: () => setPageIndex((i) => i - 1),
        onNext: () => setPageIndex((i) => i + 1),
      }}
    />
  );
}
