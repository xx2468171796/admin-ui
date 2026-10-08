import { useState } from "react";
import { History } from "lucide-react";
import { Button, TimeMachineDialog, useNotify, type TimeMachineKind, type TimeMachineOp, type TimeMachinePreview } from "@adminui/react";
import { DEMO_NOW, H } from "../../data/collab-data";

/**
 * 表时光机：拖时间轴或用快捷时间选一个时刻 → 先预览（改回 / 加回 / 移除 + 冲突）才能确认；
 * 那之后没有改动时不给确认、写清楚。回滚本身也是一次可以再撤回的操作。
 */
const KINDS: TimeMachineKind[] = [
  { key: "data", label: "数据", tone: "brand" },
  { key: "field", label: "字段", tone: "attention" },
  { key: "view", label: "视图", tone: "info" },
];
const OPS: TimeMachineOp[] = [
  { id: "058", at: DEMO_NOW - 66 * H, kind: "data", code: "OP-20261005-0058", label: "赵思远 导入 Excel 230 条" },
  { id: "064", at: DEMO_NOW - 50 * H, kind: "view", code: "OP-20261006-0064", label: "王佳宁 改「续约看板」分组" },
  { id: "119", at: DEMO_NOW - 44 * H, kind: "field", code: "OP-20261006-0119", label: "林晓 删除字段" },
  { id: "138", at: DEMO_NOW - 25 * H, kind: "data", code: "OP-20261007-0138", label: "自动化 退回公海 6 条" },
  { id: "142", at: DEMO_NOW - 5 * H, kind: "data", code: "OP-20261008-0142", label: "林晓 批量分配 12 条" },
  { id: "149", at: DEMO_NOW - 2 * H, kind: "data", code: "OP-20261008-0149", label: "陈一鸣 粘贴 48 格" },
];

/** 模拟服务端预览：目标越晚，要退回的越少。 */
function preview(target: number): TimeMachinePreview {
  const after = OPS.filter((o) => Number(o.at) > target).length;
  if (!after) return { counts: { change: 0, add: 0, remove: 0 }, conflicts: [] };
  return {
    counts: { change: after * 4, add: after > 3 ? 2 : 0, remove: after > 4 ? 230 : 0 },
    conflicts: after > 1 ? [{ key: "k1", record: "远航精密制造", field: "预计金额", then: "¥540,000", now: "¥480,000", by: "王佳宁", at: "10-08 09:05" }] : [],
  };
}

export function Demo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><History aria-hidden="true" />表时光机</Button>
      <TimeMachineDialog
        open={open}
        onClose={() => setOpen(false)}
        subtitle="客户 · 整张表退回到某个时间点"
        help="只有表管理员能用。回滚 = 把这一刻之后的改动反着做一遍，照常检查权限和校验。超过 3 天的只能在单元格修改历史里逐条恢复。"
        ops={OPS}
        kinds={KINDS}
        now={DEMO_NOW}
        initialTarget={DEMO_NOW - 30 * H}
        onPreview={async (target, signal) => {
          await new Promise((r) => setTimeout(r, 250));
          if (signal.aborted) throw new DOMException("aborted", "AbortError");
          return preview(target);
        }}
        onPreviewDiff={() => notify("打开只读的「那一刻」表格", "info")}
        onRestore={async (_target, d) => {
          await new Promise((r) => setTimeout(r, 500));
          notify(`已回滚：冲突${d.mode === "keep" ? "保留别人后来的修改" : "一起退回"}`, "success");
        }}
        actorNote="林晓（表管理员）· 会写入审计"
      />
    </>
  );
}
