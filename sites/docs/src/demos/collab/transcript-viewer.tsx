import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { MoreMenu, TranscriptViewer, useNotify } from "@adminui/react";
import { CATEGORIES, SEGMENTS, SPEAKERS, TRANSCRIPT_DURATION, TRANSCRIPT_POINTS, demoTone } from "../../data/collab-data";

/**
 * 客户季度复盘的录音文字稿（能播）：说话人图例 + 按说话人上色的波形 + AI 标注小钉；点时间跳转，文字跟着播放滚动；
 * 手机号已打码，点眼睛「留痕查看」；导出收在标题行的下拉里。音频是浏览器生成的演示音。
 */
export function Demo() {
  const notify = useNotify();
  const [audio, setAudio] = useState<{ url: string; peaks: number[] } | null>(null);
  useEffect(() => setAudio(demoTone(TRANSCRIPT_DURATION, 7)), []);
  return (
    <TranscriptViewer
      src={audio?.url}
      peaks={audio?.peaks}
      duration={TRANSCRIPT_DURATION}
      speakers={SPEAKERS}
      segments={SEGMENTS}
      categories={CATEGORIES}
      title="季度复盘 · 远航精密制造"
      meta="10-07 14:00 · 周可欣 录音 · 10:00 · 3 位说话人（自动区分，可改名）"
      actions={<MoreMenu label="更多操作" sections={[{ items: [{ key: "audio", label: "下载原始录音", icon: <Download />, onSelect: () => notify("开始下载原始录音", "success") }] }]} />}
      focus={{ label: "只听客户", speakers: ["it", "ops"] }}
      summary={{ text: "客户使用量明显上涨，预算与去年持平，关注单点登录和数据导出，下周二前要报价。", points: TRANSCRIPT_POINTS }}
      onReveal={async () => {
        await new Promise((r) => setTimeout(r, 300));
        notify("已记录：你查看了手机号", "info");
        return "13800000000";
      }}
      onExport={async (o) => {
        await new Promise((r) => setTimeout(r, 400));
        notify(`已导出 ${o.format.toUpperCase()}`, "success");
      }}
      exportNote="手机号、证件号已自动打码，导出也是打码后的"
    />
  );
}
