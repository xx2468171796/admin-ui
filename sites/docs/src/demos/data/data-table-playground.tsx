import { useState } from "react";
import { ArrowRightLeft, Download, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { CellDate, CellTags, CellText, DataTable, PersonChip, RowActionBar, type Column, type TableRowHeight } from "@adminui/react";
import { STAGES, formatAmount, personName, type Customer } from "../../data/demo-data";
import { CUSTOMERS, sortCustomers, type Sort } from "../../data/data-data";

type Props = { rowHeight?: string; zebra?: boolean; state?: string; selectable?: boolean; mobile?: string; paging?: string };

const columns: Column<Customer>[] = [
  { key: "name", title: "客户", sortable: true, width: 220, mobile: "primary", truncate: (r) => r.name,
    render: (r) => <CellText primary={r.name} secondary={`${r.id} · ${r.city}`} /> },
  { key: "stage", title: "阶段", width: 112, mobile: "status", skeleton: "tag",
    render: (r) => { const s = STAGES.find((x) => x.value === r.stage); return s ? <CellTags items={[{ label: s.label, tone: s.tone }]} /> : null; } },
  { key: "owner", title: "负责人", width: 120, skeleton: "person", render: (r) => <PersonChip plain name={personName(r.owner)} id={r.owner} /> },
  { key: "amount", title: "合同金额", numeric: true, sortable: true, render: (r) => formatAmount(r.amount) },
  { key: "nextFollowUp", title: "下次跟进", sortable: true, width: 120, render: (r) => <CellDate value={r.nextFollowUp} /> },
  { key: "actions", title: "操作", kind: "actions", render: (r) => (
    <RowActionBar label={`${r.name}的更多操作`} actions={[
      { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => undefined },
      { key: "follow", label: "跟进", icon: <MessageSquare />, onSelect: () => undefined },
      { key: "transfer", label: "转交", icon: <ArrowRightLeft />, menuOnly: true, onSelect: () => undefined },
      { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => undefined },
    ]} />
  ) },
];

/** 改右侧属性看行高、斑马纹、加载 / 空 / 出错、勾选与批量浮条、手机卡片和两种分页。 */
export function Demo({ rowHeight = "default", zebra = false, state = "数据", selectable = true, mobile = "cards", paging = "page" }: Props) {
  const [sort, setSort] = useState<Sort>({ key: "amount", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const all = state === "数据" ? sortCustomers(CUSTOMERS, sort) : [];
  const rows = all.slice((page - 1) * pageSize, page * pageSize);
  return (
    <DataTable
      caption="客户"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      sort={sort}
      onSortChange={setSort}
      rowHeight={rowHeight === "default" ? undefined : (rowHeight as TableRowHeight)}
      zebra={zebra}
      loading={state === "加载中"}
      error={state === "出错" ? "客户列表加载失败" : undefined}
      errorDetails="请求号 req-7f3a9c · 503"
      onRetry={() => undefined}
      emptyKind="no-results"
      emptyLabel="没有符合筛选条件的客户"
      selected={selectable ? selected : undefined}
      onSelectionChange={selectable ? setSelected : undefined}
      bulkActions={[
        { key: "transfer", label: "转交", icon: <ArrowRightLeft />, onSelect: () => setSelected([]) },
        { key: "export", label: "导出", icon: <Download />, onSelect: () => undefined },
        { key: "delete", label: "删除", icon: <Trash2 />, danger: true, onSelect: () => setSelected([]) },
      ]}
      mobile={mobile === "table" ? "table" : "cards"}
      expandRecord={{ title: (r) => r.name }}
      pagination={
        paging === "cursor"
          ? { mode: "cursor", pageIndex: page - 1, pageSize, onPageSizeChange: setPageSize, canPrev: page > 1, canNext: page * pageSize < all.length, onPrev: () => setPage((p) => p - 1), onNext: () => setPage((p) => p + 1) }
          : { mode: "page", total: all.length, page, pageSize, pageSizes: [10, 20, 50], onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }
      }
    />
  );
}
