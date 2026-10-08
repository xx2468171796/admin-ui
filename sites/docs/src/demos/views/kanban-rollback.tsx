import { useMemo, useState } from "react";
import { Switch } from "@adminui/react";
import { KanbanBoard } from "@adminui/react/views";
import { AMOUNT_FIELD, BOARD_SLOTS, STAGE_FIELD, TODAY, TIME_ZONE, initialDeals, type Deal } from "../../data/views-data";

/**
 * 先显示后保存：onMove 返回的 Promise reject 时卡片放回原处，读屏播报原因。
 * 打开「模拟保存失败」后拖一张卡片试试；成功时底部出「阶段：线索 → 方案报价 · 撤销」。
 */
export function Demo() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [fail, setFail] = useState(true);
  const records = useMemo(() => deals.filter((d) => d.stage !== "lost"), [deals]);

  const move = (id: string, to: string | null) =>
    new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (fail) return reject(new Error("没有权限修改这条商机"));
        setDeals((list) => list.map((d) => (d.id === id && to ? { ...d, stage: to as Deal["stage"] } : d)));
        resolve();
      }, 600);
    });

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 8, height: 500 }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Switch checked={fail} onCheckedChange={setFail} aria-label="模拟保存失败" />
        模拟保存失败
      </label>
      <KanbanBoard
        label="商机阶段看板"
        records={records}
        recordId={(r) => r.id}
        groupField={STAGE_FIELD}
        cardTitle={(r) => r.name}
        cardSlots={BOARD_SLOTS}
        sumField={AMOUNT_FIELD}
        today={TODAY}
        timeZone={TIME_ZONE}
        onMove={move}
      />
    </div>
  );
}
