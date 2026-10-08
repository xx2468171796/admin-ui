import { useState } from "react";
import { Bell, Copy, LayoutGrid, List, Pencil, Star, Trash2 } from "lucide-react";
import { Button, ButtonGroup, IconButton, MoreMenu } from "@adminui/react";

/** 只有图标时用 IconButton（label 必填 = 读屏名称 + 提示气泡）；视图切换用 ButtonGroup；低频操作进「⋯」。 */
export function Demo() {
  const [starred, setStarred] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <IconButton label="编辑" icon={<Pencil />} />
        <IconButton label="复制链接" icon={<Copy />} shortcut="Mod+C" />
        <IconButton label={starred ? "取消关注" : "关注"} icon={<Star />} pressed={starred} onClick={() => setStarred((v) => !v)} />
        <IconButton label="通知" icon={<Bell />} badge={3} />
        <IconButton label="删除" icon={<Trash2 />} variant="danger" />
      </div>
      <ButtonGroup label="视图">
        <Button variant="outline" size="sm" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" />列表</Button>
        <Button variant="outline" size="sm" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid aria-hidden="true" />卡片</Button>
      </ButtonGroup>
      <MoreMenu
        sections={[
          { items: [{ key: "settings", label: "表设置", onSelect: () => undefined }, { key: "log", label: "操作记录", onSelect: () => undefined }] },
        ]}
      />
    </div>
  );
}
