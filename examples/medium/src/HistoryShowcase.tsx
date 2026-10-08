import { useMemo, useState } from "react";
import { ArrowRightLeft, Clipboard, FileSpreadsheet, History, KanbanSquare, Pencil, Repeat, Trash2, UserPlus, Zap } from "lucide-react";
import {
  Button,
  LogTimeline,
  PageBody,
  PageHeader,
  Panel,
  TimeMachineDialog,
  useNotify,
  type ConflictDecisions,
  type LogDiff,
  type LogKind,
  type LogStatus,
  type TimeMachineKind,
  type TimeMachineOp,
  type TimeMachinePreview,
} from "@adminui/react";

// 版本回退示例（样稿 D23 操作记录、D24 表时光机）：本页用 T06 日志 / 时间线（LogTimeline variant="operations"）。
// 演示数据在内存里；撤回 / 回滚只改本页状态。真实项目里 onUndo / onPreview / onRestore 调服务端，服务端逐格重新校验、写审计。
const NOW = Date.parse("2026-10-05T07:40:00Z"); // 上海 10-05 15:40
const at = (day: number, hhmm: string) => Date.parse(`2026-10-${String(day).padStart(2, "0")}T${hhmm}:00+08:00`);

type Op = {
  id: string;
  code: string;
  at: number;
  who: string;
  bot?: "zap" | "sync";
  kind: "data" | "field" | "view";
  icon: "paste" | "assign" | "zap" | "trash" | "edit" | "history" | "sync" | "sheet" | "kanban";
  text: string;
  detail?: string;
  impact: string;
  undo?: "batch" | "field" | "revert";
  status?: LogStatus;
  diff?: LogDiff;
};

const KINDS: LogKind[] = [
  { key: "data", label: "数据", tone: "brand" },
  { key: "field", label: "字段结构", tag: "字段", tone: "attention" },
  { key: "view", label: "视图", tone: "info" },
];
const ICONS = { paste: <Clipboard />, assign: <UserPlus />, zap: <Zap />, trash: <Trash2 />, edit: <Pencil />, history: <History />, sync: <Repeat />, sheet: <FileSpreadsheet />, kanban: <KanbanSquare /> };

const PASTE_DIFF: LogDiff = {
  summary: "48 格 = 24 条记录 × 预计金额、下次跟进 · 以下是 3 条样例",
  showAllLabel: "查看全部 48 格",
  changes: [
    { key: "c1", record: "黄淑芬", field: "预计金额", before: "¥540,000", after: "¥450,000", later: { by: "小李", at: "10-05 15:05", value: "¥480,000" } },
    { key: "c2", record: "陈雅婷", field: "预计金额", before: "¥380,000", after: "¥830,000", later: null },
    { key: "c3", record: "林志明", field: "下次跟进", before: "2026-10-04", after: "2026-10-12", later: { by: "小李", at: "10-05 15:10", value: "2026-10-09" } },
  ],
};
const simpleDiff = (record: string, field: string, before: string, after: string): LogDiff => ({ changes: [{ key: "x", record, field, before, after }] });

const OPS: Op[] = [
  { id: "149", code: "OP-20261005-0149", at: at(5, "14:20"), who: "小王", kind: "data", icon: "paste", text: "粘贴 48 格", detail: "预计金额、下次跟进 两列", impact: "24 条", undo: "batch", diff: PASTE_DIFF },
  { id: "142", code: "OP-20261005-0142", at: at(5, "11:05"), who: "周组长", kind: "data", icon: "assign", text: "批量分配 12 条给 阿杰", impact: "12 条", undo: "batch", diff: simpleDiff("吴宗翰 等 12 条", "负责人", "小王", "阿杰") },
  { id: "138", code: "OP-20261005-0138", at: at(5, "09:00"), who: "自动化：15 天未跟进退回", bot: "zap", kind: "data", icon: "zap", text: "6 条退回公海", detail: "负责人清空", impact: "6 条", undo: "batch", diff: simpleDiff("6 条", "负责人", "小王 等", "空") },
  { id: "119", code: "OP-20261004-0119", at: at(4, "16:12"), who: "陈主管", kind: "field", icon: "trash", text: "删除字段『意向备注』", impact: "1 个字段", undo: "field", status: { label: "数据还在", tone: "brand" }, diff: simpleDiff("—", "意向备注", "长文本 · 1,284 条有值", "已删除") },
  { id: "102", code: "OP-20261004-0102", at: at(4, "14:05"), who: "林经理", kind: "field", icon: "edit", text: "改字段类型：预计金额 文本→货币", impact: "1 个字段", undo: "batch", diff: simpleDiff("—", "预计金额", "文本", "货币（CNY）") },
  { id: "094", code: "OP-20261004-0094", at: at(4, "11:30"), who: "林经理", kind: "data", icon: "history", text: "表时光机回到 10-04 09:00", impact: "41 条", undo: "revert", diff: simpleDiff("41 条", "多个字段", "飞书同步后的值", "10-04 09:00 的值") },
  { id: "088", code: "OP-20261004-0088", at: at(4, "09:40"), who: "飞书同步", bot: "sync", kind: "data", icon: "sync", text: "同步更新 41 条", impact: "41 条", status: { label: "已被 OP-…0094 退回", tone: "neutral" }, diff: simpleDiff("41 条", "阶段、负责人", "原值", "飞书的值") },
  { id: "076", code: "OP-20261003-0076", at: at(3, "17:40"), who: "美华", kind: "data", icon: "sheet", text: "导入 Excel 230 条", detail: "展会名单 10 月.xlsx", impact: "230 条", undo: "batch", diff: simpleDiff("230 条", "新增", "—", "展会名单 10 月") },
  { id: "064", code: "OP-20261003-0064", at: at(3, "15:40"), who: "小李", kind: "view", icon: "kanban", text: "视图「阶段看板」改分组和卡片字段", impact: "1 个视图", undo: "batch", diff: simpleDiff("阶段看板", "分组", "负责人", "阶段") },
  { id: "058", code: "OP-20261002-0058", at: at(2, "11:20"), who: "小王", kind: "data", icon: "paste", text: "粘贴 30 格", detail: "地区 一列", impact: "30 条", undo: "batch", diff: simpleDiff("30 条", "地区", "空", "上海 / 杭州") },
];

const TM_KINDS: TimeMachineKind[] = [
  { key: "data", label: "数据", tone: "brand" },
  { key: "field", label: "字段", tone: "attention" },
  { key: "view", label: "视图", tone: "info" },
  { key: "rollback", label: "回滚", tone: "outline" },
];
const TM_OPS: TimeMachineOp[] = [
  { id: "061", at: at(2, "18:00"), kind: "data", code: "OP-20261002-0061", label: "阿杰 批量修改阶段 9 条" },
  { id: "052", at: at(3, "10:20"), kind: "data", code: "OP-20261003-0052", label: "小王 粘贴 16 格" },
  { id: "064", at: at(3, "15:40"), kind: "view", code: "OP-20261003-0064", label: "小李 改「阶段看板」分组" },
  { id: "076", at: at(3, "17:40"), kind: "data", code: "OP-20261003-0076", label: "美华 导入 Excel 230 条" },
  { id: "088", at: at(4, "09:40"), kind: "data", code: "OP-20261004-0088", label: "飞书同步 更新 41 条" },
  { id: "094", at: at(4, "11:30"), kind: "rollback", code: "OP-20261004-0094", label: "林经理 表时光机" },
  { id: "102", at: at(4, "14:05"), kind: "field", code: "OP-20261004-0102", label: "林经理 改字段类型" },
  { id: "119", at: at(4, "16:12"), kind: "field", code: "OP-20261004-0119", label: "陈主管 删除字段" },
  { id: "110", at: at(4, "20:30"), kind: "view", code: "OP-20261004-0110", label: "美华 改「我的客户」筛选" },
  { id: "138", at: at(5, "09:00"), kind: "data", code: "OP-20261005-0138", label: "自动化 退回公海 6 条" },
  { id: "142", at: at(5, "11:05"), kind: "data", code: "OP-20261005-0142", label: "周组长 批量分配 12 条" },
  { id: "149", at: at(5, "14:20"), kind: "data", code: "OP-20261005-0149", label: "小王 粘贴 48 格" },
];

/** Fake server preview: the later the target, the less to roll back. */
function preview(target: number): TimeMachinePreview {
  const after = TM_OPS.filter((o) => (o.at as number) > target).length;
  if (!after) return { counts: { change: 0, add: 0, remove: 0 }, conflicts: [] };
  const conflicts = [
    { key: "k1", record: "黄淑芬", field: "预计金额", then: "¥540,000", now: "¥480,000", by: "小李", at: "10-05 15:05", avatar: "李" },
    { key: "k2", record: "林志明", field: "下次跟进", then: "2026-10-04", now: "2026-10-09", by: "小李", at: "10-05 15:10", avatar: "李" },
    { key: "k3", record: "张家豪（徐汇区别墅）", field: "阶段", then: "报价", now: "安装", by: "阿杰", at: "10-05 10:40", avatar: "杰" },
    { key: "k4", record: "李承恩（滨江豪宅）", field: "成交价", then: "空", now: "¥2,050,000", by: "美华", at: "10-05 13:30", avatar: "华" },
    { key: "k5", record: "吴宗翰", field: "负责人", then: "小王", now: "阿杰", by: "周组长", at: "10-05 11:05", avatar: "周" },
  ].slice(0, Math.min(5, Math.max(0, after - 3)));
  return {
    cards: [
      { key: "rec", title: `${after * 4 + 5} 条记录`, hint: `改回 ${after * 4 - 1} 条 · 移除新增 6 条` },
      { key: "fld", title: `${after > 4 ? 2 : 0} 个字段`, hint: after > 4 ? "意向备注 · 预计金额" : "字段没变" },
      { key: "view", title: `${after > 3 ? 1 : 0} 个视图`, hint: after > 3 ? "「我的客户」的筛选" : "视图没变" },
    ],
    conflicts,
  };
}

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// 记录修改历史（审阅 07）：一处改动直接在行里写「旧 → 新」（inlineDiff）；打码字段由服务端打好码再给
type RecordEdit = { id: string; at: number; who: string; bot?: boolean; text: string; diff: LogDiff };
const RECORD_EDITS: RecordEdit[] = [
  { id: "r3", at: at(5, "14:20"), who: "小王", text: "修改了「状态」", diff: { changes: [{ field: "状态", before: "跟进中", after: "已成交" }] } },
  { id: "r2", at: at(5, "11:05"), who: "自动化", bot: true, text: "修改了「预计金额」（打码）", diff: { changes: [{ field: "预计金额", before: "***", after: "***" }] } },
  { id: "r1", at: at(5, "09:30"), who: "周组长", text: "修改了 2 个字段", diff: { changes: [{ field: "负责人", before: "小王", after: "阿杰" }, { field: "阶段", before: "报价", after: "谈判" }] } },
];

export function HistoryShowcase() {
  const notify = useNotify();
  const [undone, setUndone] = useState<Record<string, "undone" | "partial">>({});
  const [machine, setMachine] = useState(false);
  const ops = useMemo(() => OPS, []);
  const status = (op: Op): LogStatus | null =>
    undone[op.id] === "undone" ? { label: "已撤回", tone: "neutral" } : undone[op.id] === "partial" ? { label: "部分撤回 · 保留了 2 格", tone: "attention" } : (op.status ?? null);
  return (
    <>
      <PageHeader title="版本回退" description="操作记录（样稿 D23）与表时光机（D24）：3 天内整批撤回、超过 3 天逐条恢复；回滚本身也能再撤回。" />
      <PageBody>
        <Panel
          title="客户 · 操作记录"
          count={`${ops.length} 次`}
          description="每次批量操作（粘贴、批量修改 / 分配、导入、一次自动化、一次同步）和字段 / 视图改动都有一个操作编号。3 天内可以一键撤回整批：只撤这一批，别人后来改的按你的选择保留或一起退回。超过 3 天在单元格的修改历史里逐条恢复（保留 180 天）。"
          actions={<Button size="sm" onClick={() => setMachine(true)}><History aria-hidden="true" />表时光机</Button>}
          flush
        >
          <LogTimeline
            variant="operations"
            caption="客户表操作记录"
            items={ops}
            now={NOW}
            getId={(o) => o.id}
            time={(o) => o.at}
            code={(o) => o.code}
            actor={(o) => ({ name: o.who, bot: Boolean(o.bot), icon: o.bot === "zap" ? <Zap /> : o.bot === "sync" ? <ArrowRightLeft /> : undefined })}
            icon={(o) => ICONS[o.icon]}
            kinds={KINDS}
            kind={(o) => o.kind}
            text={(o) => o.text}
            target={(o) => o.detail}
            impact={(o) => o.impact}
            status={status}
            dimmed={(o) => o.id === "088" || undone[o.id] === "undone"}
            diff={(o) => o.diff}
            defaultExpanded={["149"]}
            oldNote="只能逐条恢复（修改历史保留 180 天）"
            undo={(o) =>
              !o.undo || undone[o.id]
                ? null
                : {
                    kind: o.undo,
                    title: o.undo === "revert" ? "回滚本身也是一次操作，可以再撤回" : undefined,
                    onUndo: async (d: ConflictDecisions | null) => {
                      await wait();
                      const kept = d && d.mode === "keep" && !Object.values(d.overrides ?? {}).includes("revert");
                      setUndone((u) => ({ ...u, [o.id]: kept ? "partial" : "undone" }));
                      notify(kept ? `已撤回 ${o.code}，保留了小李后来改的 2 格（演示）` : `已撤回 ${o.code}（演示）`, "success");
                    },
                  }
            }
            total={26}
            onLoadMore={() => notify("加载更多（演示）", "info")}
          />
        </Panel>
        <Panel title="李承恩 · 记录修改历史" count={`${RECORD_EDITS.length} 条`} description="一处改动直接写出「旧 → 新」；改了多处的展开看表。" flush>
          <LogTimeline
            caption="李承恩的修改历史"
            items={RECORD_EDITS}
            now={NOW}
            getId={(e) => e.id}
            time={(e) => e.at}
            actor={(e) => ({ name: e.who, bot: Boolean(e.bot), icon: e.bot ? <Zap /> : undefined })}
            text={(e) => e.text}
            diff={(e) => e.diff}
            inlineDiff
          />
        </Panel>
      </PageBody>
      <TimeMachineDialog
        open={machine}
        onClose={() => setMachine(false)}
        subtitle="客户 · 整张表退回到某个时间点"
        help="只有表管理员、子公司管理员能用。回滚 = 把这一刻之后的改动反着做一遍，照常检查权限和校验、照常触发事件，自动化不会因此再跑一遍。字段结构、标准视图和共享视图一起退回。超过 3 天的只能在单元格修改历史里逐条恢复。"
        ops={TM_OPS}
        kinds={TM_KINDS}
        now={NOW}
        initialTarget={at(4, "09:00")}
        startLabel="3 天前（可调长）"
        onPreview={async (target, signal) => {
          await wait(250);
          if (signal.aborted) throw new DOMException("aborted", "AbortError");
          return preview(target);
        }}
        onPreviewDiff={() => notify("打开只读的「那一刻」表格（演示）", "info")}
        onRestore={async (_target, d) => {
          await wait();
          notify(`已回滚（演示）：冲突 ${d.mode === "keep" ? "保留别人后来的修改" : "一起退回"}`, "success");
        }}
        actorNote="林经理（表管理员）· 会写入审计"
      />
    </>
  );
}
