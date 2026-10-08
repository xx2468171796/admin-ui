import { useState, type ReactNode } from "react";
import { Clipboard, FileSpreadsheet, KanbanSquare, Trash2, UserPlus, Zap } from "lucide-react";
import { LogTimeline, Panel, useNotify, type ConflictDecisions, type LogDiff, type LogKind, type LogStatus } from "@adminui/react";
import { DEMO_NOW, H } from "../../data/collab-data";

/**
 * 操作记录（LogTimeline variant="operations"）：每次批量操作一个编号；「做了什么」占最宽一列；
 * 3 天内可整批撤回——别人后来又改过的格子默认保留别人的，可逐格选「退回」；超过 3 天的整组灰掉并说明原因。
 */
type Op = { id: string; code: string; at: number; who: string; bot?: boolean; kind: string; icon: ReactNode; text: string; impact: string; diff: LogDiff; field?: boolean };

const KINDS: LogKind[] = [
  { key: "data", label: "数据", tone: "brand" },
  { key: "field", label: "字段结构", tag: "字段", tone: "attention" },
  { key: "view", label: "视图", tone: "info" },
];
const one = (record: string, field: string, before: string, after: string): LogDiff => ({ changes: [{ key: "x", record, field, before, after }] });
const OPS: Op[] = [
  {
    id: "149", code: "OP-20261008-0149", at: DEMO_NOW - 2 * H, who: "陈一鸣", kind: "data", icon: <Clipboard />, text: "粘贴 48 格", impact: "24 条",
    diff: {
      summary: "48 格 = 24 条记录 × 预计金额、下次跟进 · 以下是 2 条样例",
      changes: [
        { key: "c1", record: "远航精密制造", field: "预计金额", before: "¥540,000", after: "¥450,000", later: { by: "王佳宁", at: "10-08 09:05", value: "¥480,000" } },
        { key: "c2", record: "青禾教育", field: "预计金额", before: "¥380,000", after: "¥330,000", later: null },
      ],
    },
  },
  { id: "142", code: "OP-20261008-0142", at: DEMO_NOW - 5 * H, who: "林晓", kind: "data", icon: <UserPlus />, text: "批量分配 12 条给 赵思远", impact: "12 条", diff: one("星河物流 等 12 条", "负责人", "陈一鸣", "赵思远") },
  { id: "138", code: "OP-20261007-0138", at: DEMO_NOW - 25 * H, who: "自动化：30 天未跟进退回", bot: true, kind: "data", icon: <Zap />, text: "6 条退回公海", impact: "6 条", diff: one("6 条", "负责人", "陈一鸣 等", "空") },
  { id: "119", code: "OP-20261006-0119", at: DEMO_NOW - 2 * 24 * H, who: "林晓", kind: "field", icon: <Trash2 />, text: "删除字段「意向备注」", impact: "1 个字段", field: true, diff: one("—", "意向备注", "长文本 · 1,284 条有值", "已删除") },
  { id: "064", code: "OP-20261004-0064", at: DEMO_NOW - 4 * 24 * H, who: "王佳宁", kind: "view", icon: <KanbanSquare />, text: "视图「续约看板」改分组", impact: "1 个视图", diff: one("续约看板", "分组", "负责人", "阶段") },
  { id: "058", code: "OP-20261003-0058", at: DEMO_NOW - 5 * 24 * H, who: "赵思远", kind: "data", icon: <FileSpreadsheet />, text: "导入 Excel 230 条", impact: "230 条", diff: one("230 条", "新增", "—", "展会名单 10 月") },
];

export function Demo() {
  const notify = useNotify();
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const status = (op: Op): LogStatus | null => (undone[op.id] ? { label: "已撤回", tone: "neutral" } : op.field ? { label: "数据还在", tone: "brand" } : null);
  return (
    <Panel title="客户 · 操作记录" count={`${OPS.length} 次`} flush>
      <LogTimeline
        variant="operations"
        caption="客户表操作记录"
        items={OPS}
        now={DEMO_NOW}
        getId={(o) => o.id}
        time={(o) => o.at}
        code={(o) => o.code}
        actor={(o) => ({ name: o.who, bot: Boolean(o.bot), icon: o.bot ? <Zap /> : undefined })}
        icon={(o) => o.icon}
        kinds={KINDS}
        kind={(o) => o.kind}
        text={(o) => o.text}
        impact={(o) => o.impact}
        status={status}
        dimmed={(o) => Boolean(undone[o.id])}
        diff={(o) => o.diff}
        defaultExpanded={["149"]}
        oldNote="只能逐条恢复（修改历史保留 180 天）"
        undo={(o) =>
          undone[o.id]
            ? null
            : {
                kind: o.field ? "field" : "batch",
                onUndo: async (d: ConflictDecisions | null) => {
                  await new Promise((r) => setTimeout(r, 400));
                  setUndone((u) => ({ ...u, [o.id]: true }));
                  notify(`已撤回 ${o.code}${d?.mode === "keep" ? "，保留了别人后来改的格子" : ""}`, "success");
                },
              }
        }
      />
    </Panel>
  );
}
