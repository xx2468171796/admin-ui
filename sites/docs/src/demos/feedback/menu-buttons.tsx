import { Copy, Download, FileText, Pencil, Plus, Settings2, Trash2, UserRoundPlus } from "lucide-react";
import { MenuButton, MoreMenu, useNotify, type MenuSection } from "@adminui/react";

/** 菜单项是数据：sections → items。快捷键写短（Mod 自动显示 ⌘ / Ctrl），危险项在最后一组，灰掉的写原因。 */
export function Demo() {
  const notify = useNotify();
  const pick = (label: string) => () => notify(label, "info");
  const create: MenuSection[] = [
    {
      items: [
        { key: "record", label: "新建客户", icon: <Plus />, shortcut: "N", onSelect: pick("新建客户") },
        { key: "import", label: "从 Excel 导入", icon: <Download />, onSelect: pick("从 Excel 导入") },
        { key: "form", label: "新建表单", icon: <FileText />, onSelect: pick("新建表单") },
      ],
    },
  ];
  const more: MenuSection[] = [
    {
      items: [
        { key: "settings", label: "表设置", icon: <Settings2 />, onSelect: pick("表设置") },
        { key: "dup", label: "复制视图", icon: <Copy />, shortcut: "Mod+D", onSelect: pick("复制视图") },
        { key: "export", label: "导出", icon: <Download />, disabled: true, disabledReason: "管理员关掉了导出" },
      ],
    },
    { items: [{ key: "delete", label: "删除视图", icon: <Trash2 />, danger: true, onSelect: pick("删除视图") }] },
  ];
  const selected: MenuSection[] = [
    { items: [{ key: "assign", label: "转交 {count} 位", count: 3, icon: <UserRoundPlus />, onSelect: pick("转交 3 位") }, { key: "edit", label: "批量修改", icon: <Pencil />, onSelect: pick("批量修改") }] },
    { items: [{ key: "del", label: "删除 {count} 条记录", count: 3, icon: <Trash2 />, danger: true, onSelect: pick("删除 3 条记录") }] },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <MenuButton variant="default" label="新建" sections={create}>
        <Plus aria-hidden="true" />
        新建
      </MenuButton>
      <MenuButton variant="outline" label="批量操作" header={<><b>已选 3 条</b>：远航精密制造、青禾教育…</>} sections={selected}>
        批量操作
      </MenuButton>
      <MoreMenu label="视图更多" sections={more} />
    </div>
  );
}
