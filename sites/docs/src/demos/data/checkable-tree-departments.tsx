import { useState } from "react";
import { CheckableTree, type TreeNode } from "@adminui/react/access";
import { DEPARTMENTS, PEOPLE } from "../../data/demo-data";

// 部门表 → 树：右侧灰字是人数
const headcount = (id: string) => PEOPLE.filter((p) => p.dept === id || DEPARTMENTS.some((d) => d.id === p.dept && d.parent === id)).length;
const toNode = (id: string, label: string): TreeNode => {
  const children = DEPARTMENTS.filter((d) => d.parent === id).map((d) => toNode(d.id, d.name));
  return { id, label, hint: `${headcount(id)} 人`, children: children.length ? children : undefined };
};
const TREE: TreeNode[] = DEPARTMENTS.filter((d) => d.parent === null).map((d) => toNode(d.id, d.name));

/** 部门树（单选）：mode="single" 选一个节点，选中 = 浅底加粗；没有工具栏的精简版，适合放在成员列表左栏。 */
export function Demo() {
  const [value, setValue] = useState<string[]>(["d-sales-east"]);
  const picked = DEPARTMENTS.find((d) => d.id === value[0]);
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 300 }}>
      <CheckableTree label="部门" mode="single" nodes={TREE} value={value} onValueChange={(next) => setValue(next)} toolbar={false} defaultExpanded="all" />
      <small>当前部门：{picked?.name ?? "未选择"}</small>
    </div>
  );
}
