import { useState } from "react";
import {
  Choice,
  FormField,
  PageBody,
  PageHeader,
  Panel,
  RuleList,
  SegmentedControl,
  Tag,
  useNotify,
  type RuleItem,
} from "@adminui/react";
import type { GridField } from "@adminui/react/grid";

// 分配规则示例（样稿 D26 的通用部分）：从上往下匹配、命中第一条就停的「如果 … → …」规则，拖手柄或键盘调顺序，
// 每条有命中数和开关，最后一条是固定的兜底。本页用 T08 的单卡（Panel + 列表）。销售池、权重、轮流分是业务，
// 由宿主在 renderAction / renderActionEditor 里画；规则保存和执行都在服务端。

type Customer = { quality: string; source: string; region: string; owner: string };
const FIELDS: GridField<Customer>[] = [
  { key: "quality", title: "客户质量", type: "singleSelect", options: [{ value: "high", label: "高", tone: "greenSolid" }, { value: "mid", label: "中", tone: "yellow" }, { value: "low", label: "低" }] },
  { key: "source", title: "来源", type: "singleSelect", options: [{ value: "web", label: "官网表单", tone: "blue" }, { value: "ref", label: "转介绍", tone: "yellow" }, { value: "fair", label: "展会" }, { value: "ad", label: "广告" }] },
  { key: "region", title: "地区", type: "singleSelect", options: [{ value: "tpe", label: "上海" }, { value: "ntpc", label: "杭州" }, { value: "khh", label: "广州" }] },
  { key: "owner", title: "负责人", type: "user" },
];
const POOLS = [
  { value: "elite", label: "精英销售池" },
  { value: "normal", label: "普通销售池" },
  { value: "rookie", label: "新手销售池" },
  { value: "meihua", label: "美华（指定人）" },
];
const METHODS = [
  { value: "round", label: "轮流分" },
  { value: "claim", label: "放进池子让人领" },
  { value: "least", label: "手上少的先分" },
  { value: "person", label: "指定人" },
];
const METHOD_NOTE: Record<string, string> = { round: "轮流分（按权重）", claim: "放进池子让人领（15 分钟没人领 → 轮流分）", least: "手上少的先分", person: "指定人" };

type AssignRule = RuleItem & { pool: string; method: string };
const RULES: AssignRule[] = [
  { id: "r1", enabled: true, hits: 46, pool: "elite", method: "round", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "quality", op: "anyOf", value: ["high"] }, { id: "f2", field: "source", op: "anyOf", value: ["web", "ref"] }] } },
  { id: "r2", enabled: true, hits: 88, pool: "normal", method: "claim", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "quality", op: "anyOf", value: ["mid"] }] } },
  { id: "r3", enabled: true, hits: 2, pool: "meihua", method: "person", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "source", op: "anyOf", value: ["fair"] }, { id: "f2", field: "region", op: "anyOf", value: ["khh"] }] } },
  { id: "r4", enabled: true, hits: 71, pool: "rookie", method: "least", condition: { id: "root", conjunction: "or", items: [{ id: "f1", field: "quality", op: "anyOf", value: ["low"] }, { id: "f2", field: "quality", op: "empty" }] } },
];
const poolName = (value: string) => POOLS.find((p) => p.value === value)?.label ?? value;

export function RulesShowcase() {
  const notify = useNotify();
  const [rules, setRules] = useState(RULES);
  return (
    <>
      <PageHeader title="分配规则" description="新进线客户按这些规则自动分配。样稿 D26 的通用部分：IF / THEN 规则列表、拖动排序、命中数、开关、兜底。" />
      <PageBody>
        <Panel title="分配规则" count={`${rules.length} 条`} description="从上往下匹配，命中第一条就停；拖手柄（或聚焦手柄后 Alt + ↑ / ↓）调整顺序。停用的规则跳过。">
          <RuleList
            rules={rules}
            onChange={(next) => {
              setRules(next);
              notify("规则顺序和开关已保存，只影响之后进来的客户", "success");
            }}
            fields={FIELDS}
            renderAction={(rule) => (
              <>
                {poolName(rule.pool)}
                <Tag variant="plain">{METHOD_NOTE[rule.method] ?? rule.method}</Tag>
              </>
            )}
            fallback={{ label: "都不匹配 / 池子里没人可分", action: <>留在客户池 <Tag variant="plain">通知 林经理</Tag></>, hits: 7, onEdit: () => notify("打开兜底设置：通知谁", "info") }}
            newRule={() => ({ id: `r${Date.now()}`, enabled: true, pool: "normal", method: "round", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "quality", op: "anyOf" }] } })}
            onSave={async (rule, { isNew }) => {
              await new Promise((r) => setTimeout(r, 300));
              setRules((list) => (isNew ? [...list, rule] : list.map((r) => (r.id === rule.id ? rule : r))));
              notify(isNew ? "已添加规则" : "规则已保存，只影响之后进来的客户", "success");
            }}
            onDelete={async () => {
              await new Promise((r) => setTimeout(r, 200));
            }}
            renderActionEditor={({ draft, setDraft }) => (
              // 一栏：「分法」四个选项一行放得下，不在半宽里折成两行
              <div style={{ display: "grid", gap: 16 }}>
                <FormField label="分给" htmlFor="rule-pool">
                  <Choice label="分给" value={draft.pool} options={POOLS} onChange={(pool) => setDraft({ ...draft, pool })} />
                </FormField>
                <FormField label="分法" htmlFor="rule-method">
                  <SegmentedControl label="分法" value={draft.method} options={METHODS} onValueChange={(method) => setDraft({ ...draft, method })} />
                </FormField>
              </div>
            )}
            editorNote="保存后立即生效，只影响之后进来的客户"
          />
        </Panel>
      </PageBody>
    </>
  );
}
