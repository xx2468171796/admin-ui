/**
 * Text of an uploaded CSV. `file.text()` is UTF-8 only, but Excel on Chinese Windows saves 「CSV」 as
 * GB18030 (GBK) — that came out as mojibake. Strict UTF-8 first (its BOM is dropped by TextDecoder), else GB18030.
 */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}

export async function readTextFile(file: Blob): Promise<string> {
  return decodeText(new Uint8Array(await file.arrayBuffer()));
}
