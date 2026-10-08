import { useState } from "react";
import { BitableGrid, type GridCellChange, type GridField, type GridViewInput } from "@adminui/react/grid";
import { STAGES } from "../../data/demo-data";
import { GRID_CUSTOMERS, OWNER_OPTIONS, TAGS, type GridCustomer } from "../../data/data-data";

const fields: GridField<GridCustomer>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true, width: 180, editable: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, width: 112, editable: true },
  { key: "owner", title: "负责人", type: "user", width: 108, editable: true },
  { key: "tags", title: "标签", type: "multiSelect", options: TAGS, width: 160, editable: true },
  { key: "amount", title: "合同金额", type: "money", precision: 0, width: 140, editable: true },
  { key: "seats", title: "席位", type: "number", precision: 0, width: 96, editable: true },
  { key: "active", title: "启用", type: "checkbox", width: 72, editable: true },
];

// 视图可以整块存下来：分组、统计、筛选、填色都在里面（真实页面用 useGridView 按人保存）
const defaultView: GridViewInput = {
  groupBy: [{ field: "stage", order: "asc" }],
  summary: { amount: "sum", seats: "avg" },
  filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "active", op: "checked" }] },
  colors: [{ id: "risk", target: "row", tone: "orange", filter: { id: "c1", conjunction: "and", items: [{ id: "c1a", field: "tags", op: "hasAny", value: ["risk"] }] } }],
};

/** 按阶段分组：组头带条数和组内统计，每组底部「+ 新增一行」自动带上阶段；「流失风险」整行填色；只看启用的客户。 */
export function Demo() {
  const [rows, setRows] = useState<readonly GridCustomer[]>(GRID_CUSTOMERS);
  const save = async (changes: GridCellChange<GridCustomer>[]) => {
    setRows((list) => list.map((row) => changes.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
  };
  const addRow = (group: Readonly<Record<string, string>>) => {
    setRows((list) => [...list, {
      id: `C${2000 + list.length}`, name: "", stage: group.stage ?? "lead", owner: [], industry: "", tags: [],
      amount: 0, seats: 0, intent: 0, progress: null, nextFollowUp: "2026-10-15", active: true, website: "", note: "",
    }]);
  };
  return (
    <BitableGrid
      caption="按阶段分组的客户"
      rows={rows}
      getRowId={(r) => r.id}
      fields={fields}
      defaultView={defaultView}
      height={500}
      onCellsChange={save}
      onAddRow={addRow}
      peopleOptions={{ owner: OWNER_OPTIONS }}
      panelNote="只改你的视图 · 自动保存"
    />
  );
}
