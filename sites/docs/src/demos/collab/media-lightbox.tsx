import { useState } from "react";
import { AttachmentGallery, MediaLightbox, MediaThumb, useNotify, type MediaItem } from "@adminui/react";
import { demoImage } from "../../data/collab-data";

/**
 * MediaThumb：看板卡片、列表行里的单个缩略图（宽度跟着容器，4:3；没有图时中性底 + 类型图标，视频叠播放圆）。
 * MediaLightbox：整屏沉浸的大图，上栏名字 + 第几个 + 下载 / 信息 / 关闭，底部浮动工具条，← → 切换、Esc 关闭。
 * 这里附件行用 onOpen 接管打开，自己控制大图（默认展开「信息」栏）。
 */
const ITEMS: MediaItem[] = [
  { id: "p1", name: "季度复盘-白板.png", size: 3.8 * 1024 ** 2, meta: "陈一鸣 10-07", url: demoImage(0), thumbUrl: demoImage(0) },
  { id: "p2", name: "活跃度趋势.png", size: 2.1 * 1024 ** 2, meta: "周可欣 10-07", url: demoImage(1), thumbUrl: demoImage(1) },
  { id: "p3", name: "客户办公室-前台.png", size: 2.9 * 1024 ** 2, meta: "陈一鸣 10-05", url: demoImage(2), thumbUrl: demoImage(2) },
  { id: "v1", name: "产品演示录屏.mp4", duration: 65, meta: "吴昊 09-27" },
  { id: "f1", name: "会议纪要.docx", size: 86 * 1024, meta: "周可欣 10-07" },
];

export function Demo() {
  const notify = useNotify();
  const [index, setIndex] = useState<number | null>(null);
  return (
    <div className="aui-stack">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        {ITEMS.map((item) => (
          <div key={item.id} style={{ width: 120 }}>
            <MediaThumb item={item} />
          </div>
        ))}
      </div>
      <AttachmentGallery label="附件" mode="strip" items={ITEMS} onOpen={(_item, i) => setIndex(i)} />
      <MediaLightbox
        open={index !== null}
        items={ITEMS}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        onDownload={(item) => notify(`开始下载：${item.name}`, "info")}
        caption={(item) => <>来自 远航精密制造 · {item.meta ?? "—"}</>}
        defaultInfoOpen
      />
    </div>
  );
}
