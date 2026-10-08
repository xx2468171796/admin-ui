/**
 * Extra demo data for the 数据表格 family (DataTable / BitableGrid / timelines). Built from demo-data.ts so every
 * page shows the same fictional customers and people.
 */
import { CUSTOMERS as BASE_CUSTOMERS, PEOPLE, STAGES, personName, type Customer } from "./demo-data";

/** The shared customers with every sales stage represented (lists, grids and grouping need all six). */
export const CUSTOMERS: readonly Customer[] = BASE_CUSTOMERS.map((c, i) => ({ ...c, stage: STAGES[(i * 5 + 2) % STAGES.length]?.value ?? c.stage }));

export type Sort = { key: string; direction: "asc" | "desc" };

/** Sort customers locally (a real page sends `sort` to the server instead). */
export function sortCustomers(rows: readonly Customer[], sort: Sort | undefined): Customer[] {
  const list = rows.slice();
  if (!sort) return list;
  const sign = sort.direction === "asc" ? 1 : -1;
  const value = (row: Customer): string | number => {
    if (sort.key === "amount") return row.amount;
    if (sort.key === "seats") return row.seats;
    if (sort.key === "nextFollowUp") return row.nextFollowUp;
    return row.name;
  };
  return list.sort((a, b) => (value(a) > value(b) ? sign : value(a) < value(b) ? -sign : 0));
}

export const TAGS = [
  { value: "key", label: "重点客户", tone: "red" },
  { value: "renew", label: "续约中", tone: "blue" },
  { value: "upsell", label: "可增购", tone: "green" },
  { value: "pilot", label: "试点", tone: "violet" },
  { value: "risk", label: "流失风险", tone: "orange" },
] as const;

/** One customer as a 多维表格 record: money in fen, people as { name }. */
export type GridCustomer = {
  id: string;
  name: string;
  stage: string;
  owner: { name: string }[];
  industry: string;
  tags: string[];
  amount: number;
  seats: number;
  intent: number;
  progress: number | null;
  nextFollowUp: string;
  active: boolean;
  website: string;
  note: string;
};

export const GRID_CUSTOMERS: readonly GridCustomer[] = CUSTOMERS.map((c, i) => ({
  id: c.id,
  name: c.name,
  stage: c.stage,
  owner: [{ name: personName(c.owner) }],
  industry: c.industry,
  tags: TAGS.filter((_, k) => (i + k) % 4 === 0).map((t) => t.value),
  amount: c.amount * 100,
  seats: c.seats,
  intent: 1 + (i % 5),
  progress: c.stage === "won" ? 40 + ((i * 17) % 60) : null,
  nextFollowUp: c.nextFollowUp,
  active: c.active,
  website: `https://example.com/${c.id.toLowerCase()}`,
  note: i % 3 === 0 ? "希望先在一个部门试用两周，再决定全员上线。" : "",
}));

export const OWNER_OPTIONS = PEOPLE.slice(1, 6).map((p) => ({ name: p.name, hint: p.title }));
