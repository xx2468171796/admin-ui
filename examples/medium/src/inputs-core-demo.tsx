import { useMemo, useState } from "react";
import { AtSign, Paperclip } from "lucide-react";
import {
  AsyncSwitch,
  Button,
  Choice,
  FormDialog,
  FormField,
  FormFieldErrors,
  FormSection,
  Highlight,
  IconButton,
  Input,
  Kbd,
  Panel,
  QueryBar,
  SaveBar,
  SearchField,
  Textarea,
  useChangeTracker,
} from "@adminui/react";

// 文本框（前后缀、清空、字数、多行自动长高）、搜索（边打边筛 / 慢列表回车）、提交出错汇总、设置页吸底保存条。
const ROW = { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 } as const;
const NAMES = ["上海智能家居", "深圳门锁批发", "广州影音工程", "苏州智能照明", "南京门锁维修", "宁波影音租赁"];

function TextSection() {
  const [name, setName] = useState("上海智能家居");
  const [site, setSite] = useState("tw-home");
  const [sms, setSms] = useState("您好，您预约的上门量尺寸时间是 10 月 9 日上午 10 点。");
  const [note, setNote] = useState("");
  return (
    <Panel title="文本框" description="一种框：静止浅边、悬停加深、聚焦主色边 + 光圈；出错 = 红边 + 下面一行「图标 + 原因 + 怎么改」。尺寸 28 / 36，手机 40、公开页 44。">
      <div style={{ display: "grid", gap: 16, maxWidth: 760 }} id="inputs-text">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <FormField label="客户名称" htmlFor="it-name" required count={{ value: name.length, max: 30 }}>
            <Input id="it-name" value={name} maxLength={30} clearable onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="公开页地址" htmlFor="it-site" hint="只能用小写字母、数字和 -">
            <Input id="it-site" value={site} segment={<span className="aui-input-seg">https://</span>} suffix=".forms.tw" onChange={(e) => setSite(e.target.value)} />
          </FormField>
          <FormField label="LINE ID" htmlFor="it-line" error="LINE ID 不能有空格：去掉空格，或改用手机号">
            <Input id="it-line" defaultValue="lin yi" prefix={<AtSign />} />
          </FormField>
          <FormField label="小号" htmlFor="it-sm" optional>
            <Input id="it-sm" size="sm" placeholder="28px 小号" />
          </FormField>
        </div>
        <FormField label="短信内容" htmlFor="it-sms" help="超过 70 个字会拆成两条短信计费。">
          <Textarea id="it-sms" value={sms} maxLength={70} showCount onChange={(e) => setSms(e.target.value)} />
        </FormField>
        <FormField label="跟进" htmlFor="it-note">
          <Textarea
            id="it-note"
            value={note}
            placeholder="写点什么…（自动长高，最多 10 行）"
            onChange={(e) => setNote(e.target.value)}
            footer={
              <>
                <IconButton size="xs" label="附件" icon={<Paperclip />} />
                <IconButton size="xs" label="提到同事" icon={<AtSign />} />
                <span className="aui-text-note"><Kbd keys="Mod+Enter" size="sm" flat /> 保存</span>
              </>
            }
          />
        </FormField>
      </div>
    </Panel>
  );
}

function SearchSection() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [slow, setSlow] = useState("");
  const [slowApplied, setSlowApplied] = useState("");
  const hits = useMemo(() => NAMES.filter((n) => !applied || n.includes(applied.trim())), [applied]);
  return (
    <Panel title="搜索" description="列表搜索打字就筛（停 0.3 秒），去掉「查询 / 重置」；很慢的列表（审计日志）保留回车才搜。">
      <div style={{ display: "grid", gap: 12 }} id="inputs-search">
        <QueryBar variant="bare" value={q} onChange={setQ} onSearch={() => setApplied(q)} onReset={() => { setQ(""); setApplied(""); }} hits={applied ? hits.length : undefined} shortcut="/" placeholder="搜索客户" />
        <ul style={{ margin: 0, paddingLeft: 18 }} aria-label="搜索结果">
          {hits.map((n) => <li key={n}><Highlight text={n} query={applied} /></li>)}
        </ul>
        <QueryBar variant="bare" searchMode="enter" value={slow} onChange={setSlow} onSearch={() => setSlowApplied(slow)} onReset={() => { setSlow(""); setSlowApplied(""); }} placeholder="搜索审计日志" />
        <p className="aui-text-note" id="inputs-slow-result">已搜索：{slowApplied || "（还没搜）"}</p>
        <div style={{ maxWidth: 280 }}><SearchField value={q} onChange={setQ} variant="subtle" size="sm" placeholder="在侧栏里搜" /></div>
      </div>
    </Panel>
  );
}

function FormErrorsSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("138");
  const [stage, setStage] = useState("");
  return (
    <Panel title="提交出错" description="点提交：顶部汇总（可点跳过去）+ 每个框红边 + 焦点到第一个错 + 底栏「2 项要改」。" actions={<Button onClick={() => setOpen(true)}>新建客户</Button>}>
      <p className="aui-text-note">点右上角「新建客户」，直接提交看出错的样子。</p>
      <FormDialog
        open={open}
        title="新建客户"
        description="带 * 的必填"
        onClose={() => setOpen(false)}
        dirty={Boolean(name || stage)}
        submitLabel="新建"
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 300));
          const errors: Record<string, string> = {};
          if (!name.trim()) errors["fe-name"] = "请填客户名称";
          if (!/^1\d{10}$/.test(phone)) errors["fe-phone"] = "手机号要 11 位、1 开头，例如 138 0013 8000";
          if (!stage) errors["fe-stage"] = "请选一个阶段";
          if (Object.keys(errors).length) throw new FormFieldErrors(errors);
        }}
      >
        <FormSection>
          <FormField label="客户名称" htmlFor="fe-name" required><Input id="fe-name" value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="手机" htmlFor="fe-phone" required><Input id="fe-phone" value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} /></FormField>
          <FormField label="阶段" htmlFor="fe-stage" required><Choice label="阶段" value={stage} onChange={setStage} options={[{ value: "first", label: "首通" }, { value: "quote", label: "报价" }]} placeholder="选择阶段" /></FormField>
        </FormSection>
      </FormDialog>
    </Panel>
  );
}

const SAVED = { company: "Acme 华南", region: "CN", reminder: "每天 9:00" };
function SettingsSection() {
  const tracker = useChangeTracker(SAVED);
  const [notify, setNotify] = useState(true);
  return (
    <Panel title="设置页 · 吸底保存条" description="整页一个吸底保存条，改了才出现，写「改了 N 处」；改过的字段标「已改」；立即生效的开关不算。">
      <div id="inputs-settings">
        <FormSection layout="side" title="公司" description="出现在公开页、短信落款上。">
          <FormField label="公司名称" htmlFor="st-company" changed={tracker.changed("company")}><Input id="st-company" value={tracker.values.company} onChange={(e) => tracker.set("company", e.target.value)} /></FormField>
          <FormField label="所在地" htmlFor="st-region" changed={tracker.changed("region")} hint="决定手机区号默认值（中国大陆 +86）">
            <Choice label="所在地" value={tracker.values.region} onChange={(v) => tracker.set("region", v)} options={[{ value: "CN", label: "中国大陆" }, { value: "HK", label: "中国香港" }, { value: "SG", label: "新加坡" }]} />
          </FormField>
        </FormSection>
        <FormSection layout="side" title="提醒" description="开关立即生效，不用点保存。">
          <FormField label="提醒时间" htmlFor="st-reminder" changed={tracker.changed("reminder")}><Input id="st-reminder" value={tracker.values.reminder} onChange={(e) => tracker.set("reminder", e.target.value)} /></FormField>
          <FormField label="跟进到期提醒" htmlFor="st-notify"><AsyncSwitch id="st-notify" label="跟进到期提醒" checked={notify} onChange={async (v) => setNotify(v)} /></FormField>
        </FormSection>
        <SaveBar count={tracker.count} summary={tracker.keys.map((k) => ({ company: "公司名称", region: "所在地", reminder: "提醒时间" })[k]).join("、")} onDiscard={tracker.reset} onSave={async () => { await new Promise((r) => setTimeout(r, 400)); tracker.commit(); }} />
      </div>
    </Panel>
  );
}

export function InputsCoreSections() {
  return (
    <>
      <TextSection />
      <SearchSection />
      <FormErrorsSection />
      <SettingsSection />
    </>
  );
}
