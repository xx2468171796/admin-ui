import { useEffect, useState } from "react";
import { Camera, Captions, Mic } from "lucide-react";
import {
  AttachmentGallery,
  AudioPlayer,
  AudioRecorder,
  Button,
  DataTable,
  HoldToTalk,
  PageBody,
  PageHeader,
  Panel,
  SplitLayout,
  UploadDropZone,
  UploadQueue,
  formatBytes,
  formatDuration,
  useNotify,
  useUploadQueue,
  type Column,
  type MediaItem,
  type RecordingResult,
  type UploadQueueAdapter,
  type UploadResult,
} from "@adminui/react";
import { demoPhoto, demoTone } from "./media-demo";

// 媒体与附件示例（样稿 D19 附件面板、D11 附件行、D18 上传格、D27m 录音 / 按住说话）。
// 文件地址、上传、下载、转文字都是宿主的事：这里用浏览器里生成的音频和图片、模拟的上传适配器代替。
const GB = 1024 ** 3;
const ACCEPT = ["image/*", "video/*", "audio/*", ".pdf", ".xlsx", ".docx"];

/** 模拟可续传的上传：按 key 记住进度，重试从断点继续；名字带「失败」的第一次在 60% 断网。 */
const resumeAt = new Map<string, number>();
const demoUpload: UploadQueueAdapter<UploadResult> = (file, { signal, onProgress, key, attempt }) =>
  new Promise((resolve, reject) => {
    let p = resumeAt.get(key) ?? 0;
    const step = file.name.includes("大文件") ? 0.6 : 7;
    const timer = setInterval(() => {
      p = Math.min(100, p + step);
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
    }, 150);
    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(new DOMException("cancelled", "AbortError"));
    });
  });

// 演示音频整页只生成一次（真实项目里是服务端给的文件地址，不需要释放）。
let audio: { call: ReturnType<typeof demoTone>; note: ReturnType<typeof demoTone> } | null = null;
const demoAudio = () => (audio ??= { call: demoTone(23, 3), note: demoTone(12, 7) });

type Row = { id: string; name: string; stage: string; audio: { src: string; duration: number; peaks: number[]; more: number } | null };

export function MediaShowcase() {
  const notify = useNotify();
  const [photo, setPhoto] = useState<{ a: string; b: string } | null>(null);
  const { call, note } = demoAudio();
  useEffect(() => setPhoto({ a: demoPhoto(0), b: demoPhoto(1) }), []);
  const [recordings, setRecordings] = useState<RecordingResult[]>([]);
  const saved = (r: RecordingResult) => {
    setRecordings((list) => [r, ...list].slice(0, 3));
    notify(`录好了：${formatDuration(r.duration)} · ${formatBytes(r.blob.size)}`, "success");
  };

  const items: MediaItem[] = [
    { id: "p1", name: "客厅-全景.jpg", size: 3.8 * 1024 ** 2, meta: "小王 09-27", cover: true, url: photo?.a, thumbUrl: photo?.a },
    { id: "p2", name: "配电箱.jpg", size: 2.1 * 1024 ** 2, meta: "阿明 09-27", url: photo?.b, thumbUrl: photo?.b },
    { id: "p3", name: "主卧窗帘盒.jpg", size: 2.9 * 1024 ** 2, meta: "小王 10-05" },
    { id: "v1", name: "现场走一圈.mp4", size: 48.6 * 1024 ** 2, meta: "小王 09-27", duration: 65 },
    { id: "a1", name: "客户来电-10-04.m4a", meta: "小王 · 通话录音", url: call.url, duration: 23, peaks: call.peaks },
    { id: "a2", name: "现场口述-配电箱.m4a", meta: "阿明 · 在手机上录的", url: note.url, duration: 12, peaks: note.peaks },
    { id: "f1", name: "平面图-滨江区.pdf", pages: 6, size: 2.3 * 1024 ** 2, meta: "小王 10-03" },
    { id: "f2", name: "报价单.xlsx", size: 48 * 1024, meta: "林经理 10-04", lock: { label: "仅能看价格的人可见", hint: "这个附件带价格，只有能看「成交价」的人看得到" } },
    { id: "f3", name: "成本核算.xlsx", size: 96 * 1024, meta: "财务 10-02", lock: { label: "仅财务可见", hint: "你没有「成本」字段的查看权限", denied: true } },
  ];
  const download = (list: MediaItem[]) => notify(`开始下载：${list.map((i) => i.name).join("、")}`, "info");
  const transcribe = () => (
    <Button variant="outline" size="sm" disabled disabledReason="AI 转文字以后上线">
      <Captions />
      转文字
    </Button>
  );

  // D18：表单里的上传格 = useUploadQueue 的条目映射成附件集的方块（上传中 / 失败 / 重试 / 取消）。
  const queue = useUploadQueue({ upload: demoUpload, accept: ACCEPT, maxBytes: 2 * GB });
  const formItems: MediaItem[] = [
    { id: "q-ok", name: "客厅.jpg", size: 3.2 * 1024 ** 2, url: photo?.b, thumbUrl: photo?.b },
    { id: "q-pdf", name: "户型图-滨江区.pdf", size: 2.1 * 1024 ** 2 },
    ...queue.items.map<MediaItem>((q) => ({
      id: q.id,
      name: q.name,
      size: q.size,
      kind: q.kind,
      upload: q.state === "uploading" || q.state === "waiting" ? { state: "uploading", progress: q.progress, detail: `${formatBytes((q.size * q.progress) / 100)} / ${formatBytes(q.size)}`, onCancel: () => queue.cancel(q.id) } : q.state === "failed" ? { state: "failed", error: q.error, onRetry: queue.canRetry(q.id) ? () => queue.retry(q.id) : undefined } : undefined,
    })),
  ].filter((i) => !queue.items.some((q) => q.id === i.id && q.state === "cancelled"));

  const rows: Row[] = [
    { id: "r1", name: "陈雅婷", stage: "首通", audio: { src: call.url, duration: 23, peaks: call.peaks, more: 0 } },
    { id: "r2", name: "林志明", stage: "二通", audio: { src: note.url, duration: 12, peaks: note.peaks, more: 1 } },
    { id: "r3", name: "王美玲", stage: "报价", audio: null },
    { id: "r4", name: "张家豪（徐汇区别墅）", stage: "报价", audio: { src: call.url, duration: 9, peaks: [], more: 2 } },
  ];
  const columns: Column<Row>[] = [
    { key: "name", title: "客户名称", render: (r) => r.name, truncate: (r) => r.name },
    { key: "audio", title: "通话录音", width: 170, render: (r) => (r.audio ? <AudioPlayer variant="mini" src={r.audio.src} title={`${r.name} 通话录音`} duration={r.audio.duration} peaks={r.audio.peaks.length ? r.audio.peaks : undefined} miniExtra={r.audio.more ? `+${r.audio.more}` : undefined} /> : null) },
    { key: "stage", title: "阶段", render: (r) => r.stage },
  ];

  return (
    <>
      <PageHeader title="媒体与附件" description="附件集（网格 / 列表 / 一行条）、大图预览、音频播放（含格子里的迷你版）、多文件上传队列、录音和按住说话。文件地址、上传、下载、转文字由宿主的适配器提供。" />
      <PageBody>
        <Panel title="现场资料" count="李承恩（滨江豪宅）· 9 个 · 共 186 MB">
          <AttachmentGallery
            label="现场资料"
            items={items}
            selectable
            onDownload={download}
            onOpenInNewWindow={(i) => notify(`在新窗口打开：${i.name}`, "info")}
            audioAction={transcribe}
            sectionHints={{ visual: "点开整屏大图：缩放、拖动、旋转、左右切换", file: "PDF 直接预览，Office 文件在线预览" }}
            caption={(i) => (
              <>
                <b>李承恩（滨江豪宅）</b>
                <br />
                字段「现场资料」· {i.meta ?? "—"}
              </>
            )}
            uploadSlot={
              <UploadQueue
                upload={demoUpload}
                accept={ACCEPT}
                maxBytes={2 * GB}
                label="拖文件到这里，或 粘贴 / 拍照 / 录音"
                hint="单个不超过 2GB，大文件断点续传"
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => notify("宿主打开相机", "info")}>
                      <Camera />
                      拍照
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => notify("宿主打开录音", "info")}>
                      <Mic />
                      录音
                    </Button>
                  </>
                }
                onUploaded={(r) => notify(`${r.name} 上传成功`, "success")}
              />
            }
          />
        </Panel>
        <SplitLayout
          railWidth={400}
          rail={
            <>
              <Panel title="录音">
                <AudioRecorder
                  title="上门谈话"
                  onDone={saved}
                  onCancel={() => notify("已放弃这段录音", "info")}
                  notes={<span>只在这个页面录；关掉页面会停止录音</span>}
                  onUpload={() => notify("宿主打开文件选择", "info")}
                />
              </Panel>
              <Panel title="按住说话" count={`录好 ${recordings.length} 段`}>
                <div style={{ display: "grid", gap: 12 }}>
                  <HoldToTalk onDone={saved} onCancel={(why) => notify(why === "short" ? "说话时间太短，没有发送" : "已取消，没有发送", "info")} />
                  {recordings.map((r, i) => (
                    <AudioPlayer key={r.url} src={r.url} title={`录音 ${recordings.length - i}`} subtitle={`${formatDuration(r.duration)} · ${formatBytes(r.blob.size)}`} duration={r.duration} peaks={r.peaks} />
                  ))}
                </div>
              </Panel>
            </>
          }
        >
          <Panel title="通话录音（表格格子里的迷你播放器）" flush>
            <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} caption="客户通话录音" pagination={{ mode: "all" }} rowHeight="short" />
          </Panel>
          <Panel title="记录详情里的附件行">
            <AttachmentGallery label="附件行" mode="strip" items={items} maxVisible={6} onAdd={() => notify("宿主打开文件选择", "info")} addHint="拖文件到这里上传" onDownload={download} />
          </Panel>
          <Panel title="表单里的上传格">
            <div style={{ display: "grid", gap: 12 }}>
              <AttachmentGallery label="上传户型图" items={formItems} toolbar={false} onRemove={(i) => queue.remove(i.id)} empty="还没有文件" />
              <UploadDropZone onFiles={queue.add} accept={ACCEPT} label="拖文件到这里，或点击选择" hint="户型图、现场照片、视频都可以；单个文件不超过 2GB" />
            </div>
          </Panel>
        </SplitLayout>
      </PageBody>
    </>
  );
}
