import test from "node:test";
import assert from "node:assert/strict";
import {
  barCountFor,
  clampTime,
  detectMediaKind,
  downsamplePeaks,
  estimateSecondsLeft,
  fileExtension,
  fileFamily,
  fileTypeLabel,
  fileTypeName,
  acceptLabel,
  firstViewableFrom,
  formatBytes,
  formatDuration,
  formatSpeed,
  formatTimeLeft,
  holdGesture,
  levelFromTimeDomain,
  nextSpeed,
  nextUploads,
  pickRecorderMime,
  recorderErrorState,
  mediaThumbBox,
  splitFileName,
  summarizeUploads,
  uploadQueueReducer,
  uploadRoom,
  type UploadQueueItem,
} from "../src/media-core.ts";

test("file kind: MIME first, then extension", () => {
  assert.equal(detectMediaKind("客厅.JPG"), "image");
  assert.equal(detectMediaKind("现场走一圈.mp4"), "video");
  assert.equal(detectMediaKind("客户来电-10-04.m4a"), "audio");
  assert.equal(detectMediaKind("平面图.pdf"), "pdf");
  assert.equal(detectMediaKind("报价单.xlsx"), "file");
  assert.equal(detectMediaKind("blob", "audio/webm;codecs=opus"), "audio", "录音 Blob 没有扩展名");
  assert.equal(detectMediaKind("scan", "application/pdf"), "pdf");
  assert.equal(detectMediaKind("photo.bin", "image/png"), "image", "服务端说的 MIME 优先");
  assert.equal(fileExtension("a/b/c.tar.GZ"), "gz");
  assert.equal(fileExtension(".env"), "", "点开头的不是扩展名");
  assert.equal(fileExtension("README"), "");
  assert.equal(fileFamily("报价单.xlsx"), "sheet");
  assert.equal(fileFamily("合同.docx"), "doc");
  assert.equal(fileFamily("x.mov"), "video");
  assert.equal(fileFamily("x.unknown"), "other");
  assert.equal(fileTypeLabel("报价单.xlsx"), "XLS");
  assert.equal(fileTypeLabel("平面图.pdf"), "PDF");
  assert.equal(fileTypeLabel("archive.tgz"), "TGZ");
  assert.equal(fileTypeLabel("noext"), "");
});

test("durations, sizes, speeds, time left", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(23.9), "00:23", "向下取整");
  assert.equal(formatDuration(65), "01:05");
  assert.equal(formatDuration(3725), "1:02:05");
  assert.equal(formatDuration(-1), "--:--");
  assert.equal(formatDuration(Number.NaN), "--:--");
  assert.equal(formatDuration(null), "--:--");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(48 * 1024), "48 KB");
  assert.equal(formatBytes(2.4 * 1024 * 1024), "2.4 MB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3 MB");
  assert.equal(formatBytes(186 * 1024 * 1024), "186 MB");
  assert.equal(formatBytes(2 * 1024 ** 3), "2 GB");
  assert.equal(formatBytes(-5), "—");
  assert.equal(formatSpeed(1), "1.0x");
  assert.equal(formatSpeed(1.25), "1.25x");
  assert.equal(formatSpeed(0.75), "0.75x");
  assert.equal(formatSpeed(2), "2.0x");
  assert.equal(nextSpeed(1), 1.25);
  assert.equal(nextSpeed(2), 0.75, "最后一档回到第一档");
  assert.equal(nextSpeed(3), 1, "不在列表里 → 1");
  assert.equal(nextSpeed(1, [1, 2]), 2);
  assert.equal(formatTimeLeft(9), "剩 9 秒");
  assert.equal(formatTimeLeft(0.2), "剩 1 秒");
  assert.equal(formatTimeLeft(130), "剩 2 分钟");
  assert.equal(formatTimeLeft(3900), "剩 1 小时 5 分");
  assert.equal(formatTimeLeft(7200), "剩 2 小时");
  assert.equal(formatTimeLeft(3590), "剩 1 小时", "不出现「60 分钟」");
  assert.equal(formatTimeLeft(7170), "剩 2 小时", "不出现「1 小时 60 分」");
  assert.equal(formatTimeLeft(null), "");
  assert.equal(clampTime(-3, 20), 0);
  assert.equal(clampTime(25, 20), 20);
  assert.equal(clampTime(5, Number.NaN), 5);
});

test("peaks: downsample to bars, normalised, stretch when short", () => {
  assert.deepEqual(downsamplePeaks([0, 0.5, 1, 0.25], 2), [0.5, 1]);
  assert.deepEqual(downsamplePeaks([0.2, 0.4], 4), [0.5, 0.5, 1, 1], "少于条数时每个值重复");
  assert.deepEqual(downsamplePeaks([-0.5, 0.25], 2), [1, 0.5], "负值取绝对值");
  assert.deepEqual(downsamplePeaks([0, 0, 0], 3), [0, 0, 0], "全静音不除零");
  assert.deepEqual(downsamplePeaks([], 10), []);
  assert.deepEqual(downsamplePeaks(undefined, 10), []);
  assert.deepEqual(downsamplePeaks([1, 2], 0), []);
  const many = Array.from({ length: 1000 }, (_, i) => (i === 500 ? 9 : 1));
  const out = downsamplePeaks(many, 50);
  assert.equal(out.length, 50);
  assert.equal(Math.max(...out), 1);
  assert.equal(out[25], 1, "峰值落在对应的桶里");
  assert.equal(barCountFor(100, 3, 2), 20);
  assert.equal(barCountFor(1), 1);
  assert.equal(barCountFor(0), 0);
  assert.equal(levelFromTimeDomain(new Uint8Array(64).fill(128)), 0, "静音");
  const loud = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 255 : 0));
  assert.ok(levelFromTimeDomain(loud) > 0.9);
  assert.equal(levelFromTimeDomain([]), 0);
});

const file = (id: string, size = 1000) => ({ id, name: `${id}.jpg`, size, kind: "image" as const });

test("upload queue: add, concurrency, progress, done, fail, retry keeps progress, cancel, remove", () => {
  let q: UploadQueueItem<string>[] = [];
  q = uploadQueueReducer(q, { type: "add", items: [file("a"), file("b"), file("c")] });
  q = uploadQueueReducer(q, { type: "add", items: [file("a")] });
  assert.equal(q.length, 3, "同一个 id 不重复加");
  assert.deepEqual(nextUploads(q, 2), ["a", "b"]);
  q = uploadQueueReducer(q, { type: "start", id: "a", now: 0 });
  q = uploadQueueReducer(q, { type: "start", id: "b", now: 0 });
  assert.deepEqual(nextUploads(q, 2), [], "满了不再启动");
  q = uploadQueueReducer(q, { type: "progress", id: "a", progress: 40, now: 2000 });
  q = uploadQueueReducer(q, { type: "progress", id: "a", progress: 30, now: 2100 });
  assert.equal(q[0]?.progress, 40, "进度不倒退");
  q = uploadQueueReducer(q, { type: "progress", id: "a", progress: 400, now: 2200 });
  assert.equal(q[0]?.progress, 100, "夹到 100");
  q = uploadQueueReducer(q, { type: "done", id: "a", result: "url-a", now: 3000 });
  assert.equal(q[0]?.state, "done");
  assert.equal(q[0]?.result, "url-a");
  assert.deepEqual(nextUploads(q, 2), ["c"]);
  q = uploadQueueReducer(q, { type: "progress", id: "b", progress: 60, now: 1000 });
  q = uploadQueueReducer(q, { type: "fail", id: "b", error: "网络中断，已保留文件" });
  assert.equal(q[1]?.state, "failed");
  assert.equal(q[1]?.error, "网络中断，已保留文件");
  q = uploadQueueReducer(q, { type: "done", id: "b", result: "late", now: 9 });
  assert.equal(q[1]?.state, "failed", "失败后迟到的结果不改状态");
  q = uploadQueueReducer(q, { type: "retry", id: "b" });
  assert.equal(q[1]?.state, "waiting");
  assert.equal(q[1]?.attempt, 2, "重试次数给适配器做断点续传");
  assert.equal(q[1]?.progress, 60, "重试保留进度");
  assert.equal(q[1]?.error, undefined);
  q = uploadQueueReducer(q, { type: "cancel", id: "c" });
  assert.equal(q[2]?.state, "cancelled");
  q = uploadQueueReducer(q, { type: "cancel", id: "a" });
  assert.equal(q[0]?.state, "done", "完成的不能取消");
  assert.deepEqual(summarizeUploads(q), { total: 3, active: 1, done: 1, failed: 0, cancelled: 1 });
  q = uploadQueueReducer(q, { type: "clearFinished" });
  assert.deepEqual(q.map((i) => i.id), ["b"]);
  q = uploadQueueReducer(q, { type: "remove", id: "b" });
  assert.deepEqual(q, []);
  q = uploadQueueReducer(q, { type: "reject", item: file("big", 9e9), error: "文件超过 2 GB 上限" });
  assert.equal(q[0]?.state, "failed");
  assert.equal(q[0]?.error, "文件超过 2 GB 上限");
});

test("time left from the average rate of this attempt", () => {
  const base = { state: "uploading" as const, startedAt: 0, startProgress: 0 };
  assert.equal(estimateSecondsLeft({ ...base, progress: 0, updatedAt: 0 }, 0), null, "还没有速度");
  assert.equal(estimateSecondsLeft({ ...base, progress: 10, updatedAt: 200 }, 200), null, "不到半秒不估");
  assert.equal(estimateSecondsLeft({ ...base, progress: 50, updatedAt: 10_000 }, 10_000), 10);
  assert.equal(estimateSecondsLeft({ ...base, progress: 50, updatedAt: 10_000 }, 13_000), 7, "两次报告之间也在倒数");
  assert.equal(estimateSecondsLeft({ ...base, startProgress: 60, progress: 80, updatedAt: 4000 }, 4000), 4, "续传从断点算速度");
  assert.equal(estimateSecondsLeft({ ...base, state: "done", progress: 100, updatedAt: 1 }, 1), null);
});

test("hold to talk gesture, recorder helpers", () => {
  assert.equal(holdGesture(500, 480), "send");
  assert.equal(holdGesture(500, 436), "cancel", "上滑 64px 取消");
  assert.equal(holdGesture(500, 520), "send", "下滑不算");
  assert.equal(holdGesture(500, 470, 20), "cancel");
  assert.equal(pickRecorderMime((t) => t === "audio/mp4"), "audio/mp4", "Safari 只能录 mp4");
  assert.equal(pickRecorderMime((t) => t.startsWith("audio/webm")), "audio/webm;codecs=opus");
  assert.equal(pickRecorderMime((t) => t === "audio/x-custom", "audio/x-custom"), "audio/x-custom", "宿主指定的优先");
  assert.equal(pickRecorderMime(() => false), "");
  assert.equal(pickRecorderMime(() => { throw new Error("old engine"); }), "", "isTypeSupported 抛错不炸");
  assert.equal(recorderErrorState({ name: "NotAllowedError" }), "denied");
  assert.equal(recorderErrorState({ name: "NotFoundError" }), "error");
  assert.equal(recorderErrorState("x"), "error");
});

test("upload room: only waiting + uploading hold a slot", () => {
  const items = [{ state: "waiting" }, { state: "uploading" }, { state: "done" }, { state: "failed" }, { state: "cancelled" }] as const;
  assert.equal(uploadRoom(items, 3), 1);
  assert.equal(uploadRoom(items, 2), 0);
  assert.equal(uploadRoom(items, 1), 0);
  assert.equal(uploadRoom([{ state: "done" }, { state: "failed" }], 2), 2, "被拒 / 已完成的不占名额");
  assert.equal(uploadRoom(items, undefined), Number.POSITIVE_INFINITY);
});

test("strip +N: first viewable hidden item, or none", () => {
  const items = [{ id: "a" }, { id: "b", lock: { denied: true } }, { id: "c", upload: { progress: 40 } }, { id: "d" }];
  assert.equal(firstViewableFrom(items, 1), 3, "跳过无权限和上传中的");
  assert.equal(firstViewableFrom(items, 0), 0);
  assert.equal(firstViewableFrom(items.slice(0, 3), 1), -1);
  assert.equal(firstViewableFrom(items, 9), -1);
});

test("file names keep their extension when cut", () => {
  assert.deepEqual(splitFileName("报价单.xlsx"), { stem: "报价单", ext: ".xlsx" });
  assert.deepEqual(splitFileName("现场.走一圈.MP4"), { stem: "现场.走一圈", ext: ".MP4" });
  assert.deepEqual(splitFileName(".env"), { stem: ".env", ext: "" });
  assert.deepEqual(splitFileName("没有扩展名"), { stem: "没有扩展名", ext: "" });
  assert.deepEqual(splitFileName("a.verylongextension"), { stem: "a.verylongextension", ext: "" });
  assert.deepEqual(splitFileName("v2. 草稿"), { stem: "v2. 草稿", ext: "" });
});

test("file sizes: one binary convention (1 MB = 1024 KB), limits written in MiB read as whole numbers", () => {
  assert.equal(formatBytes(1023), "1023 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5 MB", "5 MB 上限显示 5 MB，不是 5.0 / 4.8");
  assert.equal(formatBytes(20 * 1024 * 1024), "20 MB");
  assert.equal(formatBytes(1024 ** 3), "1 GB");
  assert.equal(formatBytes(1.5 * 1024 * 1024), "1.5 MB");
});

test("file types in words, never a raw MIME", () => {
  assert.equal(fileTypeName("现场.png"), "图片 PNG");
  assert.equal(fileTypeName("现场.JPEG"), "图片 JPG");
  assert.equal(fileTypeName("blob", "image/jpeg"), "图片 JPG");
  assert.equal(fileTypeName("安装.mp4", "video/mp4"), "视频 MP4");
  assert.equal(fileTypeName("语音.m4a"), "音频 M4A");
  assert.equal(fileTypeName("报价.pdf", "application/octet-stream"), "PDF 文档");
  assert.equal(fileTypeName("", "application/pdf"), "PDF 文档");
  assert.equal(fileTypeName("合同.docx"), "Word 文档");
  assert.equal(fileTypeName("x", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "Excel 表格");
  assert.equal(fileTypeName("名单.csv"), "CSV 表格");
  assert.equal(fileTypeName("方案.pptx"), "PPT 演示文稿");
  assert.equal(fileTypeName("资料.zip"), "压缩包 ZIP");
  assert.equal(fileTypeName("安装程序.exe"), "EXE 文件");
  assert.equal(fileTypeName("没有扩展名"), "文件");
});

test("accept lists in words", () => {
  assert.equal(acceptLabel([]), "任意文件");
  assert.equal(acceptLabel(["image/*"]), "图片");
  assert.equal(acceptLabel(["image/png", "image/jpeg"]), "图片 PNG / JPG");
  assert.equal(acceptLabel(["image/*", "image/png", "video/*"]), "图片、视频");
  assert.equal(acceptLabel(["image/png", ".pdf", ".doc", ".docx"]), "图片 PNG、PDF 文档、Word 文档");
});

test("MediaThumb 的尺寸：sm / md 跟容器走，数字 = 固定方块（单独用时），96 以下用小号图标", () => {
  assert.deepEqual(mediaThumbBox(undefined), { look: "md" });
  assert.deepEqual(mediaThumbBox("sm"), { look: "sm" });
  assert.deepEqual(mediaThumbBox(64), { look: "sm", px: 64 });
  assert.deepEqual(mediaThumbBox(120.4), { look: "md", px: 120 });
  assert.deepEqual(mediaThumbBox(4), { look: "sm", px: 16 }, "最小 16px");
  assert.deepEqual(mediaThumbBox(Number.NaN), { look: "md" }, "非数字回到默认");
});
