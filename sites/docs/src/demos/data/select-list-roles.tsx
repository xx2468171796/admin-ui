import { useState } from "react";
import { Plus, Shield, ShieldCheck, Users } from "lucide-react";
import { DescriptionList, IconButton, Panel, SelectList, useNotify, type SelectListItem } from "@adminui/react";

const ROLES: SelectListItem[] = [
  { key: "admin", title: "系统管理员", icon: <ShieldCheck />, meta: "全部权限", group: "内置角色" },
  { key: "auditor", title: "审计员", icon: <Shield />, meta: "只读", group: "内置角色" },
  { key: "sales", title: "销售", icon: <Users />, meta: "12 人", group: "自定义角色" },
  { key: "sales-lead", title: "销售主管", icon: <Users />, meta: "3 人", group: "自定义角色" },
  { key: "cs", title: "客户成功", icon: <Users />, meta: "5 人", group: "自定义角色" },
  { key: "finance", title: "财务", icon: <Users />, meta: "2 人", group: "自定义角色" },
];

/** 列表 + 详情：左栏搜索、分组标题带数量、选中 = 浅底加粗；搜不到时给「新建这个角色」。手机上列表整屏显示。 */
export function Demo() {
  const notify = useNotify();
  const [selected, setSelected] = useState<string | null>("sales");
  const role = ROLES.find((r) => r.key === selected);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "0 1 260px", minWidth: 220 }}>
        <SelectList
          label="角色"
          items={ROLES}
          selected={selected}
          onSelect={setSelected}
          search="搜索角色"
          toolbar={<IconButton label="新建角色" icon={<Plus />} size="sm" onClick={() => notify("新建角色", "info")} />}
          onCreate={(q) => notify(`新建角色「${q}」`, "success")}
          createLabel="新建这个角色"
        />
      </div>
      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
        <Panel title={typeof role?.title === "string" ? role.title : "选择一个角色"}>
          <DescriptionList columns={1} items={[
            { label: "成员", value: role?.meta },
            { label: "分组", value: role?.group },
            { label: "说明", value: null, hint: "还没有填写说明" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
