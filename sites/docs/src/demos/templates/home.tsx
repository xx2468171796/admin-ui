import { useMemo, useState } from "react";
import { BarChart3, BookOpen, Briefcase, CalendarClock, FileText, Headphones, Receipt, RefreshCw, Settings, TrendingUp, UserPlus, Users } from "lucide-react";
import {
  ActionList, Button, LiveStatus, PageBody, PageHeader, Panel, PresenceList, QuickLinks, SplitLayout, StatStrip, StatusBadge, TodoInbox,
  useNotify, type TodoItem,
} from "@adminui/react";

/** T01 工作台首页：指标带 → 左：待办 + 最近的操作；右栏 340：此刻在线 + 常用入口。 */
export function Demo() {
  const notify = useNotify();
  const now = useMemo(() => Date.now(), []);
  const go = (what: string) => () => notify(`打开「${what}」`);
  const [todos, setTodos] = useState<readonly TodoItem[]>(() => [
    { key: "follow", icon: <CalendarClock />, tone: "attention", title: "3 个客户今天该跟进", detail: "远航精密制造、青禾教育、星河物流——上次联系已超过 14 天", meta: "今天", filters: ["today"] },
    { key: "sla", icon: <Headphones />, tone: "danger", title: "工单 T-2041 已超出响应时限", detail: "星河物流 · 导入客户时手机号格式报错 · 超时 6 分钟", meta: "10:24", filters: ["today"] },
    { key: "invoice", icon: <Receipt />, tone: "attention", title: "2 张发票已逾期未付", detail: "云杉医疗 ¥48,000 · 启明零售 ¥126,500", meta: "3 天了", filters: ["today"] },
    { key: "seats", icon: <Users />, tone: "info", title: "海川金融科技的席位用了 96%", detail: "可以提醒客户成功经理沟通扩容", meta: "本周", filters: ["fyi"] },
  ]);
  const done = (key: string) => () => setTodos((list) => list.filter((t) => t.key !== key));
  const items = todos.map((t) => ({
    ...t,
    actions: [
      { key: "do", label: t.key === "invoice" ? "发催款提醒" : "去处理", primary: true, onSelect: done(t.key) },
      { key: "later", label: "稍后", onSelect: () => notify("已推迟到明天") },
    ],
  }));

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <PageHeader title="首页" />
      <PageBody>
        <StatStrip
          title="今天概况"
          description="和昨天比；点数字去对应页面。"
          actions={<><LiveStatus state="live" dataTime={now} /><Button size="sm" variant="outline" onClick={() => notify("已刷新")}><RefreshCw />刷新</Button></>}
          items={[
            { key: "mrr", label: "本月新签", icon: <TrendingUp />, value: "¥86.4", unit: "万", note: "比上月同期 +12%", noteTone: "brand" },
            { key: "deals", label: "进行中的商机", icon: <Briefcase />, value: 42, unit: "个", note: "谈判中 9 个" },
            { key: "tickets", label: "打开的工单", icon: <Headphones />, value: 17, unit: "个", note: "1 个已超时", noteTone: "danger" },
            { key: "overdue", label: "逾期发票", icon: <Receipt />, value: 2, unit: "张", tone: "attention", note: "合计 ¥174,500", noteTone: "attention" },
            { key: "renew", label: "续约率", icon: <RefreshCw />, value: "94", unit: "%", note: "近 90 天" },
            { key: "new", label: "本周新客户", icon: <UserPlus />, value: 8, unit: "家", note: "官网试用转化 5 家" },
          ]}
        />
        <SplitLayout
          rail={
            <>
              <PresenceList
                count="4 人"
                actions={<LiveStatus state="live" />}
                summary={[{ key: "web", label: "网页", value: 3 }, { key: "app", label: "手机", value: 1 }]}
                people={[
                  { key: "u05", name: "周可欣", hint: "客户成功 · 刚刚", status: <StatusBadge tone="success">在线</StatusBadge> },
                  { key: "u02", name: "陈一鸣", hint: "手机 · 5 分钟前", status: <StatusBadge tone="success">在线</StatusBadge> },
                  { key: "u07", name: "孙雨桐", hint: "财务 · 12 分钟前", status: <StatusBadge tone="neutral">离开</StatusBadge> },
                  { key: "bot", name: "工单助手", hint: "自动分配工单", bot: true, status: <StatusBadge tone="success">运行中</StatusBadge> },
                ]}
              />
              <Panel title="常用入口">
                <QuickLinks
                  items={[
                    { key: "c", label: "客户", icon: <Users />, onSelect: go("客户") },
                    { key: "d", label: "商机", icon: <Briefcase />, onSelect: go("商机") },
                    { key: "t", label: "工单", icon: <Headphones />, onSelect: go("工单") },
                    { key: "i", label: "发票", icon: <Receipt />, onSelect: go("发票") },
                    { key: "r", label: "报表", icon: <BarChart3 />, onSelect: go("报表") },
                    { key: "k", label: "知识库", icon: <BookOpen />, onSelect: go("知识库") },
                    { key: "n", label: "邀请成员", icon: <UserPlus />, onSelect: go("邀请成员") },
                    { key: "s", label: "设置", icon: <Settings />, onSelect: go("设置") },
                  ]}
                />
              </Panel>
            </>
          }
        >
          <TodoInbox
            description="要你处理或知道的事，最急的在上面；处理完自动消失。"
            filters={[{ key: "today", label: "今天" }, { key: "fyi", label: "知道一下" }]}
            items={items}
            ok={["续约提醒都已发出", "本周没有退款", "数据同步正常"]}
          />
          <Panel title="最近的操作" flush actions={<Button size="sm" variant="ghost" onClick={go("操作日志")}>全部日志 ›</Button>}>
            <ActionList
              dense
              label="最近的操作"
              items={[
                { key: "1", avatar: "林", title: <><strong>林晓</strong> 把「远航精密制造」推进到商务谈判</>, meta: "2 分钟前" },
                { key: "2", avatar: "助", bot: true, title: <><strong>工单助手</strong> 把 T-2045 分配给吴昊</>, meta: "6 分钟前" },
                { key: "3", avatar: "孙", title: <><strong>孙雨桐</strong> 开具发票 INV-20261008-007</>, meta: "18 分钟前" },
                { key: "4", avatar: "陈", title: <><strong>陈一鸣</strong> 新建客户「曜石半导体」</>, meta: "25 分钟前" },
                { key: "5", icon: <FileText />, title: <><strong>王佳宁</strong> 上传了合同「青禾教育 2027 续约」</>, meta: "41 分钟前" },
              ]}
            />
          </Panel>
        </SplitLayout>
      </PageBody>
    </div>
  );
}
