import { SodRulesPage, createGovernanceApi, type GovOption, type SodRuleDto, type SodRuleInput, type SodViolationDto } from "@adminui/react/access";

// 大档治理页之一：职责分离（同一个人不能既「发起付款」又「审批付款」）。治理页自己加载和保存，
// 只收一个 api。这里给 createGovernanceApi 传一个内存里的假 fetch；真实项目用默认的同源接口，鉴权和审计在服务端。

const CODES: GovOption[] = [
  { id: "pay:create", label: "发起付款" }, { id: "pay:approve", label: "审批付款" },
  { id: "deal:discount", label: "给折扣" }, { id: "deal:approve", label: "审批报价" },
  { id: "audit:read", label: "查看审计日志" }, { id: "audit:purge", label: "清理审计日志" },
];
let rules: SodRuleDto[] = [
  { id: "s1", tenantId: "northstar", a: "pay:create", b: "pay:approve", mode: "block", label: "付款：发起和审批分开", enabled: true, builtin: false, version: 1 },
  { id: "s2", tenantId: "northstar", a: "deal:discount", b: "deal:approve", mode: "approve", label: "报价：给折扣的人不审自己的报价", enabled: true, builtin: false, version: 1 },
  { id: "s3", tenantId: null, a: "audit:read", b: "audit:purge", mode: "block", label: "审计日志不能自查自清", enabled: true, builtin: true, version: 1 },
];
const VIOLATIONS: SodViolationDto[] = [
  { userId: "u07", name: "孙雨桐", rule: { id: "s1", a: "pay:create", b: "pay:approve", mode: "block", label: "付款：发起和审批分开" } },
];

const json = (body: unknown, status = 200) => new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** 假服务端：只实现这一页用到的路由。 */
async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  await new Promise((r) => setTimeout(r, 300));
  const path = String(input).replace("/demo/qx", "");
  const method = init?.method ?? "GET";
  const body = init?.body ? (JSON.parse(String(init.body)) as SodRuleInput) : null;
  if (path === "/rules/sod/violations") return json(VIOLATIONS);
  if (path === "/rules/sod" && method === "GET") return json(rules);
  if (path === "/rules/sod" && method === "POST" && body) {
    const rule: SodRuleDto = { ...body, id: `s${Date.now()}`, tenantId: "northstar", enabled: body.enabled ?? true, builtin: false, version: 1 };
    rules = [...rules, rule];
    return json(rule);
  }
  const id = decodeURIComponent(path.split("/").pop() ?? "");
  const old = rules.find((r) => r.id === id);
  if (!old) return json({ code: "NOT_FOUND", message: "这条规则已经不在了" }, 404);
  if (method === "DELETE") { rules = rules.filter((r) => r.id !== id); return json(undefined); }
  if (method === "PATCH" && body) {
    if (body.version !== undefined && body.version !== old.version) return json({ code: "VERSION_CONFLICT", message: "别人刚改过这条规则，请刷新后再改" }, 409);
    const next: SodRuleDto = { ...old, ...body, enabled: body.enabled ?? old.enabled, version: old.version + 1 };
    rules = rules.map((r) => (r.id === id ? next : r));
    return json(next);
  }
  return json({ code: "NOT_FOUND", message: "演示里没有这个接口" }, 404);
}

const api = createGovernanceApi({ baseUrl: "/demo/qx", fetch: fakeFetch });

export function Demo() {
  return <SodRulesPage api={api} codes={CODES} can={{ manage: true }} />;
}
