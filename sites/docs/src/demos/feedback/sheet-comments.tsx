import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button, SideSheet, Textarea } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

/** 评论 / 附件类：modal={false} 不带遮罩，打开后左边的列表还能点、能滚。 */
export function Demo() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ul style={{ display: "grid", gap: 4, margin: 0, padding: 0, listStyle: "none", maxWidth: 360 }}>
        {CUSTOMERS.slice(0, 5).map((c) => (
          <li key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{c.name}</span>
            <Button size="sm" variant="ghost" aria-pressed={open === c.name} onClick={() => setOpen(c.name)}>
              <MessageSquare aria-hidden="true" />
              评论
            </Button>
          </li>
        ))}
      </ul>
      <SideSheet open={open !== null} modal={false} title={`评论 · ${open ?? ""}`} onClose={() => setOpen(null)}>
        <p>陈一鸣：客户说下周三来看演示环境，记得准备报表模块。</p>
        <p>周可欣：好的，已经约了解决方案工程师吴昊。</p>
        <Textarea aria-label="写评论" placeholder="写评论，@ 提到同事" />
      </SideSheet>
    </>
  );
}
