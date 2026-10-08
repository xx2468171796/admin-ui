import { useState } from "react";
import { Copy, Download, Pencil, Trash2 } from "lucide-react";
import { RowActionBar, RowActions, useNotify, useUndoToast, type RowAction } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

/**
 * 行操作：RowActionBar 放得下就露最多 3 个（图标 + 字），其余进「⋯」；
 * 危险和灰掉的默认在「⋯」里。只要一个「⋯」时用 RowActions。手机上「⋯」变底部操作单。
 */
export function Demo() {
  const notify = useNotify();
  const undoable = useUndoToast();
  const [rows, setRows] = useState(CUSTOMERS.slice(0, 4));
  const actionsFor = (id: string, name: string): RowAction[] => [
    { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => notify(`编辑「${name}」`, "info") },
    { key: "copy", label: "复制", icon: <Copy />, onSelect: () => notify(`已复制「${name}」`) },
    { key: "export", label: "导出", icon: <Download />, disabled: true, disabledReason: "管理员关掉了导出", onSelect: () => undefined },
    {
      key: "delete",
      label: "删除",
      icon: <Trash2 />,
      destructive: true,
      onSelect: () => {
        const before = rows;
        void undoable({ title: "已删除客户", description: name, run: () => setRows((list) => list.filter((r) => r.id !== id)), undo: () => setRows(before) });
      },
    },
  ];
  return (
    <div style={{ display: "grid", gap: 4, maxWidth: 560 }}>
      {rows.map((c, i) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
          <span>{c.name}</span>
          {i % 2 === 0 ? <RowActionBar actions={actionsFor(c.id, c.name)} label={`${c.name} 的操作`} max={2} /> : <RowActions actions={actionsFor(c.id, c.name)} label={`${c.name} 的操作`} />}
        </div>
      ))}
    </div>
  );
}
