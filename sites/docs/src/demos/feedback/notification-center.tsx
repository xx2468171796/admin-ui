import { useState } from "react";
import { AtSign, FileDown, UserRoundPlus } from "lucide-react";
import { NotificationCenter, useNotify, type InboxItem, type NotificationItem } from "@adminui/react";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const START: NotificationItem[] = [
  { id: "n1", actor: { name: "陈一鸣" }, kindIcon: <AtSign />, mention: true, read: false, createdAt: ago(5), source: "客户 · 远航精密制造", title: <><b>陈一鸣</b> 在 <b>远航精密制造</b> 里提到了你</>, quote: "合同条款请法务再看一下第 7 条。" },
  { id: "n2", actor: { name: "林晓" }, kindIcon: <UserRoundPlus />, read: false, createdAt: ago(48), source: "客户", title: <><b>林晓</b> 把 <b>青禾教育</b> 分配给了你</> },
  { id: "n3", actor: { name: "系统" }, kindIcon: <FileDown />, read: true, createdAt: ago(60 * 26), source: "导出", title: "客户列表导出好了", actions: [{ key: "download", label: "下载" }] },
];
const INBOX: InboxItem[] = [
  { id: "i1", module: "access", moduleLabel: "权限申请", title: <><b>王佳宁</b> 申请查看「华东大客户」</>, summary: "跟进交接用，一周就好。", requester: { name: "王佳宁" }, createdAt: ago(30), actions: [{ key: "approve", label: "同意", tone: "primary" }, { key: "reject", label: "拒绝", tone: "danger", needsReason: true, reasonRequired: true }] },
];

/**
 * 通知中心：顶栏铃铛 + 未读数，点开 420 宽面板。数据全部来自宿主的加载函数（这里用内存假数据）。
 * 「待我处理」可以就地同意 / 拒绝。
 */
export function Demo() {
  const notify = useNotify();
  const [items, setItems] = useState(START);
  const [inbox, setInbox] = useState(INBOX);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
      <span className="aui-note">点右边的铃铛</span>
      <NotificationCenter
        unreadCount={unread}
        inboxCount={inbox.length}
        mentions
        loadNotifications={async ({ filter }) => {
          await wait(300);
          const list = items.filter((n) => (filter === "unread" ? !n.read : filter === "mentions" ? n.mention : true));
          return { items: list, nextCursor: null };
        }}
        markRead={async (ids) => setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))}
        markAllRead={async () => setItems((list) => list.map((n) => ({ ...n, read: true })))}
        loadInbox={async () => {
          await wait(300);
          return { items: inbox, nextCursor: null };
        }}
        onInboxAction={async (item, action) => {
          await wait(400);
          setInbox((list) => list.filter((i) => i.id !== item.id));
          notify(`已${action.label}`);
        }}
        onNotificationAction={() => notify("开始下载", "info")}
        onOpen={(item) => notify(`打开：${item.id}`, "info")}
      />
    </div>
  );
}
