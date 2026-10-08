import { useState } from "react";
import { SortableList, Switch } from "@adminui/react";

type FieldItem = { id: string; name: string; type: string; visible: boolean; locked?: boolean; children?: readonly FieldItem[] };

const START: FieldItem[] = [
  { id: "name", name: "客户名称", type: "文本", visible: true, locked: true },
  { id: "basic", name: "基本信息", type: "", visible: true, children: [
    { id: "stage", name: "阶段", type: "单选", visible: true },
    { id: "owner", name: "负责人", type: "人员", visible: true },
    { id: "industry", name: "行业", type: "单选", visible: false },
  ] },
  { id: "amount", name: "合同金额", type: "金额", visible: true },
  { id: "next", name: "下次跟进", type: "日期", visible: true },
  { id: "note", name: "备注", type: "长文本", visible: false },
];

/**
 * 字段顺序：拖手柄排序（悬停才出现，触屏常显）；键盘 Tab 到手柄，空格拿起、↑↓ 移动、空格放下、Esc 取消。
 * 主字段锁定在第一位；「基本信息」是可折叠的字段编组，字段可以拖进拖出。
 */
export function Demo() {
  const [items, setItems] = useState<FieldItem[]>(START);
  const toggle = (id: string, visible: boolean) => {
    const walk = (list: readonly FieldItem[]): FieldItem[] => list.map((f) => (f.id === id ? { ...f, visible } : f.children ? { ...f, children: walk(f.children) } : f));
    setItems(walk(items));
  };
  return (
    <div style={{ maxWidth: 360 }}>
      <SortableList
        label="字段顺序"
        items={items}
        onChange={(next) => setItems(next)}
        itemLabel={(f) => f.name}
        lockedHint="主字段固定在第一列"
        renderGroup={(g, { count }) => <span style={{ display: "flex", gap: 8 }}><b>{g.name}</b><small>{count} 个字段</small></span>}
        renderItem={(f) => (
          <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <span style={{ flex: 1, minWidth: 0 }}>{f.name}</span>
            <small>{f.type}</small>
            <Switch size="sm" checked={f.visible} disabled={f.locked} onCheckedChange={(v) => toggle(f.id, v)} aria-label={`在表格里显示「${f.name}」`} />
          </span>
        )}
      />
    </div>
  );
}
