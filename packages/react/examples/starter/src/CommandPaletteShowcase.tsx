// 命令面板（Ctrl / ⌘ K）样板。
// 一个假顶栏放触发器；三个提供者：客户（快）、文档（400ms）、记录（故意 2.5 秒，演示「较慢，回车看全部」）；
// 命令 = 菜单页面 + 新建客户 N / 写跟进 F / 切换公司 / 外观 D；搜不到给 新建客户「q」。
// 本页打开时，这个面板接管 Ctrl / ⌘ K（顶栏全局面板让出，见 main.tsx）。
import { useState } from "react";
import { BookOpen, FileText, NotebookPen, UserPlus, UserRound } from "lucide-react";
import {
  CommandPalette,
  Panel,
  navCommands,
  pushRecent,
  type AdminCommand,
  type CommandItem,
  type CommandProvider,
} from "@adminui/react";

const CUSTOMERS = [
  { id: "c1", title: "赵静怡", subtitle: "谈判 · 上海 徐汇 · 小王", keywords: "13800138000" },
  { id: "c2", title: "林冠宇", subtitle: "报价 · 杭州 西湖 · 李佳蓉", keywords: "13922113456" },
  { id: "c3", title: "陈雅婷", subtitle: "首通 · 杭州 滨江 · 小王", keywords: "13933765432" },
  { id: "c4", title: "郭依林", subtitle: "首通 · 上海 静安 · 王小明", keywords: "13955246810" },
  { id: "c5", title: "孙佳宁", subtitle: "需求确认 · 南京 鼓楼 · 李佳蓉", keywords: "13966135790" },
  { id: "c6", title: "林志豪", subtitle: "报价 · 苏州 姑苏 · 小王", keywords: "13977864209" },
  { id: "c7", title: "黄柏翰", subtitle: "成交 · 广州 天河 · 王小明", keywords: "13988753124" },
  { id: "c8", title: "王淑芬", subtitle: "谈判 · 深圳 南山 · 李佳蓉", keywords: "13910246357" },
].map((c) => ({ ...c, meta: "智能家居客户", kind: "customer", href: `/crm/customers/${c.id}` }));
const DOCS = [
  { id: "d1", title: "报价折扣规则（2026 版）", meta: "销售手册" },
  { id: "d2", title: "桂林七星门市 · 样品清单", meta: "门市资料" },
  { id: "d3", title: "智能门锁安装与售后", meta: "培训课程" },
  { id: "d4", title: "桂林门市排班表", meta: "门市资料" },
].map((d) => ({ ...d, kind: "doc", href: `/kb/${d.id}` }));
const RECORDS = [
  { id: "r1", title: "赵静怡 · 电话回访", subtitle: "10/03 · 小王", meta: "跟进记录" },
  { id: "r2", title: "林冠宇 · 报价单 Q-2026-118", subtitle: "10/02 · 李佳蓉", meta: "报价" },
  { id: "r3", title: "陈雅婷 · 到店体验", subtitle: "09/28 · 小王", meta: "跟进记录" },
].map((r) => ({ ...r, kind: "record", href: `/records/${r.id}` }));

/** Every query word appears in title / subtitle / keywords (the real server matches with its own indexes and permissions). */
const matches = (item: CommandItem, q: string) =>
  q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => `${item.title} ${item.subtitle ?? ""} ${item.keywords ?? ""}`.toLowerCase().includes(w));
const after = <T,>(ms: number, value: T, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
const fakeSearch = (items: readonly CommandItem[], ms: number): CommandProvider["search"] => (q, { signal, limit }) =>
  after(ms, items.filter((i) => matches(i, q)).slice(0, limit), signal);

const PROVIDERS: readonly CommandProvider[] = [
  { id: "customers", label: "客户", icon: <UserRound />, search: fakeSearch(CUSTOMERS, 60) },
  { id: "docs", label: "文档", icon: <BookOpen />, search: fakeSearch(DOCS, 400) },
  { id: "records", label: "记录", icon: <FileText />, search: fakeSearch(RECORDS, 2500) },
];
const PAGES = [
  { id: "smart-home", title: "智能家居客户", group: "多维表格" },
  { id: "board", title: "经营看板", group: "仪表盘" },
  { id: "today", title: "我的今天", group: "仪表盘" },
  { id: "kb", title: "知识库", group: "菜单" },
];

export function CommandPaletteShowcase({ enabled = true }: { enabled?: boolean }) {
  const [result, setResult] = useState("还没有操作");
  const [recent, setRecent] = useState<readonly CommandItem[]>(() => [
    ...CUSTOMERS.slice(0, 1).map((c) => ({ ...c, source: "customers" })),
    { id: "nav:smart-home", title: "智能家居客户", meta: "多维表格", kind: "page", source: "command" },
    { id: "nav:board", title: "经营看板", meta: "仪表盘", kind: "page", source: "command" },
  ]);
  const commands: AdminCommand[] = navCommands(PAGES, (id) => setResult(`打开页面：${PAGES.find((p) => p.id === id)?.title}`), [
    { id: "new-customer", label: "新建客户", shortcut: "n", keywords: "添加 客户", run: () => setResult("执行：新建客户") },
    { id: "follow-up", label: "写跟进", shortcut: "f", keywords: "跟进 记录", run: () => setResult("执行：写跟进") },
    { id: "switch-company", label: "切换公司", keywords: "公司 租户", run: () => setResult("执行：切换公司") },
    { id: "appearance", label: "外观", shortcut: "d", keywords: "深色 浅色 主题", run: () => setResult("执行：外观") },
    {
      id: "export",
      label: "导出当前视图",
      keywords: "下载 excel",
      run: () => Promise.reject(new Error("演示：导出失败，没有导出权限")),
    },
  ]);
  return (
    <section id="ov-command">
      <Panel
        title="搜索与命令（Ctrl / ⌘ K）"
        description="点顶栏的搜索框或按 Ctrl / ⌘ K；打「林」「报价」「新建」「漠河」试试。↑↓ 选、↵ 打开、Tab 换范围、Esc 关闭。「记录」故意 2.5 秒才回来。"
      >
        <div style={BAR}>
          <span style={CRUMB}>
            工作空间 / <b style={{ color: "var(--aui-text)", fontWeight: 600 }}>多维表格</b>
          </span>
          <span style={{ flex: 1 }} />
          <CommandPalette
            enabled={enabled}
            commands={commands}
            providers={PROVIDERS}
            recent={recent}
            onSelect={(item, providerId) => {
              setRecent((list) => pushRecent(list, { ...item, icon: undefined, source: providerId }));
              setResult(`打开：${item.title}（${PROVIDERS.find((p) => p.id === providerId)?.label ?? providerId}）→ ${item.href ?? ""}`);
            }}
            onSearchAll={(q, providerId) => setResult(`全部搜索页：「${q}」${providerId ? `，只看${PROVIDERS.find((p) => p.id === providerId)?.label}` : ""}`)}
            emptyActions={(q) => [
              { id: `new:${q}`, title: `新建客户「${q}」`, icon: <UserPlus />, run: () => setResult(`执行：新建客户「${q}」`) },
              { id: `note:${q}`, title: `写一条备忘「${q}」`, icon: <NotebookPen />, run: () => setResult(`执行：写备忘「${q}」`) },
            ]}
          />
        </div>
        <p role="status" data-cmdk-result="" style={{ margin: "12px 0 0", color: "var(--aui-secondary)", fontSize: 13 }}>
          结果：{result}
        </p>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--aui-note)", fontSize: 12.5, lineHeight: 1.8 }}>
          <li>没输入：「最近」+「常用」（带单键快捷键的命令：新建客户 N、写跟进 F、外观 D）。</li>
          <li>
            输入后按 客户 / 文档 / 记录 / 页面 / 命令 分组，每组 ≤ 5 条；提供者各限时 800ms，超时显示「较慢，回车看全部」。
          </li>
          <li>「导出当前视图」演示命令失败：面板不关，行内报错。</li>
        </ul>
      </Panel>
    </section>
  );
}

const BAR = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 52,
  padding: "0 12px 0 16px",
  border: "1px solid var(--aui-line)",
  borderRadius: 12,
  background: "var(--aui-surface)",
} as const;
const CRUMB = { color: "var(--aui-note)", fontSize: 13 } as const;
