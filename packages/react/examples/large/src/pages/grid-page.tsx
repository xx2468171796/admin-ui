// Lazy route: the multi-dimensional table (@adminui/react/grid pulls TanStack Table + Virtual).
import { useState } from "react";
import { PageBody, PageHeader } from "@adminui/react";
import { BitableGrid, type GridField } from "@adminui/react/grid";
import { CUSTOMERS, STAGES, type Customer } from "../data";

const FIELDS: GridField<Customer>[] = [
  { key: "name", title: "客户", type: "text", primary: true, width: 180, value: (c) => c.name },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, width: 120, value: (c) => c.stage, groupable: true },
  { key: "owner", title: "负责人", type: "text", width: 110, value: (c) => c.owner },
  { key: "amount", title: "预计金额", type: "money", width: 140, value: (c) => c.amount * 100, summary: "sum" },
  { key: "next", title: "下次跟进", type: "date", deadline: true, width: 140, value: (c) => c.next },
];

export function GridPage() {
  const [selection, setSelection] = useState<string[]>([]);
  return (
    <PageBody>
      <PageHeader title="客户表" />
      <BitableGrid caption="客户表" rows={CUSTOMERS} getRowId={(c) => c.id} fields={FIELDS} selection={selection} onSelectionChange={setSelection} />
    </PageBody>
  );
}
