/**
 * Tiny QR Code encoder (bt/share S1): byte mode (UTF-8), error correction L / M / Q / H, versions 1–40,
 * automatic mask choice by the standard penalty rules (ISO/IEC 18004). Pure, no DOM, no dependency —
 * share links are short, so this is all ShareDialog needs. Algorithm after Project Nayuki's reference
 * implementation (MIT). `encodeQr` returns the module matrix; `QrCode` (qr-code.tsx) draws it.
 */

export type QrEcc = "L" | "M" | "Q" | "H";
export type QrMatrix = { size: number; version: number; ecc: QrEcc; mask: number; /** modules[y][x], true = dark. */ modules: boolean[][] };

const ECC_ORDER: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };
// Index [ecc][version]; version 0 unused.
const ECC_PER_BLOCK: readonly (readonly number[])[] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const at = (list: readonly number[], i: number) => list[i] ?? 0;
const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

/** Number of data modules (data + ECC bits) of a version, after the function patterns. */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}
/** Data codewords (bytes) a version / level holds. */
export function dataCodewords(version: number, ecc: QrEcc): number {
  const e = ECC_ORDER[ecc];
  return Math.floor(rawDataModules(version) / 8) - at(ECC_PER_BLOCK[e] ?? [], version) * at(BLOCKS[e] ?? [], version);
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
/** Reed–Solomon generator polynomial of a degree (coefficients, highest first, leading 1 dropped). */
export function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(at(result, j), root);
      if (j + 1 < degree) result[j] = at(result, j) ^ at(result, j + 1);
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
/** Reed–Solomon remainder of `data` by `divisor` (the ECC codewords of one block). */
export function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = at(result, i) ^ gfMul(coef, factor);
    });
  }
  return result;
}

const utf8 = (text: string) => Array.from(new TextEncoder().encode(text));
const countBits = (version: number) => (version <= 9 ? 8 : 16);

/** Smallest version that holds `bytes` bytes in byte mode, or 0 when even version 40 is too small. */
export function fitVersion(bytes: number, ecc: QrEcc, minVersion = 1): number {
  for (let v = Math.max(1, minVersion); v <= 40; v++) if (4 + countBits(v) + bytes * 8 <= dataCodewords(v, ecc) * 8) return v;
  return 0;
}

function dataStream(bytes: readonly number[], version: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  for (let pad = 0xec; out.length < capacity / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function interleave(data: readonly number[], version: number, ecc: QrEcc): number[] {
  const e = ECC_ORDER[ecc];
  const blocks = at(BLOCKS[e] ?? [], version);
  const eccLen = at(ECC_PER_BLOCK[e] ?? [], version);
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const divisor = rsDivisor(eccLen);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const tail = rsRemainder(dat, divisor);
    if (i < shortBlocks) dat.push(0);
    parts.push(dat.concat(tail));
  }
  const out: number[] = [];
  const width = parts[0]?.length ?? 0;
  for (let i = 0; i < width; i++)
    parts.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) out.push(at(block, i));
    });
  return out;
}

/** Row / column centres of the alignment patterns of a version. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const size = version * 4 + 17;
  const out: number[] = [];
  for (let i = 0; i < count - 1; i++) out.push(size - 7 - i * step);
  out.push(6);
  return out.reverse();
}

class Grid {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];
  readonly size: number;
  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  get(x: number, y: number) {
    return this.modules[y]?.[x] ?? false;
  }
  set(x: number, y: number, dark: boolean) {
    const row = this.modules[y];
    if (row && x >= 0 && x < this.size) row[x] = dark;
  }
  fix(x: number, y: number, dark: boolean) {
    this.set(x, y, dark);
    const row = this.fixed[y];
    if (row && x >= 0 && x < this.size) row[x] = true;
  }
  isFixed(x: number, y: number) {
    return this.fixed[y]?.[x] ?? false;
  }
}

function drawFormat(grid: Grid, ecc: QrEcc, mask: number) {
  const data = (ECC_FORMAT[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const n = grid.size;
  for (let i = 0; i <= 5; i++) grid.fix(8, i, bit(bits, i));
  grid.fix(8, 7, bit(bits, 6));
  grid.fix(8, 8, bit(bits, 7));
  grid.fix(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) grid.fix(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) grid.fix(n - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) grid.fix(8, n - 15 + i, bit(bits, i));
  grid.fix(8, n - 8, true);
}

function drawFunctionPatterns(grid: Grid, version: number, ecc: QrEcc) {
  const n = grid.size;
  for (let i = 0; i < n; i++) {
    grid.fix(6, i, i % 2 === 0);
    grid.fix(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]] as const)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) grid.fix(x, y, d !== 2 && d !== 4);
      }
  const align = alignmentPositions(version);
  const last = align.length - 1;
  align.forEach((ay, i) =>
    align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) grid.fix(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  drawFormat(grid, ecc, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      grid.fix(a, b, bit(bits, i));
      grid.fix(b, a, bit(bits, i));
    }
  }
}

function drawCodewords(grid: Grid, data: readonly number[]) {
  const n = grid.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!grid.isFixed(x, y) && i < data.length * 8) {
          grid.set(x, y, bit(at(data, i >>> 3), 7 - (i & 7)));
          i++;
        }
      }
  }
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
function applyMask(grid: Grid, mask: number) {
  const test = MASKS[mask];
  if (!test) return;
  for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) if (!grid.isFixed(x, y) && test(x, y)) grid.set(x, y, !grid.get(x, y));
}

/** The standard mask penalty (lower is better): runs, 2×2 blocks, finder-like patterns, dark balance. */
export function maskPenalty(modules: readonly (readonly boolean[])[]): number {
  const n = modules.length;
  const cell = (x: number, y: number) => modules[y]?.[x] ?? false;
  let result = 0;
  const addHistory = (run: number, history: number[]) => {
    if (history[0] === 0) run += n;
    history.pop();
    history.unshift(run);
  };
  const countPatterns = (h: readonly number[]) => {
    const k = at(h, 1);
    const core = k > 0 && at(h, 2) === k && at(h, 3) === k * 3 && at(h, 4) === k && at(h, 5) === k;
    return (core && at(h, 0) >= k * 4 && at(h, 6) >= k ? 1 : 0) + (core && at(h, 6) >= k * 4 && at(h, 0) >= k ? 1 : 0);
  };
  const line = (get: (i: number) => boolean) => {
    let color = false;
    let run = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      if (get(i) === color) {
        run++;
        if (run === 5) result += 3;
        else if (run > 5) result++;
      } else {
        addHistory(run, history);
        if (!color) result += countPatterns(history) * 40;
        color = get(i);
        run = 1;
      }
    }
    if (color) {
      addHistory(run, history);
      run = 0;
    }
    addHistory(run + n, history);
    result += countPatterns(history) * 40;
  };
  for (let y = 0; y < n; y++) line((x) => cell(x, y));
  for (let x = 0; x < n; x++) line((y) => cell(x, y));
  let dark = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const c = cell(x, y);
      if (c) dark++;
      if (x < n - 1 && y < n - 1 && c === cell(x + 1, y) && c === cell(x, y + 1) && c === cell(x + 1, y + 1)) result += 3;
    }
  const total = n * n;
  result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return result;
}

/**
 * Encode `text` (UTF-8, byte mode). Default level M (a link survives a smudge or a small centre mark).
 * Throws a RangeError when the text does not fit version 40.
 */
export function encodeQr(text: string, options: { ecc?: QrEcc; minVersion?: number; mask?: number } = {}): QrMatrix {
  const ecc = options.ecc ?? "M";
  const bytes = utf8(text);
  const version = fitVersion(bytes.length, ecc, options.minVersion);
  if (!version) throw new RangeError("二维码内容太长");
  const codewords = interleave(dataStream(bytes, version, ecc), version, ecc);
  const grid = new Grid(version * 4 + 17);
  drawFunctionPatterns(grid, version, ecc);
  drawCodewords(grid, codewords);
  let mask = options.mask ?? -1;
  if (mask < 0 || mask > 7) {
    let best = Number.POSITIVE_INFINITY;
    for (let m = 0; m < 8; m++) {
      applyMask(grid, m);
      drawFormat(grid, ecc, m);
      const penalty = maskPenalty(grid.modules);
      if (penalty < best) {
        best = penalty;
        mask = m;
      }
      applyMask(grid, m);
    }
  }
  applyMask(grid, mask);
  drawFormat(grid, ecc, mask);
  return { size: grid.size, version, ecc, mask, modules: grid.modules };
}

/** One SVG path (`M x y h1 v1 h-1 z` per dark module, merged per row run) for a matrix with a quiet zone. */
export function qrPath(matrix: QrMatrix, quiet = 4): string {
  let d = "";
  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (row[end]) end++;
      d += `M${x + quiet} ${y + quiet}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return d;
}
