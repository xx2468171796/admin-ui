import { useMemo, useState } from "react";
import { useNotify } from "@adminui/react";
import { KanbanBoard, type KanbanColumnState } from "@adminui/react/views";
import { BOARD_SLOTS, STAGE_FIELD, TODAY, TIME_ZONE, initialDeals, type Deal } from "../../data/views-data";

const extra = (page: number): Deal[] =>
  initialDeals().slice(0, 3).map((d, i) => ({ ...d, id: `L${page}${i}`, name: `${d.name}（第 ${page + 1} 页）`, stage: "lead" }));

/**
 * 服务端分页：列头的条数和合计来自 columnMeta（整列），不是已加载的卡片；
 * 滚到底自动 onLoadMore，加载用骨架卡。列 ⋯ 可以收起、隐藏、换颜色，columnState 受控保存。
 */
export function Demo() {
  const notify = useNotify();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<KanbanColumnState>({ collapsed: ["lost"] });
  const records = useMemo(() => deals, [deals]);

  const loadMore = (value: string | null) => {
    if (value !== "lead" || loading) return;
    setLoading(true);
    setTimeout(() => {
      setDeals((list) => [...list, ...extra(page + 1)]);
      setPage((p) => p + 1);
      setLoading(false);
    }, 800);
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
        density="compact"
        today={TODAY}
        timeZone={TIME_ZONE}
        columnMeta={{ lead: { total: 128, hasMore: page < 3, loading, summary: "¥1,286 万" } }}
        onLoadMore={loadMore}
        columnState={columns}
        onColumnStateChange={setColumns}
        onAdd={(value) => notify(`在「${value ?? "未设置"}」列新建商机`, "info")}
        onOpen={(r) => notify(`打开「${r.name}」`, "info")}
        onMove={() => undefined}
      />
    </div>
  );
}
