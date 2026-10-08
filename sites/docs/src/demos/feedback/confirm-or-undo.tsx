import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog, confirmOrUndo, useUndoToast } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

const START = CUSTOMERS.slice(0, 4).map((c) => c.name);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 能撤销就别问：删一条直接做 +「撤销」8 秒；一次删 ≥ 20 条才弹确认。
 * confirmOrUndo 判断该走哪条路。
 */
export function Demo() {
  const [rows, setRows] = useState(START);
  const [asking, setAsking] = useState(false);
  const undoable = useUndoToast();
  const removeOne = (name: string) => {
    const before = rows;
    void undoable({ title: "已删除客户", description: name, run: () => setRows((list) => list.filter((n) => n !== name)), undo: () => setRows(before) });
  };
  const bulk = confirmOrUndo({ reversible: true, count: 36 });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rows.map((name) => (
          <Button key={name} variant="ghost" onClick={() => removeOne(name)}>
            <Trash2 aria-hidden="true" />
            删除「{name}」
          </Button>
        ))}
        {!rows.length && <span className="aui-note">都删了，点提示条上的「撤销」放回来</span>}
      </div>
      <div>
        <Button variant="destructive-outline" onClick={() => setAsking(bulk === "confirm")}>
          批量删除 36 条（{bulk === "confirm" ? "要确认" : "直接做"}）
        </Button>
      </div>
      <ConfirmDialog
        open={asking}
        destructive
        title="删除选中的 36 位客户？"
        description="数量较多，删除后只能由管理员从回收站恢复。"
        confirmLabel="删除 36 位"
        onConfirm={() => wait(600)}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}
