/**
 * Demo data for the 人员选择器 page: a fictional group 「Acme 集团」 (集团总部 + 华南子公司 + 华东子公司), its department
 * tree, people (incl. a departed 李文博 and a 200-person 客服中心 for virtual scrolling), roles, business lines and four
 * viewers with their own scope. Everything is invented. A real OrgDataSource asks the server, which filters by what the
 * viewer may grant; this one answers from memory with a little delay and cursor paging.
 */
import type { Availability, OrgDataSource, OrgPerson, OrgSearchHit, OrgShortcut, OrgUnit, PickedSubject, PickerSource, SubjectRef } from "@adminui/react/org-picker";

type Person = OrgPerson & { py?: string };

export const ORG_UNITS: readonly OrgUnit[] = [
  { id: "g", kind: "group", label: "Acme 集团", parentId: null, memberCount: 234, childCount: 3 },
  { id: "hq", kind: "company", label: "集团总部", parentId: "g", memberCount: 4, childCount: 1 },
  { id: "hq-office", kind: "dept", label: "总经办", parentId: "hq", memberCount: 4, childCount: 0 },
  { id: "hn", kind: "company", label: "华南子公司", parentId: "g", memberCount: 222, childCount: 5 },
  { id: "hn-sales", kind: "dept", label: "销售部", parentId: "hn", memberCount: 10, directCount: 1, childCount: 3 },
  { id: "hn-g1", kind: "dept", label: "一组", parentId: "hn-sales", memberCount: 5, childCount: 0 },
  { id: "hn-g2", kind: "dept", label: "二组", parentId: "hn-sales", memberCount: 4, childCount: 0 },
  { id: "hn-retail", kind: "dept", label: "新零售组", parentId: "hn-sales", memberCount: 0, childCount: 0, hint: "筹备中" },
  { id: "hn-ops", kind: "dept", label: "运营部", parentId: "hn", memberCount: 3, childCount: 0 },
  { id: "hn-tech", kind: "dept", label: "技术部", parentId: "hn", memberCount: 4, directCount: 2, childCount: 1 },
  { id: "hn-install", kind: "dept", label: "安装组", parentId: "hn-tech", memberCount: 2, childCount: 0 },
  { id: "hn-fin", kind: "dept", label: "财务部", parentId: "hn", memberCount: 2, childCount: 0 },
  { id: "hn-cs", kind: "dept", label: "客服中心", parentId: "hn", memberCount: 200, childCount: 0 },
  { id: "hd", kind: "company", label: "华东子公司", parentId: "g", memberCount: 8, childCount: 2 },
  { id: "hd-sales", kind: "dept", label: "销售部", parentId: "hd", memberCount: 5, childCount: 0 },
  { id: "hd-ops", kind: "dept", label: "运营部", parentId: "hd", memberCount: 3, childCount: 0 },
];

const SURNAMES = "赵钱孙周吴郑冯陈褚卫蒋沈韩杨朱秦尤许何吕施孔曹严华金魏陶姜";
const GIVEN = "子涵雨桐思远浩然一诺欣然梓轩若溪明哲语嫣嘉禾书瑶";
const csPeople: Person[] = Array.from({ length: 200 }, (_, i) => ({
  id: `cs${i + 1}`,
  label: i === 0 ? "孔思远" : `${SURNAMES[i % SURNAMES.length]}${GIVEN.slice((i * 2) % GIVEN.length, ((i * 2) % GIVEN.length) + 2)}`,
  deptIds: ["hn-cs"],
  title: i === 0 ? "客服组长" : "客服专员",
  ...(i === 0 ? { badges: ["负责人"] } : {}),
}));

export const ORG_PEOPLE: readonly Person[] = [
  { id: "boss", label: "王总", deptIds: ["hq-office"], title: "集团总经理", badges: ["负责人"], py: "wz" },
  { id: "hq2", label: "沈嘉禾", deptIds: ["hq-office"], title: "总经理助理", py: "sjh" },
  { id: "hq3", label: "韩书瑶", deptIds: ["hq-office"], title: "法务", py: "hsy" },
  { id: "hq4", label: "蒋明哲", deptIds: ["hq-office"], title: "行政", py: "jmz" },
  { id: "lin", label: "林经理", deptIds: ["hn-sales"], title: "销售部经理", badges: ["负责人"], py: "ljl" },
  { id: "chen", label: "陈组长", deptIds: ["hn-g1"], title: "一组组长", badges: ["负责人"], aside: { text: "手上 18 / 30" }, py: "czz" },
  { id: "wang", label: "小王", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 23 / 30" }, py: "xw" },
  { id: "li", label: "小李", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 12 / 30" }, py: "xl" },
  { id: "zhao", label: "赵一诺", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 27 / 30" }, py: "zyn" },
  { id: "qian", label: "钱浩然", deptIds: ["hn-g1"], title: "销售 · 外勤", aside: { text: "手上 30 / 30", tone: "warning" }, py: "qhr" },
  { id: "liwb", label: "李文博", deptIds: ["hn-g1"], title: "销售", status: "left", py: "lwb" },
  { id: "g2a", label: "孙雨桐", deptIds: ["hn-g2"], title: "二组组长", badges: ["负责人"], py: "syt" },
  { id: "g2b", label: "冯子涵", deptIds: ["hn-g2"], title: "销售", py: "fzh" },
  { id: "g2c", label: "褚欣然", deptIds: ["hn-g2"], title: "销售", py: "cxr" },
  { id: "g2d", label: "卫梓轩", deptIds: ["hn-g2"], title: "销售", py: "wzx" },
  { id: "zhoum", label: "周敏", deptIds: ["hn-ops"], title: "子公司管理员", badges: ["管理员"], py: "zm" },
  { id: "ops2", label: "小A", deptIds: ["hn-ops"], title: "运营 · 只负责智能家居线", py: "xa" },
  { id: "ops3", label: "杨若溪", deptIds: ["hn-ops"], title: "运营", py: "yrx" },
  { id: "tech1", label: "朱明哲", deptIds: ["hn-tech"], title: "技术主管", badges: ["负责人"], py: "zmz" },
  { id: "tech2", label: "秦语嫣", deptIds: ["hn-tech"], title: "工程师", py: "qyy" },
  { id: "ins1", label: "尤浩然", deptIds: ["hn-install"], title: "安装师傅", py: "yhr" },
  { id: "ins2", label: "何子涵", deptIds: ["hn-install"], title: "安装师傅", py: "hzh" },
  { id: "fin1", label: "吕书瑶", deptIds: ["hn-fin"], title: "财务", py: "lsy" },
  { id: "fin2", label: "施一诺", deptIds: ["hn-fin"], title: "出纳", py: "syn" },
  ...csPeople,
  { id: "hd1", label: "曹梓轩", deptIds: ["hd-sales"], title: "销售经理", badges: ["负责人"], py: "czx" },
  { id: "hd2", label: "严欣然", deptIds: ["hd-sales"], title: "销售", py: "yxr" },
  { id: "hd3", label: "华雨桐", deptIds: ["hd-sales"], title: "销售", py: "hyt" },
  { id: "hd4", label: "金思远", deptIds: ["hd-sales"], title: "销售", py: "jsy" },
  { id: "hd5", label: "魏若溪", deptIds: ["hd-sales"], title: "销售", py: "wrx" },
  { id: "hd6", label: "陶嘉禾", deptIds: ["hd-ops"], title: "运营", py: "tjh" },
  { id: "hd7", label: "姜语嫣", deptIds: ["hd-ops"], title: "运营", py: "jyy" },
  { id: "hd8", label: "孔浩然", deptIds: ["hd-ops"], title: "运营", py: "khr" },
];

export const ORG_ROLES: readonly PickedSubject[] = [
  { kind: "role", id: "r-sales", label: "销售", path: ["华南子公司"], count: 7 },
  { kind: "role", id: "r-fin", label: "财务", path: ["华南子公司"], count: 2 },
  { kind: "role", id: "r-lead", label: "部门主管", path: ["按发起人所在部门找"], count: 6 },
  { kind: "role", id: "r-admin", label: "子公司管理员", path: ["华南子公司"], count: 1 },
];
export const ORG_LINES: readonly PickedSubject[] = [
  { kind: "line", id: "l-home", label: "智能家居", path: ["华南子公司"], count: 8 },
  { kind: "line", id: "l-render", label: "效果图", path: ["华南子公司"], count: 5 },
  { kind: "line", id: "l-custom", label: "全屋定制", path: ["华东子公司"], count: 4 },
];

export type DemoViewer = "wang" | "chen" | "admin" | "boss";
export const DEMO_VIEWERS: readonly { value: DemoViewer; label: string }[] = [
  { value: "wang", label: "小王 · 销售" },
  { value: "chen", label: "陈组长 · 只管一组" },
  { value: "admin", label: "周敏 · 子公司管理员" },
  { value: "boss", label: "王总 · 集团管理员" },
];
/** Where each viewer's picker opens (primary department / company / group) — never ticked. */
export const DEMO_FOCUS: Record<DemoViewer, string> = { wang: "hn-g1", chen: "hn-g1", admin: "hn", boss: "g" };

const byId = new Map(ORG_UNITS.map((u) => [u.id, u]));
const chain = (id: string | null): OrgUnit[] => {
  const out: OrgUnit[] = [];
  for (let at = id; at; at = byId.get(at)?.parentId ?? null) {
    const u = byId.get(at);
    if (u) out.unshift(u);
  }
  return out;
};
const companyOf = (id: string) => chain(id).find((u) => u.kind === "company")?.id;
const pathOf = (id: string | null) => chain(id).filter((u) => u.kind !== "group").map((u) => u.label);
const ancestorsOf = (id: string | null) => chain(id).map((u) => u.id);
const deptOfRef = (ref: SubjectRef) => (ref.kind === "person" ? ORG_PEOPLE.find((p) => p.id === ref.id)?.deptIds[0] : ref.id);

/**
 * Scope per viewer (what the host's permission service would answer): other companies are hidden unless the viewer
 * may grant across the group; inside the company, departments out of scope are grey with whom to ask.
 */
export function demoAvailability(viewer: DemoViewer) {
  return (ref: SubjectRef): Availability | undefined => {
    if (viewer === "boss" || ref.kind === "role" || ref.kind === "line") return undefined;
    if (ref.kind === "group") return { state: "partial", reason: "整个集团只有集团管理员能选" };
    const dept = deptOfRef(ref);
    if (!dept) return undefined;
    if (companyOf(dept) !== "hn") return { state: "hidden" };
    if (viewer !== "chen") return undefined;
    if (ancestorsOf(dept).includes("hn-g1")) return undefined;
    if (ref.id === "hn-sales" || ref.id === "hn") return { state: "partial", reason: "只能选里面你管得着的部门（一组）" };
    return { state: "locked", reason: "不在你的管理范围，找周敏开通" };
  };
}

const unitPick = (id: string): PickedSubject => {
  const u = byId.get(id);
  if (!u) return { kind: "dept", id, label: id };
  return { kind: u.kind, id: u.id, label: u.label, path: pathOf(u.parentId), includeSub: true, count: u.memberCount, ancestors: ancestorsOf(u.parentId) };
};
const personPick = (id: string, label: string, dept: string): PickedSubject => ({ kind: "person", id, label, path: pathOf(dept), ancestors: ancestorsOf(dept) });

/** Quick picks per viewer: 我 / 我的部门 / 上级 · 整个华南子公司 · 整个集团. */
export function demoShortcuts(viewer: DemoViewer): OrgShortcut[] {
  if (viewer === "wang") {
    return [
      { key: "me", label: "我", subject: personPick("wang", "小王", "hn-g1") },
      { key: "dept", label: "我的部门", hint: "一组", subject: unitPick("hn-g1") },
      { key: "up", label: "上级", hint: "销售部", subject: unitPick("hn-sales") },
    ];
  }
  if (viewer === "chen") return [{ key: "me", label: "我", subject: personPick("chen", "陈组长", "hn-g1") }, { key: "dept", label: "我的部门", hint: "一组", subject: unitPick("hn-g1") }];
  if (viewer === "admin") return [{ key: "co", label: "整个华南子公司", subject: unitPick("hn") }];
  return [{ key: "group", label: "整个集团", subject: unitPick("g") }, { key: "hq", label: "整个集团总部", subject: unitPick("hq") }];
}

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));
const descendants = (id: string): string[] => ORG_UNITS.filter((u) => u.parentId === id).flatMap((u) => [u.id, ...descendants(u.id)]);
const isLead = (p: Person) => Boolean(p.badges?.includes("负责人"));
const PAGE = 60;

function searchHits(query: string): OrgSearchHit[] {
  const q = query.trim().toLowerCase();
  const hit = (text: string | undefined) => Boolean(text && text.toLowerCase().includes(q));
  const people: OrgSearchHit[] = ORG_PEOPLE.filter((p) => hit(p.label) || hit(p.py) || hit(p.title) || pathOf(p.deptIds[0] ?? null).some(hit)).map((p) => ({
    ...personPick(p.id, p.label, p.deptIds[0] ?? ""),
    title: p.title,
    badges: p.badges,
    ...(p.status ? { status: p.status } : {}),
  }));
  const units: OrgSearchHit[] = ORG_UNITS.filter((u) => u.kind !== "group" && (hit(u.label) || pathOf(u.parentId).some(hit))).map((u) => unitPick(u.id));
  const extra = [...ORG_ROLES, ...ORG_LINES].filter((s) => hit(s.label)).map((s) => ({ ...s }));
  return [...people, ...units, ...extra];
}

function resolveRef(r: SubjectRef): PickedSubject {
  const p = ORG_PEOPLE.find((x) => x.id === r.id);
  if (r.kind === "person" && p) return { ...personPick(p.id, p.label, p.deptIds[0] ?? ""), ...(p.status ? { status: p.status } : {}) };
  if (byId.has(r.id)) return unitPick(r.id);
  return [...ORG_ROLES, ...ORG_LINES].find((x) => x.id === r.id) ?? { kind: r.kind, id: r.id, label: r.id };
}

/** The in-memory OrgDataSource (a real one calls the host's directory API with the viewer's scope). */
export function createDemoOrgSource(): OrgDataSource {
  return {
    roots: () => wait(ORG_UNITS.filter((u) => !u.parentId)),
    loadChildren: (id) => wait(ORG_UNITS.filter((u) => u.parentId === id)),
    loadMembers: (id, { deep, cursor }) => {
      const ids = new Set(deep ? [id, ...descendants(id)] : [id]);
      const all = ORG_PEOPLE.filter((p) => p.deptIds.some((d) => ids.has(d)));
      const active = all.filter((p) => !p.status).sort((a, b) => Number(isLead(b)) - Number(isLead(a)));
      const from = cursor ? Number(cursor) : 0;
      const items = active.slice(from, from + PAGE);
      const nextCursor = from + PAGE < active.length ? String(from + PAGE) : undefined;
      return wait({ items, nextCursor, total: active.length, hiddenDeparted: all.length - active.length }, cursor ? 200 : 160);
    },
    search: (query, { limit }) => wait(searchHits(query).slice(0, limit), 180),
    resolve: (refs) => wait(refs.map(resolveRef)),
    pathOf: (id) => wait(chain(id), 60),
  };
}

/** Pluggable tabs after 「组织架构」: 角色 / 业务线 / 公司. */
export const DEMO_TABS: readonly PickerSource[] = [
  { key: "roles", label: "角色", kind: "role", list: ({ query }) => wait(ORG_ROLES.filter((r) => !query || r.label.includes(query))) },
  { key: "lines", label: "业务线", kind: "line", list: ({ query }) => wait(ORG_LINES.filter((r) => !query || r.label.includes(query))) },
  { key: "companies", label: "公司", kind: "company", list: () => wait(ORG_UNITS.filter((u) => u.kind === "company").map((u) => unitPick(u.id))) },
];

/** Someone shared with earlier who has since left: stays on the list, struck through, until removed by hand. */
export const DEMO_DEPARTED: PickedSubject = { kind: "person", id: "liwb", label: "李文博", status: "left", path: ["华南子公司", "销售部", "一组"] };

/** Props every demo passes for the chosen viewer: scope, where the tree opens, quick picks. */
export function demoViewerProps(viewer: DemoViewer) {
  return { availability: demoAvailability(viewer), defaultFocus: DEMO_FOCUS[viewer], shortcuts: demoShortcuts(viewer) };
}
