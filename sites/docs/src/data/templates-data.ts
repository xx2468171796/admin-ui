/**
 * Extra fictional data for the page-template demos (「北辰云」 SaaS company): tickets, invoices, audit entries,
 * monthly revenue. People / customers come from demo-data.ts. No real names, domains or numbers.
 */
import { CUSTOMERS, PEOPLE } from "./demo-data";

const customer = (i: number) => CUSTOMERS[i % CUSTOMERS.length]?.name ?? "";
const person = (i: number) => PEOPLE[i % PEOPLE.length]?.name ?? "";

export type TicketPriority = "urgent" | "high" | "normal";
export type TicketState = "open" | "waiting" | "overdue" | "solved";
export type Ticket = {
  id: string;
  title: string;
  customer: string;
  priority: TicketPriority;
  state: TicketState;
  assignee: string;
  /** Share of the SLA window already used (0–1). */
  sla: number;
  updated: string;
  subscribed: boolean;
};

const TICKET_TITLES = [
  "导入客户时手机号格式报错", "发票抬头需要改成分公司", "报表导出 Excel 中文乱码", "希望增加 20 个席位",
  "单点登录配置后跳转失败", "工单通知邮件收不到", "API 调用返回 429 限流", "数据看板加载很慢",
  "移动端无法上传附件", "合同到期提醒没有触发", "想把商机阶段改成 7 个", "子账号看不到客户列表",
] as const;

export const TICKETS: readonly Ticket[] = TICKET_TITLES.map((title, i) => ({
  id: `T-${String(2041 + i)}`,
  title,
  customer: customer(i * 5 + 2),
  priority: (["urgent", "high", "normal", "normal"] as const)[i % 4] ?? "normal",
  state: i === 0 ? "overdue" : (["open", "waiting", "open", "solved", "open", "waiting"] as const)[i % 6] ?? "open",
  assignee: person(4 + (i % 3)),
  sla: i === 0 ? 1 : 0.12 + ((i * 0.23) % 0.78),
  updated: `${(i * 7) % 50 + 2} 分钟前`,
  subscribed: i % 3 !== 1,
}));

export type AuditEntry = {
  id: string;
  /** Days before today, hour, minute. */
  at: readonly [number, number, number];
  who: string;
  ai?: boolean;
  text: string;
  target: string;
  result: "ok" | "denied" | "failed";
  changes?: readonly { field: string; before: string; after: string }[];
};

export const AUDIT: readonly AuditEntry[] = [
  { id: "a1", at: [0, 10, 42], who: "林晓", text: "把商机阶段改为「商务谈判」", target: "远航精密制造", result: "ok", changes: [{ field: "阶段", before: "方案报价", after: "商务谈判" }, { field: "预计金额", before: "¥186,000", after: "¥212,000" }, { field: "预计签约", before: "2026-11-30", after: "2026-11-15" }] },
  { id: "a2", at: [0, 10, 31], who: "工单助手", ai: true, text: "自动把工单分配给客户成功经理", target: "T-2045 单点登录配置后跳转失败", result: "ok" },
  { id: "a3", at: [0, 9, 58], who: "孙雨桐", text: "开具发票 INV-20261008-007", target: "青禾教育", result: "ok" },
  { id: "a4", at: [0, 9, 40], who: "王佳宁", text: "导出客户列表（412 行）", target: "客户", result: "denied" },
  { id: "a5", at: [0, 9, 12], who: "陈一鸣", text: "登录", target: "网页端 · 上海", result: "ok" },
  { id: "b1", at: [1, 22, 5], who: "数据同步", ai: true, text: "同步支付平台的到账记录", target: "发票", result: "failed" },
  { id: "b2", at: [1, 18, 20], who: "周可欣", text: "把客户「星河物流」的负责人改为自己", target: "星河物流", result: "ok", changes: [{ field: "负责人", before: "赵思远", after: "周可欣" }] },
  { id: "b3", at: [1, 16, 2], who: "林晓", text: "给角色「客户经理」加上「导出」权限", target: "角色 · 客户经理", result: "ok" },
  { id: "b4", at: [1, 11, 47], who: "吴昊", text: "新建 API 密钥", target: "开放平台", result: "ok" },
];

/** 30 days of new monthly recurring revenue, in ¥ thousand. */
export const DAILY_REVENUE: readonly number[] = [
  42, 51, 38, 60, 74, 28, 19, 57, 68, 75, 81, 63, 24, 21, 76, 92, 100, 88, 79, 32, 27, 95, 111, 106, 98, 89, 37, 29, 102, 118,
];

export type RepRow = { id: string; name: string; deals: number; won: number; amount: number; share: number | null };
export const REPS: readonly RepRow[] = [
  { id: "u02", name: "陈一鸣", deals: 34, won: 12, amount: 684_000, share: 0.31 },
  { id: "u03", name: "王佳宁", deals: 29, won: 10, amount: 552_000, share: 0.25 },
  { id: "u04", name: "赵思远", deals: 26, won: 8, amount: 441_000, share: 0.2 },
  { id: "u05", name: "周可欣", deals: 18, won: 7, amount: 309_000, share: 0.14 },
  { id: "u01", name: "林晓", deals: 9, won: 4, amount: 221_000, share: 0.1 },
  { id: "u06", name: "吴昊", deals: 0, won: 0, amount: 0, share: null },
];
