/**
 * Demo data for the 「协作与媒体」 family: comments, sharing, media, transcripts, history, AI review and approvals.
 * Everything is fictional and in memory (company 北辰云, people from demo-data). Images are inline SVG data URLs,
 * audio is a generated WAV blob — no network.
 */
import type {
  ApprovalRequest,
  CellVersion,
  CommentItem,
  CommentPerson,
  CompareSample,
  FieldSuggestion,
  PromptVersion,
  ShareAccessEvent,
  ShareItem,
  SharePolicy,
  ShareSettings,
  StatItem,
  TranscriptCategory,
  TranscriptSegment,
  TranscriptSpan,
  TranscriptSpeaker,
} from "@adminui/react";
import { PEOPLE, personName } from "./demo-data";

// ---------------------------------------------------------------- time

export const H = 3_600_000;
/** The demos' fixed 「now」: 2026-10-08 10:00 (Shanghai). */
export const DEMO_NOW = Date.UTC(2026, 9, 8, 2, 0);
export const demoNow = () => DEMO_NOW;
const isoAgo = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// ---------------------------------------------------------------- people

const DEPT_NAMES: Record<string, string> = { "d-sales": "销售部", "d-sales-east": "华东销售组", "d-sales-south": "华南销售组", "d-cs": "客户成功部", "d-rd": "研发部", "d-fin": "财务部" };
const person = (id: string): CommentPerson => {
  const p = PEOPLE.find((x) => x.id === id);
  return { id, name: p?.name ?? id, hint: p ? `${DEPT_NAMES[p.dept] ?? ""} · ${p.title}` : undefined };
};
/** The viewer in every demo: 陈一鸣, account manager. */
export const ME: CommentPerson = person("u02");
export const MENTION_PEOPLE: CommentPerson[] = [
  ...PEOPLE.map((p) => person(p.id)),
  { id: "x01", name: "外部顾问", hint: "合作伙伴", unavailable: "看不到这条记录，提到也收不到" },
];
export const searchPeople = (q: string) => MENTION_PEOPLE.filter((p) => p.name.includes(q) || (p.hint ?? "").includes(q));

// ---------------------------------------------------------------- images & audio

const SCENES = [
  { bg: "#dfe7e3", a: "#7d968c", b: "#b9cbc3" },
  { bg: "#e4e2ec", a: "#8a84a3", b: "#c6c2d6" },
  { bg: "#ece6dc", a: "#a2917a", b: "#d3c7b5" },
] as const;
/** A neutral stand-in photo (whiteboard / chart / office) as an inline SVG data URL. */
export function demoImage(variant: number): string {
  const s = SCENES[variant % SCENES.length] ?? SCENES[0];
  const shapes = [
    `<rect x="70" y="60" width="500" height="240" rx="10" fill="#fff" opacity=".85"/><rect x="110" y="110" width="220" height="18" rx="9" fill="${s.a}"/><rect x="110" y="150" width="320" height="14" rx="7" fill="${s.b}"/><rect x="110" y="180" width="280" height="14" rx="7" fill="${s.b}"/><rect x="110" y="230" width="140" height="40" rx="8" fill="${s.a}"/>`,
    `<rect x="60" y="50" width="520" height="300" rx="10" fill="#fff" opacity=".85"/>${[90, 150, 120, 210, 180, 250].map((h, i) => `<rect x="${110 + i * 75}" y="${320 - h}" width="44" height="${h}" rx="4" fill="${i === 5 ? s.a : s.b}"/>`).join("")}`,
    `<rect x="0" y="300" width="640" height="120" fill="${s.b}"/><rect x="80" y="170" width="200" height="130" rx="8" fill="${s.a}"/><rect x="380" y="70" width="190" height="140" rx="6" fill="#fff" opacity=".8"/><rect x="330" y="230" width="240" height="70" rx="6" fill="${s.a}" opacity=".6"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="${s.bg}"/>${shapes[variant % shapes.length] ?? ""}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const tones = new Map<string, { url: string; peaks: number[] }>();
/** A speech-like hum as a WAV object URL plus one peak per 100 ms (cached; a real app gets both from its server). */
export function demoTone(seconds: number, seed: number): { url: string; peaks: number[] } {
  const cacheKey = `${seconds}:${seed}`;
  const hit = tones.get(cacheKey);
  if (hit) return hit;
  const rate = 8000;
  const total = Math.round(seconds * rate);
  const rand = rng(seed);
  const samples = new Int16Array(total);
  const peaks: number[] = [];
  let env = 0;
  let target = 0;
  let max = 0;
  for (let i = 0; i < total; i++) {
    if (i % 1200 === 0) target = rand() < 0.22 ? 0.03 : 0.25 + rand() * 0.7;
    env += (target - env) * 0.002;
    const t = i / rate;
    const v = env * (0.7 * Math.sin(2 * Math.PI * 190 * t) + 0.3 * Math.sin(2 * Math.PI * 380 * t));
    samples[i] = Math.round(v * 0.6 * 32767);
    max = Math.max(max, Math.abs(v));
    if ((i + 1) % 800 === 0) {
      peaks.push(Math.round(max * 1000) / 1000);
      max = 0;
    }
  }
  const head = new DataView(new ArrayBuffer(44));
  const text = (at: number, str: string) => [...str].forEach((c, k) => head.setUint8(at + k, c.charCodeAt(0)));
  text(0, "RIFF");
  head.setUint32(4, 36 + samples.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  head.setUint32(16, 16, true);
  head.setUint16(20, 1, true);
  head.setUint16(22, 1, true);
  head.setUint32(24, rate, true);
  head.setUint32(28, rate * 2, true);
  head.setUint16(32, 2, true);
  head.setUint16(34, 16, true);
  text(36, "data");
  head.setUint32(40, samples.byteLength, true);
  const tone = { url: URL.createObjectURL(new Blob([head.buffer, samples.buffer], { type: "audio/wav" })), peaks };
  tones.set(cacheKey, tone);
  return tone;
}

// ---------------------------------------------------------------- comments

export const RECORD_COMMENTS: CommentItem[] = [
  {
    id: "c1", author: person("u05"), createdAt: isoAgo(0, 9, 42), body: "@陈一鸣 客户想在续约前看一次季度复盘，周四下午可以吗？", mentions: [ME],
    reactions: [{ key: "ok", count: 2, mine: true, names: ["陈一鸣", "林晓"] }, { key: "like", count: 1, names: ["吴昊"] }],
    replies: [{ id: "c1r", author: ME, createdAt: isoAgo(0, 9, 55), body: "可以，周四 14:00，复盘材料我先发给你看", canEdit: true, canDelete: true,
      attachments: [{ id: "p1", name: "季度复盘-白板.png", kind: "image", url: demoImage(0), thumbUrl: demoImage(0) }, { id: "p2", name: "活跃度趋势.png", kind: "image", url: demoImage(1), thumbUrl: demoImage(1) }] }],
  },
  {
    id: "c2", author: person("u01"), createdAt: isoAgo(0, 8, 31), body: "续约报价我看过了，折扣最多 8%，再多要找 @孙雨桐 走审批", mentions: [person("u07")],
    attachments: [{ id: "f1", name: "续约报价-v2.pdf", kind: "pdf", size: 1_258_291 }], reactions: [{ key: "seen", count: 1, names: ["周可欣"] }],
    replies: [
      { id: "c2r1", author: ME, createdAt: isoAgo(0, 8, 40), body: "收到，先按 92 折报", canEdit: true, canDelete: true },
      { id: "c2r2", author: person("u07"), createdAt: isoAgo(0, 8, 52), body: "可以，超过 8% 记得附上用量数据", reactions: [{ key: "like", count: 1, mine: true, names: ["陈一鸣"] }] },
    ],
  },
  { id: "c3", author: person("u06"), createdAt: isoAgo(1, 17, 20), editedAt: isoAgo(1, 17, 24), body: "客户问单点登录能不能接他们自己的 IdP，@陈一鸣 下次拜访帮忙确认一下版本", mentions: [ME], reactions: [{ key: "question", count: 1, names: ["郑明轩"] }] },
  { id: "c4", author: person("u03"), createdAt: isoAgo(1, 11, 5), body: "联系人电话已核实，不是重复线索", resolved: true, resolvedBy: "林晓" },
  { id: "c5", author: ME, createdAt: isoAgo(1, 10, 20), body: "我先报 9 折，等主管意见", canEdit: true, canDelete: true, replies: [{ id: "c5r", author: person("u01"), createdAt: isoAgo(1, 10, 31), body: "9 折不行，最多 92 折" }] },
];

export const DOC_COMMENTS: CommentItem[] = [
  { id: "k1", author: person("u05"), createdAt: isoAgo(0, 10, 12), quote: { text: "超过 30 天未登录的席位会在下个账单周期自动回收" }, body: "回收前会提前通知管理员吗？@陈一鸣 确认一下", mentions: [ME] },
  { id: "k2", author: person("u01"), createdAt: isoAgo(0, 9, 40), quote: { text: "", state: "page" }, body: "整页的价格表下个月要换新版" },
  { id: "k3", author: person("u04"), createdAt: isoAgo(1, 17, 5), quote: { text: "年付客户享受 2 个月免费", state: "orphaned" }, body: "这段被删了，年付优惠写到哪里去了？" },
];

// ---------------------------------------------------------------- sharing

export const SHARE_POLICY: SharePolicy = {
  owner: "销售部",
  summary: "对外分享必须设密码，最长 30 天",
  contact: "管理员在「分享策略」里设置；有疑问找 林晓",
  requirePassword: "销售部要求对外分享必须设密码，不能关",
  maxExpiryHours: 720,
};

export const SHARE_SETTINGS: ShareSettings = {
  audience: "anyone",
  capability: "edit",
  allowDownload: true,
  allowCopy: false,
  fields: { name: "view", stage: "view", owner: "view", amount: "view", phone: "view", files: "view", next: "edit", note: "edit" },
  password: "8K3F",
  expiresAt: DEMO_NOW + 7 * 24 * H,
  expiryPreset: "7d",
  openLimit: { mode: "max", max: 20 },
  watermark: true,
  notifyOnOpen: true,
  remindBeforeHours: 24,
};

export const SHARE_PEOPLE = [
  { id: "u05", name: "周可欣", hint: "客户成功部" },
  { id: "u06", name: "吴昊", hint: "研发部" },
  { id: "g1", name: "华东销售组", hint: "6 人", group: true },
  { id: "u07", name: "孙雨桐", hint: "财务部" },
];

export const ACCESS_LOG: ShareAccessEvent[] = [
  { id: "e6", at: DEMO_NOW + 2 * H + 16 * 60_000, ip: "203.0.**.18", area: "上海", device: "desktop", os: "Windows", browser: "Chrome", kind: "open", text: "第 3 次 · 密码正确 · 正在看" },
  { id: "e5", at: DEMO_NOW + H + 7 * 60_000, ip: "203.0.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "edit", change: { field: "下次跟进", before: "2026-10-12", after: "2026-10-14" }, notified: true },
  { id: "e4", at: DEMO_NOW + H + 5 * 60_000, ip: "203.0.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "open", text: "第 2 次 · 密码正确" },
  { id: "e3", at: DEMO_NOW + 31 * 60_000, ip: "198.51.**.201", area: "成都", device: "desktop", os: "Windows", browser: "Edge", kind: "security", text: "密码错误 3 次 → 已要求滑块验证，之后没有再试", alarm: true },
  { id: "e2", at: DEMO_NOW + 20 * 60_000, ip: "203.0.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "download", text: "续约报价-v2.pdf · 1.2 MB" },
  { id: "e1", at: DEMO_NOW + 12 * 60_000, ip: "203.0.**.18", area: "上海", device: "mobile", os: "iPhone", browser: "Safari", kind: "open", text: "第 1 次 · 密码正确" },
];

export const SHARE_ITEMS: ShareItem[] = [
  { id: "s1", kind: "record", title: "远航精密制造", subtitle: "记录 · 客户表", audience: "anyone", access: { text: "可编辑 2 个字段", kind: "edit" }, hasPassword: true, expiresAt: DEMO_NOW + 7 * 24 * H, opened: 3, openLimit: 20, lastOpen: { at: DEMO_NOW + 2 * H, where: "上海 · Windows" }, state: "active" },
  { id: "s2", kind: "view", title: "续约看板", subtitle: "视图 · 客户表", audience: "org", access: { text: "只能看", kind: "view" }, hasPassword: false, expiresAt: null, expiryNote: "公司内不受限", opened: 41, openLimit: null, lastOpen: { at: DEMO_NOW - 20 * 60_000, where: "林晓" }, state: "active" },
  { id: "s3", kind: "form", title: "产品试用申请", subtitle: "表单 · 线索表", audience: "anyone", access: { text: "可填写", kind: "fill" }, hasPassword: false, expiresAt: null, expiryNote: "表单例外 · 管理员批准", opened: 1204, openLimit: null, lastOpen: { at: DEMO_NOW - 52 * 60_000, where: "杭州 · iPhone" }, state: "active" },
  { id: "s4", kind: "file", title: "实施方案.pdf", subtitle: "文件 · 青禾教育的资料", audience: "anyone", access: { text: "可下载", kind: "download" }, hasPassword: true, expiresAt: DEMO_NOW + 15 * H, opened: 5, openLimit: 10, lastOpen: { at: DEMO_NOW - 20 * H, where: "苏州 · iPhone" }, state: "active" },
  { id: "s5", kind: "video", title: "产品演示录屏.mp4", subtitle: "视频 · 0:42", audience: "people", audienceText: "指定 2 人", access: { text: "只能看", kind: "view" }, hasPassword: true, expiresAt: DEMO_NOW + 42 * H, opened: 2, openLimit: null, lastOpen: { at: DEMO_NOW - 6.5 * H, where: "周可欣" }, state: "active" },
  { id: "s6", kind: "secret", title: "测试环境管理员账号", subtitle: "密码 · 交接给 吴昊", audience: "anyone", access: { text: "阅后即焚", kind: "burn" }, hasPassword: true, expiresAt: DEMO_NOW + 3 * 24 * H, opened: 0, openLimit: 1, lastOpen: null, state: "active" },
  { id: "s7", kind: "doc", title: "席位计费说明（2026 版）", subtitle: "文档 · 销售资料", audience: "anyone", access: { text: "可评论", kind: "comment" }, hasPassword: true, expiresAt: DEMO_NOW + 25 * 24 * H, opened: 9, openLimit: 50, lastOpen: { at: DEMO_NOW - 2 * 24 * H, where: "深圳 · Android" }, state: "paused" },
];

export const SHARE_STATS: StatItem[] = [
  { key: "live", label: "有效", value: "12", unit: "条链接" },
  { key: "week", label: "本周打开", value: "86", unit: "次", note: "比上周 +23", noteTone: "brand" },
  { key: "soon", label: "即将到期", value: "2", unit: "条", note: "48 小时内", tone: "attention" },
  { key: "void", label: "已作废", value: "31", unit: "条", note: "含到期自动失效" },
];

// ---------------------------------------------------------------- history

export const CELL_VERSIONS: CellVersion[] = [
  { id: "v5", at: DEMO_NOW - 2 * H, actor: { name: "王佳宁" }, source: "table", opId: "OP-20261008-0151", before: "¥450,000", after: "¥480,000", current: true },
  { id: "v4", at: DEMO_NOW - 3 * H - 40 * 60_000, actor: { name: "陈一鸣" }, source: "paste", opId: "OP-20261008-0149", before: "¥540,000", after: "¥450,000", note: "同一批粘贴了 48 格" },
  { id: "v3", at: DEMO_NOW - 3 * 24 * H, actor: { name: "报价金额回写", bot: true }, source: "automation", opId: "OP-20261005-0057", before: "¥520,000", after: "¥540,000" },
  { id: "v2", at: DEMO_NOW - 11 * 24 * H, actor: { name: "陈一鸣" }, source: "table", opId: "OP-20260927-0031", before: "¥500,000", after: "¥520,000" },
  { id: "v1", at: DEMO_NOW - 17 * 24 * H, actor: { name: "赵思远" }, source: "import", opId: "OP-20260921-0012", before: null, after: "¥500,000", note: "导入 Excel 时新建这条记录" },
];
export const RECORD_VERSIONS: CellVersion[] = [
  { ...CELL_VERSIONS[0], id: "r5", field: "预计金额" } as CellVersion,
  { id: "r4", at: DEMO_NOW - 3 * H, actor: { name: "访客 203.0.**.18" }, source: "share", opId: "OP-20261008-0150", field: "下次跟进", before: "2026-10-12", after: "2026-10-14" },
  { id: "r3", at: DEMO_NOW - 2 * 24 * H, actor: { name: "跟进摘要", bot: true }, source: "ai", opId: "OP-20261006-0044", field: "备注", before: "约下周复盘", after: "周四 14:00 季度复盘，带用量报表" },
  { id: "r2", at: DEMO_NOW - 5 * 24 * H, actor: { name: "官网表单", bot: true }, source: "form", opId: "OP-20261003-0102", field: "来源", before: null, after: "官网试用", restoreBlocked: "来源字段现在只读" },
];

// ---------------------------------------------------------------- transcript

export const SPEAKERS: TranscriptSpeaker[] = [
  { id: "csm", name: "周可欣", role: "客户成功" },
  { id: "it", name: "刘工", role: "客户 IT", initial: "刘" },
  { id: "ops", name: "何经理", role: "客户运营", initial: "何" },
];
export const CATEGORIES: TranscriptCategory[] = [
  { id: "need", label: "需求" },
  { id: "care", label: "关注", tone: "teal" },
  { id: "budget", label: "预算" },
  { id: "worry", label: "顾虑", tone: "greenSolid" },
  { id: "rival", label: "竞品", tone: "gray" },
];
const clock = (text: string) => {
  const [m, s] = text.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
};
/** [start, end, speaker, text]; [[word|category]] = AI annotation, {{masked|label}} = masked value. */
const LINES: [string, string, string, string][] = [
  ["00:05", "00:40", "csm", "刘工、何经理好，今天主要回顾一下上个季度的使用情况，再聊聊续约。"],
  ["00:40", "01:30", "ops", "好的，我们这季度最大的变化是华南的两个仓也接进来了，[[用的人多了不少|need]]。"],
  ["01:30", "02:20", "csm", "对，活跃席位从 120 涨到 168，现在离合同的 200 个席位不远了。"],
  ["02:20", "03:05", "it", "我比较关心[[单点登录|care]]，我们准备换新的身份系统，你们能接吗？"],
  ["03:05", "04:10", "csm", "可以，标准协议都支持，切换那天我们安排工程师在线陪同。"],
  ["04:10", "05:00", "ops", "续约的话，[[预算大概和去年持平|budget]]，最多再加一点给新仓。"],
  ["05:00", "05:40", "it", "还有一个[[数据要能导出|worry]]，审计那边要求每季度留档。"],
  ["05:40", "06:30", "csm", "导出在管理后台就有，按季度归档也能设成自动的，我会后发操作说明。"],
  ["06:30", "07:00", "it", "合同联系人写我，手机 {{138****0000|手机号}}。"],
  ["07:00", "08:10", "ops", "另外有家[[同行在推按量计费|rival]]，你们有类似的方案吗？"],
  ["08:10", "09:20", "csm", "有的，年付也可以按季度对齐用量，我把两种方式的对比放进报价里。"],
  ["09:20", "10:00", "ops", "好，那下周二前把报价和对比发过来，我们内部过一下。"],
];
function parse(line: string): Pick<TranscriptSegment, "text" | "spans"> {
  const spans: TranscriptSpan[] = [];
  let text = "";
  let last = 0;
  for (const m of line.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]|\{\{([^|}]+)\|([^}]+)\}\}/g)) {
    text += line.slice(last, m.index);
    const start = text.length;
    text += m[1] ?? m[3] ?? "";
    spans.push(m[1] ? { kind: "annotation", start, end: text.length, category: m[2] ?? "" } : { kind: "mask", start, end: text.length, label: m[4] });
    last = (m.index ?? 0) + m[0].length;
  }
  return { text: text + line.slice(last), spans };
}
export const SEGMENTS: TranscriptSegment[] = LINES.map(([from, to, speaker, line], i) => ({ id: `s${i + 1}`, speaker, start: clock(from), end: clock(to), ...parse(line) }));
export const TRANSCRIPT_DURATION = clock("10:00");
export const TRANSCRIPT_POINTS = [
  { time: clock("01:30"), text: "活跃席位 120 → 168，接近合同上限" },
  { time: clock("02:20"), text: "关注单点登录切换" },
  { time: clock("04:10"), text: "预算与去年持平（客户原话）" },
  { time: clock("09:20"), text: "下周二前发报价和计费对比" },
];

// ---------------------------------------------------------------- AI review

export const PROMPT_PUBLISHED = [
  "你是一名资深客户成功经理，帮同事复盘一次客户沟通。",
  "客户资料：{{客户资料}}",
  "这次沟通的文字稿（已分说话人）：{{本次文字稿}}",
  "知识库里查到的相关内容：{{知识库片段}}",
  "分析时重点看：",
  "1. 使用情况的变化和续约风险；",
  "2. 预算只要客户说过的数；",
  "3. 每条顾虑给一句回应；",
  "4. 建议下一步和下次跟进时间（工作日 9:00–18:00）。",
  "语气：简短、口语。",
].join("\n");
export const PROMPT_DRAFT = PROMPT_PUBLISHED.replace("2. 预算只要客户说过的数；", "2. 预算只用客户原话，不要自己估算，没说就写「未提到」；").replace(
  "3. 每条顾虑给一句回应；",
  "3. 每条顾虑给一句回应，回应必须来自知识库片段并标出处；",
);
export const PROMPT_VARIABLES = [
  { name: "客户资料", hint: "这条客户你能看到的字段" },
  { name: "本次文字稿", hint: "已分说话人" },
  { name: "知识库片段", hint: "按顾虑检索" },
  { name: "历史摘要", hint: "最近 5 次" },
];
export const PROMPT_VERSIONS: PromptVersion[] = [
  { id: "v4", version: "v4", note: "草稿 · 改了 2 处", author: "周可欣", time: "刚刚", state: "draft" },
  { id: "v3", version: "v3", note: "回应必须标出处", author: "周可欣", time: "10-02", state: "current" },
  { id: "v2", version: "v2", note: "加上续约风险", author: "周可欣", time: "09-20" },
  { id: "v1", version: "v1", note: "第一版", author: "林晓", time: "09-05" },
];
export const COMPARE_SAMPLES: CompareSample[] = [
  {
    key: "s1", label: "远航精密制造 · 季度复盘", summary: "v3 多抓到 1 个顾虑，回应都有出处",
    rows: [
      { key: "sum", label: "摘要", cells: { v2: "客户用得不错，打算续约。", v3: "活跃席位涨到 168，预算持平，关注单点登录和数据导出。" } },
      { key: "con", label: "顾虑", cells: { v2: { content: "单点登录", flag: "worse", note: "漏了导出" }, v3: { content: "单点登录、数据导出", flag: "better", note: "+1" } } },
      { key: "tk", label: "回应", cells: { v2: { content: "「续约马上打 8 折。」", flag: "bad", note: "知识库里没有这个优惠" }, v3: "「导出在管理后台就有，可按季度自动归档。」" } },
    ],
  },
  {
    key: "s2", label: "青禾教育 · 电话", summary: "两版差不多，v3 把跟进时间放进了工作时间",
    rows: [
      { key: "sum", label: "摘要", cells: { v2: "想加 20 个席位。", v3: "下学期想加 20 个席位，先试用一个月。" } },
      { key: "con", label: "顾虑", cells: { v2: "价格", v3: "价格、培训要多久" } },
      { key: "tk", label: "回应", cells: { v2: "「培训很快。」", v3: "「标准培训 2 小时，有录屏可回看。」" } },
    ],
  },
];
export const SUGGESTIONS: FieldSuggestion[] = [
  { id: "seats", field: "席位数", before: "200", after: "240", reason: "客户说「华南两个仓也接进来了」", state: "applied" },
  { id: "stage", field: "阶段", before: "已确认需求", after: "方案报价", reason: "客户要下周二前的报价" },
  { id: "amount", field: "预计金额", before: "¥360,000", after: "¥388,000", reason: "客户原话：预算和去年持平，再加一点给新仓", source: "▶ 04:10" },
  { id: "next", field: "下一步", after: "发续约报价和计费对比", detail: "10-13 周二 18:00 前", acceptHint: "填进下一步和下次跟进，到时提醒你" },
];

// ---------------------------------------------------------------- approvals

export type ApprovalSubject = { kind: "discount"; before: string; after: string; limit: string } | { kind: "leave"; days: string } | { kind: "expense"; amount: string };
export type DemoApproval = ApprovalRequest<ApprovalSubject>;
const ap = (id: string) => ({ id, name: personName(id), hint: PEOPLE.find((p) => p.id === id)?.title });
/** The approver in the approval demos: 林晓, sales director. */
export const APPROVER = ap("u01");
export const APPROVALS: DemoApproval[] = [
  {
    id: "a1", title: "续约折扣 12%（远航精密制造）", typeLabel: "折扣", requester: ap("u02"), createdAt: isoAgo(1, 16), status: "pending", reason: "客户比了三家，对手按量计费便宜约 10%",
    summary: { kind: "discount", before: "8%", after: "12%", limit: "超过销售部阈值 10%" },
    steps: [
      { key: "lead", label: "组长", approvers: [ap("u03")], mode: "any", decisions: [{ approver: ap("u03"), decision: "approved", reason: "老客户，增购明确，可以", at: isoAgo(1, 18) }] },
      { key: "dir", label: "销售总监 + 财务", approvers: [APPROVER, ap("u07")], mode: "all" },
    ],
  },
  { id: "a2", title: "王佳宁 请假 2 天（10月15日 – 10月16日）", typeLabel: "请假", requester: ap("u03"), createdAt: isoAgo(0, 8), status: "pending", reason: "家里有事", summary: { kind: "leave", days: "2 天 · 年假还剩 6 天" }, steps: [{ key: "lead", label: "直属上级", approvers: [APPROVER], mode: "any" }] },
  {
    id: "a3", title: "赵思远 报销差旅 ¥3,280", typeLabel: "报销", requester: ap("u04"), createdAt: isoAgo(3, 9), status: "rejected", reason: "深圳客户现场实施 3 天", closedAt: isoAgo(3, 11),
    summary: { kind: "expense", amount: "¥3,280 · 3 张发票" },
    steps: [{ key: "lead", label: "直属上级", approvers: [APPROVER], mode: "any", decisions: [{ approver: APPROVER, decision: "rejected", reason: "缺酒店发票，补齐后重新提交", at: isoAgo(3, 11) }] }],
  },
  {
    id: "a4", title: "周可欣 请假 1 天（10月9日）", typeLabel: "请假", requester: ap("u05"), createdAt: isoAgo(4, 9), status: "approved", reason: "看病", closedAt: isoAgo(4, 10),
    summary: { kind: "leave", days: "1 天 · 病假" }, steps: [{ key: "lead", label: "直属上级", approvers: [APPROVER], mode: "any", decisions: [{ approver: APPROVER, decision: "approved", at: isoAgo(4, 10) }] }],
  },
  { id: "a5", title: "林晓 请假 3 天（10月20日 – 10月22日）", typeLabel: "请假", requester: APPROVER, createdAt: isoAgo(0, 9), status: "pending", reason: "年假", summary: { kind: "leave", days: "3 天 · 年假还剩 8 天" }, steps: [{ key: "hr", label: "人事", approvers: [{ id: "u09", name: "人事专员" }], mode: "any" }] },
];
