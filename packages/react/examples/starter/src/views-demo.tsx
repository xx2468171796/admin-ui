// 视图示例的演示数据（样稿 D06 / D07 / D09 / D09b / D10 / D16：智能家居业务线的「客户」表）。
// 真实项目里记录、字段、视图、节假日日历都来自宿主的服务端；这里是浏览器里的假数据。
import { Rating, type MediaItem } from "@adminui/react";
import type { GridField, GridSelectOption } from "@adminui/react/grid";
import { toneOfOption, type RecordCardSlots, type ViewSummary, type WorkCalendar } from "@adminui/react/views";
import type { OptionTone } from "@adminui/react";
import { demoPhoto } from "./media-demo";

export type Customer = {
  id: string;
  name: string;
  stage: string | null;
  owner: string;
  phone: string;
  intent: number;
  amount: number;
  next: string | null;
  region: string;
  installer: string | null;
  installStart: string | null;
  installEnd: string | null;
  followAt: string | null;
  /** End of the follow-up (after a resize in the week view). */
  followEnd: string | null;
  /** 产品（多选）：卡片标签行和阶段一起显示。 */
  products: string[];
  /** 评论数（卡片底栏）。 */
  comments: number;
  files: MediaItem[];
};

export const STAGES: GridSelectOption[] = [
  { value: "first", label: "首通", tone: "green" },
  { value: "second", label: "二通", tone: "teal" },
  { value: "quote", label: "报价", tone: "yellow" },
  { value: "won", label: "成交", tone: "greenSolid" },
  { value: "install", label: "安装", tone: "blue" },
  { value: "visit", label: "回访", tone: "gray" },
  { value: "lost", label: "流失", tone: "red" },
];

export const PRODUCTS: GridSelectOption[] = [
  { value: "lock", label: "智能门锁", tone: "olive" },
  { value: "curtain", label: "窗帘", tone: "teal" },
  { value: "light", label: "照明", tone: "yellow" },
  { value: "security", label: "安防", tone: "red" },
  { value: "av", label: "影音", tone: "violet" },
  { value: "network", label: "网络", tone: "gray" },
];
const PRODUCT_SETS: string[][] = [["lock", "curtain"], ["light"], ["lock", "security"], ["light", "curtain", "av", "network"], [], ["network"]];

const photo = (id: string, name: string, variant: number, extra: Partial<MediaItem> = {}): MediaItem => ({ id, name, kind: "image", url: demoPhoto(variant), thumbUrl: demoPhoto(variant), size: 2_400_000 + variant * 13_000, ...extra });
const video = (id: string, name: string, seconds: number): MediaItem => ({ id, name, kind: "video", duration: seconds, size: 48_600_000 });
const pdf = (id: string, name: string): MediaItem => ({ id, name, kind: "pdf", pages: 6, size: 2_300_000 });

type Seed = [string, string | null, string, number, number, string | null, string, string | null, string | null, string | null, string | null, MediaItem[]];
// 名称 · 阶段 · 负责人 · 意向 · 预计金额（元）· 下次跟进 · 地区 · 安装负责人 · 安装日期 · 完工日期 · 跟进时间（北京时间）· 现场资料
const SEEDS: Seed[] = [
  ["陈雅婷", "first", "小王", 4, 380_000, "2026-10-08", "上海", "阿明", "2026-09-28", "2026-09-30", "2026-10-01T10:00", [photo("f1", "客厅.jpg", 0), photo("f2", "玄关.jpg", 1)]],
  ["林志明", "first", "小李", 3, 260_000, "2026-10-04", "杭州", null, null, null, "2026-10-06T10:30", []],
  ["王美玲", "first", "小王", 2, 150_000, "2026-10-02", "苏州", "志伟", "2026-10-08", "2026-10-09", "2026-10-07T13:00", [photo("f3", "外观.jpg", 1)]],
  ["吴宗翰", "second", "阿杰", 4, 560_000, "2026-10-06", "苏州", "志伟", "2026-10-16", "2026-10-20", "2026-10-05T15:00", [video("v1", "客厅走线.mp4", 65), photo("f4", "主卧.jpg", 0), photo("f5", "书房.jpg", 1)]],
  ["蔡依琳", "second", "美华", 4, 310_000, "2026-10-05", "上海", null, null, null, "2026-10-06T10:00", []],
  ["刘建宏", "second", "小李", 3, 280_000, "2026-10-12", "苏州", "志伟", "2026-10-23", "2026-10-27", null, []],
  ["张家豪（徐汇别墅）", "quote", "阿杰", 5, 1_260_000, "2026-10-07", "上海", "志伟", "2026-10-13", "2026-10-15", "2026-10-10T15:00", [photo("f6", "一楼.jpg", 0), video("v2", "徐汇别墅-客厅走线.mp4", 65), pdf("p1", "报价单.pdf"), photo("f7", "二楼.jpg", 1)]],
  ["黄淑芬", "quote", "小王", 4, 540_000, "2026-10-02", "杭州", "阿明", "2026-10-19", "2026-10-21", "2026-10-07T09:00", [pdf("p2", "需求清单.pdf")]],
  ["李承恩（滨江豪宅）", "quote", "美华", 5, 2_180_000, "2026-10-09", "上海", "阿明", "2026-10-09", "2026-10-15", "2026-10-05T09:30", [photo("f8", "全景.jpg", 1), photo("f9", "厨房.jpg", 0)]],
  ["郑淑惠", "won", "小李", 5, 880_000, "2026-10-10", "杭州", "阿明", "2026-10-29", "2026-11-03", "2026-10-10T10:00", [photo("f10", "门口.jpg", 0)]],
  ["许文杰", "visit", "小王", 3, 210_000, null, "南京", null, null, null, "2026-10-07T10:30", []],
  ["杨佩珊", "won", "美华", 4, 450_000, null, "上海", "阿明", "2026-10-26", "2026-10-28", "2026-10-16T15:30", []],
  ["陈雅婷（城西二期）", "won", "小王", 4, 450_000, null, "杭州", null, null, null, null, []],
  ["周怡君", null, "小李", 2, 120_000, null, "南京", null, null, null, "2026-10-07T14:00", []],
  ["何俊廷", null, "阿杰", 3, 200_000, null, "苏州", null, null, null, "2026-10-07T16:00", []],
  ["邱子轩", "first", "小王", 3, 180_000, null, "上海", null, null, null, null, []],
  ["谢宛蓉", "second", "阿杰", 2, 160_000, null, "杭州", null, null, null, null, []],
  ["江美惠", "lost", "美华", 1, 90_000, null, "南京", null, null, null, null, []],
];

export const initialCustomers = (): Customer[] =>
  SEEDS.map(([name, stage, owner, intent, amount, next, region, installer, installStart, installEnd, followAt, files], i) => ({
    id: `C${1001 + i}`,
    name,
    stage,
    owner,
    phone: `1${38 + i}****${String(5600 + i * 17).slice(0, 4)}`,
    intent,
    amount: amount * 100,
    next,
    region,
    installer,
    installStart,
    installEnd,
    // 跟进时间按北京时间写，存成带时区的 ISO（UTC+8）。
    followAt: followAt ? `${followAt}:00+08:00` : null,
    followEnd: null,
    products: PRODUCT_SETS[i % PRODUCT_SETS.length] ?? [],
    comments: (i * 5) % 8,
    files,
  }));

/** One extra page of 「首通」 cards for the kanban's 「加载更多」. */
export const moreFirstCalls = (page: number): Customer[] =>
  ["孙嘉玲", "罗志豪", "高佩君"].map((name, i) => ({
    id: `M${page}${i}`,
    name: `${name}${page > 1 ? page : ""}`,
    stage: "first",
    owner: ["小王", "小李", "阿杰"][i] ?? "小王",
    phone: `139****0${100 + i}`,
    intent: 2 + i,
    amount: (120_000 + i * 40_000) * 100,
    next: "2026-10-14",
    region: "上海",
    installer: null,
    installStart: null,
    installEnd: null,
    followAt: null,
    followEnd: null,
    products: [],
    comments: 0,
    files: [],
  }));

/** The option tone of a stage value (neutral for 「未设置」). */
export const stageTone = (value: string | null): OptionTone => {
  const option = STAGES.find((s) => s.value === value);
  return option ? toneOfOption(option) : "gray";
};

export const FIELDS: GridField<Customer>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES },
  { key: "owner", title: "负责人", type: "user" },
  { key: "phone", title: "手机", type: "text" },
  { key: "amount", title: "预计金额", type: "money", currency: "¥", precision: 0 },
  // 逾期（早于今天）的下次跟进用异常色，卡片和表格一样
  { key: "next", title: "下次跟进", type: "date", timeZone: "Asia/Shanghai", tone: (r) => (r.next && r.next < TODAY ? "danger" : null) },
  { key: "intent", title: "意向", type: "custom", text: (r) => `${r.intent} 星`, render: (r) => <Rating value={r.intent} label="意向" /> },
  { key: "region", title: "地区", type: "text" },
  { key: "installer", title: "安装负责人", type: "user" },
  { key: "installStart", title: "安装日期", type: "date", timeZone: "Asia/Shanghai" },
  { key: "installEnd", title: "完工日期", type: "date", timeZone: "Asia/Shanghai" },
  { key: "followAt", title: "跟进时间", type: "datetime", timeZone: "Asia/Shanghai" },
  { key: "products", title: "产品", type: "multiSelect", options: PRODUCTS },
];
export const STAGE_FIELD: GridField<Customer> = FIELDS.find((f) => f.key === "stage") ?? { key: "stage", title: "阶段", type: "singleSelect", options: STAGES };
export const fieldsByKey = (keys: readonly string[]) => keys.map((k) => FIELDS.find((f) => f.key === k)).filter((f): f is GridField<Customer> => Boolean(f));

/**
 * 卡片五个固定位（审阅 08）：标签 = 阶段 + 产品，关键数 = 金额 · 地区，底栏 = 负责人 + 评论数 + 下次跟进（今天注意色、逾期异常色）。
 * 看板 / 画册都用这一份（KanbanBoard / GalleryView 的 cardSlots）。
 */
export const CARD_SLOTS: RecordCardSlots<Customer> = {
  tags: fieldsByKey(["stage", "products"]),
  keyline: fieldsByKey(["amount", "region"]),
  owner: FIELDS.find((f) => f.key === "owner"),
  due: FIELDS.find((f) => f.key === "next"),
  comments: (r) => r.comments,
};

export const INITIAL_VIEWS: ViewSummary[] = [
  { id: "all", name: "智能家居 · 全部客户", kind: "grid", tier: "standard", mustSee: true },
  { id: "week", name: "本周待跟进", kind: "grid", tier: "standard", mustSee: true },
  { id: "board", name: "阶段看板", kind: "kanban", tier: "standard" },
  { id: "cal", name: "跟进日历", kind: "calendar", tier: "standard" },
  { id: "plan", name: "安装排期", kind: "gantt", tier: "standard" },
  { id: "photo", name: "现场照片", kind: "gallery", tier: "standard" },
  { id: "g1", name: "一组客户", kind: "grid", tier: "shared" },
  { id: "deal", name: "本月成交", kind: "kanban", tier: "shared" },
  { id: "mine", name: "我的客户", kind: "grid", tier: "mine" },
  { id: "late", name: "我的逾期跟进", kind: "calendar", tier: "mine" },
  { id: "tp", name: "上海大户", kind: "grid", tier: "mine", hidden: true },
];

/**
 * 中国大陆 2026 国庆 10-01 至 10-08（宿主自己的节假日数据，名称写在值里：月历格子写「休 国庆日」、补班「班」；
 * SDK 不内置任何地区的日历，真实项目从服务端按地区取）。
 */
export const CN_2026: WorkCalendar = {
  holidays: Object.fromEntries(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map((d) => [d, "国庆日"])),
  workdays: { "2026-10-10": "国庆调休" },
};
export const TODAY = "2026-10-05";
