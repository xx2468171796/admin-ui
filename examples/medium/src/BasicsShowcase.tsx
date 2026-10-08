import { useState } from "react";
import { Bell, Download, Eye, Filter, History, Layers, Plus, RefreshCw, Save, Search, Settings2, Share2, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarStack,
  Button,
  ButtonGroup,
  ChipGroup,
  Count,
  Divider,
  DotBadge,
  HelpTip,
  IconButton,
  Kbd,
  MoreMenu,
  PageBody,
  PageHeader,
  Panel,
  PersonChip,
  ShortcutSheet,
  SplitButton,
  StatusBadge,
  Tag,
  Tooltip,
} from "@adminui/react";
import { BasicsMoreSections } from "./basics-demo-more";

// 基础元素（审阅「组件库 01 基础元素」通过的 8 项）：按钮、标签与徽标、头像、提示气泡与「?」、快捷键 / 复制 / 分隔线、
// 加载与进度、文字层级与链接、图标。本页用 T08 设置页的分节；页面不写一行控件样式。
const ROW = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } as const;
const LABEL = { minWidth: 72, color: "var(--aui-note)", fontSize: 12 } as const;
const VARIANTS = [
  ["default", "主按钮"],
  ["secondary", "次要"],
  ["outline", "描边"],
  ["ghost", "幽灵"],
  ["text", "文字按钮"],
  ["destructive", "危险"],
  ["destructive-outline", "危险描边"],
] as const;
const SIZES = [["lg", "40"], ["default", "36"], ["sm", "28"], ["xs", "24"]] as const;
const PEOPLE = [
  { key: "u1", name: "赵静怡", hint: "在编辑" },
  { key: "u2", name: "陈冠宇", hint: "在看" },
  { key: "u3", name: "许雅婷" },
  { key: "u4", name: "王志明" },
  { key: "u5", name: "孙佳宁" },
  { key: "u6", name: "蔡宗翰" },
  { key: "u7", name: "黄诗涵" },
];
const SHORTCUTS = [
  { title: "表格", items: [{ keys: "Mod+K", label: "搜索与命令" }, { keys: "Mod+F", label: "在表里搜索" }, { keys: "Mod+Z", label: "撤销" }, { keys: "Mod+Shift+Z", label: "重做" }] },
  { title: "记录详情", items: [{ keys: "Mod+Enter", label: "保存跟进" }, { keys: "Esc", label: "关闭" }, { keys: "J", label: "下一条" }, { keys: "K", label: "上一条" }] },
];

function ButtonsSection() {
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [view, setView] = useState("table");
  const save = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1600);
  };
  return (
    <Panel title="按钮" count="7 种样式 · 4 档尺寸" description="主按钮纯主色、无渐变无投影；幽灵按钮灰字，只有文字按钮和链接用主色；28 / 24 圆角 6；禁用 = 浅灰底 + 淡字；加载时转圈换掉左图标、宽度不变。">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }} id="basics-buttons">
        {VARIANTS.map(([variant, label]) => (
          <div key={variant} style={ROW} data-variant-row={variant}>
            <span style={LABEL}>{label}</span>
            {SIZES.map(([size, h]) => (
              <Button key={size} variant={variant} size={size}>
                {variant !== "text" && <Plus />}
                {label} {h}
              </Button>
            ))}
            <Button variant={variant} disabled>
              禁用
            </Button>
            <Button variant={variant} disabledReason="没有修改权限，找管理员开通">
              有原因的禁用
            </Button>
          </div>
        ))}
        <div style={ROW}>
          <span style={LABEL}>加载</span>
          <Button loading={saving} loadingText="保存中…" onClick={save}>
            <Save />
            保存跟进
          </Button>
          <Button variant="outline" loading={saving} onClick={save}>
            <RefreshCw />
            刷新
          </Button>
        </div>
        <div style={ROW}>
          <span style={LABEL}>图标按钮</span>
          <IconButton label="搜索" icon={<Search />} shortcut="Mod+K" />
          <IconButton label="筛选" icon={<Filter />} badge={3} />
          <IconButton label="通知" icon={<Bell />} badge />
          <IconButton label="关注" icon={<Eye />} pressed={following} onClick={() => setFollowing((v) => !v)} />
          <IconButton label="设置" icon={<Settings2 />} size="sm" />
          <IconButton label="删除" icon={<Trash2 />} size="xs" variant="danger" />
          <IconButton label="下载" icon={<Download />} variant="outline" />
          <IconButton label="分享" icon={<Share2 />} disabledReason="这张表还没有可分享的视图" />
        </div>
        <div style={ROW}>
          <span style={LABEL}>按钮组</span>
          <ButtonGroup label="视图">
            {([["table", "表格"], ["board", "看板"], ["calendar", "日历"]] as const).map(([value, label]) => (
              <Button key={value} variant="outline" size="sm" aria-pressed={view === value} onClick={() => setView(value)}>
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <SplitButton label="新记录" icon={<Plus />} onClick={() => undefined} sections={[{ items: [{ key: "form", label: "用表单填写" }, { key: "import", label: "从 Excel 导入" }] }]} />
        </div>
        <div className="aui-grid-toolbar" role="toolbar" aria-label="工具栏示例" style={{ borderTop: "1px solid var(--aui-line)", paddingTop: 12, flexWrap: "wrap" }} id="basics-toolbar">
          <Button variant="ghost" size="sm"><Filter />筛选</Button>
          <Button variant="ghost" size="sm"><Layers />分组</Button>
          <Divider orientation="vertical" />
          <Button variant="ghost" size="sm"><History />操作记录</Button>
          <span style={{ flex: 1 }} />
          <Button size="sm"><Plus />新记录</Button>
          <MoreMenu size="sm" sections={[{ items: [{ key: "settings", label: "表设置", icon: <Settings2 /> }, { key: "access", label: "权限" }, { key: "log", label: "操作记录", shortcut: "Mod+H" }] }]} />
        </div>
      </div>
    </Panel>
  );
}

function TagsSection() {
  const [quick, setQuick] = useState<string[]>(["pool"]);
  return (
    <Panel title="标签与徽标" description="只有两种形状：圆角 6 的软方块（标签、状态、筛选块）和全圆（数字角标、圆点、头像、进度）；都不加描边。">
      <div style={{ display: "grid", gap: 12 }} id="basics-tags">
        <div style={ROW}><span style={LABEL}>普通标签</span><Tag variant="plain">员工</Tag><Tag variant="plain">销售</Tag><Tag>官网表单</Tag><Tag size="sm" variant="plain">转介绍</Tag></div>
        <div style={ROW}><span style={LABEL}>状态 · 软底</span><StatusBadge tone="success">正常</StatusBadge><StatusBadge tone="warning">待审核</StatusBadge><StatusBadge tone="danger">同步失败</StatusBadge><StatusBadge tone="info" pulse>同步中</StatusBadge><StatusBadge tone="neutral">已停用</StatusBadge></div>
        <div style={ROW}><span style={LABEL}>状态 · 表格</span><StatusBadge tone="success" variant="dot">正常</StatusBadge><StatusBadge tone="neutral" variant="dot">已停用</StatusBadge><StatusBadge tone="danger" variant="dot">异常</StatusBadge></div>
        <div style={ROW}><span style={LABEL}>数字角标</span>收藏 <Count>{0}</Count> 未读 <Count tone="primary">{12}</Count> 没有未读 <Count tone="primary">{0}</Count> 告警 <Count tone="danger">{128}</Count> 新消息 <DotBadge label="有新消息" /></div>
        <div style={ROW}><span style={LABEL}>快捷筛选</span><ChipGroup label="快捷筛选" value={quick} onValueChange={(v) => setQuick(v.slice(-1))} options={[{ value: "pool", label: "公海", count: 15 }, { value: "mine", label: "我跟进中的", count: 3 }, { value: "stale", label: "停滞", count: 0 }]} /></div>
      </div>
    </Panel>
  );
}

function AvatarsSection() {
  return (
    <Panel title="头像" description="5 档尺寸；按人分到 10 色之一（同一个人在哪都一个颜色）；机器人是圆角方块，已离职是灰色。">
      <div style={{ display: "grid", gap: 12 }} id="basics-avatars">
        <div style={ROW}><span style={LABEL}>5 档</span>{([20, 24, 32, 40, 64] as const).map((s) => <Avatar key={s} name="赵静怡" id="u1" size={s} />)}</div>
        <div style={ROW}><span style={LABEL}>按人分色</span>{PEOPLE.map((p) => <Avatar key={p.key} name={p.name} id={p.key} tooltip />)}</div>
        <div style={ROW}><span style={LABEL}>种类</span><Avatar name="自动分配" kind="bot" size={40} /><Avatar name="赵静怡" kind="gone" size={40} /><Avatar name="销售一部" kind="group" size={40} /><Avatar name="陈冠宇" id="u2" size={40} presence="on" /><Avatar name="许雅婷" id="u3" size={40} presence="away" /><Avatar name="王志明" id="u4" size={40} presence="off" /></div>
        <div style={ROW}><span style={LABEL}>叠放</span><AvatarStack people={PEOPLE} max={3} label="正在看的人" size={24} /><AvatarStack people={PEOPLE.slice(0, 2)} label="协作人" /></div>
        <div style={ROW}><span style={LABEL}>人员块</span><PersonChip name="赵静怡" id="u1" /><PersonChip name="孙佳宁" id="u5" kind="gone" /><PersonChip name="陈冠宇" id="u2" plain /></div>
      </div>
    </Panel>
  );
}

function TipsSection() {
  const [sheet, setSheet] = useState(false);
  return (
    <Panel title="提示气泡与说明「?」" description="一句话 = 深色气泡（可带快捷键）；能点的说明 = 「?」浅色卡片，从下方左对齐弹出。">
      <div style={{ display: "grid", gap: 12 }} id="basics-tips">
        <div style={ROW}>
          <span style={LABEL}>气泡</span>
          <Tooltip content="搜索与命令" shortcut="Mod+K"><Button variant="outline"><Search />搜索</Button></Tooltip>
          <IconButton label="刷新" icon={<RefreshCw />} shortcut="Mod+R" />
          <Button disabledReason="只有负责人能转交">转交</Button>
        </div>
        <div style={ROW}>
          <span style={LABEL}>说明「?」</span>
          <b style={{ fontSize: 14.5 }}>客户质量</b>
          <HelpTip label="客户质量说明" title="客户质量怎么算" more={{ href: "#help-quality" }}>按最近 30 天的跟进次数、阶段推进和成交金额打分，每天早上 6 点更新。</HelpTip>
        </div>
        <div style={ROW}>
          <span style={LABEL}>快捷键</span>
          <Kbd keys="Mod+K" /> <Kbd keys="Mod+Enter" /> <Kbd keys="Shift+?" size="sm" /> <Kbd keys="/" flat />
          <Button variant="text" onClick={() => setSheet(true)}>快捷键一览（按 ?）</Button>
        </div>
        <ShortcutSheet groups={SHORTCUTS} open={sheet} onOpenChange={setSheet} />
      </div>
    </Panel>
  );
}

export function BasicsShowcase() {
  return (
    <>
      <PageHeader title="基础元素" description="组件库审阅第 1 批「基础元素」通过的 8 项。" />
      <PageBody>
        <ButtonsSection />
        <TagsSection />
        <AvatarsSection />
        <TipsSection />
        <BasicsMoreSections />
      </PageBody>
    </>
  );
}
