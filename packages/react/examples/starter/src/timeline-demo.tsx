import { useState } from "react";
import { FileText, Phone, Plus, Shield, Users } from "lucide-react";
import {
  Button, LogTimeline, Panel, SelectList, StatusBadge, Timeline, TimelineAttachment, TimelineDay, TimelineItem, TimelineMore, dayHeading, useNotify,
  type SelectListItem,
  IconButton,
} from "@adminui/react";

// 一种时间线长相。宿主自己的跟进记录（CRM 跟进块）用 Timeline 积木拼，和 ActivityFeed / LogTimeline 同一个解剖：
// 人做的事 = 头像，系统的事 = 小圆点，结果 = 带 ✓ / ✕ / ! 的圆；标题「谁 + 做了什么 + 对象」，时间在右；附件是描边小卡。
const DAY = 86_400_000;
const key = (offset: number) => new Date(Date.now() - offset * DAY + 8 * 3_600_000).toISOString().slice(0, 10);

export function FollowUpTimelineDemo() {
  const notify = useNotify();
  const today = dayHeading(key(0));
  const yesterday = dayHeading(key(1));
  return (
    <Panel title="客户动态（Timeline 积木）" description="宿主自己的跟进记录用 Timeline + TimelineDay + TimelineItem 拼，长相和 ActivityFeed / LogTimeline 一样。">
      <Timeline label="赵静怡的跟进记录">
        <TimelineDay label={today.label} date={today.date}>
          <TimelineItem marker="person" avatar="小王" title={<><b>小王</b> LINE 跟进</>} time="10:42" timeTitle={`${key(0)} 10:42:10`}
            attachments={<TimelineAttachment icon={<FileText />} onClick={() => notify("打开附件", "info")}>赵静怡-全屋报价-v2.pdf · 1.2 MB</TimelineAttachment>}>
            客户说太太想先看样品，约周六下午到上海门市；报价单已发 PDF。
          </TimelineItem>
          <TimelineItem marker="person" avatar="小王" title={<><b>小王</b> 改了阶段 <StatusBadge tone="info">需求确认</StatusBadge> → <StatusBadge tone="warning">报价</StatusBadge></>} time="10:40" timeTitle={`${key(0)} 10:40:02`} />
          <TimelineItem marker="system" title="提醒：下次跟进是今天" time="09:00" />
        </TimelineDay>
        <TimelineDay label={yesterday.label} date={yesterday.date}>
          <TimelineItem marker="person" avatar="小王" title={<><b>小王</b> 电话跟进 · 3 分 40 秒</>} time="17:29"
            attachments={<TimelineAttachment icon={<Phone />} onClick={() => notify("播放录音", "info")}>通话录音 03:40 · AI 摘要已生成</TimelineAttachment>}>
            老屋翻新，主要想改照明和门锁；预算 25 万内，下周一给方案。
          </TimelineItem>
          <TimelineItem marker="person" avatar="陈组长" title={<><b>陈组长</b> 转交给 小王</>} time="17:28">小李这周请假，交给小王跟进。</TimelineItem>
          <TimelineItem marker="result" result="success" title={<><b>同步成功</b> 写入 LINE 客户档案</>} time="17:27" />
          <TimelineItem marker="system" title="客户从「官网表单」登记" time="17:20" />
        </TimelineDay>
      </Timeline>
      <TimelineMore count={9} onClick={() => notify("加载更早的跟进", "info")} />
    </Panel>
  );
}

const ROLES: SelectListItem[] = [
  ...["财务", "技术", "经理", "客服", "销售", "运营", "组长"].map((title, i) => ({ key: `r${i}`, group: "本公司", icon: <Users />, title, meta: String([0, 2, 1, 5, 6, 2, 2][i] ?? 0) })),
  { key: "admin", group: "内置角色 · 只读", icon: <Shield />, title: "子公司管理员", meta: "全部权限" },
  { key: "lead", group: "内置角色 · 只读", icon: <Shield />, title: "部门主管", meta: "3" },
];
const CHATS: SelectListItem[] = [
  { key: "lin", group: "未读", avatar: "怡", title: "赵静怡", hint: "好的，我先跟太太讨论报价单再回复你", meta: "10:42", unreadCount: 3 },
  { key: "cai", group: "未读", avatar: "宇", title: "蔡冠宇", hint: "民宿的密码锁可以远程改吗？", meta: "10:15", unreadCount: 1 },
  { key: "zhang", group: "全部", avatar: "宁", title: "孙佳宁", hint: "[图片]", meta: "09:58" },
  { key: "wang", group: "全部", avatar: "妤", title: "王思妤", hint: "家庭剧院那套影音方案还有优惠吗", meta: "昨天" },
  { key: "zheng", group: "全部", avatar: "雯", title: "郑雅雯", hint: "别墅三楼要不要另外拉网线", meta: "昨天" },
];

export function SelectListDemo() {
  const notify = useNotify();
  const [role, setRole] = useState<string | null>("r4");
  const [chat, setChat] = useState<string | null>("lin");
  return (
    <Panel title="选择列表（SelectList）" description="行 36px（两行 52、手机 44）；选中 = 浅底 + 加粗；图标不套圆底；未读 = 加粗 + 数量；搜索高亮、搜不到可新建；加载骨架行。">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <SelectList label="角色" search="搜角色" items={ROLES} selected={role} onSelect={setRole} onCreate={(q) => notify(`新建角色「${q}」`, "success")} createLabel="新建这个角色"
          toolbar={<IconButton label="新建角色" variant="outline" onClick={() => notify("新建角色", "info")} icon={<Plus />} />} />
        <SelectList label="LINE 会话" search="搜客户、LINE 名称" items={CHATS} selected={chat} onSelect={setChat} />
        <SelectList label="加载中的列表" search="搜角色" items={[]} selected={null} onSelect={() => undefined} loading />
      </div>
    </Panel>
  );
}

export function LogTimelineStatesDemo() {
  return (
    <Panel title="操作记录：空 / 加载" description="空状态居中在卡片里；首次加载是 44px 行形状的骨架。" flush>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <LogTimeline caption="角色变更记录" items={[]} getId={() => ""} time={() => null} actor={() => ({ name: "" })} text={() => ""}
          emptyLabel="还没有变更记录" emptyHint="改了这个角色的权限后，这里会按时间列出谁改了什么。" />
        <LogTimeline caption="本公司审计" items={[]} getId={() => ""} time={() => null} actor={() => ({ name: "" })} text={() => ""} loading />
      </div>
    </Panel>
  );
}
