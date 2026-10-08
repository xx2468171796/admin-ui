import { useState, type ReactNode } from "react";
import { Building2, Check, Database, Mail, Plus, Search, Share2, Ticket, Wallet } from "lucide-react";
import {
  Button, ChatMessage, ChatThread, Composer, DescriptionList, InfoList, InlineAlert, LoadingDots, Meter, PageHeader, Pane, PaneSection,
  SearchField, SelectList, StatusBadge, ToolCallCard, WorkspaceLayout, useNotify,
} from "@adminui/react";

const CHATS = [
  { key: "risk", group: "今天", title: "星河物流续约风险", hint: "要给客户发续约提醒吗？", meta: "10:31" },
  { key: "qbr", group: "今天", title: "青禾教育季度回顾提纲", hint: "已整理 5 个要点", meta: "09:12", unreadCount: 2 },
  { key: "seats", group: "今天", title: "海川金融科技扩容建议", hint: "建议增购 20 席", meta: "08:45", unread: true },
  { key: "churn", group: "昨天", title: "上月流失客户原因汇总", hint: "价格 3 家、功能 2 家", meta: "17:20" },
  { key: "faq", group: "昨天", title: "单点登录常见问题整理", hint: "已写进知识库", meta: "11:02" },
  { key: "nps", group: "更早", title: "9 月 NPS 回访分析", hint: "推荐者 61%", meta: "9-28" },
];
type Msg = { id: number; mine: boolean; body: ReactNode };

/** T10 工具 / 工作区页：页面不滚；左 240 对话列表 | 中间对话（自己滚，底部输入框）| 右 280 上下文。手机上先列表、点进对话。 */
export function Demo() {
  const notify = useNotify();
  const [chat, setChat] = useState<string | null>("risk");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [extra, setExtra] = useState<readonly Msg[]>([]);
  const title = CHATS.find((c) => c.key === chat)?.title ?? "新对话";

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setExtra((list) => [...list, { id: list.length, mine: true, body }]);
    setText("");
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setExtra((list) => [...list, { id: list.length, mine: false, body: "好的，我把这条也记进客户跟进记录了。" }]);
    }, 900);
  };

  return (
    <div style={{ height: 680, overflow: "auto", background: "var(--aui-canvas)" }}>
      <PageHeader title="客户成功助手" />
      <WorkspaceLayout
        narrow="steps"
        detailOpen={open}
        onBack={() => setOpen(false)}
        left={
          <Pane label="对话列表" header={<SearchField size="sm" value={q} onChange={setQ} placeholder="搜对话" />} actions={<Button size="sm" onClick={() => notify("新对话")}><Plus />新对话</Button>}>
            <SelectList label="对话" selected={chat} onSelect={(k) => { setChat(k); setOpen(true); }} items={CHATS.filter((c) => !q || `${c.title}${c.hint}`.includes(q))} />
          </Pane>
        }
        right={
          <Pane title="当前客户" padding="sm">
            <PaneSection title="星河物流" icon={<Building2 />}>
              <DescriptionList columns={2} items={[{ label: "套餐", value: "专业版" }, { label: "到期", value: "11-30" }, { label: "席位", value: "48 / 50" }, { label: "健康度", value: <StatusBadge tone="warning">偏低</StatusBadge> }]} />
            </PaneSection>
            <PaneSection title="可用工具" icon={<Database />} count="4 个">
              <InfoList label="可用工具" items={[
                { key: "c", icon: <Search />, label: "查询客户", value: "用了 1 次" },
                { key: "t", icon: <Ticket />, label: "查询工单", value: "用了 1 次" },
                { key: "m", icon: <Mail />, label: "发送邮件", value: "要确认" },
                { key: "i", icon: <Wallet />, label: "查询发票", value: "只读" },
              ]} />
            </PaneSection>
            <PaneSection title="本月额度" icon={<Wallet />}>
              <Meter label="已用" ratio={0.31} detail="¥31 / ¥100" />
            </PaneSection>
          </Pane>
        }
      >
        <Pane
          title={title}
          count={<StatusBadge tone="brand">助手 · 只读工具</StatusBadge>}
          actions={<Button size="sm" variant="ghost" onClick={() => notify("已复制分享链接")}><Share2 />分享</Button>}
          footer={<Composer value={text} onChange={setText} onSend={send} placeholder="接着问，或让助手查数据、起草邮件…" />}
        >
          <ChatThread>
            <ChatMessage author="周可欣" mine time="10:28">星河物流下个月到期，帮我看看续约有没有风险。</ChatMessage>
            <ChatMessage author="客户成功助手" avatar="助" bot time="10:31 · 用了 2 个工具">
              <p>先看这家客户最近的使用和工单。</p>
              <ToolCallCard icon={<Search />} title="查询客户 · 星河物流 · 近 30 天活跃" status={<StatusBadge tone="success">完成 0.6 秒</StatusBadge>} defaultOpen>
                {"活跃席位 31 / 48（上月 42）\n最近登录：管理员 3 天前\n使用最多：工单、报表"}
              </ToolCallCard>
              <ToolCallCard icon={<Ticket />} title="查询工单 · 星河物流 · 未解决" status={<StatusBadge tone="success">完成 0.4 秒</StatusBadge>}>
                {"T-2043 报表导出 Excel 中文乱码 · 等客户回复 · 6 天"}
              </ToolCallCard>
              <p>活跃席位一个月掉了 26%，还有一个报表工单拖了 6 天，续约有风险。建议先解决工单，再约一次回顾会。</p>
              <InlineAlert tone="warning" title="要给客户管理员发续约提醒邮件吗？">
                <p>会用你的名义发到客户管理员邮箱，附上本季度使用报告。</p>
                <p><Button size="sm" onClick={() => notify("邮件已发出")}><Check />发送</Button> <Button size="sm" variant="outline" onClick={() => notify("已取消")}>先不发</Button></p>
              </InlineAlert>
            </ChatMessage>
            {extra.map((m) => (m.mine
              ? <ChatMessage key={m.id} author="周可欣" mine time="刚刚">{m.body}</ChatMessage>
              : <ChatMessage key={m.id} author="客户成功助手" avatar="助" bot time="刚刚">{m.body}</ChatMessage>))}
            {thinking && <LoadingDots label="助手正在回复" />}
          </ChatThread>
        </Pane>
      </WorkspaceLayout>
    </div>
  );
}
