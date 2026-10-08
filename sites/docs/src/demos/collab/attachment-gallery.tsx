import { Captions } from "lucide-react";
import { AttachmentGallery, Button, useNotify, type MediaItem } from "@adminui/react";
import { demoImage, demoTone } from "../../data/collab-data";

/**
 * 一条记录的附件：网格 / 列表切换、悬停出勾选框、选中后顶上出选中条（下载）；点开走自带的整屏大图。
 * 有权限限制的给 lock（锁写在第二行灰字，不挤名字）；看不了的 denied：模糊、不能打开、不能勾选。
 */
export function Demo() {
  const notify = useNotify();
  const call = demoTone(23, 3);
  const items: MediaItem[] = [
    { id: "p1", name: "季度复盘-白板.png", size: 3.8 * 1024 ** 2, meta: "陈一鸣 10-07", cover: true, url: demoImage(0), thumbUrl: demoImage(0) },
    { id: "p2", name: "活跃度趋势.png", size: 2.1 * 1024 ** 2, meta: "周可欣 10-07", url: demoImage(1), thumbUrl: demoImage(1) },
    { id: "p3", name: "客户办公室-前台.png", size: 2.9 * 1024 ** 2, meta: "陈一鸣 10-05", url: demoImage(2), thumbUrl: demoImage(2) },
    { id: "v1", name: "产品演示录屏.mp4", size: 48.6 * 1024 ** 2, meta: "吴昊 09-27", duration: 65 },
    { id: "a1", name: "客户来电-10-07.wav", meta: "陈一鸣 · 通话录音", url: call.url, duration: 23, peaks: call.peaks },
    { id: "f1", name: "实施方案-第二版（含华南仓）.pdf", pages: 6, size: 2.3 * 1024 ** 2, meta: "吴昊 10-03" },
    { id: "f2", name: "续约报价.xlsx", size: 48 * 1024, meta: "林晓 10-04", lock: { label: "仅能看价格的人可见", hint: "这个附件带价格，只有能看「成交价」的人看得到" } },
    { id: "f3", name: "成本核算.xlsx", size: 96 * 1024, meta: "财务部 10-02", lock: { label: "仅财务可见", hint: "你没有「成本」字段的查看权限", denied: true } },
  ];
  return (
    <AttachmentGallery
      label="资料"
      items={items}
      selectable
      onDownload={(list) => notify(`开始下载：${list.map((i) => i.name).join("、")}`, "info")}
      onOpenInNewWindow={(i) => notify(`在新窗口打开：${i.name}`, "info")}
      audioAction={() => (
        <Button variant="outline" size="sm" disabled disabledReason="转文字还没开通">
          <Captions aria-hidden="true" />转文字
        </Button>
      )}
      sectionHints={{ visual: "点开整屏大图：缩放、拖动、旋转、左右切换" }}
      caption={(i) => <>远航精密制造 · 字段「资料」· {i.meta ?? "—"}</>}
    />
  );
}
