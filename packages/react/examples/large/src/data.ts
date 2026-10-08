// Demo data shared by the large-tier pages (no backend).
export type Customer = { id: string; name: string; stage: string; owner: string; amount: number; next: string };
export const STAGES = [
  { value: "lead", label: "线索", tone: "gray" as const },
  { value: "quote", label: "报价", tone: "yellow" as const },
  { value: "deal", label: "谈判", tone: "blue" as const },
  { value: "won", label: "成交", tone: "greenSolid" as const },
];
const NAMES = ["赵静怡", "陈冠宇", "王小明", "孙佳宁", "李承恩", "黄志豪", "吴佩珊", "郑家豪"];
const OWNERS = ["小王", "阿杰", "小美"];
export const CUSTOMERS: Customer[] = Array.from({ length: 48 }, (_, i) => ({
  id: `C${String(2001 + i)}`,
  name: `${NAMES[i % NAMES.length]!}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`,
  stage: STAGES[(i * 7) % STAGES.length]!.value,
  owner: OWNERS[i % OWNERS.length]!,
  amount: 120000 + ((i * 37931) % 900000),
  next: `2026-10-${String(8 + (i % 20)).padStart(2, "0")}`,
}));
