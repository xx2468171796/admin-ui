import { useState } from "react";
import { ArrowRightLeft, Download, History, Pencil, Plus, Settings2, Shield, Trash2 } from "lucide-react";
import { Button, ChipGroup, useNotify, type TableRowHeightPreset } from "@adminui/react";
import { BitableGrid, type GridCellChange, type GridField } from "@adminui/react/grid";
import { STAGES } from "../../data/demo-data";
import { GRID_CUSTOMERS, OWNER_OPTIONS, TAGS, type GridCustomer } from "../../data/data-data";

type Props = { rowHeight?: string; frozenColumns?: number; toolbarSearch?: string; summary?: boolean };

const TODAY = "2026-10-08";
const fields: GridField<GridCustomer>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true, width: 180, editable: true, required: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, width: 112, editable: true },
  { key: "owner", title: "负责人", type: "user", width: 108, editable: true },
  { key: "tags", title: "标签", type: "multiSelect", options: TAGS, width: 160, editable: true },
  { key: "amount", title: "合同金额", type: "money", precision: 0, width: 132, editable: true, summary: "sum" },
  { key: "seats", title: "席位", type: "number", precision: 0, width: 88, editable: true, summary: "avg" },
  { key: "intent", title: "意向", type: "rating", width: 108, editable: true },
  { key: "progress", title: "上线进度", type: "progress", width: 128, editable: true },
  { key: "nextFollowUp", title: "下次跟进", type: "date", width: 116, editable: true, deadline: true,
    tone: (r) => (r.nextFollowUp < TODAY ? "danger" : null), description: "早于今天的标红" },
  { key: "active", title: "启用", type: "checkbox", width: 72, editable: true },
  { key: "website", title: "官网", type: "url", width: 180 },
  { key: "note", title: "备注", type: "longText", width: 220, editable: true },
];

/** 客户表：13 种字段的标准格子，双击 / 回车 / 直接打字编辑，勾选后底部浮条，少用的表级操作进「⋯」。 */
export function Demo({ rowHeight = "short", frozenColumns = 1, toolbarSearch = "icon", summary = true }: Props) {
  const notify = useNotify();
  const [rows, setRows] = useState<readonly GridCustomer[]>(GRID_CUSTOMERS);
  const [selection, setSelection] = useState<string[]>([]);
  const [quick, setQuick] = useState<string[]>([]);

  // 一批改动（编辑、粘贴、清空、撤销）一次保存；保存成功后再 resolve
  const save = async (changes: GridCellChange<GridCustomer>[]) => {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setRows((list) => list.map((row) => changes.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
  };

  return (
    <BitableGrid
      key={rowHeight}
      caption="客户"
      rows={rows}
      getRowId={(r) => r.id}
      fields={fields}
      rowHeight={rowHeight as TableRowHeightPreset}
      frozenColumns={frozenColumns}
      summary={summary}
      height={500}
      selection={selection}
      onSelectionChange={setSelection}
      onCellsChange={save}
      peopleOptions={{ owner: OWNER_OPTIONS }}
      toolbarSearch={toolbarSearch === "box" ? "box" : "icon"}
      toolbarQuick={
        <ChipGroup label="快捷筛选" value={quick} onValueChange={(next) => setQuick(next.filter((v) => !quick.includes(v)))}
          options={[{ value: "overdue", label: "逾期未跟进", count: 3 }]} />
      }
      toolbarMore={[
        { key: "table", items: [
          { key: "settings", label: "表设置", icon: <Settings2 aria-hidden="true" />, onSelect: () => notify("打开表设置", "info") },
          { key: "access", label: "权限", icon: <Shield aria-hidden="true" />, onSelect: () => notify("打开权限", "info") },
          { key: "log", label: "操作记录", icon: <History aria-hidden="true" />, onSelect: () => notify("打开操作记录", "info") },
        ] },
        { key: "data", items: [{ key: "export", label: "导出 Excel", icon: <Download aria-hidden="true" />, onSelect: () => notify("正在导出", "info") }] },
      ]}
      actions={<Button size="sm" onClick={() => notify("新建一条客户记录", "info")}><Plus aria-hidden="true" />新记录</Button>}
      bulkActions={(ids) => [
        { key: "transfer", label: "转交", icon: <ArrowRightLeft aria-hidden="true" />, onSelect: () => notify(`转交 ${ids.length} 条`, "info") },
        { key: "edit", label: "批量修改", icon: <Pencil aria-hidden="true" />, onSelect: () => notify(`批量修改 ${ids.length} 条`, "info") },
        { key: "delete", label: "删除", icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => { setRows((list) => list.filter((r) => !ids.includes(r.id))); setSelection([]); } },
      ]}
      emptyLabel="还没有客户"
    />
  );
}
