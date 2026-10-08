import { useMemo, useState } from "react";
import { useNotify } from "@adminui/react";
import { GalleryView, type RecordCardDensity } from "@adminui/react/views";
import { DEAL_SLOTS, TODAY, TIME_ZONE, initialDeals } from "../../data/views-data";

const COVER_FIELDS = [{ value: "files", label: "现场照片" }];

/**
 * 顶部一行：条数 | 封面字段 | 紧凑 / 常规 | 字段名。点封面开大图，点卡片别处开记录。
 * 没图的记录封面是中性底 + 图标；滚到底自动加载下一页。
 */
export function Demo() {
  const notify = useNotify();
  const all = useMemo(() => initialDeals(), []);
  const [shown, setShown] = useState(12);
  const [loading, setLoading] = useState(false);
  const [coverField, setCoverField] = useState("files");
  const [density, setDensity] = useState<RecordCardDensity>("normal");
  const [labels, setLabels] = useState(false);
  const records = useMemo(() => all.slice(0, shown), [all, shown]);

  const loadMore = () => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setShown((n) => Math.min(n + 6, all.length));
      setLoading(false);
    }, 700);
  };

  return (
    <div style={{ height: 520, overflow: "auto" }}>
      <GalleryView
        label="客户现场照片"
        records={records}
        recordId={(r) => r.id}
        cardTitle={(r) => r.name}
        cardSlots={DEAL_SLOTS}
        cardAttachments={(r) => r.files}
        coverFields={COVER_FIELDS}
        coverField={coverField}
        onCoverFieldChange={setCoverField}
        density={density}
        onDensityChange={setDensity}
        showLabels={labels}
        onShowLabelsChange={setLabels}
        today={TODAY}
        timeZone={TIME_ZONE}
        total={all.length}
        hasMore={shown < all.length}
        loading={loading}
        onLoadMore={loadMore}
        onOpen={(r) => notify(`打开「${r.name}」`, "info")}
      />
    </div>
  );
}
