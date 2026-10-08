// 分享套件示例数据（样稿 D20 / D21 / D22 / D25）：真实项目里来自 fenxiang 服务端（分享设置、访问记录）和多维表格（版本）。
import type { CellVersion, ShareAccessEvent, ShareItem, SharePolicy, ShareSettings, StatItem } from "@adminui/react";

export const H = 3_600_000;
/** 演示里的「现在」：固定时间，截图每次一样。 */
export const DEMO_NOW = Date.UTC(2026, 9, 5, 10, 0); // 2026-10-05 18:00（上海）
export const demoNow = () => DEMO_NOW;

export const SHARE_POLICY: SharePolicy = {
  owner: "华南子公司",
  summary: "对外分享必须设密码，最长 30 天",
  contact: "管理员在「分享策略」里设置；有疑问找 林经理",
  requirePassword: "华南子公司要求对外分享必须设密码，不能关",
  maxExpiryHours: 720,
};

export const SHARE_SETTINGS: ShareSettings = {
  audience: "anyone",
  capability: "edit",
  allowDownload: true,
  allowCopy: false,
  fields: { name: "view", stage: "view", owner: "view", intent: "view", amount: "view", phone: "view", files: "view", next: "edit", note: "edit" },
  password: "8K3F",
  expiresAt: DEMO_NOW + 7 * 24 * H,
  expiryPreset: "7d",
  openLimit: { mode: "max", max: 20 },
  watermark: true,
  notifyOnOpen: true,
  remindBeforeHours: 24,
};

export const ACCESS_LOG: ShareAccessEvent[] = [
  { id: "e6", at: DEMO_NOW + 2 * H + 16 * 60_000, ip: "116.228.**.18", area: "上海", device: "desktop", os: "Windows", browser: "Chrome", kind: "open", text: "第 3 次 · 密码正确 · 正在看" },
  { id: "e5", at: DEMO_NOW + H + 7 * 60_000, ip: "116.228.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "edit", change: { field: "下次跟进", before: "2026-10-09", after: "2026-10-11" }, notified: true },
  { id: "e4", at: DEMO_NOW + H + 5 * 60_000, ip: "116.228.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "open", text: "第 2 次 · 密码正确" },
  { id: "e3", at: DEMO_NOW + 31 * 60_000, ip: "113.108.**.201", area: "广州", device: "desktop", os: "Windows", browser: "Edge", kind: "security", text: "密码错误 3 次 → 已要求滑块验证，之后没有再试", alarm: true },
  { id: "e2", at: DEMO_NOW + 20 * 60_000, ip: "116.228.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "download", text: "报价单 v2.pdf · 1.2 MB" },
  { id: "e1", at: DEMO_NOW + 12 * 60_000, ip: "116.228.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "open", text: "第 1 次 · 密码正确" },
];

export const SHARE_ITEMS: ShareItem[] = [
  { id: "s1", kind: "record", title: "李承恩（滨江豪宅）", subtitle: "记录 · 客户表", audience: "anyone", access: { text: "可编辑 2 个字段", kind: "edit" }, hasPassword: true, expiresAt: DEMO_NOW + 7 * 24 * H, opened: 3, openLimit: 20, lastOpen: { at: DEMO_NOW + 2 * H + 16 * 60_000, where: "上海 · Windows" }, state: "active" },
  { id: "s2", kind: "view", title: "阶段看板", subtitle: "视图 · 客户表 · 共享设置", audience: "org", access: { text: "只能看", kind: "view" }, hasPassword: false, expiresAt: null, expiryNote: "公司内不受限", opened: 41, openLimit: null, lastOpen: { at: DEMO_NOW - 20 * 60_000, where: "周组长" }, state: "active" },
  { id: "s3", kind: "form", title: "官网咨询表单", subtitle: "表单 · 客户表", audience: "anyone", access: { text: "可填写", kind: "fill" }, hasPassword: false, expiresAt: null, expiryNote: "表单例外 · 管理员批准", opened: 1204, openLimit: null, lastOpen: { at: DEMO_NOW + H + 52 * 60_000, where: "杭州 · iPhone" }, state: "active" },
  { id: "s4", kind: "file", title: "平面图.pdf", subtitle: "文件 · 张家豪（徐汇区别墅）的现场资料", audience: "anyone", access: { text: "可下载", kind: "download" }, hasPassword: true, expiresAt: DEMO_NOW + 15 * H, opened: 5, openLimit: 10, lastOpen: { at: DEMO_NOW - 20 * H + 10 * 60_000, where: "上海 · iPhone" }, state: "active" },
  { id: "s5", kind: "video", title: "现场走一圈.mp4", subtitle: "视频 · 0:42 · 李承恩的现场资料", audience: "people", audienceText: "指定 2 人", access: { text: "只能看", kind: "view" }, hasPassword: true, expiresAt: DEMO_NOW + 42 * H, opened: 2, openLimit: null, lastOpen: { at: DEMO_NOW - 6.5 * H, where: "设计 佳慧" }, state: "active" },
  { id: "s6", kind: "secret", title: "滨江样品间 Wi-Fi 管理员", subtitle: "密码 · 安装交接给 阿明", audience: "anyone", access: { text: "阅后即焚", kind: "burn" }, hasPassword: true, expiresAt: DEMO_NOW + 3 * 24 * H + 2 * H, opened: 0, openLimit: 1, lastOpen: null, state: "active" },
  { id: "s7", kind: "doc", title: "智能家居报价说明（2026 版）", subtitle: "知识库文档 · 销售资料", audience: "anyone", access: { text: "可评论", kind: "comment" }, hasPassword: true, expiresAt: DEMO_NOW + 25 * 24 * H, opened: 9, openLimit: 50, lastOpen: { at: DEMO_NOW - 2 * 24 * H - 2.8 * H, where: "苏州 · Android" }, state: "active" },
];

export const SHARE_STATS: StatItem[] = [
  { key: "live", label: "有效", value: "12", unit: "条链接" },
  { key: "week", label: "本周打开", value: "86", unit: "次", note: "比上周 +23", noteTone: "brand" },
  { key: "soon", label: "即将到期", value: "2", unit: "条", note: "48 小时内", tone: "attention" },
  { key: "void", label: "已作废", value: "31", unit: "条", note: "含到期自动失效" },
];

export const CELL_VERSIONS: CellVersion[] = [
  { id: "v5", at: DEMO_NOW - 2 * H - 55 * 60_000, actor: { name: "小李" }, source: "table", opId: "OP-20261005-0151", before: "¥450,000", after: "¥480,000", current: true },
  { id: "v4", at: DEMO_NOW - 3 * H - 40 * 60_000, actor: { name: "小王" }, source: "paste", opId: "OP-20261005-0149", before: "¥540,000", after: "¥450,000", note: "同一批粘贴了 48 格" },
  { id: "v3", at: DEMO_NOW - 3 * 24 * H - 6 * H - 40 * 60_000, actor: { name: "报价单金额回写", bot: true }, source: "automation", opId: "OP-20261002-0057", before: "¥520,000", after: "¥540,000" },
  { id: "v2", at: DEMO_NOW - 11 * 24 * H - H - 20 * 60_000, actor: { name: "小王" }, source: "table", opId: "OP-20260924-0031", before: "¥500,000", after: "¥520,000" },
  { id: "v1", at: DEMO_NOW - 17 * 24 * H - 7 * H - 58 * 60_000, actor: { name: "美华" }, source: "import", opId: "OP-20260918-0012", before: null, after: "¥500,000", note: "导入 Excel 时新建这条记录" },
];
export const RECORD_VERSIONS: CellVersion[] = [
  { ...CELL_VERSIONS[0]!, field: "预计金额" },
  { id: "r4", at: DEMO_NOW - 3 * H, actor: { name: "访客 116.228.**.18" }, source: "share", opId: "OP-20261005-0150", field: "下次跟进", before: "2026-10-09", after: "2026-10-11", current: true },
  { ...CELL_VERSIONS[1]!, field: "预计金额" },
  { id: "r3", at: DEMO_NOW - 2 * 24 * H, actor: { name: "跟进摘要", bot: true }, source: "ai", opId: "OP-20261003-0044", field: "备注", before: "约周末看样品间", after: "周六 10 点到滨江样品间看 KNX 面板" },
  { id: "r2", at: DEMO_NOW - 5 * 24 * H, actor: { name: "官网表单", bot: true }, source: "form", opId: "OP-20260930-0102", field: "来源", before: null, after: "转介绍", restoreBlocked: "来源字段现在只读" },
];
