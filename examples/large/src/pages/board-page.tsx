// Lazy route: the kanban view (@adminui/react/views).
import { useState } from "react";
import { PageBody, PageHeader } from "@adminui/react";
import type { GridField } from "@adminui/react/grid";
import { KanbanBoard } from "@adminui/react/views";
import { CUSTOMERS, STAGES, type Customer } from "../data";

const STAGE: GridField<Customer> = { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, value: (c) => c.stage, write: (c, v) => ({ ...c, stage: String(v) }) };
const AMOUNT: GridField<Customer> = { key: "amount", title: "预计金额", type: "money", currency: "CN¥", value: (c) => c.amount * 100 };
const OWNER: GridField<Customer> = { key: "owner", title: "负责人", type: "text", value: (c) => c.owner };

export function BoardPage() {
  const [rows, setRows] = useState(CUSTOMERS);
  return (
    <PageBody>
      <PageHeader title="客户看板" />
      <KanbanBoard
        label="客户看板"
        records={rows}
        recordId={(c) => c.id}
        groupField={STAGE}
        cardTitle={(c) => c.name}
        cardSlots={{ keyline: [AMOUNT], owner: OWNER }}
        sumField={AMOUNT}
        undo={false}
        onMove={(id, to) => setRows((list) => list.map((c) => (c.id === id ? { ...c, stage: to ?? "lead" } : c)))}
      />
    </PageBody>
  );
}
