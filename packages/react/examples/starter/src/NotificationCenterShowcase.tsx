// 通知中心（顶栏铃铛 + 面板 +「待我处理」）样板。数据是假的异步接口（300–600ms），
// 演示：被 @、分配客户、导出完成带「下载」、权限申请同意 / 拒绝（拒绝先写原因）、停用交接确认、两页「加载更多」、
// 「模拟加载失败」「清空待办」看出错和空状态、「来一条新通知」走 refreshKey。
import { useRef, useState } from "react";
import { AlarmClock, AtSign, Download, GraduationCap, Lock, MessageSquare, Search, Tag as TagIcon, TriangleAlert, UserCheck, Users } from "lucide-react";
import {
  Button,
  Kbd,
  NotificationCenter,
  Panel,
  Switch,
  useNotify,
  type InboxAction,
  type InboxItem,
  type NotificationItem,
  type NotificationPage,
} from "@adminui/react";

const MIN = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN);
const daysAgo = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const wait = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 300 + Math.round(Math.random() * 300));
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

function seedNotifications(): NotificationItem[] {
  return [
    { id: "n1", actor: { id: "u-wang", name: "王小明" }, kindIcon: <AtSign />, mention: true, read: false, createdAt: ago(10), source: "智能家居客户", title: <><b>王小明</b> 在「赵静怡」的评论里提到了你</>, quote: "@李佳蓉 客户周六来看样品，能不能帮忙留一套 K7 展示机？" },
    { id: "n2", actor: { id: "u-chen", name: "陈组长" }, kindIcon: <UserCheck />, read: false, createdAt: ago(62), source: "智能家居客户", title: <><b>陈组长</b> 把 3 位客户分配给你：<b>郭依琳</b>、<b>许家豪</b>、<b>蔡欣怡</b></> },
    { id: "n3", kindIcon: <AlarmClock />, tone: "attention", read: false, createdAt: daysAgo(0, 9), source: "跟进提醒", title: <><b>孙佳宁</b> 今天要跟进（约好 15:00 回电）</> },
    { id: "n4", kindIcon: <Download />, read: true, createdAt: daysAgo(0, 8, 41), source: "后台任务 · 7 天后链接失效", title: <><b>导出好了</b>：跟进记录 2026-10.xlsx（1,204 条）</>, actions: [{ key: "download", label: "下载" }] },
    { id: "n5", actor: { id: "u-huang", name: "黄志明" }, kindIcon: <TagIcon />, read: true, createdAt: daysAgo(1, 17, 20), source: "智能家居客户 · 陈组长改的", title: <>你关注的 <b>黄志明</b> 阶段改成「签约」</> },
    { id: "n6", kindIcon: <TriangleAlert />, tone: "attention", read: true, createdAt: daysAgo(1, 9), source: "公海规则", title: <><b>12 位客户</b> 2 天后退回公海</> },
    { id: "n7", actor: { id: "u-lin", name: "赵静怡" }, kindIcon: <MessageSquare />, read: true, createdAt: daysAgo(1, 8, 12), source: "知识库 · 售后话术", title: <><b>赵静怡</b> 回复了你的评论</>, quote: "门锁换电池的话术我补了两句，你看下可以吗？" },
    { id: "n8", kindIcon: <GraduationCap />, read: true, createdAt: daysAgo(4, 10), source: "培训", title: <>课程 <b>智能门锁安装与售后</b> 下周一截止，你还剩 2 章</> },
    // 第 2 页
    { id: "n9", actor: { id: "u-xu", name: "许家豪" }, kindIcon: <AtSign />, mention: true, read: false, createdAt: daysAgo(5, 15, 3), source: "CRM · 智能家居客户", title: <><b>许家豪</b> 在「季度复盘」里提到了你</>, quote: "@李佳蓉 华南区的数字麻烦周五前补一下。" },
    { id: "n10", actor: { id: "u-chen", name: "陈组长" }, kindIcon: <Users />, read: true, createdAt: daysAgo(6, 11), source: "团队", title: <><b>陈组长</b> 把你加进了「华南销售二组」</> },
    { id: "n11", kindIcon: <Lock />, read: true, createdAt: daysAgo(9, 10), source: "账号安全", title: <>你的账号在 <b>新设备</b> 上登录（Windows · 深圳）</> },
  ];
}
function seedInbox(): InboxItem[] {
  const reject: InboxAction = { key: "reject", label: "拒绝", needsReason: true, reasonRequired: true };
  return [
    { id: "i1", module: "access", moduleLabel: "权限申请", kind: "查看客户", requester: { id: "u-zhou", name: "周经理" }, createdAt: ago(35), title: <><b>周经理</b> 申请查看「华南 · 智能家居客户」</>, summary: "原因：帮华南区做季度复盘", actions: [{ key: "approve", label: "同意", tone: "primary" }, reject] },
    { id: "i2", module: "access", moduleLabel: "权限申请", kind: "导出", requester: { id: "u-cai", name: "蔡欣怡" }, createdAt: ago(130), title: <><b>蔡欣怡</b> 申请「客户导出」档位</>, summary: "原因：月底对账要导出跟进记录", actions: [{ key: "approve", label: "同意", tone: "primary" }, reject] },
    { id: "i3", module: "handover", moduleLabel: "停用交接", kind: "交接确认", requester: { id: "u-guo", name: "郭依琳" }, createdAt: daysAgo(1, 16, 40), title: <><b>郭依琳</b> 停用前把 <b>28 位客户</b> 交接给你</>, summary: "确认后这些客户的负责人改成你，跟进记录一起带过来", actions: [{ key: "accept", label: "确认接收", tone: "primary" }, { key: "decline", label: "退回", needsReason: true }] },
  ];
}

const PAGE = 8;

// 本页用 T05 分区合并页里的一块 Panel：上面一条假的顶栏，铃铛在「搜索与命令」右边。
export function NotificationCenterShowcase() {
  const notify = useNotify();
  const notes = useRef(seedNotifications());
  const inbox = useRef(seedInbox());
  const [unread, setUnread] = useState(() => notes.current.filter((n) => !n.read).length);
  const [waiting, setWaiting] = useState(() => inbox.current.length);
  const [fail, setFail] = useState(false);
  const [emptyInbox, setEmptyInbox] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const failRef = useRef(fail);
  failRef.current = fail;
  const sync = () => setUnread(notes.current.filter((n) => !n.read).length);

  const loadNotifications = async ({ cursor, filter, signal }: { cursor?: string | null; filter: "all" | "unread" | "mentions"; signal: AbortSignal }): Promise<NotificationPage<NotificationItem>> => {
    await wait(signal);
    if (failRef.current) throw new Error("通知服务暂时连不上，稍后再试");
    const all = notes.current.filter((n) => (filter === "unread" ? !n.read : filter === "mentions" ? n.mention : true));
    const start = cursor ? Number(cursor) : 0;
    const next = start + PAGE;
    return { items: all.slice(start, next), nextCursor: next < all.length ? String(next) : null };
  };
  const loadInbox = async ({ signal }: { cursor?: string | null; signal: AbortSignal }): Promise<NotificationPage<InboxItem>> => {
    await wait(signal);
    if (failRef.current) throw new Error("待办服务暂时连不上，稍后再试");
    return { items: emptyInbox ? [] : inbox.current, nextCursor: null };
  };

  return (
    <section id="ov-inbox">
      <Panel
        title="通知中心"
        description="顶栏「搜索与命令」右边的铃铛：红底数字 = 未读 + 待我处理（99+ 封顶）。点开 420 宽面板，标签「通知」（全部 / 未读 / @我，按今天 / 昨天 / 更早分组）和「待我处理」（按模块分组，就地同意 / 拒绝）。点一条 = 标为已读并打开对应记录；手机上是整屏面板。"
        actions={
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Switch size="sm" checked={fail} onCheckedChange={setFail} aria-label="模拟加载失败" />
              模拟加载失败
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Switch
                size="sm"
                checked={emptyInbox}
                onCheckedChange={(next) => {
                  setEmptyInbox(next);
                  setWaiting(next ? 0 : inbox.current.length);
                  setRefreshKey((k) => k + 1);
                }}
                aria-label="清空待办"
              />
              清空待办
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const n = notes.current.length + 1;
                notes.current = [{ id: `new-${n}`, actor: { id: "u-chen", name: "陈组长" }, kindIcon: <UserCheck />, read: false, createdAt: new Date(), source: "智能家居客户", title: <><b>陈组长</b> 把客户 <b>吴佩珊</b> 分配给你</> }, ...notes.current];
                sync();
                setRefreshKey((k) => k + 1);
              }}
            >
              来一条新通知
            </Button>
          </div>
        }
      >
        <div
          data-demo="topbar"
          style={{ display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 12px 0 16px", border: "1px solid var(--aui-line)", borderRadius: "var(--aui-radius-lg)", background: "var(--aui-surface)" }}
        >
          <span style={{ color: "var(--aui-note)", fontSize: 13 }}>
            工作空间 / <b style={{ color: "var(--aui-text)", fontWeight: 600 }}>多维表格</b>
          </span>
          <span style={{ flex: 1 }} />
          <Button variant="outline" size="sm" onClick={() => notify("命令面板见下一块样板", "info")}>
            <Search aria-hidden="true" />
            搜索与命令
            <Kbd keys="Mod+K" />
          </Button>
          <NotificationCenter
            unreadCount={unread}
            inboxCount={waiting}
            mentions
            refreshKey={refreshKey}
            loadNotifications={loadNotifications}
            loadInbox={loadInbox}
            markRead={async (ids) => {
              await new Promise((r) => window.setTimeout(r, 150));
              notes.current = notes.current.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
              sync();
            }}
            markAllRead={async () => {
              await new Promise((r) => window.setTimeout(r, 300));
              notes.current = notes.current.map((n) => ({ ...n, read: true }));
              sync();
              notify("全部标为已读", "success");
            }}
            onNotificationAction={async (item, key) => {
              if (key !== "download") return;
              await new Promise((r) => window.setTimeout(r, 400));
              notify("开始下载「跟进记录 2026-10.xlsx」", "success");
              void item;
            }}
            onInboxAction={async (item, action, { reason }) => {
              await new Promise((r) => window.setTimeout(r, 500));
              if (failRef.current) throw new Error("没办成：审批服务暂时连不上，这条还在");
              inbox.current = inbox.current.filter((i) => i.id !== item.id);
              setWaiting(inbox.current.length);
              const who = item.requester?.name ?? "对方";
              notify(action.key === "approve" || action.key === "accept" ? `已${action.label}，${who} 会收到通知` : `已${action.label}${reason ? `（原因：${reason}）` : ""}`, "success");
            }}
            onOpen={(item, kind) => notify(kind === "inbox" ? "打开待办对应的记录（演示）" : `打开通知 ${item.id} 对应的记录（演示）`, "info")}
          />
        </div>
        <div data-demo="many" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "var(--aui-note)", fontSize: 13 }}>
          未读很多时角标封顶 99+：
          <NotificationCenter
            unreadCount={128}
            label="通知"
            loadNotifications={async ({ signal }) => {
              await wait(signal);
              return { items: [], nextCursor: null };
            }}
            markRead={async () => {}}
            markAllRead={async () => {}}
          />
        </div>
      </Panel>
    </section>
  );
}
