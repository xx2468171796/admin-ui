import { FilePlus2 } from "lucide-react";
import { Button, UploadDropZone, UploadQueueList, useNotify, useUploadQueue, type UploadQueueAdapter } from "@adminui/react";

/**
 * 多文件上传：拖放区 + 上传队列（总进度 + 每行 等待 / 上传中剩几秒 / 失败写原因 + 重试 / 完成）。
 * 适配器是模拟的：按 key 记住进度，重试从断点续传；名字带「失败」的第一次在 60% 断网。
 * 没有文件可拖时点「模拟添加 3 个文件」。
 */
const GB = 1024 ** 3;
const resumeAt = new Map<string, number>();
const fakeUpload: UploadQueueAdapter = (file, { signal, onProgress, key, attempt }) =>
  new Promise((resolve, reject) => {
    let p = resumeAt.get(key) ?? 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 6);
      resumeAt.set(key, p);
      onProgress(p);
      if (file.name.includes("失败") && attempt === 1 && p >= 60) {
        clearInterval(timer);
        reject(new Error("网络中断，已保留文件"));
      } else if (p >= 100) {
        clearInterval(timer);
        resumeAt.delete(key);
        resolve({ id: key, name: file.name, url: `/files/${encodeURIComponent(file.name)}` });
      }
    }, 200);
    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(new DOMException("cancelled", "AbortError"));
    });
  });

const sample = () => [
  new File([new Uint8Array(3_200_000)], "季度复盘.pptx"),
  new File([new Uint8Array(1_200_000)], "用量报表-失败演示.xlsx"),
  new File([new Uint8Array(800_000)], "会议纪要.docx"),
];

export function Demo() {
  const notify = useNotify();
  const queue = useUploadQueue({ upload: fakeUpload, maxBytes: 2 * GB, onUploaded: (r) => notify(`${r.name} 上传成功`, "success") });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16, alignItems: "start" }}>
      <UploadDropZone
        onFiles={queue.add}
        maxBytes={2 * GB}
        hint="单个不超过 2 GB，大文件断点续传"
        actions={<Button variant="outline" size="sm" onClick={() => queue.add(sample())}><FilePlus2 aria-hidden="true" />模拟添加 3 个文件</Button>}
      />
      <UploadQueueList items={queue.items} now={queue.now} onCancel={queue.cancel} onRetry={queue.retry} onRemove={queue.remove} canRetry={queue.canRetry} previewOf={queue.previewOf} />
    </div>
  );
}
