import test from "node:test";
import assert from "node:assert/strict";
import { recorderFailure, recorderProblem } from "../src/media-recorder-core.ts";

const fail = (name: string, message = "x") => recorderFailure(Object.assign(new Error(message), { name }));

test("麦克风打不开：按错误名给中文说明，浏览器英文原话只进 detail", () => {
  const denied = recorderProblem("denied", fail("NotAllowedError", "Permission denied"));
  assert.equal(denied.title, "浏览器没有麦克风权限");
  assert.match(denied.steps[0] ?? "", /锁图标/);
  assert.equal(denied.retry, true);
  assert.equal(denied.detail, "NotAllowedError: Permission denied");
  assert.equal(denied.short, "浏览器没有麦克风权限：点地址栏左侧的锁图标允许麦克风后再按");
  assert.match(denied.steps[0] ?? "", /再点「再试一次」/, "步骤里的按钮名和界面一致（再试一次）");

  assert.equal(recorderProblem("error", fail("NotFoundError")).title, "没有找到麦克风");
  assert.equal(recorderProblem("error", fail("DevicesNotFoundError")).title, "没有找到麦克风");
  assert.equal(recorderProblem("error", fail("NotReadableError")).title, "麦克风被别的程序占用");
  assert.equal(recorderProblem("error", fail("TrackStartError")).title, "麦克风被别的程序占用");
  assert.equal(recorderProblem("denied", fail("SecurityError")).title, "浏览器没有麦克风权限");
});

test("审阅 07 实拍：浏览器说「Not supported」→ 不重试、换浏览器或上传，原话只在小字", () => {
  const p = recorderProblem("error", fail("NotSupportedError", "Not supported"));
  assert.equal(p.title, "这个浏览器打不开麦克风");
  assert.equal(p.retry, false);
  assert.ok(![p.title, ...p.steps, p.short].some((line) => line.includes("Not supported")));
  assert.equal(p.detail, "NotSupportedError: Not supported");
});

test("不安全的网址（http 局域网 IP）：说清楚要 https，不给重试", () => {
  const p = recorderProblem("unsupported", {}, { secure: false });
  assert.equal(p.title, "这个网址不能用麦克风");
  assert.equal(p.state, "unsupported");
  assert.equal(p.retry, false);
  assert.match(p.steps[0] ?? "", /https/);
});

test("没有错误名：按状态兜底；没有原因就没有 detail", () => {
  assert.equal(recorderProblem("unsupported").title, "这个浏览器打不开麦克风");
  assert.equal(recorderProblem("denied").title, "浏览器没有麦克风权限");
  const other = recorderProblem("error", { name: "WeirdError" });
  assert.equal(other.title, "没能打开麦克风");
  assert.equal(other.retry, true);
  assert.equal(recorderProblem("error").detail, "");
});

test("recorderFailure：取 name / message，非 Error 也不炸", () => {
  assert.deepEqual(recorderFailure(new DOMException("Not supported", "NotSupportedError")), { name: "NotSupportedError", message: "Not supported" });
  assert.deepEqual(recorderFailure("boom"), { message: "boom" });
  assert.deepEqual(recorderFailure(null), {});
  assert.deepEqual(recorderFailure({ name: 3 }), {});
});
