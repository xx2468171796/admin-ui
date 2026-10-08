import { Captions } from "lucide-react";
import { AudioPlayer, Button, DataTable, useNotify, type Column } from "@adminui/react";
import { demoTone } from "../../data/collab-data";

/**
 * 完整播放器：播放键 · 名字 / 来源 · 波形（播过的主色）· 时间 · 倍速（点一下轮换）· 转文字 / 下载；点波形跳转。
 * 表格格子里用 variant="mini"（24 高），「+2」写明是还有 2 段录音。同一页同时只放一个在播。
 */
export function Demo() {
  const notify = useNotify();
  const call = demoTone(23, 3);
  const note = demoTone(12, 7);
  const rows = [
    { id: "r1", name: "远航精密制造", tone: call, more: 0 },
    { id: "r2", name: "青禾教育", tone: note, more: 2 },
  ];
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "name", title: "客户", render: (r) => r.name },
    { key: "audio", title: "最近一通", width: 190, render: (r) => <AudioPlayer variant="mini" src={r.tone.url} title={`${r.name} 通话录音`} duration={r.tone.peaks.length / 10} peaks={r.tone.peaks} miniExtra={r.more ? `+${r.more} 段` : undefined} /> },
  ];
  return (
    <div className="aui-stack">
      <AudioPlayer
        src={call.url}
        title="客户来电-10-07.wav"
        subtitle="陈一鸣 · 通话录音"
        duration={23}
        peaks={call.peaks}
        onDownload={() => notify("开始下载录音", "info")}
        action={<Button variant="outline" size="sm" disabled disabledReason="转文字还没开通"><Captions aria-hidden="true" />转文字</Button>}
      />
      <AudioPlayer src="data:audio/x-unknown;base64,AAAA" title="旧系统迁移的录音.amr" subtitle="格式不支持时写原因和能做什么" duration={40} />
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} caption="通话录音" pagination={{ mode: "all" }} rowHeight="short" />
    </div>
  );
}
