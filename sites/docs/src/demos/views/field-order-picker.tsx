import { useState } from "react";
import { FieldOrderPicker } from "@adminui/react/views";
import { DEAL_FIELDS, dealField } from "../../data/views-data";

/** 字段列表：拖柄 + 类型图标 + 名字 + 眼睛；主字段锁在第一个。Alt + ↑ / ↓ 用键盘排序。 */
export function Demo() {
  const [shown, setShown] = useState<string[]>(["stage", "amount", "ownerName", "nextFollowUp"]);
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 380 }}>
      <FieldOrderPicker fields={DEAL_FIELDS} value={shown} onChange={setShown} label="卡片上的字段" />
      <p className="aui-note" style={{ margin: 0 }}>显示：{["客户名称", ...shown.map((k) => dealField(k).title)].join(" · ")}</p>
    </div>
  );
}
