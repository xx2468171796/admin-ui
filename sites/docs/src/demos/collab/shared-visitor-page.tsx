import { useState } from "react";
import { Ban, Bell, Box, Coins, Download, Eye, FileText, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { Button, SharedMediaCard, SharedPageShell, SharedRecordCard, Tag, type MediaItem } from "@adminui/react";
import { demoImage, demoTone } from "../../data/collab-data";

/**
 * 访客打开的公开页（不在后台外壳里）：顶栏一行（品牌 · 谁分享给你 · 失效提示 · 唯一一个按钮）；
 * 记录卡里可改的字段白底线框、悬停出铅笔，改过写一行「你改过（原 …）」；资料卡和附件集同一套；整页淡水印。
 */
const brand = (
  <>
    <Box aria-hidden="true" />
    北辰云
  </>
);

export function Demo() {
  const [next, setNext] = useState("2026-10-14");
  const [note, setNote] = useState("周四 14:00 季度复盘，请带上华南两个仓的使用数据。");
  const tone = demoTone(36, 5);
  const media: MediaItem[] = [
    { id: "p1", name: "季度复盘-白板.png", size: 2.1 * 1024 ** 2, url: demoImage(0), thumbUrl: demoImage(0) },
    { id: "p2", name: "活跃度趋势.png", size: 1.8 * 1024 ** 2, url: demoImage(1), thumbUrl: demoImage(1) },
    { id: "f", name: "续约报价-v2.pdf", pages: 3, size: 1.2 * 1024 ** 2 },
    { id: "a", name: "客户语音留言.wav", duration: 36, url: tone.url, peaks: tone.peaks, meta: "10-07" },
  ];
  const save = (set: (v: string) => void) => async (value: string) => {
    await new Promise((r) => setTimeout(r, 300));
    if (!value.trim()) throw new Error("不能为空");
    set(value);
  };
  return (
    <div style={{ height: 720, overflow: "auto" }}>
      <SharedPageShell
        brand={brand}
        sharedBy={{ name: "陈一鸣", text: "分享给你的客户记录", org: "北辰云 · 华东销售组" }}
        verified
        status={{ text: <><b>7 天后失效</b> · 还能打开 17 次</>, title: "2026-10-15 10:00 失效；最多打开 20 次，已打开 3 次" }}
        actions={<Button size="sm" variant="outline"><Download aria-hidden="true" />下载全部附件</Button>}
        visitor={{ ip: "203.0.113.18", at: Date.UTC(2026, 9, 8, 2, 16) }}
        product="北辰云"
        footerNote="本页带水印，打开、下载、修改都会记录"
      >
        <SharedRecordCard
          title="远航精密制造"
          avatar="远"
          status={<Tag>方案报价</Tag>}
          meta="客户记录 · 负责人 陈一鸣 · 更新于 10-08 09:55"
          fields={[
            { key: "amount", label: "预计金额", icon: <Coins />, value: "¥388,000" },
            { key: "phone", label: "联系电话", icon: <Phone />, value: "138****0000", masked: true },
            { key: "city", label: "城市 · 行业", icon: <MapPin />, value: <><Tag>上海</Tag><Tag>制造</Tag></> },
            { key: "next", label: "下次跟进", icon: <Bell />, value: next, sub: next === "2026-10-14" ? "你 10:07 改过（原 10-12）" : "刚改过", edit: { kind: "date", value: next, onSave: save(setNext), note: "你的修改会通知 陈一鸣" } },
            { key: "owner", label: "负责人", icon: <User />, value: "陈一鸣", sub: "客户经理" },
            { key: "note", label: "备注", icon: <FileText />, value: note, span: "full", edit: { kind: "textarea", value: note, maxLength: 500, onSave: save(setNote), note: "你的修改会通知 陈一鸣" } },
          ]}
          permissions={[
            { key: "view", icon: <Eye />, text: "看 8 个字段" },
            { key: "edit", icon: <Pencil />, text: "改 下次跟进、备注" },
            { key: "dl", icon: <Download />, text: "下载附件" },
            { key: "copy", icon: <Ban />, text: "复制文字已关闭", denied: true },
          ]}
          contact={{ name: "陈一鸣", hint: "客户经理 · 工作日 9:00–18:00 回复", actions: <Button size="sm" variant="outline"><Mail aria-hidden="true" />发邮件</Button> }}
        />
        <SharedMediaCard title="资料" summary="图片 2 · PDF 1 · 语音 1" items={media} onDownload={() => undefined} downloadAllLabel="全部下载 · 5 MB" />
      </SharedPageShell>
    </div>
  );
}
