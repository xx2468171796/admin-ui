/**
 * Zoom / pan maths of the full-screen MediaLightbox (看大图改全屏沉浸 + 缩放). Scales are
 * relative to the image's natural pixels (1 = 「100%」); 「适应」 is the largest scale that shows the whole
 * (rotated) picture, never above 1 so small photos are not blown up. Pan is the picture centre's offset
 * from the stage centre in CSS pixels. Pure functions, no React / DOM (test/media-zoom.test.ts).
 */

export type ZoomSize = { width: number; height: number };
export type ZoomPan = { x: number; y: number };

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
/** Stops for 「放大」 / 「缩小」 and the + / - keys. */
export const ZOOM_STEPS: readonly number[] = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
const EPS = 1e-3;

const positive = (n: number) => Number.isFinite(n) && n > 0;

/** Keep `scale` inside [min, max]; NaN / non-positive → min. */
export function clampZoom(scale: number, min = ZOOM_MIN, max = ZOOM_MAX): number {
  if (!positive(scale)) return min;
  return Math.min(max, Math.max(min, scale));
}

/** Quarter turns normalised to 0 / 90 / 180 / 270. */
export function normalizeRotation(rotation: number): number {
  const quarter = Math.round((Number.isFinite(rotation) ? rotation : 0) / 90);
  return (((quarter % 4) + 4) % 4) * 90;
}

/** The picture's box after rotating (90° / 270° swap width and height). */
export function rotatedSize(natural: ZoomSize, rotation: number): ZoomSize {
  const turned = normalizeRotation(rotation) % 180 !== 0;
  return turned ? { width: natural.height, height: natural.width } : { width: natural.width, height: natural.height };
}

/**
 * 「适应」: the largest scale at which the whole rotated picture fits `box`, capped at `max` (default 1 —
 * a small photo is shown at its real size, not stretched). Unknown sizes → 1.
 */
export function fitScale(natural: ZoomSize, box: ZoomSize, rotation = 0, max = 1): number {
  const turned = rotatedSize(natural, rotation);
  if (!positive(turned.width) || !positive(turned.height) || !positive(box.width) || !positive(box.height)) return 1;
  return Math.min(max, box.width / turned.width, box.height / turned.height);
}

/** Next stop up (dir 1) or down (dir -1) from `scale`, clamped to [min, max]; off-stop scales snap to the nearest stop in that direction. */
export function stepZoom(scale: number, dir: 1 | -1, min = ZOOM_MIN, max = ZOOM_MAX): number {
  const current = clampZoom(scale, min, max);
  const stops = ZOOM_STEPS.filter((s) => s >= min - EPS && s <= max + EPS);
  const next = dir > 0 ? stops.find((s) => s > current + EPS) : [...stops].reverse().find((s) => s < current - EPS);
  return clampZoom(next ?? (dir > 0 ? max : min), min, max);
}

/** Ctrl + wheel / trackpad pinch: smooth exponential zoom (wheel down = smaller). */
export function wheelZoom(scale: number, deltaY: number, min = ZOOM_MIN, max = ZOOM_MAX): number {
  const delta = Number.isFinite(deltaY) ? Math.max(-300, Math.min(300, deltaY)) : 0;
  return clampZoom(scale * Math.exp(-delta * 0.0015), min, max);
}

/**
 * Pan after zooming from `scale` to `next` so the picture point under `point` stays put (`point` is
 * relative to the stage centre). Zooming with the buttons / keys uses the centre (point 0, 0).
 */
export function zoomAround(pan: ZoomPan, scale: number, next: number, point: ZoomPan = { x: 0, y: 0 }): ZoomPan {
  if (!positive(scale) || !positive(next)) return { x: 0, y: 0 };
  const k = next / scale;
  return { x: point.x - (point.x - pan.x) * k, y: point.y - (point.y - pan.y) * k };
}

/**
 * Keep the zoomed picture covering the stage: on each axis the offset can go at most half of the overflow;
 * an axis where the picture is smaller than the stage stays centred (0).
 */
export function clampPan(pan: ZoomPan, scale: number, natural: ZoomSize, box: ZoomSize, rotation = 0): ZoomPan {
  const turned = rotatedSize(natural, rotation);
  const limit = (size: number, room: number) => Math.max(0, (size * scale - room) / 2);
  const lx = limit(turned.width, box.width);
  const ly = limit(turned.height, box.height);
  const clamp = (v: number, l: number) => (Number.isFinite(v) ? Math.min(l, Math.max(-l, v)) : 0) || 0;
  return { x: clamp(pan.x, lx), y: clamp(pan.y, ly) };
}

/** True when the picture is bigger than the stage on some axis (dragging pans instead of swiping). */
export function canPan(scale: number, natural: ZoomSize, box: ZoomSize, rotation = 0): boolean {
  const turned = rotatedSize(natural, rotation);
  return turned.width * scale > box.width + 0.5 || turned.height * scale > box.height + 0.5;
}

/** 「100%」 label value. */
export const zoomPercent = (scale: number): number => Math.round(clampZoom(scale, 0.01, 100) * 100);

/**
 * A horizontal swipe on a phone: left (dx < 0) = next (1), right = previous (-1), else 0. Needs at least
 * `minDistance` px, mostly sideways (|dx| ≥ 1.5 × |dy|) and quicker than `maxMs`.
 */
export function swipeIntent(dx: number, dy: number, ms: number, minDistance = 50, maxMs = 800): -1 | 0 | 1 {
  if (![dx, dy, ms].every(Number.isFinite) || ms > maxMs) return 0;
  if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
