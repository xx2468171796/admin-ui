import { Bell, Inbox } from "lucide-react";
import { Button, ICON_SIZES, StatePanel, iconStroke } from "@adminui/react";

/** 5 档尺寸，线宽随尺寸走（12–14 → 2，16–20 → 1.75，24 → 1.5）；图标颜色跟着字走，不单独上色。 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-end" }}>
        {ICON_SIZES.map((size) => (
          <div key={size} style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <Bell size={size} strokeWidth={iconStroke(size)} aria-hidden="true" />
            <span className="aui-text-note">{size} · {iconStroke(size)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Button variant="outline"><Bell aria-hidden="true" />关注</Button>
        <Button variant="ghost" size="sm"><Bell aria-hidden="true" />关注</Button>
      </div>
      <StatePanel kind="empty" size="compact" icon={<Inbox aria-hidden="true" />} title="还没有跟进记录" message="空状态：24px 图标放在中性浅底圆里，下面一句话 + 一个按钮。" action={<Button size="sm">写第一条跟进</Button>} />
    </div>
  );
}
