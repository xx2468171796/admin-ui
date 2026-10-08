/**
 * Neutral demo data for every demo on the site: a fictional B2B SaaS company 「北辰云」 (Northstar Cloud) selling
 * to fictional customers. No real companies, people, domains, IPs or phone numbers (phones use reserved ranges).
 */

export const COMPANY = { name: "北辰云", en: "Northstar Cloud", logo: "北" } as const;

export type Person = { id: string; name: string; title: string; dept: string; email: string };

export const DEPARTMENTS = [
  { id: "d-sales", name: "销售部", parent: null },
  { id: "d-sales-east", name: "华东销售组", parent: "d-sales" },
  { id: "d-sales-south", name: "华南销售组", parent: "d-sales" },
  { id: "d-cs", name: "客户成功部", parent: null },
  { id: "d-rd", name: "研发部", parent: null },
  { id: "d-fin", name: "财务部", parent: null },
] as const;

export const PEOPLE: readonly Person[] = [
  { id: "u01", name: "林晓", title: "销售总监", dept: "d-sales", email: "lin.xiao@example.com" },
  { id: "u02", name: "陈一鸣", title: "客户经理", dept: "d-sales-east", email: "chen.yiming@example.com" },
  { id: "u03", name: "王佳宁", title: "客户经理", dept: "d-sales-east", email: "wang.jianing@example.com" },
  { id: "u04", name: "赵思远", title: "客户经理", dept: "d-sales-south", email: "zhao.siyuan@example.com" },
  { id: "u05", name: "周可欣", title: "客户成功经理", dept: "d-cs", email: "zhou.kexin@example.com" },
  { id: "u06", name: "吴昊", title: "解决方案工程师", dept: "d-rd", email: "wu.hao@example.com" },
  { id: "u07", name: "孙雨桐", title: "财务专员", dept: "d-fin", email: "sun.yutong@example.com" },
  { id: "u08", name: "郑明轩", title: "前端工程师", dept: "d-rd", email: "zheng.mingxuan@example.com" },
];

export const personName = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;

export const STAGES = [
  { value: "lead", label: "线索", tone: "gray" },
  { value: "qualified", label: "已确认需求", tone: "blue" },
  { value: "proposal", label: "方案报价", tone: "violet" },
  { value: "negotiation", label: "商务谈判", tone: "orange" },
  { value: "won", label: "赢单", tone: "green" },
  { value: "lost", label: "输单", tone: "red" },
] as const;
export type StageValue = (typeof STAGES)[number]["value"];

export const INDUSTRIES = ["制造", "零售", "教育", "医疗", "物流", "金融"] as const;
export const CITIES = ["上海", "杭州", "深圳", "成都", "苏州", "武汉"] as const;

export type Customer = {
  id: string;
  name: string;
  industry: (typeof INDUSTRIES)[number];
  city: (typeof CITIES)[number];
  owner: string;
  stage: StageValue;
  amount: number;
  seats: number;
  createdAt: string;
  nextFollowUp: string;
  active: boolean;
};

const NAMES = [
  "远航精密制造", "青禾教育", "星河物流", "云杉医疗", "启明零售", "海川金融科技", "松果智能", "蓝湾供应链",
  "白鹭酒店管理", "长风新能源", "晨光文具", "知行培训", "安澜保险经纪", "望岳建材", "鹿鸣传媒", "清泉食品",
  "明德医院集团", "极光汽车零部件", "南山软件", "银杏连锁药房", "飞鱼跨境", "北斗测绘", "竹溪茶业", "曜石半导体",
] as const;

const pick = <T,>(pool: readonly T[], i: number): T => pool[i % pool.length] as T;
const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 9, 8) + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};

export const CUSTOMERS: readonly Customer[] = NAMES.map((name, i) => ({
  id: `C${String(1001 + i)}`,
  name,
  industry: pick(INDUSTRIES, i),
  city: pick(CITIES, i * 5 + 1),
  owner: pick(["u02", "u03", "u04", "u05"], i),
  stage: pick(STAGES, i * 7 + Math.floor(i / 6)).value,
  amount: 48_000 + ((i * 37_919) % 420_000),
  seats: 20 + ((i * 13) % 180),
  createdAt: day(-90 + i * 3),
  nextFollowUp: day((i % 9) - 3),
  active: i % 7 !== 3,
}));

export const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;
export const formatAmount = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
