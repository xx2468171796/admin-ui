import { Copy, FileText, FolderInput, Star, Trash2 } from "lucide-react";
import { ContextMenu, useNotify, type MenuSection } from "@adminui/react";
import { CUSTOMERS, STAGES } from "../../data/demo-data";

/** 右键菜单：在指针处打开，贴边自动翻转；子菜单向右展开；勾选项用 checked。键盘可用 Shift+F10 打开。 */
export function Demo() {
  const notify = useNotify();
  const menuFor = (name: string): MenuSection[] => [
    {
      items: [
        { key: "copy", label: "复制", icon: <Copy />, shortcut: "Mod+C", onSelect: () => notify(`已复制「${name}」`) },
        { key: "open", label: "展开记录", icon: <FileText />, shortcut: "Shift+Enter", onSelect: () => notify(`打开「${name}」`, "info") },
        { key: "star", label: "关注", icon: <Star />, checked: true },
        {
          key: "move",
          label: "移到阶段",
          icon: <FolderInput />,
          items: [{ items: STAGES.map((s) => ({ key: s.value, label: s.label, onSelect: () => notify(`「${name}」已移到「${s.label}」`) })) }],
        },
      ],
    },
    { items: [{ key: "delete", label: `删除「${name}」`, icon: <Trash2 />, danger: true, shortcut: "Mod+Backspace", onSelect: () => notify(`已删除「${name}」`) }] },
  ];
  return (
    <ContextMenu label="客户菜单" sections={(target) => {
      const name = target.closest("[data-name]")?.getAttribute("data-name");
      return name ? menuFor(name) : null;
    }}>
      <ul style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none", maxWidth: 360 }}>
        <li className="aui-note">在客户名上点右键试试</li>
        {CUSTOMERS.slice(0, 5).map((c) => (
          <li key={c.id} data-name={c.name} tabIndex={0} style={{ padding: "6px 8px" }}>
            {c.name}
          </li>
        ))}
      </ul>
    </ContextMenu>
  );
}
