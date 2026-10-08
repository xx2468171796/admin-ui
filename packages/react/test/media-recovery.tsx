import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, MediaLightbox, type MediaItem } from "../src/index.ts";
import "../src/styles.css";
/**
 * Lightbox recovery harness (8.0.1, a host project's 「宝石开启中.mp4」): a 1920×1080 video on a wide, short stage;
 * a video whose address is missing with an oversized poster (「重新加载」); a link that is already expired
 * (403 → re-sign); a file the browser can't decode. media.mjs serves /signed/* with page.route.
 */
declare global {
  interface Window {
    __calls: { name: string; currentTime: number; code: number | null }[];
    __reloads: string[];
    __downloads: string[];
  }
}
window.__calls = [];
window.__reloads = [];
window.__downloads = [];
const BIG_POSTER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#3a6"/></svg>')}`;
const START: MediaItem[] = [
  { id: "wide", name: "宝石开启中.mp4", kind: "video", url: "/signed/wide?v=0", duration: 3 },
  { id: "missing", name: "没签到.mp4", kind: "video", thumbUrl: BIG_POSTER, duration: 3 },
  { id: "bad", name: "坏编码.mp4", kind: "video", url: "/signed/bad?v=0" },
];

function Harness() {
  const [items, setItems] = useState(START);
  const [index, setIndex] = useState(0);
  return (
    <MediaLightbox
      open
      label="恢复"
      items={items}
      index={index}
      onIndexChange={setIndex}
      onClose={() => undefined}
      onDownload={(item) => window.__downloads.push(item.name)}
      onReload={async (item) => {
        window.__reloads.push(item.name);
        await new Promise((r) => setTimeout(r, 150));
        setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, url: "/signed/wide?v=9" } : entry)));
      }}
      onMediaError={async (item, info) => {
        window.__calls.push({ name: item.name, ...info });
        // 第 N 次重签 → 链接带 v=N（v=0 是一开始那个过期的）
        const next = window.__calls.filter((c) => c.name === item.name).length;
        return `/signed/${item.id === "bad" ? "bad" : "wide"}?v=${next}`;
      }}
    />
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<AdminProvider storageKey="aui-media-recovery"><Harness /></AdminProvider>);
