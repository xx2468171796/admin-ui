import { useMemo, useState } from "react";
import {
  AlignLeft, AtSign, Bell, Bot, Calculator, Calendar, CalendarClock, CircleChevronDown, Coins, ExternalLink, FileText, GitBranch,
  Hash, Link2, ListChecks, MapPin, MessageSquare, MousePointerClick, Paperclip, PenLine, Percent, Phone, Search, Sigma, SquareCheck,
  Star, Table2, TrendingUp, Type, User, UserPen, UserPlus, Users,
} from "lucide-react";
import {
  ActivityFeed, AttachmentGallery, Button, CellTags, Choice, CommentThread, CompactTable, DescriptionList, FieldDialog, GrantList,
  PageBody, PageHeader, Panel, Rating, SensitiveValue, SubTableSection, cleanOptions, patchComment, removeComment, toggleReaction, useNotify, useRecordDetail,
  type CommentDraft, type CommentItem, type FieldDraft, type FieldTypeTile, type GrantEntry, type MediaItem, type RecordLayout, type SubTableColumn,
} from "@adminui/react";
import type { GridField } from "@adminui/react/grid";
import { demoPhoto } from "./media-demo";
import { demoEdit, demoSave } from "./record-edit-demo";

// 记录与字段示例（样稿 D11 记录详情 + 子表 + 评论、D12 新建字段 + 谁能看 / 谁能改）。
// 数据都是演示：保存、留痕、上传、搜人由宿主接自己的接口，服务端照样鉴权、写审计。
type FieldType = "text" | "longText" | "number" | "singleSelect" | "multiSelect" | "date" | "user" | "checkbox" | "money" | "percent" | "phone" | "email" | "url" | "autoNumber" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt";
const TYPES: FieldTypeTile<FieldType>[] = [
  { label: "文本", icon: <Type />, value: "text" },
  { label: "数字", icon: <Calculator />, value: "number" },
  { label: "单选", icon: <CircleChevronDown />, value: "singleSelect", keywords: "select 下拉" },
  { label: "多选", icon: <ListChecks />, value: "multiSelect", keywords: "select 标签" },
  { label: "日期", icon: <Calendar />, value: "date" },
  { label: "人员", icon: <User />, value: "user" },
  { label: "复选框", icon: <SquareCheck />, value: "checkbox" },
  { label: "附件", icon: <Paperclip />, later: "等文件存储（下一阶段）" },
  { label: "子表", icon: <Table2 />, later: "B3" },
  { label: "关联", icon: <Link2 />, later: "B3" },
  { label: "公式", icon: <Sigma />, later: "B3" },
  { label: "查找引用", icon: <Search />, later: "B3" },
  { label: "评分", icon: <Star />, later: "B3" },
  { label: "进度", icon: <TrendingUp />, later: "B3" },
  { label: "货币", icon: <Coins />, value: "money" },
  { label: "电话", icon: <Phone />, value: "phone" },
  { label: "邮箱", icon: <AtSign />, value: "email" },
  { label: "超链接", icon: <ExternalLink />, value: "url" },
  { label: "自动编号", icon: <Hash />, value: "autoNumber" },
  { label: "流程", icon: <GitBranch />, later: "接自动化之后" },
  { label: "按钮", icon: <MousePointerClick />, later: "接自动化之后" },
  { label: "创建人", icon: <UserPlus />, value: "createdBy" },
  { label: "创建时间", icon: <CalendarClock />, value: "createdAt" },
  { label: "修改人", icon: <UserPen />, value: "updatedBy" },
  { label: "多行文本", icon: <AlignLeft />, value: "longText" },
  { label: "百分比", icon: <Percent />, value: "percent" },
  { label: "地理位置", icon: <MapPin />, later: "以后" },
  { label: "签名", icon: <PenLine />, later: "以后" },
  { label: "AI 字段", icon: <Bot />, later: "以后" },
];
const OPTION_TYPES: FieldType[] = ["singleSelect", "multiSelect"];
const freshDraft = (): FieldDraft<FieldType> => ({
  name: "客户质量",
  type: "singleSelect",
  options: [{ id: "o1high", label: "高", tone: "green" }, { id: "o2mid0", label: "中", tone: "yellow" }, { id: "o3low0", label: "低", tone: "gray" }],
  allowCreate: true,
  description: "运营根据通话和询价内容判断，分配前必填",
});
const CANDIDATES = [
  { id: "g-ops", name: "运营组", hint: "运营部 · 4 人", kind: "group" as const },
  { id: "u-a", name: "小A", hint: "运营，只负责智能家居线" },
  { id: "r-ops", name: "运营", hint: "限智能家居、效果图专员", kind: "role" as const },
  { id: "u-c", name: "阿杰", hint: "销售 · 上海" },
  { id: "d-tech", name: "技术部", hint: "6 人", kind: "dept" as const },
];
const LEVELS = [{ value: "read", label: "可读" }, { value: "write", label: "可读写" }, { value: "manage", label: "管理" }];

function FieldDialogDemo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(freshDraft);
  const [grants, setGrants] = useState<GrantEntry[]>([{ id: "g-ops", level: "write" }, { id: "u-a", level: "read" }, { id: "r-ops", level: "write" }]);
  const [defaultOption, setDefaultOption] = useState("o2mid0");
  const named = cleanOptions(draft.options);
  return (
    <>
      <Button onClick={() => setOpen(true)}>新建字段</Button>
      <FieldDialog<FieldType>
        open={open}
        onClose={() => setOpen(false)}
        value={draft}
        onChange={setDraft}
        types={TYPES}
        optionTypes={OPTION_TYPES}
        existingNames={["客户名称", "阶段", "负责人", "手机"]}
        help="字段建好后，表头菜单里还能改名、改类型、改权限。"
        footerNote="以后在表头菜单「字段权限」里还能改"
        settings={draft.type === "money" ? <Choice label="币种" value="CNY" onChange={() => undefined} options={[{ value: "CNY", label: "人民币 ¥" }, { value: "USD", label: "美元 US$" }]} /> : undefined}
        defaultValue={
          draft.type === "singleSelect" ? (
            <Choice label="默认值" value={named.some((o) => o.id === defaultOption) ? defaultOption : "none"} onChange={setDefaultOption}
              options={[{ value: "none", label: "没有默认值" }, ...named.map((o) => ({ value: o.id, label: o.label }))]} />
          ) : <span className="aui-note">这个类型先不设默认值</span>
        }
        asideHelp="字段级权限只决定这一列能不能看、能不能改；能看哪些记录按表的行权限。"
        aside={
          <GrantList
            mode="picked"
            subjects={CANDIDATES}
            value={grants}
            onChange={setGrants}
            levels={LEVELS}
            label="字段授权"
            lockedNote={<>默认：<b>你（运营 小B）</b>和<b>你的上级（运营主管 郑主管）</b>可看可改，子公司管理员也能看。上级的权限不能关掉。</>}
            locked={[{ id: "me", name: "小B", hint: "你 · 可读写" }, { id: "boss", name: "郑主管", hint: "上级 · 可读写" }, { id: "admin", name: "子公司管理员", kind: "role", hint: "可读写" }]}
            title="再给下级或其他角色授权"
            levelsHint="可读 / 可读写 / 管理（能再分给别人）"
            audience={{ hidden: { count: 9, names: ["销售", "组长", "主管", "林经理"], groups: ["销售", "经理"] }, readers: { count: 3 + grants.length + 1, names: ["小B", "郑主管", ...grants.map((g) => CANDIDATES.find((c) => c.id === g.id)?.name ?? g.id), "管理员"] } }}
            audienceText={{ where: `表格、详情、导出、筛选里都不会出现「${draft.name || "这个字段"}」。`, scopeNote: "只决定这一列能不能看；能看哪些客户照旧按行权限。" }}
          />
        }
        onSubmit={async (d) => {
          await new Promise((r) => setTimeout(r, 300));
          if (d.name.includes("失败")) throw new Error("保存失败：网络中断，请重试");
          notify(`已新建字段「${d.name}」，授权 ${grants.length} 个对象`, "success");
          setOpen(false);
          setDraft(freshDraft());
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- D11 记录详情

type FollowUp = { id: string; at: string; who: { name: string }[]; way: string; text: string; files: number; next: string };
const FOLLOW_UPS: FollowUp[] = [
  { id: "f1", at: "10-05 14:20", who: [{ name: "小王" }], way: "visit", text: "带 KNX 面板样品到府，客户确认客厅、主卧做场景面板，书房改无线开关；太太希望窗帘能接 Apple Home", files: 3, next: "10-09 送修改版报价" },
  { id: "f2", at: "10-03 19:05", who: [{ name: "小王" }], way: "line", text: "客户传来平面图，问能不能在大门加装人脸辨识门锁", files: 1, next: "10-05 出平面配置图" },
  { id: "f3", at: "10-01 10:30", who: [{ name: "陈主管" }], way: "call", text: "陪同电话回访，客户对预算有顾虑，建议分两期施工", files: 0, next: "10-03 拆成两期报价" },
  { id: "f4", at: "09-27 15:00", who: [{ name: "小王" }], way: "visit", text: "现场丈量 4 房 2 厅，拍了配电箱和弱电箱", files: 3, next: "10-01 出初版方案" },
];
const FOLLOW_FIELDS: GridField<FollowUp>[] = [
  { key: "at", title: "时间", type: "text", primary: true, width: 100 },
  { key: "who", title: "跟进人", type: "user", width: 96 },
  { key: "way", title: "方式", type: "singleSelect", width: 80, options: [{ value: "visit", label: "上门", tone: "teal" }, { value: "line", label: "LINE", tone: "green" }, { value: "call", label: "电话", tone: "blue" }] },
  { key: "text", title: "内容", type: "longText" },
  { key: "files", title: "图片 / 视频", type: "number", width: 96, precision: 0 },
  { key: "next", title: "下一步", type: "text", width: 160 },
];

type Customer = { id: string; name: string; phone: string; amount: string; deal: string; last: string; next: string };
const CUSTOMER: Customer = { id: "c6", name: "李承恩（滨江豪宅）", phone: "139-****-5781", amount: "¥2,180,000", deal: "¥2,050,000", last: "2026-10-05", next: "2026-10-09" };
// 第二条：上一条 / 下一条切换时，上一条查看过的明文不能留在这一条的方块上。
const CUSTOMER_2: Customer = { id: "c7", name: "王美玲（徐汇公寓）", phone: "136-****-2456", amount: "¥860,000", deal: "¥820,000", last: "2026-10-03", next: "2026-10-10" };
const PLAIN_PHONE: Record<string, string> = { c6: "139-1234-5781", c7: "136-2222-2456" };
const ago = (m: number) => new Date(Date.parse("2026-10-05T07:30:00Z") - m * 60_000).toISOString();
const FIRST_COMMENTS: CommentItem[] = [
  { id: "m1", author: { id: "u-zhou", name: "周组长" }, createdAt: ago(28), body: "@小王 客户说周六想看样品间，记得带 KNX 面板和窗帘电机样品", mentions: [{ id: "u-wang", name: "小王" }], reactions: [{ key: "ok", count: 2 }],
    replies: [{ id: "m1r", author: { id: "u-wang", name: "小王" }, createdAt: ago(20), body: "约好周六 10 点，样品间照片先发给客户看了", attachments: [{ id: "p1", name: "样品间-客厅.jpg", kind: "image" }, { id: "p2", name: "样品间-主卧.jpg", kind: "image" }] }] },
  { id: "m2", author: { id: "u-chen", name: "陈主管" }, createdAt: ago(60 * 21), body: "报价单 v2 我看过了，折扣最多 6%，再多要找 @林经理", mentions: [{ id: "u-lin", name: "林经理" }] },
  { id: "m3", author: { id: "u-a", name: "小A" }, createdAt: ago(60 * 40), body: "客户电话已核实，不是重复进线", resolved: true, resolvedBy: "小B" },
  // 自己（小B）的评论：「⋯」里能编辑 / 删除；有回复的删掉后留「评论已删除」墓碑。
  { id: "m4", author: { id: "me", name: "小B" }, createdAt: ago(60 * 46), editedAt: ago(60 * 45), body: "报价单 v1 已发给客户，@陈主管 帮忙看下折扣", mentions: [{ id: "u-chen", name: "陈主管" }],
    replies: [{ id: "m4r", author: { id: "u-wang", name: "小王" }, createdAt: ago(60 * 44), body: "收到，明天给意见" }] },
];
const ME_ID = "me";
const PEOPLE = [{ id: "u-wang", name: "小王", hint: "销售 · 负责人" }, { id: "u-ming", name: "阿明", hint: "技术 · 安装" }, { id: "u-lin", name: "林经理", hint: "智能家居线" }, { id: "u-chen", name: "陈主管", hint: "销售主管" }];
const ASSIGN = [
  { id: "a1", at: "2026-09-12T02:02:00Z", what: "运营 小B 收到进线", detail: "官网表单 · 已查重，无重复" },
  { id: "a2", at: "2026-09-12T02:05:00Z", what: "小B → 智能家居线 · 林经理", detail: "运营分配" },
  { id: "a3", at: "2026-09-12T06:30:00Z", what: "林经理 → 陈主管", detail: "按地区：上海" },
  { id: "a4", at: "2026-09-13T01:10:00Z", what: "陈主管 → 小王（当前负责人）", detail: "原因：滨江区由小王负责" },
];

// 就地编辑的字段（RecordField.edit）：和多维表格同一套字段定义
const EDIT_FIELDS: Record<string, GridField<{ id: string } & Record<string, unknown>>> = {
  amount: { key: "amount", title: "预计金额", type: "text" },
  quality: { key: "quality", title: "客户质量", type: "singleSelect", options: [{ value: "A", label: "A 高意向", tone: "green" }, { value: "B", label: "B 观望", tone: "yellow" }, { value: "C", label: "C 低", tone: "gray" }] },
  installDate: { key: "installDate", title: "安装日期", type: "date" },
  note: { key: "note", title: "备注", type: "longText" },
};

function useCustomerLayout(): RecordLayout<Customer> {
  const notify = useNotify();
  // 演示：改过的值按记录存在这里（真实项目是服务端）
  const [patch, setPatch] = useState<Record<string, Record<string, unknown>>>({});
  const read = (c: Customer, key: string): unknown => patch[c.id]?.[key] ?? (c as Record<string, unknown>)[key] ?? null;
  const editOf = (key: string) => (c: Customer) => demoEdit(EDIT_FIELDS[key]!, c.id, read(c, key), demoSave((value) => setPatch((all) => ({ ...all, [c.id]: { ...all[c.id], [key]: value } }))));
  const label = (key: string, value: unknown) => EDIT_FIELDS[key]?.options?.find((o) => o.value === value)?.label ?? (value === null || value === "" ? null : String(value));
  // 演示图片用色卡现画（真实项目是服务端给的地址）。
  const [comments, setComments] = useState<CommentItem[]>(() => FIRST_COMMENTS.map((c) => ({ ...c, replies: c.replies?.map((r) => ({ ...r, attachments: r.attachments?.map((a, i) => ({ ...a, url: demoPhoto(i), thumbUrl: demoPhoto(i) })) })) })));
  const [columns, setColumns] = useState<SubTableColumn[]>(FOLLOW_FIELDS.map((f) => ({ key: f.key, label: f.title, visible: true, locked: f.primary })));
  const photos = useMemo<MediaItem[]>(() => [
    { id: "s1", name: "客厅.jpg", kind: "image", url: demoPhoto(0), thumbUrl: demoPhoto(0) },
    { id: "s2", name: "配电箱.jpg", kind: "image", url: demoPhoto(1), thumbUrl: demoPhoto(1) },
    { id: "s3", name: "现场走一圈.mp4", kind: "video", duration: 42 },
    { id: "s4", name: "报价单 v2.pdf", kind: "pdf" },
    { id: "s5", name: "平面图.pdf", kind: "pdf" },
    { id: "s6", name: "弱电箱.jpg", kind: "image" },
    { id: "s7", name: "门锁.jpg", kind: "image" },
  ], []);
  const send = async (d: CommentDraft) => {
    await new Promise((r) => setTimeout(r, 200));
    if (d.body.includes("失败")) throw new Error("发送失败：网络中断，文字已保留");
    const item: CommentItem = { id: `m${Date.now()}`, author: { id: "me", name: "小B" }, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions, attachments: d.attachments };
    setComments((all) => (d.replyTo ? all.map((c) => (c.id === d.replyTo ? { ...c, replies: [...(c.replies ?? []), item] } : c)) : [item, ...all]));
  };
  // 宿主自己的接口：服务端核对作者、写 editedAt；有回复的删除留墓碑（deleted: true）。
  const edit = async (id: string, body: string, mentions: CommentItem["mentions"], extra: { attachments: MediaItem[] }) => {
    await new Promise((r) => setTimeout(r, 200));
    if (body.includes("失败")) throw new Error("保存失败：网络中断，改动已保留");
    setComments((all) => patchComment(all, id, (c) => ({ ...c, body, mentions, attachments: extra.attachments, editedAt: new Date().toISOString() })));
  };
  const remove = async (id: string) => {
    await new Promise((r) => setTimeout(r, 200));
    setComments((all) => removeComment(all, id, { tombstone: Boolean(all.find((c) => c.id === id)?.replies?.length) }));
    notify("评论已删除", "success");
  };
  return {
    title: (c) => c.name,
    avatar: () => "李",
    status: () => ({ label: "报价", tone: "warning" }),
    tags: () => ["智能家居业务线"],
    crumb: "客户 / 全部客户",
    sections: [
      {
        key: "profile", title: "客户资料", icon: <FileText />, progress: true, hiddenFields: () => 2, columns: 2,
        fields: [
          { key: "phone", label: "手机", icon: <Phone />, value: (c) => c.phone, copy: true, mono: true, tel: () => "13912345781",
            reveal: async (c) => { await new Promise((r) => setTimeout(r, 150)); notify("已记录：小B 查看了「手机」", "info"); return PLAIN_PHONE[c.id] ?? ""; } },
          { key: "region", label: "地区 · 来源", icon: <MapPin />, value: () => <CellTags items={[{ label: "上海", tone: "blue" }, { label: "转介绍", tone: "teal" }]} />, text: () => "上海 转介绍" },
          { key: "amount", label: "预计金额", icon: <Coins />, value: (c) => read(c, "amount") as string, edit: editOf("amount") },
          { key: "quality", label: "客户质量", icon: <Star />, value: (c) => label("quality", read(c, "quality")), edit: editOf("quality") },
          { key: "deal", label: "成交价", icon: <Coins />, value: (c) => c.deal, hint: "比预计少 6%", action: () => ({ label: "修改成交价", onSelect: () => notify("打开表单，定位到成交价", "info") }) },
          { key: "last", label: "最后跟进", icon: <Calendar />, value: (c) => c.last, hint: "今天 · 共 9 次", edit: () => null, lockedReason: "按跟进记录自动算，不能手改" },
          { key: "next", label: "下次跟进", icon: <Bell />, value: (c) => c.next, tone: () => "attention", hint: "4 天后",
            actions: () => [{ label: "提醒我", icon: <Bell />, onSelect: () => notify("到时提醒你", "success") }] },
          { key: "intent", label: "意向", icon: <Star />, value: () => <Rating label="意向" value={5} />, text: () => "5 星" },
          { key: "files", label: "现场资料", icon: <Paperclip />, full: true, text: () => "7 个文件",
            value: () => <AttachmentGallery label="现场资料" mode="strip" items={photos} maxVisible={4} onAdd={() => notify("宿主打开文件选择", "info")} addHint="拖文件到这里上传" /> },
          { key: "installDate", label: "安装日期", icon: <Calendar />, value: (c) => label("installDate", read(c, "installDate")), edit: editOf("installDate") },
          { key: "installer", label: "安装负责人", value: () => null },
          { key: "note", label: "备注", icon: <AlignLeft />, value: (c) => label("note", read(c, "note")), edit: editOf("note") },
        ],
      },
      {
        key: "follow", title: "跟进记录",
        block: () => (
          <SubTableSection title="跟进记录" icon={<MessageSquare />} total={9} shown={4} note="子表 · 能看这个客户的人就能看"
            onOpenInTable={() => notify("打开「跟进记录」表，筛选到这个客户", "info")} columns={columns} onColumnsChange={setColumns}
            onAdd={() => notify("新增一条跟进", "info")} addLabel="添加跟进" onViewAll={() => notify("打开全部 9 条", "info")}>
            <CompactTable caption="跟进记录" rows={FOLLOW_UPS} getRowId={(r) => r.id} fields={FOLLOW_FIELDS} columns={columns.filter((c) => c.visible).map((c) => c.key)} expandRecord={false} />
          </SubTableSection>
        ),
      },
    ],
    aside: [
      {
        key: "comments", title: "评论",
        block: () => (
          <CommentThread comments={comments} onSend={send} searchMentions={(q) => PEOPLE.filter((p) => p.name.includes(q))}
            canEdit={(c) => c.author.id === ME_ID} canDelete={(c) => c.author.id === ME_ID} onEdit={edit} onDelete={remove}
            onReact={(id, key) => setComments((all) => patchComment(all, id, (c) => ({ ...c, reactions: toggleReaction(c.reactions, key) })))}
            onResolve={(id, resolved) => setComments((all) => all.map((c) => (c.id === id ? { ...c, resolved, resolvedBy: resolved ? "小B" : undefined } : c)))}
            onUpload={async (files) => files.map((f, i) => ({ id: `up${Date.now()}${i}`, name: f.name, size: f.size, mime: f.type }))} />
        ),
      },
      {
        key: "assign", title: "分配记录", icon: <Users />,
        render: () => <ActivityFeed caption="分配记录" items={ASSIGN} getId={(a) => a.id} time={(a) => a.at} title={(a) => a.what} description={(a) => a.detail} groupByDay={false} />,
      },
    ],
    actions: () => [
      { key: "follow", label: "已关注", primary: true, keepOpen: true, onSelect: () => notify("取消关注", "info") },
      { key: "share", label: "分享", primary: true, onSelect: () => notify("打开分享", "info") },
      { key: "copy", label: "复制链接", onSelect: () => notify("已复制链接", "success") },
    ],
  };
}

export function RecordsShowcase() {
  const notify = useNotify();
  const layout = useCustomerLayout();
  const detail = useRecordDetail<Customer>({ rows: [CUSTOMER, CUSTOMER_2], rowKey: (c) => c.id, layout, defaultLevel: "expanded" });
  const [shares, setShares] = useState<GrantEntry[]>([{ id: "u-c", level: "read" }]);
  return (
    <>
      <PageHeader title="记录与字段" description="样稿 D11（记录详情：子表、评论、看不到的字段、留痕查看）和 D12（新建字段 + 谁能看 / 谁能改）。" actions={<FieldDialogDemo />} />
      <PageBody>
        <Panel title="记录详情（D11）" description="字段方块上可以有多个小按钮：留痕查看、拨打、复制、修改；子表和评论用 RecordSection.block 放进详情。">
          <Button variant="outline" onClick={() => detail.open(CUSTOMER.id)}>打开 李承恩（滨江豪宅）</Button>
          {detail.element}
        </Panel>
        <Panel title="留痕查看与授权名单" description="打码的值点「查看」时宿主记录谁看过，30 秒后自动打码；GrantList 列表模式就是原来的 SharePicker。">
          <DescriptionList columns={2} items={[
            { label: "手机（文字按钮）", value: <SensitiveValue masked="138-****-8000" label="手机" onReveal={async () => { notify("已记录：查看了手机", "info"); return "138-0013-8000"; }} remaskAfter={10_000} /> },
            { label: "身份证（图标按钮）", value: <SensitiveValue masked="A12*****89" label="身份证" variant="icon" onReveal={async () => { throw new Error("你没有查看身份证的权限"); }} /> },
          ]} />
          <GrantList subjects={CANDIDATES} value={shares} onChange={setShares} levels={[{ value: "read", label: "可看" }, { value: "secret", label: "可看密码" }]} label="分享给" />
        </Panel>
      </PageBody>
    </>
  );
}
