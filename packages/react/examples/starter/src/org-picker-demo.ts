// 组织选人示例数据：一个集团（集团总部 + 华南子公司 + 深圳子公司）、部门树、
// 人（含已离职的李俊杰、500 人的客服中心）、角色、业务线，和四个身份（小王 / 陈组长 / 赵静怡 / 王总）各自的可选范围。
// 真项目的 OrgDataSource 由后端按看的人的可授权范围过滤；这里在内存里模拟，带一点延迟和分页。
import type { Availability, OrgDataSource, OrgPerson, OrgSearchHit, OrgUnit, PickedSubject, PickerSource, SubjectRef } from "@adminui/react/org-picker";

type Person = OrgPerson & { py?: string };

export const ORG_UNITS: OrgUnit[] = [
  { id: "g", kind: "group", label: "Acme 集团", parentId: null, memberCount: 532, childCount: 3 },
  { id: "hq", kind: "company", label: "集团总部", parentId: "g", memberCount: 4, childCount: 1 },
  { id: "hq-sales", kind: "dept", label: "总部销售部", parentId: "hq", memberCount: 4, childCount: 0 },
  { id: "hn", kind: "company", label: "华南子公司", parentId: "g", memberCount: 520, childCount: 6 },
  { id: "hn-sales", kind: "dept", label: "销售部", parentId: "hn", memberCount: 10, directCount: 1, childCount: 3 },
  { id: "hn-g1", kind: "dept", label: "一组", parentId: "hn-sales", memberCount: 5, childCount: 0 },
  { id: "hn-g2", kind: "dept", label: "二组", parentId: "hn-sales", memberCount: 4, childCount: 0 },
  { id: "hn-retail", kind: "dept", label: "新零售组", parentId: "hn-sales", memberCount: 0, childCount: 0, hint: "筹备中" },
  { id: "hn-ops", kind: "dept", label: "运营部", parentId: "hn", memberCount: 3, childCount: 0 },
  { id: "hn-tech", kind: "dept", label: "技术部", parentId: "hn", memberCount: 4, directCount: 2, childCount: 1 },
  { id: "hn-install", kind: "dept", label: "安装组", parentId: "hn-tech", memberCount: 2, childCount: 0 },
  { id: "hn-fin", kind: "dept", label: "财务部", parentId: "hn", memberCount: 2, childCount: 0 },
  { id: "hn-cs", kind: "dept", label: "客服中心", parentId: "hn", memberCount: 500, childCount: 0 },
  { id: "sz", kind: "company", label: "深圳子公司", parentId: "g", memberCount: 8, childCount: 2 },
  { id: "sz-sales", kind: "dept", label: "销售部", parentId: "sz", memberCount: 5, childCount: 0 },
  { id: "sz-ops", kind: "dept", label: "运营部", parentId: "sz", memberCount: 3, childCount: 0 },
];

const SURNAMES = "陈林黄张李王吴刘蔡杨许郑谢洪郭邱曾廖赖徐周叶苏庄吕江何萧罗高";
const GIVEN = "怡君雅婷家豪志明淑芬俊杰美玲建宏佩珊宗翰诗涵冠宇欣怡承恩";
const csPeople: Person[] = Array.from({ length: 500 }, (_, i) => ({
  id: `cs${i + 1}`,
  label: i === 0 ? "陈怡君" : `${SURNAMES[i % SURNAMES.length]}${GIVEN.slice((i * 2) % GIVEN.length, ((i * 2) % GIVEN.length) + 2)}`,
  deptIds: ["hn-cs"],
  title: i === 0 ? "客服组长" : "客服专员",
  ...(i === 0 ? { badges: ["负责人"] } : {}),
}));

export const ORG_PEOPLE: Person[] = [
  { id: "zhou", label: "周经理", deptIds: ["hq-sales"], title: "销售部负责人", badges: ["负责人"], py: "zjl" },
  { id: "hq2", label: "许雅婷", deptIds: ["hq-sales"], title: "大客户经理", py: "xyt" },
  { id: "hq3", label: "郑志明", deptIds: ["hq-sales"], title: "大客户经理", py: "zzm" },
  { id: "hq4", label: "王总", deptIds: ["hq-sales"], title: "集团总经理", py: "wz" },
  { id: "lin", label: "林经理", deptIds: ["hn-sales"], title: "销售部经理", badges: ["负责人"], py: "ljl" },
  { id: "chen", label: "陈组长", deptIds: ["hn-g1"], title: "一组组长", badges: ["负责人"], aside: { text: "手上 18 / 30" }, py: "czz" },
  { id: "wang", label: "小王", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 23 / 30" }, py: "xw" },
  { id: "li", label: "小李", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 12 / 30" }, py: "xl" },
  { id: "zhang", label: "张家豪", deptIds: ["hn-g1"], title: "销售", aside: { text: "手上 27 / 30" }, py: "zjh" },
  { id: "jie", label: "阿杰", deptIds: ["hn-g1"], title: "销售 · 上海", aside: { text: "手上 30 / 30", tone: "warning" }, py: "aj" },
  { id: "lijj", label: "李俊杰", deptIds: ["hn-g1"], title: "销售", status: "left", py: "ljj" },
  { id: "g2a", label: "黄淑芬", deptIds: ["hn-g2"], title: "二组组长", badges: ["负责人"], py: "hsf" },
  { id: "g2b", label: "吴建宏", deptIds: ["hn-g2"], title: "销售", py: "wjh" },
  { id: "g2c", label: "蔡佩珊", deptIds: ["hn-g2"], title: "销售", py: "cps" },
  { id: "g2d", label: "杨宗翰", deptIds: ["hn-g2"], title: "销售", py: "yzh" },
  { id: "liny", label: "赵静怡", deptIds: ["hn-ops"], title: "子公司管理员", badges: ["管理员"], py: "zjy" },
  { id: "xa", label: "小A", deptIds: ["hn-ops"], title: "运营 · 只负责智能家居线", py: "xa" },
  { id: "ops3", label: "谢诗涵", deptIds: ["hn-ops"], title: "运营", py: "xsh" },
  { id: "tech1", label: "洪冠宇", deptIds: ["hn-tech"], title: "技术主管", badges: ["负责人"], py: "hgy" },
  { id: "tech2", label: "郭欣怡", deptIds: ["hn-tech"], title: "工程师", py: "gxy" },
  { id: "ming", label: "阿明", deptIds: ["hn-install"], title: "安装师傅", py: "am" },
  { id: "ins2", label: "邱承恩", deptIds: ["hn-install"], title: "安装师傅", py: "qce" },
  { id: "fin1", label: "曾美玲", deptIds: ["hn-fin"], title: "财务", py: "zml" },
  { id: "fin2", label: "廖佩珊", deptIds: ["hn-fin"], title: "出纳", py: "lps" },
  ...csPeople,
  { id: "sz1", label: "赖俊杰", deptIds: ["sz-sales"], title: "销售经理", badges: ["负责人"], py: "ljj" },
  { id: "sz2", label: "徐美玲", deptIds: ["sz-sales"], title: "销售", py: "xml" },
  { id: "sz3", label: "周建宏", deptIds: ["sz-sales"], title: "销售", py: "zjh" },
  { id: "sz4", label: "叶志明", deptIds: ["sz-sales"], title: "销售", py: "yzm" },
  { id: "sz5", label: "苏怡君", deptIds: ["sz-sales"], title: "销售", py: "syj" },
  { id: "sz6", label: "庄雅婷", deptIds: ["sz-ops"], title: "运营", py: "zyt" },
  { id: "sz7", label: "吕家豪", deptIds: ["sz-ops"], title: "运营", py: "ljh" },
  { id: "sz8", label: "江淑芬", deptIds: ["sz-ops"], title: "运营", py: "jsf" },
];

export const ORG_ROLES: PickedSubject[] = [
  { kind: "role", id: "r-sales", label: "销售", path: ["华南子公司"], count: 7 },
  { kind: "role", id: "r-fin", label: "财务", path: ["华南子公司"], count: 2 },
  { kind: "role", id: "r-lead", label: "部门主管", path: ["按发起人所在部门找"], count: 6 },
  { kind: "role", id: "r-admin", label: "子公司管理员", path: ["华南子公司"], count: 1 },
];
export const ORG_LINES: PickedSubject[] = [
  { kind: "line", id: "l-home", label: "智能家居", path: ["华南子公司"], count: 8 },
  { kind: "line", id: "l-render", label: "效果图", path: ["华南子公司"], count: 5 },
  { kind: "line", id: "l-custom", label: "全屋定制", path: ["深圳子公司"], count: 4 },
];

export type DemoViewer = "wang" | "chen" | "liny" | "boss";
export const DEMO_VIEWERS: { value: DemoViewer; label: string }[] = [
  { value: "wang", label: "小王 · 销售" },
  { value: "chen", label: "陈组长 · 只管一组" },
  { value: "liny", label: "赵静怡 · 子公司管理员" },
  { value: "boss", label: "王总 · 集团管理员" },
];
/** Where each viewer's picker opens (primary department / company / group) — never ticked. */
export const DEMO_FOCUS: Record<DemoViewer, string> = { wang: "hn-g1", chen: "hn-g1", liny: "hn", boss: "g" };

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
const deptOfRef = (ref: SubjectRef) => (ref.kind === "person" ? ORG_PEOPLE.find((p) => p.id === ref.id)?.deptIds[0] : ref.id);

/**
 * Scope per viewer (what quanxian would answer): other companies are hidden unless the viewer may grant
 * across the group; inside the company out-of-scope departments are grey with who to ask.
 */
export function demoAvailability(viewer: DemoViewer) {
  return (ref: SubjectRef): Availability | undefined => {
    if (viewer === "boss" || ref.kind === "role" || ref.kind === "line") return undefined;
    if (ref.kind === "group") return { state: "partial", reason: "整个集团只有集团管理员能选" };
    const dept = deptOfRef(ref);
    if (!dept) return undefined;
    if (companyOf(dept) !== "hn") return { state: "hidden" };
    if (viewer !== "chen") return undefined;
    const ids = chain(dept).map((u) => u.id);
    if (ids.includes("hn-g1")) return undefined;
    if (ref.id === "hn-sales" || ref.id === "hn") return { state: "partial", reason: "只能选里面你管得着的部门（一组）" };
    return { state: "locked", reason: "不在你的管理范围，找赵静怡开通" };
  };
}

/** Quick picks per viewer: 我 / 我的部门 / 上级 · 整个华南子公司 · 整个集团. */
export function demoShortcuts(viewer: DemoViewer) {
  const unitPick = (id: string): PickedSubject => {
    const u = byId.get(id) as OrgUnit;
    return { kind: u.kind, id: u.id, label: u.label, path: pathOf(u.parentId), includeSub: true, count: u.memberCount, ancestors: chain(u.parentId).map((x) => x.id) };
  };
  const me = (id: string, label: string, dept: string): PickedSubject => ({ kind: "person", id, label, path: pathOf(dept), ancestors: chain(dept).map((x) => x.id) });
  if (viewer === "wang") return [
    { key: "me", label: "我", subject: me("wang", "小王", "hn-g1") },
    { key: "dept", label: "我的部门", hint: "一组", subject: unitPick("hn-g1") },
    { key: "up", label: "上级", hint: "销售部", subject: unitPick("hn-sales") },
  ];
  if (viewer === "chen") return [{ key: "me", label: "我", subject: me("chen", "陈组长", "hn-g1") }, { key: "dept", label: "我的部门", hint: "一组", subject: unitPick("hn-g1") }];
  if (viewer === "liny") return [{ key: "co", label: "整个华南子公司", subject: unitPick("hn") }];
  return [{ key: "group", label: "整个集团", subject: unitPick("g") }, { key: "hq", label: "整个集团总部", subject: unitPick("hq") }];
}

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));
const descendants = (id: string): string[] => ORG_UNITS.filter((u) => u.parentId === id).flatMap((u) => [u.id, ...descendants(u.id)]);

/** The in-memory OrgDataSource (a real one calls the platform directory with the viewer's scope). */
export function createDemoOrgSource(): OrgDataSource {
  return {
    roots: () => wait(ORG_UNITS.filter((u) => !u.parentId)),
    loadChildren: (id) => wait(ORG_UNITS.filter((u) => u.parentId === id)),
    loadMembers: (id, { deep, cursor }) => {
      const ids = new Set(deep ? [id, ...descendants(id)] : [id]);
      const all = ORG_PEOPLE.filter((p) => p.deptIds.some((d) => ids.has(d)));
      const active = all.filter((p) => !p.status).sort((a, b) => Number(Boolean(b.badges?.includes("负责人"))) - Number(Boolean(a.badges?.includes("负责人"))));
      const from = cursor ? Number(cursor) : 0;
      const page = active.slice(from, from + 60);
      return wait({ items: page, nextCursor: from + 60 < active.length ? String(from + 60) : undefined, total: active.length, hiddenDeparted: all.length - active.length }, cursor ? 200 : 160);
    },
    search: (query, { limit }) => {
      const q = query.trim().toLowerCase();
      const hit = (text: string | undefined) => Boolean(text && text.toLowerCase().includes(q));
      const people: OrgSearchHit[] = ORG_PEOPLE.filter((p) => hit(p.label) || hit(p.py) || hit(p.title) || pathOf(p.deptIds[0] ?? null).some(hit)).map((p) => ({
        kind: "person",
        id: p.id,
        label: p.label,
        title: p.title,
        path: pathOf(p.deptIds[0] ?? null),
        ancestors: chain(p.deptIds[0] ?? null).map((u) => u.id),
        badges: p.badges,
        ...(p.status ? { status: p.status } : {}),
      }));
      const units: OrgSearchHit[] = ORG_UNITS.filter((u) => u.kind !== "group" && (hit(u.label) || pathOf(u.parentId).some(hit))).map((u) => ({ kind: u.kind, id: u.id, label: u.label, path: pathOf(u.parentId), ancestors: chain(u.parentId).map((x) => x.id), count: u.memberCount, includeSub: true }));
      const extra = [...ORG_ROLES, ...ORG_LINES].filter((s) => hit(s.label)).map((s) => ({ ...s }));
      return wait([...people, ...units, ...extra].slice(0, limit), 180);
    },
    resolve: (refs) =>
      wait(
        refs.map((r): PickedSubject => {
          const p = ORG_PEOPLE.find((x) => x.id === r.id);
          if (r.kind === "person" && p) return { kind: "person", id: p.id, label: p.label, path: pathOf(p.deptIds[0] ?? null), ancestors: chain(p.deptIds[0] ?? null).map((u) => u.id), ...(p.status ? { status: p.status } : {}) };
          const u = byId.get(r.id);
          if (u) return { kind: u.kind, id: u.id, label: u.label, path: pathOf(u.parentId), ancestors: chain(u.parentId).map((x) => x.id), count: u.memberCount };
          const s = [...ORG_ROLES, ...ORG_LINES].find((x) => x.id === r.id);
          return s ?? { kind: r.kind, id: r.id, label: r.id };
        }),
      ),
    pathOf: (id) => wait(chain(id), 60),
  };
}

/** Pluggable tabs: 角色 / 业务线 / 公司. */
export const DEMO_TABS: PickerSource[] = [
  { key: "roles", label: "角色", kind: "role", list: ({ query }) => wait(ORG_ROLES.filter((r) => !query || r.label.includes(query))) },
  { key: "lines", label: "业务线", kind: "line", list: ({ query }) => wait(ORG_LINES.filter((r) => !query || r.label.includes(query))) },
  {
    key: "companies",
    label: "公司",
    kind: "company",
    list: () => wait(ORG_UNITS.filter((u) => u.kind === "company").map((u) => ({ kind: "company", id: u.id, label: u.label, path: [], count: u.memberCount, includeSub: true, ancestors: ["g"] }))),
  },
];

/** People with the grant they already have (字段权限 · 认领时间), incl. the departed 李俊杰. */
export const DEMO_DEPARTED: PickedSubject = { kind: "person", id: "lijj", label: "李俊杰", status: "left", path: ["华南子公司", "销售部", "一组"] };
