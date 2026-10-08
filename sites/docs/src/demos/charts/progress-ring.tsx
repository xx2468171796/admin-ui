import { useState } from "react";
import { Phone } from "lucide-react";
import { Button, Panel, ProgressRing } from "@adminui/react";

/** 进度环只给「一个人在手机上看自己今天的进度」：点「记一次回访」，环会走；到 12 位变成完成。 */
export function Demo() {
  const [done, setDone] = useState(7);
  const total = 12;
  return (
    <div style={{ maxWidth: 390, display: "grid", gap: 12 }}>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressRing value={done} max={total} target={total * 0.8} label="今天已回访的客户" />
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <b>今天已回访</b>
            <span className="aui-note">今天到期 {total} 家，还差 {total - done} 家</span>
            <span className="aui-note">目标 80%：{done >= total * 0.8 ? "已达到" : `再回访 ${Math.ceil(total * 0.8 - done)} 家就到`}</span>
          </div>
        </div>
      </Panel>
      <Button size="lg" disabledReason={done >= total ? "今天的回访都做完了" : undefined} disabled={done >= total} onClick={() => setDone((n) => Math.min(total, n + 1))}>
        <Phone aria-hidden="true" />记一次回访
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDone(7)}>重来</Button>
    </div>
  );
}
