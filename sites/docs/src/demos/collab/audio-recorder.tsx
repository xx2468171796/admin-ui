import { useState } from "react";
import { AudioPlayer, AudioRecorder, HoldToTalk, Panel, formatBytes, formatDuration, useNotify, type RecordingResult } from "@adminui/react";

/**
 * 录音（AudioRecorder）：点大红键才请求麦克风——没有麦克风或被拒绝时变成两步说明 +「再试一次」+「改成上传录音文件」，
 * 不会把浏览器的英文报错直接丢给用户。按住说话（HoldToTalk）：按下变录音红 + 气泡计时，上滑松开取消。
 */
export function Demo() {
  const notify = useNotify();
  const [clips, setClips] = useState<RecordingResult[]>([]);
  const saved = (r: RecordingResult) => {
    setClips((list) => [r, ...list].slice(0, 3));
    notify(`录好了：${formatDuration(r.duration)} · ${formatBytes(r.blob.size)}`, "success");
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
      <Panel title="录音">
        <AudioRecorder
          title="客户拜访"
          onDone={saved}
          onCancel={() => notify("已放弃这段录音", "info")}
          notes={<span>只在这个页面录；关掉页面会停止录音</span>}
          onUpload={() => notify("打开文件选择", "info")}
        />
      </Panel>
      <Panel title="按住说话" count={`录好 ${clips.length} 段`}>
        <div className="aui-stack">
          <HoldToTalk onDone={saved} onCancel={(why) => notify(why === "short" ? "说话时间太短，没有发送" : "已取消，没有发送", "info")} />
          {clips.map((r, i) => (
            <AudioPlayer key={r.url} src={r.url} title={`录音 ${clips.length - i}`} subtitle={`${formatDuration(r.duration)} · ${formatBytes(r.blob.size)}`} duration={r.duration} peaks={r.peaks} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
