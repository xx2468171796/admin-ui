import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA_ERR, MEDIA_RESIGN_TRIES, mediaFailureOf, mediaFailureText, planMediaError, resumeAt } from "../src/media-source-core.ts";

test("planMediaError: expired link (network mid-play / not-supported on first load) re-signs once, then gives up with the reason", () => {
  for (const code of [MEDIA_ERR.NETWORK, MEDIA_ERR.SRC_NOT_SUPPORTED, null]) {
    assert.deepEqual(planMediaError({ code, tries: 0, canResign: true }), { kind: "resign" }, `code ${code}: first error re-signs`);
    assert.deepEqual(planMediaError({ code, tries: MEDIA_RESIGN_TRIES, canResign: true }), { kind: "fail", failure: mediaFailureOf(code) }, `code ${code}: a fresh link failing again stops`);
  }
  // 宿主没给重签：直接给原因
  assert.deepEqual(planMediaError({ code: MEDIA_ERR.SRC_NOT_SUPPORTED, tries: 0, canResign: false }), { kind: "fail", failure: "unsupported" });
  assert.deepEqual(planMediaError({ code: MEDIA_ERR.NETWORK, tries: 0, canResign: false }), { kind: "fail", failure: "network" });
  // 解码出错换链接也没用；用户中断不算错
  assert.deepEqual(planMediaError({ code: MEDIA_ERR.DECODE, tries: 0, canResign: true }), { kind: "fail", failure: "decode" });
  assert.deepEqual(planMediaError({ code: MEDIA_ERR.ABORTED, tries: 0, canResign: true }), { kind: "ignore" });
});

test("mediaFailureOf / mediaFailureText: unsupported codec says download, network says reload", () => {
  assert.equal(mediaFailureOf(MEDIA_ERR.SRC_NOT_SUPPORTED), "unsupported");
  assert.equal(mediaFailureOf(MEDIA_ERR.DECODE), "decode");
  assert.equal(mediaFailureOf(MEDIA_ERR.NETWORK), "network");
  assert.equal(mediaFailureOf(null), "network");
  assert.equal(mediaFailureText("unsupported", "video"), "浏览器不支持这个视频编码，下载后播放");
  assert.equal(mediaFailureText("unsupported", "audio"), "浏览器不支持这个音频格式，下载后播放");
  assert.match(mediaFailureText("network", "video"), /重新加载/);
  assert.match(mediaFailureText("decode", "audio"), /^音频文件解码出错/);
});

test("resumeAt: same second after a re-sign, never past the end", () => {
  assert.equal(resumeAt(42.5, 120), 42.5);
  assert.equal(resumeAt(42.5), 42.5, "duration unknown yet");
  assert.equal(resumeAt(120, 120), 0, "at the end → from the start");
  assert.equal(resumeAt(0, 120), 0);
  assert.equal(resumeAt(Number.NaN, 120), 0);
  assert.equal(resumeAt(-3, 120), 0);
  assert.equal(resumeAt(10, Number.NaN), 10, "stream with unknown length");
});
