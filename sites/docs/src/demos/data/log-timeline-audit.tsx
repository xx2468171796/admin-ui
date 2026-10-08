import { LogTimeline, type LogDiff, type LogKind, type LogResult } from "@adminui/react";

type Audit = { id: string; at: number; who: string; text: string; target: string; kind: string; result?: LogResult; diff?: LogDiff };

const HOUR = 3_600_000;
const now = Date.now();
const KINDS: LogKind[] = [
  { key: "data", label: "数据" },
  { key: "access", label: "权限", tone: "attention" },
  { key: "login", label: "登录", tone: "info" },
];
const ITEMS: Audit[] = [
  { id: "l1", at: now - 0.2 * HOUR, who: "林晓", kind: "data", text: "修改了客户", target: "远航精密制造",
    diff: { changes: [{ field: "阶段", before: "方案报价", after: "商务谈判" }] } },
  { id: "l2", at: now - 1.5 * HOUR, who: "周可欣", kind: "access", text: "给角色「销售」加了权限", target: "导出客户",
    diff: { meta: ["请求号 req-51b0e2"], changes: [{ field: "导出客户", before: "无", after: "允许" }] } },
  { id: "l3", at: now - 3 * HOUR, who: "陈一鸣", kind: "login", text: "登录失败", target: "网页端", result: { label: "密码错误", tone: "danger" } },
  { id: "l4", at: now - 5 * HOUR, who: "王佳宁", kind: "data", text: "批量转交 3 个客户", target: "赵思远",
    diff: { changes: [{ field: "负责人", before: "王佳宁", after: "赵思远" }, { field: "客户数", before: "—", after: "3" }] } },
  { id: "l5", at: now - 26 * HOUR, who: "吴昊", kind: "login", text: "登录", target: "桌面端", result: { label: "成功", tone: "success" } },
];

/** 审计密排：一行「时间 · 头像 + 人 · 摘要 · 对象 · 展开」，展开 = 下方改动前后；顶上按类型筛选；底部写已显示条数。 */
export function Demo() {
  return (
    <LogTimeline
      caption="操作日志"
      items={ITEMS}
      getId={(i) => i.id}
      time={(i) => i.at}
      actor={(i) => ({ name: i.who })}
      text={(i) => i.text}
      target={(i) => i.target}
      result={(i) => i.result}
      diff={(i) => i.diff}
      inlineDiff
      kinds={KINDS}
      kind={(i) => i.kind}
      total={1284}
      emptyLabel="这段时间没有记录"
    />
  );
}
