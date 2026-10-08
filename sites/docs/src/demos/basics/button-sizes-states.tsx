import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@adminui/react";

/** 4 档尺寸（40 / 36 / 28 / 24）与加载、禁用原因。 */
export function Demo() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 1500);
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Button size="lg">大号 40</Button>
        <Button>标准 36</Button>
        <Button size="sm" variant="outline">小号 28</Button>
        <Button size="xs" variant="outline">迷你 24</Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Button loading={saving} loadingText="保存中…" onClick={save}><Save aria-hidden="true" />保存</Button>
        <Button variant="outline" disabled disabledReason="合同已归档，不能再改">编辑合同</Button>
        <Button variant="outline" tooltip="刷新列表" shortcut="Mod+R">刷新</Button>
      </div>
    </div>
  );
}
