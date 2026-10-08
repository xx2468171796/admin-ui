import { useState } from "react";
import { FileText, Mic } from "lucide-react";
import { Timeline, TimelineAttachment, TimelineDay, TimelineItem, TimelineMore, dayHeading, useNotify } from "@adminui/react";

// 「今天」「昨天」按 Asia/Shanghai 的日期算
const dayOf = (offset: number) => new Date(Date.now() - offset * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });

/**
 * 自己拼跟进记录：用 Timeline 积木，不自己画圆点和竖线。人做的事 = 头像、系统的事 = 小圆点、结果 = ✓ / ✕ / ! 圆；
 * 时间在右（悬停看完整时间），附件 / 录音是描边小卡；底部「显示更早的 N 条」。
 */
export function Demo() {
  const notify = useNotify();
  const [older, setOlder] = useState(false);
  const today = dayHeading(dayOf(0));
  const yesterday = dayHeading(dayOf(1));
  return (
    <div style={{ maxWidth: 640 }}>
      <Timeline label="跟进记录">
        <TimelineDay label={today.label} date={today.date}>
          <TimelineItem marker="person" avatar="陈一鸣" avatarKey="u02" title={<><b>陈一鸣</b> 电话跟进 远航精密制造</>} time="10:42" timeTitle={`${dayOf(0)} 10:42:10`}
            attachments={<TimelineAttachment icon={<Mic />} onClick={() => notify("播放通话录音", "info")}>通话录音 · 3 分 12 秒</TimelineAttachment>}>
            客户希望先在生产部试用两周，下周二上门演示单点登录。
          </TimelineItem>
          <TimelineItem marker="result" result="danger" title={<><b>同步失败</b> 合同附件上传到文件库</>} time="10:30">
            文件超过 50 MB，请压缩后重新上传。
          </TimelineItem>
          <TimelineItem marker="system" dot="brand" title="提醒：今天要跟进「青禾教育」" time="09:00" />
        </TimelineDay>
        <TimelineDay label={yesterday.label} date={yesterday.date}>
          <TimelineItem marker="person" avatar="王佳宁" avatarKey="u03" title={<><b>王佳宁</b> 改了阶段 方案报价 → 商务谈判</>} time="17:20" />
          <TimelineItem marker="person" avatar="陈一鸣" avatarKey="u02" title={<><b>陈一鸣</b> 发送了报价单</>} time="15:05"
            attachments={<TimelineAttachment icon={<FileText />} onClick={() => notify("打开报价单", "info")}>报价单-v2.pdf · 1.2 MB</TimelineAttachment>} />
          <TimelineItem marker="result" result="success" title={<><b>合同审批通过</b> 金额 ¥128,000</>} time="11:48" />
          {older && <TimelineItem marker="system" title="客户由「线索」转为「已确认需求」" time="09:12" />}
        </TimelineDay>
      </Timeline>
      <TimelineMore count={older ? 0 : 6} onClick={() => setOlder(true)} />
    </div>
  );
}
