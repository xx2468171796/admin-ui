import { ConditionSummary, describeConditionTree, type ConditionFieldDef, type ConditionGroup } from "@adminui/react";
import { STAGES } from "../../data/demo-data";

const FIELDS: ConditionFieldDef[] = [
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES.map((s) => ({ value: s.value, label: s.label, tone: s.tone })) },
  { key: "source", title: "来源", type: "singleSelect", options: [{ value: "web", label: "官网表单", tone: "blue" }, { value: "ref", label: "转介绍", tone: "green" }, { value: "expo", label: "展会", tone: "orange" }] },
  { key: "amount", title: "预计金额", type: "money", currency: "¥" },
  { key: "city", title: "城市", type: "text" },
];

const RULES: { name: string; tree: ConditionGroup<string> }[] = [
  {
    name: "高质量官网线索",
    tree: { id: "r1", conjunction: "and", items: [{ id: "a", field: "source", op: "anyOf", value: ["web", "ref"] }, { id: "b", field: "amount", op: "gte", value: 100000 }] },
  },
  {
    name: "华东谈判中",
    tree: {
      id: "r2",
      conjunction: "and",
      items: [
        { id: "a", field: "stage", op: "anyOf", value: ["negotiation"] },
        { id: "g", conjunction: "or", items: [{ id: "b", field: "city", op: "is", value: "上海" }, { id: "c", field: "city", op: "is", value: "杭州" }] },
      ],
    },
  },
  { name: "全部客户", tree: { id: "r3", conjunction: "and", items: [] } },
];

/** 规则列表、卡片里只读显示条件：ConditionSummary 画成带颜色的标签；describeConditionTree 给一句纯文字（通知、日志、读屏）。 */
export function Demo() {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
      {RULES.map((rule) => (
        <li key={rule.name} style={{ display: "grid", gap: 4 }}>
          <b style={{ fontWeight: 500 }}>{rule.name}</b>
          <ConditionSummary tree={rule.tree} fields={FIELDS} />
          <small className="aui-text-note">纯文字：{describeConditionTree(rule.tree, FIELDS)}</small>
        </li>
      ))}
    </ul>
  );
}
