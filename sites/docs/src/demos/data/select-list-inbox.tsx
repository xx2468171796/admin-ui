import { useState } from "react";
import { SelectList, Switch, type SelectListItem } from "@adminui/react";

const CHATS: SelectListItem[] = [
  { key: "c1", title: "远航精密制造 · 林经理", avatar: "林", hint: "合同扫描件已经发到邮箱了", meta: "10:42", unreadCount: 3, group: "今天" },
  { key: "c2", title: "青禾教育 · 周老师", avatar: "周", hint: "下周二可以安排培训吗？", meta: "09:15", unread: true, group: "今天" },
  { key: "c3", title: "星河物流 · 赵总", avatar: "赵", hint: "好的，谢谢", meta: "08:03", group: "今天" },
  { key: "c4", title: "云杉医疗 · 王主任", avatar: "王", hint: "发票抬头需要改一下", meta: "昨天", unreadCount: 128, group: "更早" },
  { key: "c5", title: "启明零售 · 陈店长", avatar: "陈", hint: "收到报价，内部再讨论", meta: "周一", group: "更早" },
];

/** 两行版：头像 + 名字 / 最后一条消息 + 时间；未读 = 加粗 + 数量徽标（超过 99 写 99+）。打开「加载中」看骨架行。 */
export function Demo() {
  const [selected, setSelected] = useState<string | null>("c1");
  const [loading, setLoading] = useState(false);
  const items = CHATS.map((c) => (c.key === selected ? { ...c, unread: false, unreadCount: 0 } : c));
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch size="sm" checked={loading} onCheckedChange={setLoading} />加载中</label>
      <SelectList label="会话" items={items} selected={selected} onSelect={setSelected} search="搜索客户或消息" loading={loading} emptyLabel="还没有会话" />
    </div>
  );
}
