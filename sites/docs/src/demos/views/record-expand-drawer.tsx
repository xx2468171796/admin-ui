import { useMemo, useState } from "react";
import { RecordDetailDialog, useNotify, type RecordFrame, type RecordLayout } from "@adminui/react";
import { KanbanBoard } from "@adminui/react/views";
import { BOARD_SLOTS, STAGE_FIELD, TODAY, TIME_ZONE, formatAmount, initialDeals, stageLabel, stageTone, type Deal } from "../../data/views-data";

const LAYOUT: RecordLayout<Deal> = {
  title: (r) => r.name,
  badges: (r) => [{ label: stageLabel(r.stage), tone: stageTone(r.stage) }],
  meta: (r) => [{ person: r.ownerName, suffix: "负责" }, r.city, r.industry],
  highlights: (r) => [
    { key: "amount", label: "预计金额", value: formatAmount(r.amount) },
    { key: "seats", label: "席位数", value: r.seats },
  ],
  sections: [
    {
      key: "basic",
      title: "客户资料",
      fields: [
        { key: "id", label: "客户编号", value: (r) => r.id, copy: true },
        { key: "next", label: "下次跟进", value: (r) => r.nextFollowUp },
        { key: "created", label: "建档日期", value: (r) => r.createdAt },
      ],
    },
  ],
};

/**
 * 从看板打开记录：默认右侧抽屉，不挡看板 —— 点别的卡片直接换人，打开的卡片高亮。
 * 标题栏 ↑ ↓ 上一条 / 下一条，右侧三档（抽屉 / 弹框 / 整页）随时切，Esc 关。
 */
export function Demo() {
  const notify = useNotify();
  const records = useMemo(() => initialDeals().filter((d) => d.stage !== "lost"), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [frame, setFrame] = useState<Exclude<RecordFrame, "page">>("drawer");
  const index = openId ? records.findIndex((r) => r.id === openId) : -1;
  const row = index >= 0 ? records[index] : undefined;

  return (
    <div style={{ height: 500 }}>
      <KanbanBoard
        label="商机阶段看板"
        records={records}
        recordId={(r) => r.id}
        groupField={STAGE_FIELD}
        cardTitle={(r) => r.name}
        cardSlots={BOARD_SLOTS}
        density="compact"
        today={TODAY}
        timeZone={TIME_ZONE}
        selectedId={openId}
        onOpen={(r) => setOpenId(r.id)}
      />
      <RecordDetailDialog<Deal>
        layout={LAYOUT}
        row={row}
        level="expanded"
        frame={frame}
        onFrameChange={(next) => (next === "page" ? notify("整页：跳到记录自己的地址", "info") : setFrame(next))}
        nav={row ? { index, total: records.length, label: "阶段看板", onMove: (d) => setOpenId(records[index + d]?.id ?? openId) } : undefined}
        onCopyLink={() => notify("已复制链接", "success")}
        onClose={() => setOpenId(null)}
        recordKey={row?.id}
      />
    </div>
  );
}
