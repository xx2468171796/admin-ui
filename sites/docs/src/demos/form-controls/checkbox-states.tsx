import { useState } from "react";
import { Checkbox } from "@adminui/react";

const PERMISSIONS = [
  { id: "view", label: "查看客户" },
  { id: "edit", label: "编辑客户" },
  { id: "export", label: "导出客户" },
  { id: "delete", label: "删除客户" },
] as const;
type Perm = (typeof PERMISSIONS)[number]["id"];

/** 勾选框 16px：选中 = 主色实底白勾，半选一横，禁用灰；文字是 label，点文字也能勾。 */
export function Demo() {
  const [picked, setPicked] = useState<Perm[]>(["view", "edit"]);
  const all = picked.length === PERMISSIONS.length ? true : picked.length === 0 ? false : "indeterminate";
  const toggle = (id: Perm, on: boolean) => setPicked((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  const row = { display: "flex", alignItems: "center", gap: 8 } as const;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={row}>
        <Checkbox checked={all} onCheckedChange={(v) => setPicked(v === true ? PERMISSIONS.map((p) => p.id) : [])} />
        <b>客户模块（全选）</b>
      </label>
      <div role="group" aria-label="客户模块权限" style={{ display: "grid", gap: 10, paddingLeft: 24 }}>
        {PERMISSIONS.map((p) => (
          <label key={p.id} style={row}>
            <Checkbox checked={picked.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
            {p.label}
          </label>
        ))}
      </div>
      <label style={row}>
        <Checkbox checked disabled />
        <span>登录后台（所有成员默认有，不能取消）</span>
      </label>
      <label style={row}>
        <Checkbox aria-invalid="true" />
        <span>我已阅读并同意数据处理协议（必选）</span>
      </label>
    </div>
  );
}
