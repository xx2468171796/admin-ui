import { useState } from "react";
import { CheckableTree, type TreeNode } from "@adminui/react/access";

const MENUS: TreeNode[] = [
  { id: "customer", label: "客户", hint: "customer", children: [
    { id: "customer.view", label: "查看客户", hint: "customer:view" },
    { id: "customer.edit", label: "编辑客户", hint: "customer:edit" },
    { id: "customer.transfer", label: "转交客户", hint: "customer:transfer" },
    { id: "customer.export", label: "导出客户", hint: "customer:export" },
  ] },
  { id: "contract", label: "合同", hint: "contract", children: [
    { id: "contract.view", label: "查看合同", hint: "contract:view" },
    { id: "contract.approve", label: "审批合同", hint: "contract:approve", children: [
      { id: "contract.approve.small", label: "10 万以下", hint: "contract:approve:s" },
      { id: "contract.approve.large", label: "10 万及以上", hint: "contract:approve:l" },
    ] },
  ] },
  { id: "settings", label: "系统设置", hint: "settings", children: [
    { id: "settings.members", label: "成员管理", hint: "settings:members" },
    { id: "settings.audit", label: "审计日志", hint: "settings:audit", disabled: true },
  ] },
];

/** 勾选树：父节点三态（部分选中 = 「−」）、编码等宽备注色、层级引导线；搜索时自动展开命中的分支并高亮；「只看已选」。 */
export function Demo() {
  const [value, setValue] = useState<string[]>(["customer.view", "customer.edit", "contract.view"]);
  return (
    <div style={{ maxWidth: 480 }}>
      <CheckableTree label="菜单权限" nodes={MENUS} value={value} onValueChange={(next) => setValue(next)} maxHeight={320} />
    </div>
  );
}
