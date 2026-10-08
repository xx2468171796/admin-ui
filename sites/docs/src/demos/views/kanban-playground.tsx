import { useMemo, useState } from "react";
import { KanbanBoard, type RecordCardDensity } from "@adminui/react/views";
import { AMOUNT_FIELD, BOARD_SLOTS, STAGE_FIELD, TODAY, TIME_ZONE, dealFields, initialDeals, type Deal } from "../../data/views-data";

type Props = { density?: string; sumTotals?: boolean; showLabels?: boolean; cover?: boolean; lockWon?: boolean; failSave?: boolean; undo?: boolean };

/** 拖卡片换阶段；右侧开关改属性。「保存失败」模拟服务端拒绝：卡片会放回原处。 */
export function Demo({ density = "normal", sumTotals = true, showLabels = false, cover = false, lockWon = true, failSave = false, undo = true }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  // records 用 useMemo 保持引用：每次渲染新建数组会让刚拖过去的卡片闪回
  const records = useMemo(() => deals.filter((d) => d.stage !== "lost"), [deals]);

  const move = async (id: string, to: string | null, beforeId: string | null) => {
    await new Promise((r) => setTimeout(r, 400));
    if (failSave) throw new Error("保存失败：网络中断，已放回原处");
    setDeals((list) => {
      const moving = list.find((d) => d.id === id);
      if (!moving || !to) return list;
      const rest = list.filter((d) => d.id !== id);
      const at = beforeId ? rest.findIndex((d) => d.id === beforeId) : rest.length;
      rest.splice(at < 0 ? rest.length : at, 0, { ...moving, stage: to as Deal["stage"] });
      return rest;
    });
  };

  return (
    <div style={{ height: 500 }}>
      <KanbanBoard
        label="商机阶段看板"
        records={records}
        recordId={(r) => r.id}
        groupField={STAGE_FIELD}
        cardTitle={(r) => r.name}
        cardSlots={BOARD_SLOTS}
        cardFields={showLabels ? dealFields(["industry", "seats"]) : undefined}
        showLabels={showLabels}
        cardAttachments={cover ? (r) => r.files : undefined}
        density={density as RecordCardDensity}
        sumField={sumTotals ? AMOUNT_FIELD : undefined}
        canMove={lockWon ? (r) => r.stage !== "won" : undefined}
        lockReason={() => "赢单只有销售总监能改阶段"}
        undo={undo}
        today={TODAY}
        timeZone={TIME_ZONE}
        onMove={move}
      />
    </div>
  );
}
