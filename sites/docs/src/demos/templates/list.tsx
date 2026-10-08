import { useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, UserCog } from "lucide-react";
import {
  Button, CellPeople, CellTags, CellText, Choice, DataTable, PageBody, PageHeader, QueryBar, ResourcePanel, RowActionBar,
  useNotify, type Column,
} from "@adminui/react";
import { CUSTOMERS, INDUSTRIES, PEOPLE, STAGES, formatAmount, personName, type Customer } from "../../data/demo-data";

/** T02 资源列表页：一张列表卡（标题 · 数量 · 按钮）→ 筛选行 → 表格（每行 ≤3 个操作）→ 分页；勾选后底部浮出批量条。 */
export function Demo() {
  const notify = useNotify();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [owner, setOwner] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const rows = useMemo(
    () =>
      CUSTOMERS.filter(
        (c) =>
          (!q || c.name.includes(q) || c.city.includes(q)) &&
          (stage === "all" || c.stage === stage) &&
          (owner === "all" || c.owner === owner) &&
          (industry === "all" || c.industry === industry),
      ),
    [q, stage, owner, industry],
  );
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => { setDraft(""); setQ(""); setStage("all"); setOwner("all"); setIndustry("all"); setPage(1); };

  const columns: Column<Customer>[] = [
    { key: "name", title: "客户", maxWidth: 260, render: (c) => <CellText primary={<strong>{c.name}</strong>} secondary={`${c.industry} · ${c.city} · ${c.seats} 席位`} /> },
    { key: "stage", title: "阶段", width: 120, render: (c) => { const s = STAGES.find((x) => x.value === c.stage); return s ? <CellTags items={[{ label: s.label, tone: s.tone }]} label="阶段" /> : null; } },
    { key: "amount", title: "预计金额", numeric: true, align: "right", render: (c) => formatAmount(c.amount) },
    { key: "owner", title: "负责人", render: (c) => <CellPeople people={[{ name: personName(c.owner) }]} /> },
    { key: "next", title: "下次跟进", render: (c) => c.nextFollowUp },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (c) => (
        <RowActionBar
          label={`${c.name}的更多操作`}
          actions={[
            { key: "view", label: "查看", icon: <Eye />, onSelect: () => notify(`打开 ${c.name}`) },
            { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => notify(`编辑 ${c.name}`) },
            { key: "owner", label: "换负责人", icon: <UserCog />, menuOnly: true, onSelect: () => notify("换负责人") },
            { key: "del", label: "删除", destructive: true, onSelect: () => notify(`删除 ${c.name}`) },
          ]}
        />
      ),
    },
  ];
  const opt = (label: string, list: readonly { value: string; label: string }[]) => [{ value: "all", label: `${label}：全部` }, ...list];

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)", display: "flex", flexDirection: "column" }}>
      <PageHeader title="客户" />
      <PageBody fill>
        <ResourcePanel
          title="客户"
          count={rows.length}
          unit="家"
          description="所有签约和跟进中的客户；负责人每周一自动收到跟进提醒。"
          actions={<><Button size="sm" variant="outline" onClick={() => notify("开始导出")}><Download />导出</Button><Button size="sm" onClick={() => notify("新建客户")}><Plus />新建客户</Button></>}
          filters={
            <QueryBar value={draft} onChange={setDraft} onSearch={() => { setQ(draft.trim()); setPage(1); }} onReset={reset} placeholder="搜客户名称、城市">
              <Choice label="阶段" value={stage} onChange={(v) => { setStage(v); setPage(1); }} options={opt("阶段", STAGES)} />
              <Choice label="负责人" value={owner} onChange={(v) => { setOwner(v); setPage(1); }} options={opt("负责人", PEOPLE.slice(1, 5).map((p) => ({ value: p.id, label: p.name })))} />
              <Choice label="行业" value={industry} onChange={(v) => { setIndustry(v); setPage(1); }} options={opt("行业", INDUSTRIES.map((i) => ({ value: i, label: i })))} />
            </QueryBar>
          }
        >
          <DataTable
            caption="客户列表"
            rows={shown}
            rowKey={(c) => c.id}
            columns={columns}
            rowHeight="medium"
            selected={selected}
            onSelectionChange={setSelected}
            bulkActions={[
              { key: "owner", label: "换负责人", icon: <UserCog />, onSelect: () => notify(`给 ${selected.length} 个客户换负责人`) },
              { key: "export", label: "导出选中", icon: <Download />, onSelect: () => notify(`导出 ${selected.length} 个客户`) },
            ]}
            pagination={{ mode: "page", total: rows.length, page, pageSize, pageSizes: [8, 20, 50], onPageChange: setPage, onPageSizeChange: (n) => { setPageSize(n); setPage(1); } }}
          />
        </ResourcePanel>
      </PageBody>
    </div>
  );
}
