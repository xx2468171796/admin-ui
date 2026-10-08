import test from "node:test";
import assert from "node:assert/strict";
import { canPan, clampPan, clampZoom, fitScale, normalizeRotation, rotatedSize, stepZoom, swipeIntent, wheelZoom, zoomAround, zoomPercent, ZOOM_MAX, ZOOM_MIN } from "../src/media-zoom.ts";

const photo = { width: 4000, height: 3000 };
const stage = { width: 1000, height: 800 };

test("fitScale shows the whole picture and never blows small photos up", () => {
  assert.equal(fitScale(photo, stage), 0.25);
  assert.equal(fitScale(photo, stage, 90), 800 / 4000, "rotated: height limits");
  assert.equal(fitScale({ width: 640, height: 420 }, stage), 1, "small photo stays 100%");
  assert.equal(fitScale({ width: 640, height: 420 }, stage, 0, 2), 1000 / 640, "max lets the host allow upscaling");
  assert.equal(fitScale({ width: 0, height: 0 }, stage), 1, "unknown size → 1");
  assert.equal(fitScale(photo, { width: 0, height: 10 }), 1);
});

test("rotation normalises to quarter turns and swaps the box", () => {
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(Number.NaN), 0);
  assert.deepEqual(rotatedSize(photo, 270), { width: 3000, height: 4000 });
  assert.deepEqual(rotatedSize(photo, 180), photo);
});

test("stepZoom walks the stops and snaps off-stop scales", () => {
  assert.equal(stepZoom(1, 1), 1.25);
  assert.equal(stepZoom(1, -1), 0.75);
  assert.equal(stepZoom(0.3, 1), 0.33, "0.3 snaps up to the next stop");
  assert.equal(stepZoom(0.3, -1), 0.25);
  assert.equal(stepZoom(ZOOM_MAX, 1), ZOOM_MAX, "stays at max");
  assert.equal(stepZoom(ZOOM_MIN, -1), ZOOM_MIN, "stays at min");
  assert.equal(stepZoom(2, 1, 0.1, 2.5), 2.5, "custom max caps the last step");
});

test("clampZoom / wheelZoom / zoomPercent", () => {
  assert.equal(clampZoom(20), ZOOM_MAX);
  assert.equal(clampZoom(-1), ZOOM_MIN);
  assert.equal(clampZoom(Number.NaN), ZOOM_MIN);
  assert.ok(wheelZoom(1, -100) > 1, "wheel up zooms in");
  assert.ok(wheelZoom(1, 100) < 1, "wheel down zooms out");
  assert.equal(wheelZoom(1, Number.NaN), 1);
  assert.equal(wheelZoom(ZOOM_MAX, -10_000), ZOOM_MAX);
  assert.equal(zoomPercent(0.333), 33);
  assert.equal(zoomPercent(1), 100);
});

test("zoomAround keeps the point under the pointer still", () => {
  const pan = { x: 0, y: 0 };
  const point = { x: 200, y: -100 };
  const next = zoomAround(pan, 1, 2, point);
  // Picture coordinate under the pointer before and after: (point - pan) / scale.
  assert.deepEqual({ x: (point.x - next.x) / 2, y: (point.y - next.y) / 2 }, { x: 200, y: -100 });
  assert.deepEqual(zoomAround({ x: 40, y: 10 }, 1, 2), { x: 80, y: 20 }, "centre zoom scales the offset");
  assert.deepEqual(zoomAround(pan, 0, 2), { x: 0, y: 0 });
});

test("clampPan keeps the picture covering the stage; canPan only when it overflows", () => {
  assert.deepEqual(clampPan({ x: 999, y: -999 }, 0.5, photo, stage), { x: 500, y: -350 }, "(2000 − 1000) / 2, (1500 − 800) / 2");
  assert.deepEqual(clampPan({ x: 120, y: 80 }, 0.2, photo, stage), { x: 0, y: 0 }, "smaller than the stage → centred");
  assert.deepEqual(clampPan({ x: 999, y: 0 }, 0.5, photo, stage, 90), { x: 250, y: 0 }, "rotated box: 1500 wide");
  assert.equal(canPan(0.25, photo, stage), false);
  assert.equal(canPan(0.5, photo, stage), true);
});

test("swipeIntent: quick sideways swipes page, everything else is ignored", () => {
  assert.equal(swipeIntent(-120, 10, 200), 1, "left = next");
  assert.equal(swipeIntent(120, -10, 200), -1, "right = previous");
  assert.equal(swipeIntent(-30, 0, 100), 0, "too short");
  assert.equal(swipeIntent(-120, 100, 200), 0, "too diagonal");
  assert.equal(swipeIntent(-120, 0, 1500), 0, "too slow");
  assert.equal(swipeIntent(Number.NaN, 0, 100), 0);
});
