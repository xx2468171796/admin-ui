import { useState } from "react";
import { Button, DataTable, DescriptionList, PersonChip, readableDetail, type Column } from "@adminui/react";

type AuditRow = { id: string; at: string; who: string; whoId: string; action: string; detail: Record<string, unknown> };

const ROWS: AuditRow[] = [
  { id: "a1", at: "2026-10-08 10:42", who: "林晓", whoId: "u01", action: "修改了客户「远航精密制造」",
    detail: { field: "阶段", before: "方案报价", after: "商务谈判", requestId: "req-7f3a9c", ids: ["C1001"], client: "web" } },
  { id: "a2", at: "2026-10-08 09:15", who: "陈一鸣", whoId: "u02", action: "批量转交 3 个客户",
    detail: { to: "王佳宁", count: 3, requestId: "req-51b0e2", ids: ["C1004", "C1009", "C1013"], client: "web" } },
];
// 只有给了中文名的 key 显示在键值列表里，其余是「技术字段」
const LABELS = { field: "字段", before: "改之前", after: "改之后", to: "转交给", count: "数量" };

function Detail({ row }: { row: AuditRow }) {
  const [raw, setRaw] = useState(false);
  const { shown, technical } = readableDetail(row.detail, { labels: LABELS });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <DescriptionList columns={2} items={shown.map((e) => ({ label: e.label, value: e.value }))} />
      <div>
        <Button size="xs" variant="ghost" aria-expanded={raw} onClick={() => setRaw((v) => !v)}>{raw ? "收起原始数据" : `原始数据（JSON，${technical.length} 项）`}</Button>
      </div>
      {raw && <DescriptionList columns={1} items={technical.map((e) => ({ label: e.key, value: <code>{e.value}</code> }))} />}
    </div>
  );
}

const columns: Column<AuditRow>[] = [
  { key: "at", title: "时间", width: 150, render: (r) => r.at },
  { key: "who", title: "操作人", width: 120, render: (r) => <PersonChip plain name={r.who} id={r.whoId} /> },
  { key: "action", title: "操作", render: (r) => r.action },
];

/** 嵌在展开行里：键值列表单独一块；技术 key（请求号、ID 数组）收进「原始数据（JSON）」。 */
export function Demo() {
  const [expanded, setExpanded] = useState<string[]>(["a1"]);
  return (
    <DataTable
      caption="操作日志"
      rows={ROWS}
      columns={columns}
      rowKey={(r) => r.id}
      expandable={{ expanded, onExpandedChange: setExpanded, label: (r) => r.action, render: (r) => <Detail row={r} /> }}
      pagination={{ mode: "all" }}
    />
  );
}
