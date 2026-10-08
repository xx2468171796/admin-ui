import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarDays,
  Clipboard,
  ClipboardPaste,
  Copy,
  CornerDownRight,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Folder,
  FolderPlus,
  History,
  Info,
  Layers,
  Link2,
  ListPlus,
  Lock,
  Maximize2,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Share2,
  Snowflake,
  Star,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  User,
  Wallet,
  X,
  Columns3,
  PanelRight,
  PanelBottom,
} from "lucide-react";
import {
  AvatarStack,
  BottomSheet,
  Button,
  Choice,
  CellTags,
  CodeInput,
  CompactTable,
  ContextMenu,
  Countdown,
  DescriptionList,
  Input,
  MenuButton,
  MoneyDisplay,
  NumberStepper,
  OPTION_HUE_LABELS,
  OPTION_HUES,
  OptionSwatchPicker,
  PageBody,
  PageHeader,
  Panel,
  PopoverPanel,
  Rating,
  SideSheet,
  SortableList,
  SplitButton,
  StatStrip,
  Textarea,
  Watermark,
  useNotify,
  type MenuSection,
  type OptionTone,
  IconButton,
  MoreMenu,
} from "@adminui/react";
import type { GridField } from "@adminui/react/grid";

// 基础部件（bt/foundations）：照多维表格样稿 D01 / D02 / D03 / D05 / D06 / D12 / D20 / D21 / D21m / D21s 摆的真实内容。

type Customer = { id: string; name: string; stage: string; owner: string; phone: string; intent: number; expected: number };
const STAGES = [
  { value: "first", label: "首通", tone: "green" as const },
  { value: "quote", label: "报价", tone: "yellow" as const },
  { value: "install", label: "安装", tone: "teal" as const },
  { value: "won", label: "成交", tone: "greenSolid" as const },
  { value: "lost", label: "流失", tone: "gray" as const },
];
const customers: Customer[] = [
  { id: "c1", name: "陈雅婷", stage: "first", owner: "小王", phone: "138-****-8000", intent: 4, expected: 38000000 },
  { id: "c2", name: "林志明", stage: "first", owner: "小李", phone: "135-****-0112", intent: 3, expected: 26000000 },
  { id: "c3", name: "张家豪（徐汇区别墅）", stage: "quote", owner: "阿杰", phone: "188-****-6430", intent: 5, expected: 126000000 },
  { id: "c4", name: "李承恩（滨江豪宅）", stage: "won", owner: "美华", phone: "139-****-5781", intent: 5, expected: 237900000 },
];
// 金额值是「分」；precision 0 = 只显示到元（CN¥2,379,000）。
const fields: GridField<Customer>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES },
  { key: "owner", title: "负责人", type: "user" },
  { key: "phone", title: "手机", type: "text" },
  { key: "intent", title: "意向", type: "custom", text: (row) => `${row.intent} 星`, render: (row) => <Rating value={row.intent} label="意向" /> },
  { key: "expected", title: "预计金额", type: "money", currency: "CN¥", precision: 0 },
];

type FieldNode = { id: string; title: string; icon: ReactNode; locked?: boolean; hidden?: boolean; children?: FieldNode[] };
const FIELD_TREE: FieldNode[] = [
  { id: "name", title: "客户名称", icon: <User />, locked: true },
  { id: "stage", title: "阶段", icon: <Layers /> },
  { id: "owner", title: "负责人", icon: <User /> },
  { id: "intent", title: "意向", icon: <Star /> },
  { id: "contact", title: "联系方式", icon: <Folder />, children: [
    { id: "phone", title: "手机", icon: <Phone /> },
    { id: "region", title: "地区", icon: <Layers /> },
    { id: "source", title: "来源", icon: <Layers /> },
  ] },
  { id: "money", title: "金额", icon: <Folder />, children: [
    { id: "expected", title: "预计金额", icon: <Wallet /> },
    { id: "deal", title: "成交价", icon: <Wallet /> },
  ] },
  { id: "last", title: "最后跟进", icon: <CalendarDays /> },
  { id: "install", title: "安装日期", icon: <CalendarDays />, hidden: true },
  { id: "installer", title: "安装负责人", icon: <User />, hidden: true },
];

type OptionRow = { id: string; label: string; tone: OptionTone };

function cellMenu(count: number): MenuSection[] {
  return [
    { items: [
      { key: "copy", label: "复制", icon: <Clipboard />, shortcut: "Ctrl+C" },
      { key: "paste", label: "粘贴", icon: <ClipboardPaste />, shortcut: "Ctrl+V" },
    ] },
    { items: [
      { key: "above", label: "向上插入记录", icon: <ArrowUpNarrowWide />, shortcut: "Ctrl+Shift+Enter" },
      { key: "below", label: "向下插入记录", icon: <ArrowDownWideNarrow />, shortcut: "Shift+Enter" },
      { key: "dup", label: "复制记录", icon: <Copy /> },
    ] },
    { items: [
      { key: "expand", label: "展开记录", icon: <Maximize2 />, shortcut: "Ctrl+E" },
      { key: "share", label: "分享记录", icon: <Share2 /> },
      { key: "link", label: "复制记录链接", icon: <Link2 /> },
      { key: "history", label: "查看修改历史", icon: <History /> },
      { key: "child", label: "添加子记录", icon: <CornerDownRight />, disabled: true, disabledReason: "这张表没有开启子记录" },
      { key: "comment", label: "添加评论", icon: <MessageSquare /> },
    ] },
    { items: [{ key: "delete", label: "删除所选 {count} 条记录", count, icon: <Trash2 />, danger: true }] },
  ];
}
const headerMenu: MenuSection[] = [
  { items: [
    { key: "edit", label: "修改字段", icon: <Pencil />, hint: "双击表头" },
    { key: "describe", label: "编辑字段说明", icon: <Info /> },
  ] },
  { items: [
    { key: "left", label: "向左插入字段", icon: <ArrowLeftToLine /> },
    { key: "right", label: "向右插入字段", icon: <ArrowRightToLine /> },
    { key: "dup", label: "复制字段", icon: <Copy /> },
  ] },
  { items: [
    { key: "hide", label: "隐藏字段", icon: <EyeOff /> },
    { key: "freeze", label: "冻结至此列", icon: <Snowflake /> },
  ] },
  { items: [
    { key: "asc", label: "升序", icon: <ArrowUpNarrowWide />, hint: "0 → 9" },
    { key: "desc", label: "降序", icon: <ArrowDownWideNarrow />, hint: "9 → 0" },
    { key: "filter", label: "按此字段筛选", icon: <Filter /> },
    { key: "group", label: "按此字段分组", icon: <Layers /> },
  ] },
  { items: [
    { key: "acl", label: "字段权限", icon: <Lock />, hint: "谁能看 / 改" },
    { key: "fgroup", label: "加入字段编组", icon: <Folder />, items: [
      { title: "字段编组", items: [
        { key: "g-contact", label: "联系方式", icon: <Folder /> },
        { key: "g-money", label: "金额", icon: <Folder />, checked: true },
      ] },
      { items: [{ key: "g-new", label: "新建字段编组…", icon: <FolderPlus /> }] },
    ] },
  ] },
  { items: [{ key: "delete", label: "删除字段", icon: <Trash2 />, danger: true }] },
];

export function FoundationsShowcase() {
  const notify = useNotify();
  const say = (text: string) => () => notify(text, "info");
  const withNotify = (sections: MenuSection[]): MenuSection[] =>
    sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, onSelect: i.items ? undefined : say(`点了「${i.label.replace("{count}", String(i.count ?? ""))}」`), items: i.items ? withNotify([...i.items]) : undefined })) }));
  const [tree, setTree] = useState(FIELD_TREE);
  const fieldButton = useRef<HTMLButtonElement>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [options, setOptions] = useState<OptionRow[]>([
    { id: "high", label: "高", tone: "green" },
    { id: "mid", label: "中", tone: "yellow" },
    { id: "low", label: "低", tone: "gray" },
  ]);
  const [intent, setIntent] = useState<number | null>(4);
  const [opens, setOpens] = useState<number | null>(20);
  const [pin, setPin] = useState("7K2");
  const [pinError, setPinError] = useState<string | undefined>();
  const [toneValue, setToneValue] = useState<OptionTone>("teal");
  const [sheet, setSheet] = useState<"side" | "bottom" | null>(null);
  const [fallback, setFallback] = useState("sales");
  const [deadline] = useState(() => Date.now() + 52_000);
  const [claimUntil] = useState(() => Date.now() + 4 * 60_000 + 59_000);
  const hiddenCount = tree.flatMap((n) => [n, ...(n.children ?? [])]).filter((n) => !n.children && n.hidden).length;
  const fieldCount = tree.flatMap((n) => [n, ...(n.children ?? [])]).filter((n) => !n.children).length;
  const toggleHidden = (id: string) =>
    setTree((old) => old.map((n) => (n.id === id ? { ...n, hidden: !n.hidden } : n.children ? { ...n, children: n.children.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)) } : n)));
  const cellSections = useMemo(() => (target: Element) => (target.closest("tbody tr") ? withNotify(cellMenu(3)) : null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="基础部件" description="菜单、弹出面板、拖动排序、选项 7 色、小部件和侧边 / 底部弹层；照多维表格样稿摆的真实内容。" />
      <PageBody>
        <Panel
          title="客户"
          count="右键任意一行"
          description="右键单元格出现单元格菜单（D02）；表头「预计金额」的菜单（D03）、看板列 ⋯（D06）和「添加记录 ▾」（D01）用同一个 Menu。"
          actions={
            <>
              <MenuButton label="预计金额" sections={withNotify(headerMenu)} align="start" variant="outline" size="sm">
                <Wallet />预计金额
              </MenuButton>
              <MoreMenu label="「报价」列操作" sections={withNotify([
                { items: [
                  { key: "fold", label: "折叠此列", icon: <Columns3 /> },
                  { key: "color", label: "列颜色", icon: <Layers />, items: [{ items: OPTION_HUES.map((t) => ({ key: t, label: OPTION_HUE_LABELS[t], checked: t === "yellow" })) }] },
                  { key: "hide", label: "隐藏此列", icon: <EyeOff /> },
                ] },
                { items: [{ key: "del", label: "删除选项「报价」", icon: <Trash2 />, danger: true, disabled: true, disabledReason: "还有 8 条记录在这一列" }] },
              ])} icon={<ListPlus />} />
              <SplitButton
                label="添加记录"
                icon={<Plus />}
                onClick={say("添加了一条记录")}
                sections={withNotify([{ items: [
                  { key: "form", label: "用表单添加", icon: <FileSpreadsheet /> },
                  { key: "import", label: "从 Excel 导入", icon: <FileSpreadsheet /> },
                  { key: "copy", label: "复制上一条", icon: <Copy /> },
                ] }])}
              />
            </>
          }
          flush
        >
          <ContextMenu label="单元格菜单" sections={cellSections}>
            <CompactTable rows={customers} getRowId={(row) => row.id} fields={fields} caption="客户" expandRecord={false} />
          </ContextMenu>
        </Panel>

        <Panel
          title="选项"
          count={`${options.length} 个选项`}
          description="拖 ⠿ 调顺序（或在把手上按 Alt + 上 / 下），点色块换颜色（D12）。颜色只有 7 种，跟着色卡和深色模式走。"
          actions={
            <>
              <Button ref={fieldButton} variant="ghost" size="sm" aria-haspopup="dialog" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((v) => !v)}>
                <Columns3 />字段配置
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOptions((o) => [...o, { id: `o${o.length + 1}`, label: `选项 ${o.length + 1}`, tone: "blue" }])}>
                <Plus />添加选项
              </Button>
            </>
          }
        >
          <SortableList
            label="选项顺序"
            items={options}
            itemLabel={(o) => o.label}
            onChange={(next) => setOptions(next)}
            renderItem={(o) => (
              <>
                <OptionSwatchPicker label={`选项「${o.label}」的颜色`} value={o.tone} sample={o.label} onChange={(tone) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, tone } : x)))} />
                <Input aria-label="选项名" value={o.label} onChange={(e) => { const label = e.currentTarget.value; setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, label } : x))); }} />
                <CellTags items={[{ label: o.label || "（空）", tone: o.tone }]} />
                <IconButton label={`删除选项「${o.label}」`} onClick={() => setOptions((all) => all.filter((x) => x.id !== o.id))} icon={<X />} />
              </>
            )}
          />
          <PopoverPanel
            open={fieldsOpen}
            anchor={fieldButton.current}
            onClose={(back) => { setFieldsOpen(false); if (back) fieldButton.current?.focus(); }}
            title="字段配置"
            help="拖动调整字段顺序；客户名称是主字段，固定在第一列。"
            headerExtra={`显示 ${fieldCount - hiddenCount} / ${fieldCount}`}
            footer={<><Button variant="ghost" size="sm"><Plus />新建字段</Button><Button variant="ghost" size="sm"><FolderPlus />新建字段编组</Button></>}
          >
            <SortableList
              dense
              label="字段顺序"
              items={tree}
              itemLabel={(n) => n.title}
              lockedHint="主字段固定在第一列"
              onChange={(next) => setTree(next)}
              renderGroup={(g, s) => (<>{g.icon}<b>{g.title}</b><small className="aui-note">{s.count} 个字段</small></>)}
              renderItem={(n) => (
                <>
                  {n.icon}
                  <span>{n.title}</span>
                  {n.locked && <small className="aui-note">主字段</small>}
                  <IconButton label={`${n.hidden ? "显示" : "隐藏"}「${n.title}」`} style={{ marginLeft: "auto" }} disabled={n.locked} onClick={() => toggleHidden(n.id)} icon={n.hidden ? <EyeOff /> : <Eye />} />
                </>
              )}
            />
          </PopoverPanel>
        </Panel>

        <Panel title="选项颜色" description="10 色：绿（主色）、青、蓝、紫、粉、红、橙、黄、橄榄、灰，都从当前色卡算；每色还有一个实心（只给最重要的一个值）。旧的 7 色名（brand / warning …）一一对上新色，其他任意颜色一律显示灰。">
          <CellTags label="10 种颜色" items={OPTION_HUES.map((tone) => ({ label: OPTION_HUE_LABELS[tone], tone }))} />
          <OptionSwatchPicker variant="inline" label="列颜色" value={toneValue} onChange={setToneValue} />
        </Panel>

        <Panel title="小部件" description="叠放头像、评分、步进器、倒计时、分格密码、金额小数位（D01 / D20 / D21m / D21s / D26c）。">
          <DescriptionList
            columns={2}
            items={[
              { label: "正在看的人", value: <AvatarStack label="正在看的人" people={[{ name: "王小明", hint: "在编辑" }, { name: "阿杰" }, { name: "美华" }, { name: "李娜" }, { name: "陈雅婷" }]} /> },
              { label: "意向", value: <Rating label="意向" value={intent} onChange={setIntent} size="md" /> },
              { label: "最多打开次数", value: <NumberStepper label="最多打开次数" value={opens} onChange={setOpens} min={1} max={100} unit="次" /> },
              { label: "领取时限", value: <span>还剩 <Countdown until={claimUntil} label="领取时限" warnBelowMs={60_000} /></span> },
              { label: "自动隐藏", value: <Countdown variant="ring" until={deadline} totalMs={60_000} label="自动隐藏" /> },
              { label: "成交价（只显示到元）", value: <MoneyDisplay value={237900000n} unit="" digits={0} /> },
              {
                label: "密码",
                full: true,
                value: (
                  <CodeInput
                    label="密码"
                    value={pin}
                    error={pinError}
                    onChange={(v) => { setPin(v); setPinError(undefined); }}
                    onComplete={(v) => setPinError(v === "7K2Q" ? undefined : "密码不对，还能试 4 次")}
                  />
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="分享给访客的记录" description="水印：访客 IP + 打开时间，斜着铺满，不挡点击（D21）。">
          <Watermark text={["访客 116.228.**.18", "2026-10-05 20:16"]}>
            <DescriptionList columns={2} items={[{ label: "意向", value: <><Rating value={5} label="意向" /> 非常有意向</> }, { label: "预计金额", value: <MoneyDisplay value={218000000n} unit="" digits={0} /> }, { label: "手机", value: "139-****-5781", hint: "已打码" }, { label: "负责人", value: "小王 · 智能家居顾问" }]} />
          </Watermark>
        </Panel>

        <Panel
          title="操作结果提示"
          description="useNotify：成功 / 信息 5 秒自动消失；失败不自动消失，要点 × 关（用户没看到就没了）。手机上抬到底栏之上。"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => notify("已保存 3 格", "success")}>成功提示</Button>
              <Button variant="outline" size="sm" onClick={() => notify("保存失败：网络断了，请重试", "error")}>失败提示</Button>
            </>
          }
        >
          <span className="aui-note">点右上角的按钮弹出提示条。</span>
        </Panel>

        <Panel
          title="侧边 / 底部弹层"
          description="SideSheet 给工具面板（规则试运行 D26b），BottomSheet 给手机（跟进记录 D27m）；记录详情仍然居中，不从侧边滑出。"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setSheet("side")}><PanelRight />规则试运行</Button>
              <Button variant="outline" size="sm" onClick={() => setSheet("bottom")}><PanelBottom />写跟进</Button>
            </>
          }
        >
          <span className="aui-note">点右上角的按钮打开。</span>
        </Panel>

        <SideSheet
          open={sheet === "side"}
          onClose={() => setSheet(null)}
          title="规则试运行"
          description="用最近 7 天进来的 412 条线索试跑，不会真的分配"
          width="lg"
          headerActions={<MoreMenu label="试运行操作" sections={withNotify([{ items: [
            { key: "export", label: "导出结果", icon: <FileSpreadsheet /> },
            { key: "again", label: "换一批线索再试", icon: <History /> },
          ] }])} icon={<ListPlus />} />}
          footer={<><Button variant="outline" onClick={() => setSheet(null)}>关闭</Button><Button onClick={() => setSheet(null)}>启用这套规则</Button></>}
        >
          <StatStrip label="试运行结果" items={[
            { key: "hit", label: "命中规则", value: "386", unit: "条" },
            { key: "fallback", label: "走兜底", value: "26", unit: "条" },
            { key: "people", label: "分到", value: "9", unit: "人" },
          ]} />
          <Choice
            label="兜底分给"
            value={fallback}
            onChange={setFallback}
            options={[{ value: "sales", label: "销售" }, { value: "lead", label: "组长" }, { value: "ops", label: "运营" }]}
          />
          <CompactTable
            caption="分到每个人"
            rows={[{ id: "1", name: "小王", count: 82 }, { id: "2", name: "阿杰", count: 64 }, { id: "3", name: "美华", count: 51 }]}
            getRowId={(r) => r.id}
            fields={[{ key: "name", title: "销售", type: "text", primary: true }, { key: "count", title: "分到", type: "number", precision: 0 }]}
          />
        </SideSheet>
        <BottomSheet
          open={sheet === "bottom"}
          onClose={() => setSheet(null)}
          title="写跟进"
          description="李承恩（滨江豪宅）"
          footer={<><Button variant="outline" onClick={() => setSheet(null)}>取消</Button><Button onClick={() => setSheet(null)}>保存</Button></>}
        >
          <Textarea aria-label="跟进内容" rows={4} defaultValue="周六 10 点到滨江样品间看 KNX 面板，太太一起来。" />
        </BottomSheet>
      </PageBody>
    </>
  );
}
