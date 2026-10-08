import { useState } from "react";
import { GalleryView } from "@adminui/react/views";
import { DEAL_SLOTS, TODAY, TIME_ZONE, initialDeals } from "../../data/views-data";

const deals = initialDeals();

/** 表里没有图片字段时默认不显示封面；筛选没有结果时写出当前筛选并给「清空筛选」。 */
export function Demo() {
  const [filtered, setFiltered] = useState(true);
  return (
    <GalleryView
      label="客户卡片"
      records={filtered ? [] : deals.slice(0, 6)}
      recordId={(r) => r.id}
      cardTitle={(r) => r.name}
      cardSlots={DEAL_SLOTS}
      coverFields={[]}
      today={TODAY}
      timeZone={TIME_ZONE}
      filterText={filtered ? "阶段 = 赢单 · 城市 = 拉萨" : undefined}
      onClearFilters={() => setFiltered(false)}
    />
  );
}
