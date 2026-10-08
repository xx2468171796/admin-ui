import { useState } from "react";
import { ArrowRightLeft, Download, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, CellDate, CellTags, CellText, DataTable, PersonChip, QueryBar, ResourcePanel, RowActionBar, SegmentedControl, useNotify, type Column } from "@adminui/react";
import { STAGES, formatAmount, personName, type Customer } from "../../data/demo-data";
import { CUSTOMERS, sortCustomers, type Sort } from "../../data/data-data";

/** 一个标准列表页：标题 + 条数、搜索与阶段筛选、可排序表头、勾选后底部批量浮条、操作列放得下就露、点行首图标看详情。 */
export function Demo() {
  const notify = useNotify();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [sort, setSort] = useState<Sort>({ key: "nextFollowUp", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);

  const matched = sortCustomers(CUSTOMERS, sort).filter((c) => (stage === "all" || c.stage === stage) && c.name.includes(query.trim()));
  const rows = matched.slice((page - 1) * pageSize, page * pageSize);
  const act = (what: string, r: Customer) => () => notify(`${what}「${r.name}」`, "info");

  const columns: Column<Customer>[] = [
    { key: "name", title: "客户", sortable: true, width: 220, truncate: (r) => r.name, render: (r) => <CellText primary={r.name} secondary={`${r.industry} · ${r.city}`} /> },
    { key: "stage", title: "阶段", width: 112, render: (r) => { const s = STAGES.find((x) => x.value === r.stage); return s ? <CellTags items={[{ label: s.label, tone: s.tone }]} /> : null; } },
    { key: "owner", title: "负责人", width: 120, render: (r) => <PersonChip plain name={personName(r.owner)} id={r.owner} /> },
    { key: "seats", title: "席位", numeric: true, sortable: true, width: 88, render: (r) => r.seats },
    { key: "amount", title: "合同金额", numeric: true, sortable: true, render: (r) => formatAmount(r.amount) },
    { key: "nextFollowUp", title: "下次跟进", sortable: true, width: 120, render: (r) => <CellDate value={r.nextFollowUp} /> },
    { key: "actions", title: "操作", kind: "actions", render: (r) => (
      <RowActionBar label={`${r.name}的更多操作`} actions={[
        { key: "edit", label: "编辑", icon: <Pencil />, onSelect: act("编辑", r) },
        { key: "follow", label: "跟进", icon: <MessageSquare />, onSelect: act("写跟进", r) },
        { key: "transfer", label: "转交", icon: <ArrowRightLeft />, disabled: !r.active, disabledReason: "客户已停用，不能转交", onSelect: act("转交", r) },
        { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: act("删除", r) },
      ]} />
    ) },
  ];

  return (
    <ResourcePanel
      title="客户"
      count={matched.length}
      unit="家"
      actions={<Button size="sm"><Plus aria-hidden="true" />新建客户</Button>}
      filters={
        <QueryBar variant="bare" value={query} onChange={(v) => { setQuery(v); setPage(1); }} onSearch={() => undefined} onReset={() => { setQuery(""); setStage("all"); }} canReset={stage !== "all"} placeholder="搜索客户名称" hits={query ? matched.length : null}>
          <SegmentedControl size="sm" label="阶段" value={stage} onValueChange={(v) => { setStage(v); setPage(1); }}
            options={[{ value: "all", label: "全部" }, ...STAGES.slice(0, 4).map((s) => ({ value: s.value, label: s.label }))]} />
        </QueryBar>
      }
    >
      <DataTable
        caption="客户"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        selected={selected}
        onSelectionChange={setSelected}
        bulkActions={[
          { key: "transfer", label: "转交", icon: <ArrowRightLeft />, onSelect: () => notify(`已转交 ${selected.length} 个客户`, "success") },
          { key: "export", label: "导出", icon: <Download />, onSelect: () => notify(`正在导出 ${selected.length} 个客户`, "info") },
          { key: "delete", label: "删除", icon: <Trash2 />, danger: true, onSelect: () => setSelected([]) },
        ]}
        emptyKind={query || stage !== "all" ? "no-results" : "empty"}
        emptyLabel={query || stage !== "all" ? "没有符合条件的客户" : "还没有客户"}
        expandRecord={{ title: (r) => r.name, description: (r) => `${r.id} · ${r.city}` }}
        pagination={{ mode: "page", total: matched.length, page, pageSize, pageSizes: [10, 20, 50], onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
      />
    </ResourcePanel>
  );
}
