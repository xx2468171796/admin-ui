import { recordDemoAudit } from "./governance-demo";
import { useMemo, useState } from "react";
import { Archive, Download, UserCheck } from "lucide-react";
import {
  Button, ConfirmDialog, CellDate, CellLink, CellPeople, CellTags, CellText, Checkbox, Choice, DataTable,
  FormDialog, FormField, Input, MoneyDisplay, PageHeader, QueryBar, ResourcePanel, RowActionBar, StatusBadge,
  TablePreferencesMenu, useNotify, buildCsv, compareGroupKeys, downloadCsv, flattenGroups, groupRows,
  type CellPerson, type CellTagItem, type Column, type Sort, type TablePreferences,
} from "@adminui/react";

// 后台主列表的标准写法（DataTable）：行内可见操作、固定行高（用户在「表格设置」里选 矮 / 中 / 高 / 超高）、
// 分页、行首图标「展开记录」看整条记录；字段格子用 Cell*（标签放不下收进 +N、协作人、链接、日期）。
// 勾选后底部浮出批量条（bulkActions，不推动表格）；手机上每行一张卡片（列上的 mobile 提示决定卡片上放什么）。
type Order = {
  id: string; customer: string; contact: string; owner: string; region: string;
  amount: bigint; status: string; date: string; note: string;
  tags: CellTagItem[]; team: CellPerson[]; contract: string; updated: string;
};
const TAGS: CellTagItem[] = [
  { label: "重点客户", tone: "green" }, { label: "华东一区" }, { label: "年框合同", tone: "green" },
  { label: "需开专票", tone: "yellow" }, { label: "账期 60 天" }, { label: "逾期风险", tone: "red" },
  { label: "已签保密协议" }, { label: "续约 2026Q4" },
];
const PEOPLE: CellPerson[] = [
  { name: "陈晓", hint: "销售部" }, { name: "林宁", hint: "交付组" }, { name: "周敏", hint: "财务部" }, { name: "王磊", hint: "法务" },
];
const defaults: TablePreferences = {
  density: "comfortable", columns: ["id", "customer", "contact", "owner", "region", "amount", "status", "tags", "team", "date", "note", "contract", "updated", "actions"],
  hidden: [], pinned: "id", pageSize: 10,
};
const pad = (n: number) => String(n).padStart(4, "0");
const initial: Order[] = Array.from({ length: 36 }, (_, i) => ({
  id: `SO-${pad(i + 1)}`,
  customer: ["Acme 科技", "远山精密制造与工业自动化有限公司", "星河供应链", "青禾商贸"][i % 4]!,
  contact: ["王经理 · 采购部", "李工 · 设备科", "赵总 · 运营", "孙会计 · 财务"][i % 4]!,
  owner: ["陈晓", "林宁", "周敏"][i % 3]!, region: ["华东", "华南", "西南"][i % 3]!,
  amount: BigInt(128000 + i * 13799), status: i % 7 === 0 ? "已归档" : i % 3 ? "待跟进" : "跟进中",
  date: `2026-09-${String(1 + i % 20).padStart(2, "0")}`,
  note: "交付前请与采购负责人核对收货批次、发票抬头和交付地址。此处为完整业务备注，可在展开记录里阅读。",
  tags: TAGS.slice(0, 1 + (i * 3) % TAGS.length),
  team: PEOPLE.slice(0, 1 + i % 4),
  contract: `https://contracts.example.com/orders/SO-${pad(i + 1)}?view=pdf&version=latest`,
  updated: new Date(Date.UTC(2026, 8, 1 + (i % 28), 2 + (i % 12), (i * 7) % 60)).toISOString(),
}));

export function BusinessTables() {
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [statusDraft, setStatusDraft] = useState("all");
  const [page, setPage] = useState(1);
  const [sorts, setSorts] = useState<readonly Sort[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // 展开记录：受控的打开记录（行内「详情」按钮和行首图标都打开它）
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(defaults);
  // rowHeight="auto" 是逃生口：内容撑高行，只给短列表；行高档位由用户在「表格设置」里选
  const [grow, setGrow] = useState(false);
  const [zebra, setZebra] = useState(true);
  // 分组：默认不分组（筛选才是主要手段）；分组时整行宽的分组标题可折叠，列排序只在组内排
  const [groupBy, setGroupBy] = useState<"none" | "region" | "owner">("none");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [editing, setEditing] = useState<Order | null>(null);
  const [owner, setOwner] = useState("");
  const [confirmFollow, setConfirmFollow] = useState(false);
  const notify = useNotify();
  const resetContext = () => { setPage(1); setSelected([]); };
  const resetFilters = () => { setDraft(""); setSearch(""); setStatus("all"); setStatusDraft("all"); resetContext(); };
  const matched = useMemo(() => rows.filter(row =>
    `${row.id} ${row.customer} ${row.owner} ${row.tags.map(t => t.label).join(" ")}`.includes(search) && (status === "all" || row.status === status),
  ).sort((a, b) => {
    for (const sort of sorts) {
      const key = sort.key as keyof Order;
      const left = a[key], right = b[key];
      const diff = typeof left === "bigint" && typeof right === "bigint" ? (left < right ? -1 : left > right ? 1 : 0) : String(left).localeCompare(String(right), "zh-CN");
      if (diff) return diff * (sort.direction === "desc" ? -1 : 1);
    }
    return a.id.localeCompare(b.id);
  }), [rows, search, status, sorts]);
  const groupOf = (row: Order) => (groupBy === "owner" ? row.owner : row.region);
  // 先分组再翻页：同组相邻，翻页不会把两组穿插起来
  const arranged = useMemo(() => (groupBy === "none" ? matched : flattenGroups(groupRows(matched, groupOf, compareGroupKeys))), [matched, groupBy]);
  const groupTotals = useMemo(() => new Map(groupRows(matched, groupOf).map(g => [g.key, { total: g.rows.length, open: g.rows.filter(row => row.status !== "已归档").length }])), [matched, groupBy]);
  const columns: Column<Order>[] = [
    { key: "id", title: "订单编号", width: 150, sortable: true, render: row => <strong>{row.id}</strong> },
    // wrap 列（3.0）：在行的行数内换行，放不下省略号 + 悬停全文，不再撑高行
    { key: "customer", title: "客户名称", width: 220, minWidth: 180, wrap: true, sortable: true, mobile: "primary", render: row => row.customer },
    // 主文字 + 一行灰色说明；矮行里说明进悬停提示
    { key: "contact", title: "联系人", width: 150, maxWidth: 170, render: row => <CellText primary={row.contact.split(" · ")[0]} secondary={row.contact.split(" · ")[1]} />, detail: row => row.contact },
    { key: "owner", title: "负责人", width: 100, sortable: true, mobile: "meta", render: row => row.owner },
    { key: "region", title: "区域", width: 90, render: row => row.region },
    { key: "amount", title: "订单金额（元）", width: 180, numeric: true, sortable: true, mobile: "meta", render: row => <MoneyDisplay value={row.amount} unit="" /> },
    { key: "status", title: "状态", width: 110, sortable: true, render: row => <StatusBadge tone={row.status === "已归档" ? "neutral" : row.status === "待跟进" ? "warning" : "brand"}>{row.status}</StatusBadge> },
    { key: "tags", title: "标签", width: 200, maxWidth: 220, render: row => <CellTags label={`${row.id}的标签`} items={row.tags} /> },
    { key: "team", title: "协作人", width: 160, maxWidth: 170, render: row => <CellPeople label={`${row.id}的协作人`} people={row.team} /> },
    { key: "date", title: "创建日期", width: 130, sortable: true, mobile: "meta", render: row => <CellDate value={row.date} /> },
    // 长文本单行截断：省略号 + 悬停看全文（完整内容也在展开区）
    { key: "note", title: "备注", maxWidth: 240, truncate: row => row.note, render: row => row.note },
    { key: "contract", title: "合同", width: 180, maxWidth: 200, render: row => <CellLink href={row.contract} /> },
    { key: "updated", title: "更新时间", width: 150, render: row => <CellDate value={row.updated} time /> },
    // 操作列用 RowActionBar：放得下就露（最多 3 个），其余进 ⋯；不可用的带原因进 ⋯
    { key: "actions", title: "操作", width: 220, kind: "actions", render: row => <RowActionBar label={`${row.id}的更多操作`} actions={[
      { key: "detail", label: "详情", onSelect: () => setOpenKey(row.id) },
      { key: "owner", label: "修改负责人", disabled: row.status === "已归档", disabledReason: "已归档的订单不能改负责人", onSelect: () => { setOwner(row.owner); setEditing(row); } },
      { key: "copy", label: "复制编号", menuOnly: true, onSelect: () => { void navigator.clipboard?.writeText(row.id).catch(() => undefined); } },
    ]} /> },
  ];
  return <>
    <PageHeader title="客户与订单" description="集中查看客户、跟进状态和订单金额。已归档订单只读。" actions={
      <Button variant="outline" disabled={!matched.length} onClick={() => { recordDemoAudit("orders:export", String(matched.length)); downloadCsv("客户订单", buildCsv(matched, [
        { title: "订单编号", value: row => row.id }, { title: "客户", value: row => row.customer },
        { title: "负责人", value: row => row.owner }, { title: "金额（分）", value: row => row.amount.toString(), type: "number" },
      ])); }}><Download />导出筛选结果</Button>
    } />
    <ResourcePanel title="订单列表" count={matched.length} description="勾选可批量跟进，行首图标或「详情」打开整条记录；宽表可横向滚动。" filters={
      <QueryBar value={draft} onChange={setDraft} placeholder="搜索订单、客户或负责人" onSearch={() => { setSearch(draft); setStatus(statusDraft); resetContext(); }} onReset={resetFilters}>
        <Choice label="订单状态" value={statusDraft} onChange={setStatusDraft} options={[{ value: "all", label: "全部状态" }, ...["待跟进", "跟进中", "已归档"].map(value => ({ value, label: value }))]} />
      </QueryBar>
    }>
      <DataTable rows={arranged.slice((page - 1) * preferences.pageSize, page * preferences.pageSize)} columns={columns} rowKey={row => row.id} caption="客户订单"
        pagination={{
          mode: "page", total: matched.length, page, pageSize: preferences.pageSize, pageSizes: [10, 20, 50],
          onPageChange: value => { setPage(value); setSelected([]); },
          onPageSizeChange: pageSize => { setPreferences(value => ({ ...value, pageSize })); resetContext(); },
        }}
        sorts={sorts} onSortsChange={value => { setSorts(value); resetContext(); }}
        preferences={preferences} rowHeight={grow ? "auto" : undefined} zebra={zebra} maxHeight={480}
        selected={selected} onSelectionChange={setSelected} isRowSelectable={row => row.status !== "已归档"}
        bulkNote={`本页 ${Math.min(preferences.pageSize, Math.max(0, matched.length - (page - 1) * preferences.pageSize))} 条`}
        bulkActions={[
          { key: "follow", label: "标记跟进", icon: <UserCheck />, onSelect: () => setConfirmFollow(true) },
          { key: "export", label: "导出所选", icon: <Download />, onSelect: () => { recordDemoAudit("orders:export-selected", selected.join(", ")); downloadCsv("所选订单", buildCsv(rows.filter(row => selected.includes(row.id)), [
            { title: "订单编号", value: row => row.id }, { title: "客户", value: row => row.customer },
          ])); } },
          { key: "archive", label: "归档", icon: <Archive />, danger: true, disabled: true, disabledReason: "演示：归档要走审批", onSelect: () => undefined },
        ]}
        toolbar={<>
          <TablePreferencesMenu value={preferences} columns={columns} defaults={defaults} rowHeightControl onChange={value => { setPreferences(value); resetContext(); }} />
          <label className="aui-workflow-bar"><Checkbox checked={grow} onCheckedChange={value => setGrow(value === true)} />随内容撑高</label>
          <label className="aui-workflow-bar"><Checkbox checked={zebra} onCheckedChange={value => setZebra(value === true)} />斑马纹</label>
          <Choice label="分组" value={groupBy} onChange={value => { setGroupBy(value as typeof groupBy); setCollapsed([]); resetContext(); }} options={[
            { value: "none", label: "不分组" }, { value: "region", label: "按区域" }, { value: "owner", label: "按负责人" },
          ]} />
        </>}
        grouping={groupBy === "none" ? undefined : {
          by: groupOf, collapsed, onCollapsedChange: setCollapsed,
          header: key => <><strong>{key}</strong><span className="aui-note">共 {groupTotals.get(key)?.total ?? 0} 条 · 未归档 {groupTotals.get(key)?.open ?? 0} 条</span></>,
        }}
        expandRecord={{
          openKey, onOpenChange: setOpenKey,
          title: row => `${row.id} · ${row.customer}`,
          description: row => `${row.region} · 负责人 ${row.owner}`,
          label: row => row.id,
        }}
        emptyKind={search || status !== "all" ? "no-results" : "empty"} emptyAction={<Button variant="outline" onClick={resetFilters}>清空筛选</Button>}
      />
    </ResourcePanel>
    <ConfirmDialog open={confirmFollow} title={`把 ${selected.length} 条订单标记为跟进中？`} description="只改状态，不改金额；已归档的订单不会被选中。" confirmLabel={`标记 ${selected.length} 条`}
      onClose={() => setConfirmFollow(false)} onConfirm={() => {
        recordDemoAudit("orders:batch-follow", selected.join(", "));
        setRows(previous => previous.map(row => selected.includes(row.id) && row.status !== "已归档" ? { ...row, status: "跟进中" } : row));
        notify(`已把 ${selected.length} 条订单标记为跟进中`, "success");
        setSelected([]);
        setConfirmFollow(false);
      }} />
    <p className="aui-note" style={{ marginTop: 12 }}>演示数据 · 修改仅在当前会话有效，导出范围为当前筛选结果。</p>
    <FormDialog open={editing !== null} title="修改负责人" description={editing?.id ?? ""} dirty={Boolean(editing && owner !== editing.owner)} onClose={() => setEditing(null)} onSubmit={async () => {
      if (!owner.trim()) throw Error("请填写负责人");
      recordDemoAudit("orders:owner", editing?.id, [{ field: "owner", before: editing?.owner ?? "", after: owner.trim() }]);
      setRows(previous => previous.map(row => row.id === editing?.id && row.status !== "已归档" ? { ...row, owner: owner.trim() } : row));
      setEditing(null);
    }}>
      <FormField label="负责人" htmlFor="business-owner" required><Input id="business-owner" value={owner} onChange={event => setOwner(event.target.value)} /></FormField>
    </FormDialog>
  </>;
}
