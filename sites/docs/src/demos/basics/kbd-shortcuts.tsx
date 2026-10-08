import { useState } from "react";
import { Keyboard } from "lucide-react";
import { Button, Kbd, ShortcutSheet } from "@adminui/react";

/** 键帽一个键一个框，只显示当前系统的写法（Windows「Ctrl K」、Mac「⌘ K」）；快捷键一览按「?」打开。 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const row = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" } as const;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={row}>
        <span>搜索与命令 <Kbd keys="Mod+K" /></span>
        <span>发送 <Kbd keys="Mod+Enter" /></span>
        <span>菜单里 <Kbd keys="Shift+Enter" size="sm" compact /></span>
        <span>输入框里 <Kbd keys="/" flat /></span>
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Keyboard aria-hidden="true" />快捷键一览
        </Button>
      </div>
      <ShortcutSheet
        open={open}
        onOpenChange={setOpen}
        groups={[
          { title: "表格", items: [{ keys: "Mod+K", label: "搜索与命令" }, { keys: "Mod+F", label: "在表格中查找" }, { keys: "Enter", label: "编辑单元格" }, { keys: "Space", label: "展开记录" }] },
          { title: "记录详情", items: [{ keys: "Mod+S", label: "保存" }, { keys: "Mod+Enter", label: "发送评论" }, { keys: "Esc", label: "关闭" }] },
        ]}
      />
    </div>
  );
}
