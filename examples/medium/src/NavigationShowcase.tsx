import { useState } from "react";
import { Bolt, FileText, Layers, ListChecks, Phone, ShieldCheck, Target, Trash2, Type, Users } from "lucide-react";
import {
  AuthLayout,
  Breadcrumbs,
  Button,
  FormField,
  Input,
  ListDetailLayout,
  LoadMore,
  LoginForm,
  Pane,
  Panel,
  PageBody,
  PageHeader,
  PublicPageLayout,
  PublicResult,
  SaveBar,
  SelectList,
  SettingsSheet,
  SideNavLayout,
  Steps,
  Tabs,
  useChangeTracker,
  useNotify,
} from "@adminui/react";

// 「导航与布局」：面包屑、页内下划线标签 +「更多」、表设置抽屉（SettingsSheet）、设置侧导航、列表 → 详情两步、
// 步骤条、加载更多、登录页、公开页外框。外壳（切换公司 / 账号菜单 / 工作标签胶囊 / 外观）就是这个 starter 自己的 AdminShell。

const ROLES = [
  { key: "sales", title: "销售", hint: "8 人 · 只看自己的客户", group: "本公司" },
  { key: "lead", title: "组长", hint: "2 人 · 看整组", group: "本公司" },
  { key: "manager", title: "主管", hint: "1 人 · 看部门及下级", group: "本公司" },
  { key: "admin", title: "子公司管理员", hint: "全部权限", group: "内置 · 只读" },
] as const;

function TableSettingsDemo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const form = useChangeTracker({ limit: "250", days: "15", currency: "CNY", target: "4,000,000" });
  const currencyBad = !/^[A-Z]{3}$/.test(form.values.currency);
  const line = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      <FormField label="每人认领上限" htmlFor="nav-limit" changed={form.changed("limit")}>
        <Input id="nav-limit" value={form.values.limit} suffix="条" onChange={(e) => form.set("limit", e.target.value)} />
      </FormField>
      <FormField label="几天没跟进自动退回公海" htmlFor="nav-days" changed={form.changed("days")}>
        <Input id="nav-days" value={form.values.days} suffix="天" onChange={(e) => form.set("days", e.target.value)} />
      </FormField>
      <FormField label="币种" htmlFor="nav-cur" changed={form.changed("currency")} error={currencyBad ? "要三位代码，例如 CNY、USD" : undefined}>
        <Input id="nav-cur" value={form.values.currency} onChange={(e) => form.set("currency", e.target.value)} />
      </FormField>
      <FormField label="每月成交目标（CNY）" htmlFor="nav-target" changed={form.changed("target")}>
        <Input id="nav-target" value={form.values.target} onChange={(e) => form.set("target", e.target.value)} />
      </FormField>
    </div>
  );
  const soon = (text: string) => <p className="aui-note">{text}</p>;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>打开表设置</Button>
      <SettingsSheet
        open={open}
        onClose={() => setOpen(false)}
        title="表设置"
        subtitle="智能家居客户"
        changes={form.count}
        errors={currencyBad ? 1 : 0}
        summary={form.keys.join("、")}
        onDiscard={form.reset}
        onSave={async () => {
          if (currencyBad) throw Error("币种要三位代码");
          form.commit();
          notify("表设置已保存", "success");
        }}
        sections={[
          { id: "basic", group: "表格", label: "基本信息", icon: <FileText />, content: soon("表名、图标、说明。") },
          { id: "fields", group: "表格", label: "字段", icon: <Type />, count: 24, content: soon("字段列表（演示）。") },
          { id: "access", group: "表格", label: "权限", icon: <ShieldCheck />, content: soon("谁能看 / 改（演示）。") },
          { id: "line", group: "业务线 · CRM", label: "业务线设置", hint: "智能家居", icon: <Layers />, dirty: form.count > 0, error: currencyBad ? "币种填错了" : undefined, content: line },
          { id: "roles", group: "业务线 · CRM", label: "推荐角色", icon: <Users />, content: soon("推荐角色（演示）。") },
          { id: "stages", group: "业务线 · CRM", label: "阶段与赢率", icon: <Target />, content: soon("阶段与赢率（演示）。") },
          { id: "auto", group: "高级", label: "自动化", icon: <Bolt />, count: 6, content: soon("自动化（演示）。") },
          { id: "trash", group: "高级", label: "回收站", icon: <Trash2 />, content: soon("回收站（演示）。") },
        ]}
      />
    </>
  );
}

function SideNavDemo() {
  const form = useChangeTracker({ limit: "250", phone: "中国大陆（1 开头 11 位）" });
  return (
    <SideNavLayout
      label="业务线设置分节"
      footer={<SaveBar count={form.count} summary={form.keys.join("、")} onDiscard={form.reset} onSave={() => form.commit()} />}
      sections={[
        { id: "claim", group: "业务线 · 智能家居", label: "认领与回收", icon: <Users size={16} />, dirty: form.changed("limit"), content: <Panel title="认领与回收"><FormField label="每人认领上限" htmlFor="sn-limit" changed={form.changed("limit")}><Input id="sn-limit" value={form.values.limit} onChange={(e) => form.set("limit", e.target.value)} /></FormField></Panel> },
        { id: "phone", group: "业务线 · 智能家居", label: "手机号与币种", icon: <Phone size={16} />, error: "币种要三位代码", content: <Panel title="手机号与币种"><p className="aui-note">币种填成了「CN」。</p></Panel> },
        { id: "target", group: "权限", label: "推荐角色", icon: <ListChecks size={16} />, content: <Panel title="推荐角色"><p className="aui-note">演示。</p></Panel> },
      ]}
    />
  );
}

function ListDetailDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<"list" | "detail">("list");
  const role = ROLES.find((r) => r.key === selected) ?? ROLES[0];
  return (
    <Panel title="角色与权限" count={`${ROLES.length}`} flush>
      <ListDetailLayout
        minHeight={320}
        detailOpen={step === "detail"}
        onBack={() => setStep("list")}
        backLabel="返回角色"
        detailTitle={role.title}
        list={<SelectList label="角色" items={ROLES.map((r) => ({ ...r }))} selected={selected ?? ROLES[0].key} onSelect={(key) => { setSelected(key); setStep("detail"); }} search="搜角色" />}
      >
        <Pane title={role.title} hint={role.hint} padding="md">
          <p className="aui-note">窄屏（≤ 760）上：先看列表，点一行滑进详情，左上 ← 回列表。</p>
        </Pane>
      </ListDetailLayout>
    </Panel>
  );
}

function LoadMoreDemo() {
  const [shown, setShown] = useState(4);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [tries, setTries] = useState(0);
  const load = () => {
    setState("loading");
    window.setTimeout(() => {
      const fail = tries === 1;
      setTries((t) => t + 1);
      if (fail) return setState("error");
      setShown((s) => Math.min(10, s + 3));
      setState("idle");
    }, 400);
  };
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <LoadMore shown={shown} total={10} loading={state === "loading"} error={state === "error" ? "没加载出来，网络断了一下" : undefined} onLoadMore={load} />
      <LoadMore shown={50} total={128} onLoadMore={() => undefined} />
      <LoadMore shown={50} total={128} loading onLoadMore={() => undefined} />
      <LoadMore shown={50} total={128} error onLoadMore={() => undefined} />
      <LoadMore shown={128} total={128} onLoadMore={() => undefined} />
    </div>
  );
}

const MANY_TABS = ["资料", "跟进", "商机", "报价单", "合同", "安装工单", "售后回访", "附件", "操作记录"];

export function NavigationShowcase() {
  const notify = useNotify();
  const [tab, setTab] = useState("follow");
  const [many, setMany] = useState(MANY_TABS[0]!);
  const [stepAt, setStepAt] = useState("map");
  return (
    <PageBody>
      <PageHeader title="外壳与布局" description="外壳（左上切换公司、左下头像菜单、胶囊工作标签、外观弹层）就是这个页面的外壳；下面是页面里的导航部件。" />
      <Panel title="面包屑" description="灰色可点、当前页深色加粗、小箭头分隔；太深中间收成 …；手机只留「← 上一级」。">
        <div style={{ display: "grid", gap: 12 }}>
          <Breadcrumbs items={[{ label: "客户", onClick: () => notify("回到客户", "info") }, { label: "智能家居", onClick: () => notify("回到智能家居", "info") }, { label: "赵静怡" }]} />
          <Breadcrumbs items={[{ label: "知识库", onClick: () => undefined }, { label: "产品", onClick: () => undefined }, { label: "门锁", onClick: () => undefined }, { label: "安装", onClick: () => undefined }, { label: "安装手册 · 智能门锁 S30" }]} />
        </div>
      </Panel>
      <Panel title="页内标签" description="只用下划线；数量是灰色小胶囊，选中变主色浅底；放不下右端「更多 ⌄」，不用圆箭头。">
        <Tabs label="客户分区" value={tab} onValueChange={setTab} items={[{ value: "info", label: "资料" }, { value: "follow", label: "跟进", count: 28 }, { value: "deal", label: "商机", count: 3 }, { value: "late", label: "逾期", count: 2, countTone: "danger" }, { value: "archived", label: "已归档", disabled: true }]} />
        <div style={{ maxWidth: 520 }}>
          <Tabs label="记录分区" value={many} onValueChange={setMany} items={MANY_TABS.map((t) => ({ value: t, label: t, count: t === "跟进" ? 28 : undefined }))} />
        </div>
      </Panel>
      <Panel title="表设置抽屉" description="左侧分节 + 右边一节内容 + 底部保存条；改过的节琥珀圆点、出错的节红色叹号。">
        <TableSettingsDemo />
      </Panel>
      <SideNavDemo />
      <ListDetailDemo />
      <Panel title="步骤与向导" description="做完 = 浅主色底 + 勾，字是正文色；当前 = 实心主色 + 浅光；等别人 = 注意色；出错 = 异常色 ×。">
        <div style={{ display: "grid", gap: 20 }}>
          <Steps stretch current={stepAt} onStepClick={setStepAt} steps={[{ key: "upload", label: "上传文件", description: "客户名单.xlsx · 128 行" }, { key: "map", label: "对应字段", description: "12 列对上 10 个" }, { key: "check", label: "检查数据", description: "查重、格式" }, { key: "done", label: "完成导入" }]} />
          <Steps stretch current="approve" steps={[{ key: "submit", label: "提交报价", description: "小王 · 10/05" }, { key: "approve", label: "主管审批", description: "等陈组长确认 · 已等 2 天", status: "waiting" }, { key: "send", label: "发给客户" }]} />
          <Steps stretch current="check" steps={[{ key: "upload", label: "上传文件" }, { key: "check", label: "检查数据", description: "7 行手机号格式不对", status: "error" }, { key: "done", label: "完成导入" }]} />
          <div style={{ maxWidth: 320 }}>
            <Steps orientation="vertical" current="install" steps={[{ key: "order", label: "下单", description: "10/06 · 赵静怡" }, { key: "assign", label: "派工", description: "阿杰 · 10/09 下午" }, { key: "install", label: "上门安装", description: "今天 14:00 – 16:00" }, { key: "accept", label: "验收" }]} />
          </div>
        </div>
      </Panel>
      <Panel title="加载更多" description="时间线 / 动态 / 评论用「加载更多」，表格用页码。第一行能点：第二次故意失败，重试后到底。">
        <LoadMoreDemo />
      </Panel>
      <Panel title="登录页与公开页外框" description="登录按钮一直能点，点了再说缺什么；密码随便填，少于 8 位算密码错。">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
          <AuthLayout embedded logo="A" title="登录 Acme 工作台" description="用公司给你的账号登录" footer="© Acme · 登录遇到问题找公司管理员">
            <LoginForm
              remember={{}}
              forgot={<Button variant="text" size="sm" onClick={() => notify("请找公司管理员重置密码", "info")}>忘记密码</Button>}
              onSubmit={async ({ password }) => {
                await new Promise((r) => window.setTimeout(r, 300));
                if (password.length < 8) throw Error("账号或密码不对，还能试 4 次；忘了找公司管理员重置");
                notify("登录成功（演示）", "success");
              }}
            />
          </AuthLayout>
          <PublicPageLayout logo="A" brand="Acme" brandNote="智能家居" width="narrow">
            <PublicResult title="提交成功" description="顾问会在 1 个工作日内打电话给你约时间。" meta="智能家居免费到府评估 · 2026-10-07 14:32 提交" actions={<Button variant="outline">再填一份</Button>} />
          </PublicPageLayout>
        </div>
      </Panel>
    </PageBody>
  );
}
