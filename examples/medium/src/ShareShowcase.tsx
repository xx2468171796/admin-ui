import { useRef, useState } from "react";
import { CalendarDays, Coins, ExternalLink, FileText, Paperclip, Phone, Rows3, Share2, Star, TextCursorInput, User, CircleDot, History } from "lucide-react";
import {
  Button,
  CellHistoryPopover,
  GrantList,
  PageBody,
  PageHeader,
  Panel,
  QuickLinks,
  ShareAccessLog,
  ShareDialog,
  ShareManager,
  SideSheet,
  applySharePolicy,
  randomPin,
  useNotify,
  type CellHistoryScope,
  type GrantEntry,
  type ShareFieldChoice,
  type ShareGrant,
  type ShareKind,
  type ShareSettings,
  type ShareState,
} from "@adminui/react";
import { ACCESS_LOG, CELL_VERSIONS, RECORD_VERSIONS, SHARE_ITEMS, SHARE_POLICY, SHARE_SETTINGS, SHARE_STATS, demoNow } from "./share-demo";

// 分享套件示例（样稿 D20 分享弹窗、D22 我的分享 + 访问记录、D25 单元格修改历史；公开页 D21 / D21m / D21s 在独立地址打开）。
// 分享链接、密码、次数、访问记录都由服务端（fenxiang）管；这里用内存里的数据和延迟模拟保存。
const FIELDS: ShareFieldChoice[] = [
  { key: "name", label: "客户名称", icon: <TextCursorInput /> },
  { key: "stage", label: "阶段", icon: <CircleDot /> },
  { key: "owner", label: "负责人", icon: <User /> },
  { key: "intent", label: "意向", icon: <Star /> },
  { key: "amount", label: "预计金额", icon: <Coins /> },
  { key: "phone", label: "手机", icon: <Phone />, masked: true },
  { key: "files", label: "现场资料", icon: <Paperclip /> },
  { key: "next", label: "下次跟进", icon: <CalendarDays />, editable: true },
  { key: "note", label: "备注", icon: <FileText />, editable: true },
  { key: "source", label: "来源", icon: <CircleDot />, editable: true },
  { key: "region", label: "地区", icon: <CircleDot /> },
  { key: "last", label: "最后跟进", icon: <CalendarDays /> },
  { key: "followups", label: "跟进", icon: <Rows3 /> },
  { key: "price", label: "成交价", icon: <Coins />, forbidden: "成交价由管理员禁止对外" },
];
const PEOPLE = [
  { id: "u1", name: "佳慧", hint: "设计部" },
  { id: "u2", name: "阿明", hint: "安装组" },
  { id: "g1", name: "上海安装组", hint: "6 人", group: true },
  { id: "u3", name: "林经理", hint: "智能家居线" },
];
const SHARE_LEVELS = [
  { value: "view", label: "只能看" },
  { value: "comment", label: "可评论" },
  { value: "edit", label: "可编辑" },
];
// 知识库「页面权限」那样的名单：四档、负责人锁住、改了立刻生效（演示：第一次给「可管理」会失败，重试就好）
const PAGE_LEVELS = [
  { value: "view", label: "可查看" },
  { value: "comment", label: "可评论" },
  { value: "edit", label: "可编辑" },
  { value: "manage", label: "可管理" },
];
const OWNER = { id: "me", name: "小王", tag: "负责人", hint: "销售一组 · 默认能管，去不掉", level: "manage" };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 公开页的地址：#share-public=visitor / password / secret（在新标签打开，外面没有后台外壳）。 */
export const publicHref = (kind: "visitor" | "password" | "secret") => `#share-public=${kind}`;

export function ShareShowcase() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ShareSettings>(() => applySharePolicy(SHARE_SETTINGS, SHARE_POLICY, FIELDS, () => randomPin(4), demoNow()).settings);
  const [paused, setPaused] = useState(false);
  const [people, setPeople] = useState<ShareGrant[]>([{ id: "u1", level: "view" }]);
  const [page, setPageGrants] = useState<GrantEntry[]>([{ id: "u2", level: "view" }, { id: "g1", level: "edit" }]);
  const failed = useRef({ expiry: false, manage: false });
  const [logOpen, setLogOpen] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  // 改了立刻保存（onApply）：演示第一次选「30 天」时网络中断 → 改回原值、底栏写原因 + 重试
  const apply = async (next: ShareSettings) => {
    await wait(400);
    if (next.expiryPreset === "30d" && !failed.current.expiry) {
      failed.current.expiry = true;
      throw new Error("网络中断");
    }
  };

  // D22 我的分享
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ShareKind | "all">("all");
  const [status, setStatus] = useState<ShareState>("active");
  const [expanded, setExpanded] = useState<string | null>("s1");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState(SHARE_ITEMS);
  const shown = items.filter((i) => i.state === status && (kind === "all" || i.kind === kind) && (!search || `${i.title} ${i.subtitle ?? ""}`.includes(search)));

  // D25 单元格历史
  const cell = useRef<HTMLButtonElement>(null);
  const [history, setHistory] = useState(false);
  const [scope, setScope] = useState<CellHistoryScope>("cell");
  const [versions, setVersions] = useState(CELL_VERSIONS);

  const log = (
    <ShareAccessLog
      events={ACCESS_LOG}
      blockedIps={blocked}
      onExport={() => notify("已开始导出访问记录（CSV）", "info")}
      onBlockIp={async (event) => {
        await new Promise((r) => setTimeout(r, 300));
        setBlocked((list) => [...list, event.ip]);
        notify(`已封 ${event.ip}，这个 IP 再打开只会看到「链接已失效」`, "success");
      }}
    />
  );

  return (
    <>
      <PageHeader title="分享与历史" description="对外分享（D20 弹窗、D21 访客页、D21m 密码门、D21s 一次性密钥、D22 我的分享）和单元格修改历史（D25）。数据和保存都是演示，服务端规则见架构 §5.9。" />
      <PageBody>
        <Panel
          title="分享弹窗与公开页"
          description="点「分享记录」打开分享弹窗：改任何设置都立即保存；公司策略要求对外必须设密码、最长 30 天，所以密码开关锁住、「永久」划线。公开页在独立地址打开，外面没有后台外壳。"
          actions={<Button size="sm" onClick={() => setOpen(true)}><Share2 />分享记录</Button>}
        >
          <QuickLinks
            columns={3}
            label="公开页"
            items={[
              { key: "visitor", label: "访客页（D21）", icon: <ExternalLink />, href: publicHref("visitor") },
              { key: "password", label: "密码门（D21m）", icon: <ExternalLink />, href: publicHref("password") },
              { key: "secret", label: "一次性密钥（D21s）", icon: <ExternalLink />, href: publicHref("secret") },
            ]}
          />
        </Panel>
        <ShareManager
          stats={SHARE_STATS}
          items={shown.slice((pageNo - 1) * pageSize, pageNo * pageSize)}
          total={shown.length}
          page={pageNo}
          pageSize={pageSize}
          onPageChange={setPageNo}
          onPageSizeChange={(s) => { setPageSize(s); setPageNo(1); }}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPageNo(1); }}
          kind={kind}
          onKindChange={(k) => { setKind(k); setPageNo(1); }}
          status={status}
          onStatusChange={(s) => { setStatus(s); setPageNo(1); }}
          counts={{ active: items.filter((i) => i.state === "active").length, paused: items.filter((i) => i.state === "paused").length, void: items.filter((i) => i.state === "void").length + 31 }}
          expanded={expanded}
          onExpandedChange={setExpanded}
          renderLog={(item) => (item.id === "s1" ? log : <ShareAccessLog events={[]} />)}
          onCopyLink={(item) => notify(`已复制「${item.title}」的链接`, "success")}
          onEdit={() => setOpen(true)}
          onExtend={(item) => setItems((list) => list.map((i) => (i.id === item.id && i.expiresAt ? { ...i, expiresAt: i.expiresAt + 7 * 24 * 3_600_000 } : i)))}
          extendLabel={() => "延长 7 天"}
          onPausedChange={(item, p) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, state: p ? "paused" : "active" } : i)))}
          onReshare={(item) => notify(`按「${item.title}」的设置新建了一条分享`, "success")}
          onVoid={async (item) => {
            await new Promise((r) => setTimeout(r, 300));
            setItems((list) => list.map((i) => (i.id === item.id ? { ...i, state: "void" } : i)));
            notify(`已作废「${item.title}」的链接`, "success");
          }}
          policyNote="公司要求：对外必须设密码，最长 30 天"
          now={demoNow}
        />
        <Panel title="页面权限（授权名单 · 改了立刻生效）" description="知识库「页面权限」用的就是它：GrantList picked + apply=instant，没有保存按钮；负责人锁住；第一次给「可管理」会演示保存失败（改回原值、行内写原因 + 重试）。">
          <GrantList
            mode="picked"
            label="页面权限"
            subjects={PEOPLE}
            value={page}
            onChange={setPageGrants}
            levels={PAGE_LEVELS}
            levelPicker="menu"
            locked={[OWNER]}
            addPlaceholder="添加人、部门或角色"
            summary={<>共 <b>{page.length + 1}</b> 个人或组能看这个页面</>}
            apply="instant"
            onApply={async (change) => {
              await wait(400);
              if (change.type === "level" && change.level === "manage" && !failed.current.manage) {
                failed.current.manage = true;
                throw new Error("只有空间管理员能给「可管理」");
              }
            }}
          />
        </Panel>
        <Panel title="单元格修改历史" description="D25：在格子上右键「修改历史」或点格子角标打开；表格接线由多维表格负责，这里用一个按钮代替格子。">
          <Button ref={cell} variant="outline" onClick={() => setHistory(true)} aria-label="黄淑芬的预计金额 ¥480,000，查看修改历史">
            黄淑芬 · 预计金额：¥480,000
            <History />
          </Button>
        </Panel>
      </PageBody>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title="李承恩（滨江豪宅）"
        objectLabel="客户记录"
        objectIcon={<Rows3 />}
        meta="小王 10-05 创建 · 改了立刻生效"
        link={{ url: "https://app.example.com/s/Kp7xQ2", token: "Kp7xQ2" }}
        settings={settings}
        onChange={setSettings}
        onApply={apply}
        fields={FIELDS}
        policy={SHARE_POLICY}
        people={{
          subjects: PEOPLE,
          value: people,
          onChange: setPeople,
          levels: SHARE_LEVELS,
          locked: [{ id: "me", name: "小王", tag: "负责人", hint: "销售一组 · 默认能看，去不掉", level: "edit" }],
          summary: <>共 <b>{people.length + 1}</b> 人能打开{people.some((p) => p.id === "u2") ? " · 阿明看不到「预计金额」（他的角色没这个字段）" : ""}</>,
        }}
        opened={3}
        paused={paused}
        onPausedChange={setPaused}
        onVoid={async () => {
          await new Promise((r) => setTimeout(r, 300));
          setOpen(false);
          notify("链接已作废", "success");
        }}
        onOpenLog={() => setLogOpen(true)}
        logCount={ACCESS_LOG.length}
        onPreview={() => window.open(publicHref("visitor"), "_blank")}
        previewText="记录卡片 · 9 个字段 · 附件可预览、可下载"
        passwordHint="连错 3 次要过滑块验证；密码和链接分开发更安全"
        notifyHint="站内通知 + LINE"
        qrMark="A"
        now={demoNow}
      />
      <SideSheet open={logOpen} onClose={() => setLogOpen(false)} title="访问记录 · 李承恩（滨江豪宅）" width="xl">
        {log}
      </SideSheet>
      <CellHistoryPopover
        open={history}
        onClose={() => setHistory(false)}
        anchor={cell.current}
        subject="黄淑芬 · 预计金额"
        versions={scope === "cell" ? versions : RECORD_VERSIONS}
        scope={scope}
        onScopeChange={setScope}
        onRestore={async (v) => {
          await new Promise((r) => setTimeout(r, 300));
          setVersions((list) => [{ ...v, id: `v${list.length + 1}`, at: demoNow(), actor: { name: "我" }, source: "restore", opId: "OP-20261005-0160", before: list[0]?.after ?? null, note: "恢复到之前的版本", current: true }, ...list.map((x) => ({ ...x, current: false }))]);
          notify(`已恢复成 ${String(v.after)}`, "success");
        }}
        retentionNote="保留 180 天，超过 3 天的版本也能在这里逐条恢复"
        onOpenLog={() => notify("打开操作记录（D23）", "info")}
      />
    </>
  );
}
