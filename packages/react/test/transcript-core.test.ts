import test from "node:test";
import assert from "node:assert/strict";
import {
  annotationPins,
  barSpeakers,
  countAnnotations,
  findSilences,
  nextFocusTime,
  searchTranscript,
  segmentAt,
  segmentIndexAt,
  silenceLabel,
  skipSilence,
  sortSegments,
  speakerLane,
  splitSegmentText,
  stackPins,
  talkShare,
  timeTicks,
  transcriptText,
  annotationStats,
  speakerColors,
  speakerTone,
  speakerToneAt,
  SPEAKER_TONES,
  type TranscriptSegment,
} from "../src/transcript-core.ts";

const segs: TranscriptSegment[] = [
  { id: "a", speaker: "rep", start: 12, end: 120, text: "李先生好，先演示一下场景。" },
  { id: "b", speaker: "c1", start: 134, end: 150, text: "我们想全屋都做智能，重点门锁。", spans: [{ kind: "annotation", start: 3, end: 9, category: "need" }, { kind: "annotation", start: 12, end: 14, category: "need" }] },
  { id: "c", speaker: "rep", start: 150, end: 300, text: "了解。" },
  { id: "d", speaker: "c1", start: 556, end: 570, text: "写我的，身份证 A12****789。", spans: [{ kind: "mask", start: 4, end: 18, label: "身份证" }] },
  { id: "e", speaker: "c2", start: 300, end: 318, text: "我比较在意安全。", spans: [{ kind: "annotation", start: 5, end: 7, category: "care" }] },
];
const sorted = sortSegments(segs);

test("segments sort by start and the playing one is found by binary search", () => {
  assert.deepEqual(sorted.map((s) => s.id), ["a", "b", "c", "e", "d"]);
  assert.equal(segmentIndexAt(sorted, 0), -1, "before the first line");
  assert.equal(segmentIndexAt(sorted, 12), 0);
  assert.equal(segmentIndexAt(sorted, 125), 0, "a silence keeps the previous line");
  assert.equal(segmentIndexAt(sorted, 134), 1);
  assert.equal(segmentIndexAt(sorted, 1000), 4);
  assert.equal(segmentIndexAt(sorted, Number.NaN), -1);
  assert.equal(segmentAt(sorted, 125), null, "nobody speaks at 125 s");
  assert.equal(segmentAt(sorted, 140)?.id, "b");
  assert.deepEqual(sortSegments([{ id: "x", speaker: "a", start: 5, end: 2, text: "" }]), [], "end before start is dropped");
});

test("talk share adds up to 100 with largest remainders and keeps speaker order", () => {
  const share = talkShare(sorted, [{ id: "rep" }, { id: "c1" }, { id: "c2" }, { id: "silent" }]);
  assert.deepEqual(share.map((s) => s.speaker), ["rep", "c1", "c2", "silent"]);
  assert.equal(share.reduce((n, s) => n + s.percent, 0), 100);
  assert.equal(share.find((s) => s.speaker === "rep")?.seconds, 258);
  assert.equal(share.find((s) => s.speaker === "silent")?.percent, 0);
  assert.deepEqual(talkShare([], [{ id: "a" }]), [{ speaker: "a", seconds: 0, percent: 0 }]);
});

test("silences come from the gaps between segments, with a minimum length", () => {
  const gaps = findSilences(sorted, 600, 8);
  assert.deepEqual(gaps, [
    { start: 0, end: 12, seconds: 12 },
    { start: 120, end: 134, seconds: 14 },
    { start: 318, end: 556, seconds: 238 },
    { start: 570, end: 600, seconds: 30 },
  ]);
  assert.equal(findSilences(sorted, 600, 20).length, 2);
  assert.equal(skipSilence(125, gaps), 134, "inside a silence → its end");
  assert.equal(skipSilence(140, gaps), 140);
  assert.equal(silenceLabel(12), "静默 12 秒");
  assert.equal(silenceLabel(72, true), "跳过 1 分 12 秒静默");
  assert.equal(silenceLabel(120), "静默 2 分钟");
});

test("only-these-speakers playback jumps to their next segment or stops", () => {
  const customers = new Set(["c1", "c2"]);
  assert.equal(nextFocusTime(sorted, 140, customers), 140, "a customer is speaking");
  assert.equal(nextFocusTime(sorted, 160, customers), 300, "the rep speaks → jump to the next customer line");
  assert.equal(nextFocusTime(sorted, 580, customers), null, "nobody of them again");
});

test("text splits into plain, annotated and masked parts; bad spans are ignored", () => {
  const parts = splitSegmentText("我们想全屋都做智能，重点门锁。", segs[1]?.spans);
  assert.deepEqual(parts.map((p) => [p.kind, p.text]), [["text", "我们想"], ["annotation", "全屋都做智能"], ["text", "，重点"], ["annotation", "门锁"], ["text", "。"]]);
  const masked = splitSegmentText("写我的，身份证 A12****789。", segs[3]?.spans);
  assert.deepEqual(masked[1], { kind: "mask", text: "身份证 A12****789", start: 4, label: "身份证", index: 0 });
  const overlap = splitSegmentText("abcdef", [{ kind: "annotation", start: 0, end: 4, category: "x" }, { kind: "annotation", start: 2, end: 5, category: "y" }, { kind: "mask", start: 4, end: 99 }]);
  assert.deepEqual(overlap.map((p) => p.text), ["abcd", "ef"], "overlapping and out-of-range spans are skipped");
});

test("pins: one per segment and category, in time order; count of phrases", () => {
  assert.deepEqual(annotationPins(sorted).map((p) => [p.time, p.category]), [[134, "need"], [300, "care"]]);
  assert.equal(countAnnotations(sorted), 3);
  assert.deepEqual(stackPins([0.1, 0.12, 0.13, 0.5]), [0, 1, 0, 0]);
});

test("search is case-insensitive and never matches inside a masked span", () => {
  const hits = searchTranscript([{ id: "x", speaker: "a", start: 0, end: 1, text: "KNX 面板，knx 开关，身份证 A12", spans: [{ kind: "mask", start: 11, end: 18 }] }], "knx");
  assert.deepEqual(hits.map((h) => h.start), [0, 7]);
  assert.deepEqual(searchTranscript(sorted, "A12"), [], "masked text is not searchable");
  assert.deepEqual(searchTranscript(sorted, "  "), []);
});

test("speaker lane, bar speakers and axis ticks", () => {
  const lane = speakerLane(sorted, 600);
  assert.equal(lane[0]?.from, 0.02);
  assert.equal(lane.length, 5);
  assert.deepEqual(speakerLane(sorted, 0), []);
  const bars = barSpeakers(sorted, 6, 600);
  assert.deepEqual(bars, ["rep", "rep", "rep", null, null, null]);
  assert.deepEqual(timeTicks(1085).map((t) => t.label), ["00:00", "03:01", "06:02", "09:03", "12:03", "15:04", "18:05"]);
});

test("copy / export text is the masked form with optional time, speaker and tags", () => {
  const speakers = [{ id: "rep", name: "小王" }, { id: "c1", name: "李先生" }, { id: "c2", name: "李太太" }];
  const text = transcriptText(sorted.slice(1, 2), speakers, { withAnnotations: true, categories: [{ id: "need", label: "需求" }] });
  assert.equal(text, "[02:14] 李先生：我们想全屋都做智能〔需求〕，重点门锁〔需求〕。");
  assert.equal(transcriptText(sorted.slice(3, 5), speakers, { withTime: false }), "李太太：我比较在意安全。\n李先生：写我的，身份证 A12****789。");
  assert.equal(transcriptText(sorted.slice(0, 1), speakers, { withSpeaker: false }), "[00:12] 李先生好，先演示一下场景。");
});

test("说话人颜色：蓝 / 橙 / 青分类色，按顺序固定，不用主色和红", () => {
  const speakers = [{ id: "rep" }, { id: "c1" }, { id: "c2" }];
  assert.deepEqual(speakers.map((s) => speakerTone(speakers, s.id)), ["blue", "orange", "teal"]);
  assert.equal(speakerTone(speakers, "who"), "violet", "不在名单里的接在后面");
  assert.equal(speakerTone([{ id: "rep", slot: 2 }], "rep"), "teal", "slot 优先");
  assert.equal(speakerToneAt(SPEAKER_TONES.length), "blue", "超出就循环");
  assert.equal(speakerToneAt(-1), SPEAKER_TONES[SPEAKER_TONES.length - 1]);
  assert.equal(speakerToneAt(Number.NaN), "blue");
  assert.ok(!SPEAKER_TONES.includes("green") && !SPEAKER_TONES.includes("red"), "不用主色绿和录音 / 异常红");
  assert.deepEqual(speakerColors("orange"), { color: "var(--aui-option-orange)", soft: "var(--aui-option-orange-soft)", text: "var(--aui-option-orange-text)" });
});

test("annotationStats：每类标注数，按第一次出现排序", () => {
  assert.deepEqual(annotationStats(segs), [{ category: "need", count: 2 }, { category: "care", count: 1 }]);
  assert.deepEqual(annotationStats([]), []);
});
