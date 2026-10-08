/** Pure parts of the record frame (record-frame.tsx): the three frames and the 「8 / 13 · 按阶段」 text. */
export type RecordFrame = "drawer" | "dialog" | "page";
export const RECORD_FRAMES: readonly RecordFrame[] = ["drawer", "dialog", "page"];
export const RECORD_FRAME_LABELS: Readonly<Record<RecordFrame, string>> = { drawer: "右侧抽屉", dialog: "居中弹框", page: "整页" };

export type RecordFrameNav = {
  /** 0-based position of the open record in the view and the view's count. */
  index: number;
  total: number;
  onMove: (delta: -1 | 1) => void;
  /** The list it walks, after the count: 「按阶段」. */
  label?: string;
};

/** 「8 / 13 · 按阶段」 */
export function recordFrameNavText(nav: Pick<RecordFrameNav, "index" | "total" | "label">): string {
  return `${nav.index + 1} / ${nav.total}${nav.label ? ` · ${nav.label}` : ""}`;
}

