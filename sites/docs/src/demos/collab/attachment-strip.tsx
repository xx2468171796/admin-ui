import { useState } from "react";
import { AttachmentGallery, useNotify, type MediaItem } from "@adminui/react";
import { demoImage } from "../../data/collab-data";

/**
 * 记录详情里的附件行（mode="strip"）：一行缩略图，超过 maxVisible 收成「+N」，末尾一个「＋」加文件。
 * 下面是空的时候：只有一个拖放区（onFiles），不会再多一个「还没有文件」的框。
 */
const ITEMS: MediaItem[] = [
  { id: "p1", name: "季度复盘-白板.png", url: demoImage(0), thumbUrl: demoImage(0) },
  { id: "p2", name: "活跃度趋势.png", url: demoImage(1), thumbUrl: demoImage(1) },
  { id: "p3", name: "客户办公室-前台.png", url: demoImage(2), thumbUrl: demoImage(2) },
  { id: "v1", name: "产品演示录屏.mp4", duration: 65 },
  { id: "f1", name: "实施方案.pdf", pages: 6 },
  { id: "f2", name: "续约报价.xlsx" },
  { id: "f3", name: "会议纪要.docx" },
  { id: "f4", name: "培训签到表.xlsx" },
];

export function Demo() {
  const notify = useNotify();
  const [empty, setEmpty] = useState<MediaItem[]>([]);
  return (
    <div className="aui-stack">
      <AttachmentGallery label="附件" mode="strip" items={ITEMS} maxVisible={5} onAdd={() => notify("打开文件选择", "info")} addHint="拖文件到这里上传" onDownload={() => undefined} />
      <AttachmentGallery
        label="合同扫描件"
        items={empty}
        toolbar={false}
        onFiles={(files) => setEmpty(Array.from(files).map((f, i) => ({ id: `n${i}`, name: f.name, size: f.size })))}
        empty="还没有合同扫描件"
        accept={["image/*", ".pdf"]}
        maxBytes={20 * 1024 * 1024}
      />
    </div>
  );
}
