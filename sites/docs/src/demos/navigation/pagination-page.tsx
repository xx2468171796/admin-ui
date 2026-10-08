// 表格用页码：左「共 1,284 条 · 第 41–60 条」，右 每页条数 · ‹ 1 … 3 4 5 … 65 ›；当前页 = 主色浅底 + 加粗，页码无框。
// 翻页时旧行留着、变淡（refreshing），页码区不能连点。手机上变「‹ 3 / 65 ›」。
import { useState } from "react";
import { DataTable, StatusBadge, type Column } from "@adminui/react";
import { CUSTOMERS, formatAmount, stageLabel, type Customer } from "../../data/demo-data";

const TOTAL = 1284;
const COLUMNS: readonly Column<Customer>[] = [
  { key: "name", title: "客户", render: (r) => r.name, minWidth: 160 },
  { key: "id", title: "编号", render: (r) => r.id, width: 96 },
  { key: "stage", title: "阶段", render: (r) => <StatusBadge variant="dot">{stageLabel(r.stage)}</StatusBadge> },
  { key: "amount", title: "金额", render: (r) => formatAmount(r.amount), numeric: true, align: "right" },
];

/** 假的服务端分页：用演示客户拼出第 page 页。 */
function pageRows(page: number, size: number): Customer[] {
  const start = (page - 1) * size;
  const count = Math.max(0, Math.min(size, TOTAL - start));
  return Array.from({ length: count }, (_, i) => {
    const base = CUSTOMERS[(start + i) % CUSTOMERS.length] ?? CUSTOMERS[0];
    return { ...(base as Customer), id: `C${10001 + start + i}` };
  });
}

export function Demo() {
  const [page, setPage] = useState(3);
  const [size, setSize] = useState(10);
  const [rows, setRows] = useState(() => pageRows(3, 10));
  const [refreshing, setRefreshing] = useState(false);
  const load = (nextPage: number, nextSize: number) => {
    setPage(nextPage);
    setSize(nextSize);
    setRefreshing(true);
    window.setTimeout(() => {
      setRows(pageRows(nextPage, nextSize));
      setRefreshing(false);
    }, 350);
  };
  return (
    <DataTable
      caption="客户"
      rows={rows}
      rowKey={(r) => r.id}
      columns={COLUMNS}
      refreshing={refreshing}
      pagination={{
        mode: "page",
        total: TOTAL,
        page,
        pageSize: size,
        pageSizes: [10, 20, 50],
        onPageChange: (p) => load(p, size),
        onPageSizeChange: (s) => load(1, s),
      }}
    />
  );
}
