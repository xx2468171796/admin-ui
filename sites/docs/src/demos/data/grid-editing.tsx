import { useState } from "react";
import { Panel } from "@adminui/react";
import { BitableGrid, type GridCellChange, type GridField } from "@adminui/react/grid";

type Line = { id: string; item: string; plan: string; qty: number | null; price: number | null; due: string | null; done: boolean };

const PLANS = [
  { value: "basic", label: "基础版", tone: "gray" },
  { value: "team", label: "团队版", tone: "blue" },
  { value: "enterprise", label: "企业版", tone: "violet" },
] as const;

const fields: GridField<Line>[] = [
  { key: "item", title: "报价项", type: "text", primary: true, width: 180, editable: true, required: true, placeholder: "写报价项名称" },
  { key: "plan", title: "版本", type: "singleSelect", options: PLANS, width: 112, editable: true },
  { key: "qty", title: "数量", type: "number", precision: 0, width: 88, editable: true,
    validate: (v) => (typeof v === "number" && v > 500 ? "单次最多 500 个席位" : null) },
  { key: "price", title: "单价", type: "money", width: 120, editable: true },
  { key: "due", title: "交付日期", type: "date", width: 120, editable: true },
  { key: "done", title: "已确认", type: "checkbox", width: 80, editable: true },
];

const START: Line[] = [
  { id: "q1", item: "席位授权", plan: "team", qty: 120, price: 36_000, due: "2026-10-20", done: true },
  { id: "q2", item: "单点登录接入", plan: "enterprise", qty: 1, price: 1_200_000, due: "2026-10-31", done: false },
  { id: "q3", item: "数据迁移服务", plan: "enterprise", qty: 1, price: 800_000, due: null, done: false },
  { id: "q4", item: "上线培训", plan: "basic", qty: 2, price: 150_000, due: "2026-11-05", done: false },
];

/**
 * 嵌在卡片里的小表：高度随行数、不要工具栏。试试：双击「数量」改成 600（格子里显示原因、不关编辑框）；
 * 把「单价」改成 0 —— 服务端拒绝，这一格回滚并提示；Ctrl + Z 撤销。
 */
export function Demo() {
  const [rows, setRows] = useState<readonly Line[]>(START);
  const save = async (changes: GridCellChange<Line>[]) => {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const rejected = changes.filter((c) => c.field === "price" && c.value === 0).map((c) => ({ rowId: c.rowId, field: c.field, error: "单价不能为 0" }));
    const ok = changes.filter((c) => !rejected.some((r) => r.rowId === c.rowId && r.field === c.field));
    setRows((list) => list.map((row) => ok.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
    return { rejected };
  };
  return (
    <Panel title="报价明细" count={`${rows.length} 项`} flush>
      <BitableGrid caption="报价明细" rows={rows} getRowId={(r) => r.id} fields={fields} onCellsChange={save} height="auto" toolbar={false} summary={false} expandRecord={false} />
    </Panel>
  );
}
