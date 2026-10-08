"use client";
/**
 * QrCode (bt/share S1): draws a link as a QR code with the built-in encoder (qr-core.ts), no extra
 * dependency. Always dark modules on a light tile in both themes (scanners need that), colours from
 * tokens (--aui-qr-dark / --aui-qr-light). An optional centre mark (brand letter) switches to level Q
 * so the code still reads. `downloadQrPng` saves the same code as a PNG for chat apps.
 */
import { useMemo, type ReactNode } from "react";
import { encodeQr, qrPath, type QrEcc, type QrMatrix } from "./qr-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

export type QrCodeProps = {
  /** The text to encode (the share URL). */
  value: string;
  /** Rendered size in px (default 96). */
  size?: number;
  /** Accessible name (default 「二维码」). */
  label?: string;
  /** Error correction (default M, or Q with a mark). */
  ecc?: QrEcc;
  /** A small centre mark (brand letter / logo), ≤ 22% of the width. */
  mark?: ReactNode;
};
const QUIET = 2;

/** A QR code as an SVG image; the value is in the accessible name's title for copy-free checks. */
export function QrCode({ value, size = 96, label = "二维码", ecc, mark }: QrCodeProps) {
  const matrix = useMemo<QrMatrix | null>(() => {
    try {
      return encodeQr(value, { ecc: ecc ?? (mark ? "Q" : "M") });
    } catch {
      return null;
    }
  }, [value, ecc, mark]);
  if (!matrix) return <span className="aui-qr" data-error style={{ width: size, height: size }} role="img" aria-label={`${label}：内容太长，无法生成`} />;
  const box = matrix.size + QUIET * 2;
  return (
    <span className="aui-qr" style={{ width: size, height: size }} role="img" aria-label={label} data-qr-version={matrix.version}>
      <svg viewBox={`0 0 ${box} ${box}`} shapeRendering="crispEdges" aria-hidden="true">
        <rect className="aui-qr-bg" width={box} height={box} />
        <path className="aui-qr-fg" d={qrPath(matrix, QUIET)} />
      </svg>
      {mark && <span className="aui-qr-mark" aria-hidden="true">{mark}</span>}
    </span>
  );
}

/**
 * Save `value` as a PNG (`scale` px per module, 4-module quiet zone). Colours are read from `from`'s
 * computed --aui-qr-dark / --aui-qr-light (the element inside `.adminui`), falling back to the
 * text / surface tokens. Returns false when the canvas is unavailable.
 */
export async function downloadQrPng(value: string, fileName: string, from: Element | null, scale = 10): Promise<boolean> {
  const matrix = encodeQr(value, { ecc: "M" });
  const quiet = 4;
  const px = (matrix.size + quiet * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const style = from ? getComputedStyle(from) : null;
  const read = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || style?.getPropertyValue(fallback).trim() || "";
  ctx.fillStyle = read("--aui-qr-light", "--aui-surface") || "white";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = read("--aui-qr-dark", "--aui-text") || "black";
  matrix.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    }),
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
