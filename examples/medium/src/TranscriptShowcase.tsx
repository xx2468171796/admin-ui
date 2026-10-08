import { useEffect, useState } from "react";
import { ChevronRight, Download, Ellipsis } from "lucide-react";
import {
  Button,
  MenuButton,
  PageBody,
  PageHeader,
  TranscriptViewer,
  useNotify,
  type TranscriptCategory,
  type TranscriptSegment,
  type TranscriptSpeaker,
  type TranscriptSpan,
  MoreMenu,
} from "@adminui/react";
import { demoTone } from "./media-demo";

// 录音文字稿示例（样稿 D27t）：上门谈话的录音 + 自动分说话人的文字稿 + AI 标注 + 打码。本页用 T10 的整块工作区，
// 真实项目里通常放在「跟进记录」的大弹框里。录音地址、波形 peaks、转写、打码、导出都由宿主服务端给；这里是浏览器生成的演示音频。

const SPEAKERS: TranscriptSpeaker[] = [
  { id: "rep", name: "小王", role: "销售", initial: "王" },
  { id: "mr", name: "李先生", role: "客户", initial: "李" },
  { id: "mrs", name: "李太太", role: "客户", initial: "李" },
];
const CATEGORIES: TranscriptCategory[] = [
  { id: "need", label: "需求" },
  { id: "care", label: "关注", tone: "teal" },
  { id: "budget", label: "预算" },
  { id: "worry", label: "顾虑", tone: "greenSolid" },
  { id: "rival", label: "竞品", tone: "gray" },
  { id: "decider", label: "决策人" },
];

const t = (clock: string) => {
  const [m, s] = clock.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
};
/** [开始, 结束, 说话人, 文字]；[[词|分类]] = AI 标注，{{打码文字|类别}} = 打码。 */
const LINES: [string, string, string, string][] = [
  ["00:12", "01:20", "rep", "李先生、李太太好，今天把 KNX 面板和窗帘电机的样品都带来了，我先帮两位演示一下场景。"],
  ["01:20", "02:14", "mrs", "我们先看看样品吧，这个面板是什么材质？摸起来不太像塑料。"],
  ["02:14", "02:31", "mr", "我们是想[[全屋都做智能|need]]，最主要是[[门锁|need]]跟[[窗帘电机|need]]，灯光也想一起弄。"],
  ["02:31", "03:30", "rep", "了解，那客厅和主卧做场景面板，书房用无线开关就好，不用打墙。"],
  ["03:30", "05:03", "mr", "书房我常常在家开会，灯光要能一键切成会议模式，窗帘也一起拉上，这个做得到吗？"],
  ["05:03", "05:20", "mrs", "我比较在意[[安全|care]]，而且我妈妈跟我们住，她[[不太会用手机|care]]，按钮要简单。"],
  ["05:20", "06:30", "rep", "门锁可以刷脸也可以按指纹，老人家不用带钥匙、也不用手机；进门在面板上按一下，整层灯就开了。"],
  ["06:30", "07:42", "mrs", "我妈妈晚上会起来上厕所，走廊的灯能不能自己亮？不要太亮，会刺眼。"],
  ["07:42", "07:58", "mr", "预算的话，我们大概抓[[两百万到两百二十万|budget]]之间，再多就要再想想。"],
  ["07:58", "08:20", "rep", "这个范围全屋都做得到，修改版报价我周五送过来，再带窗帘的样品。"],
  ["09:10", "09:16", "rep", "合约要写李先生的名字吗？证件号码我先记一下。"],
  ["09:16", "09:24", "mr", "写我的，{{身份证 A12****789|身份证}}。"],
  ["11:26", "11:40", "mrs", "可是施工的时候我们[[还要住在这里|worry]]，而且万一[[断网|worry]]了，窗帘是不是就不能动？"],
  ["11:40", "12:50", "rep", "断网的时候墙上的面板和遥控都照常用，只是出门在外没办法用手机控制；施工可以分区，一次只动两个房间。"],
  ["12:50", "13:50", "mrs", "分区施工的话大概要多久？过年前做得完吗？"],
  ["13:50", "14:05", "mr", "我朋友家装的是[[小米|rival]]跟 [[Aqara|rival]]，价格好像比较便宜？"],
  ["14:05", "15:10", "rep", "便宜的那种多半走无线，断网就麻烦；我们是有线总线，老人家用起来更稳，我把两种的差别写进报价单。"],
  ["15:10", "16:08", "mr", "那报价单里把有线跟无线的差别列清楚，我们再比较一下。"],
  ["16:08", "16:24", "mr", "最后还是[[她决定|decider]]啦，你周五带报价来再说。"],
  ["16:24", "17:30", "rep", "好的，那周五下午两点我带修改版报价和窗帘样品过来，再请李太太试一下面板。"],
  ["17:30", "18:05", "mr", "好，那就周五下午两点，我们等你。"],
];

/** Turns the markup above into text + spans (offsets in the plain text). */
function parse(line: string): Pick<TranscriptSegment, "text" | "spans"> {
  const spans: TranscriptSpan[] = [];
  let text = "";
  const re = /\[\[([^|\]]+)\|([^\]]+)\]\]|\{\{([^|}]+)\|([^}]+)\}\}/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    text += line.slice(last, m.index);
    const word = m[1] ?? m[3] ?? "";
    const start = text.length;
    text += word;
    spans.push(m[1] ? { kind: "annotation", start, end: text.length, category: m[2] ?? "" } : { kind: "mask", start, end: text.length, label: m[4] });
    last = (m.index ?? 0) + m[0].length;
  }
  text += line.slice(last);
  return { text, spans };
}
const SEGMENTS: TranscriptSegment[] = LINES.map(([from, to, speaker, line], i) => ({ id: `s${i + 1}`, speaker, start: t(from), end: t(to), ...parse(line) }));
const SUMMARY: [string, string][] = [
  ["02:14", "要做全屋，重点门锁和窗帘电机"],
  ["07:42", "预算 200–220 万（客户原话）"],
  ["11:26", "顾虑：施工期要住、怕断网"],
  ["16:08", "李太太决定，周五看修改版报价"],
];
const DURATION = t("18:05");

export function TranscriptShowcase() {
  const notify = useNotify();
  const [audio, setAudio] = useState<{ url: string; peaks: number[] } | null>(null);
  useEffect(() => {
    const tone = demoTone(DURATION, 7);
    setAudio(tone);
    return () => URL.revokeObjectURL(tone.url);
  }, []);
  return (
    <>
      <PageHeader title="录音文字稿" description="上门谈话录音：按说话人分段的波形、AI 标注、点时间跳转、文字跟着播放滚动、打码与留痕查看、说话占比、导出。样稿 D27t。" />
      <PageBody>
        <TranscriptViewer
          src={audio?.url}
          peaks={audio?.peaks}
          duration={DURATION}
          speakers={SPEAKERS}
          segments={SEGMENTS}
          categories={CATEGORIES}
          title="上门谈话 · 李承恩（滨江豪宅）"
          meta="10-05 14:20 · 小王 录音 · 18:05 · 3 位说话人（自动区分，可改名）· 能看这个客户的人就能看"
          actions={<MoreMenu label="更多操作" sections={[{ items: [{ key: "audio", label: "下载原始录音", icon: <Download />, onSelect: () => notify("开始下载原始录音", "success") }] }]} />}
          focus={{ label: "只听客户", speakers: ["mr", "mrs"] }}
          summary={{ text: "李先生夫妇认可全屋智能方案，预算 ¥200–220 万，最在意老人好用和断网，李太太拍板。", points: SUMMARY.map(([time, text]) => ({ time: t(time), text })) }}
          summaryAction={<Button variant="ghost" size="sm" onClick={() => notify("打开完整分析：建议更新字段、话术建议", "info")}>完整分析<ChevronRight /></Button>}
          onReveal={async () => {
            await new Promise((r) => setTimeout(r, 300));
            notify("已记录：你查看了身份证号码", "info");
            return "身份证 A123456789";
          }}
          onExport={async (o) => {
            await new Promise((r) => setTimeout(r, 400));
            notify(`已导出 ${o.format.toUpperCase()}（${[o.withTime && "带时间", o.withSpeaker && "带说话人", o.withAnnotations && "带 AI 标注"].filter(Boolean).join("、") || "只有文字"}）`, "success");
          }}
          exportNote="身份证、银行卡已自动打码，导出也是打码后的"
        />
      </PageBody>
    </>
  );
}
