import { useState } from "react";
import { DataScopeSelect, type DataScope } from "@adminui/react/access";
import { ORG_TREE, SCOPE_LABELS } from "../../data/business-data";

// 「能看到的数据」下拉：五档范围；给了部门树就多一项「指定部门…」（打开部门树对话框）。
// 授不出的档用 disabledTiers 写原因，改过没保存的用 changed 标出来。

export function Demo() {
  const [crm, setCrm] = useState<DataScope | null>({ tier: "dept_tree" });
  const [org, setOrg] = useState<DataScope | null>({ tier: "dept" });
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <span className="aui-note">客户管理 · 能看到的商机</span>
        <DataScopeSelect label="客户管理 能看到的数据" value={crm} onChange={setCrm} orgTree={ORG_TREE} labels={SCOPE_LABELS}
          subject="销售主管 · 客户管理" changed={crm?.tier !== "dept_tree"} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <span className="aui-note">组织管理 · 能看到的成员（不给部门树）</span>
        <DataScopeSelect label="组织管理 能看到的数据" value={org} onChange={setOrg} labels={SCOPE_LABELS}
          disabledTiers={{ all: "你自己只能看本部门及下级，不能授出「全部」" }} />
      </div>
    </div>
  );
}
