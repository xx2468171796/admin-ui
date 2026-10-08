import { useState, type CSSProperties, type ReactNode } from "react";
import { FormField, IconButton, MoneyInput, NumberInput, NumberStepper, Panel, PercentBar, PercentInput, PhoneInput, Rating, Slider, formatLocalPhone, parsePhone, phoneCountryLabel, rangeMessage } from "@adminui/react";
import { BitableGrid, type GridCellChange, type GridField } from "@adminui/react/grid";
import { Copy, Phone } from "lucide-react";

const WORDS = ["很低", "较低", "一般", "较高", "很高"];
const SATISFY = ["很不满意", "不满意", "一般", "满意", "很满意"];

// 数字、步进器、百分比、金额、电话，以及表格格子里的样子。
export function NumbersSection() {
  return (
    <div className="aui-stack" style={{ display: "grid", gap: 16 }}>
      <NumberCard />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))" }}>
        <StepperCard />
        <PercentCard />
      </div>
      <MoneyCard />
      <PhoneCard />
      <CellsCard />
      <RatingCard />
      <SliderCard />
    </div>
  );
}

const states: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", alignItems: "start" };

function NumberCard() {
  const [a, setA] = useState<number | null>(3);
  const [b, setB] = useState<number | null>(12);
  const [c, setC] = useState<number | null>(32);
  const [d, setD] = useState<number | null>(120);
  return (
    <Panel title="数字" description="表单里左对齐、表格里右对齐；悬停 / 聚焦才出上下小箭头；↑ ↓ 加减，Shift 一次 10">
      <div style={states} id="num-states">
        <FormField label="默认" htmlFor="num-a"><NumberInput id="num-a" value={a} onChange={setA} min={0} /></FormField>
        <FormField label="带千分位" htmlFor="num-b" hint="离开时加千分位"><NumberInput id="num-b" value={b} onChange={setB} thousands /></FormField>
        <FormField label="带单位" htmlFor="num-c"><NumberInput id="num-c" value={c} onChange={setC} unit="平方米" spin={false} /></FormField>
        <FormField label="出错（范围外）" htmlFor="num-d" error={rangeMessage(d, 0, 100, "%") ? `赢率${rangeMessage(d, 0, 100, "%")}` : undefined}>
          <NumberInput id="num-d" value={d} onChange={setD} min={0} max={100} unit="%" clamp={false} />
        </FormField>
      </div>
    </Panel>
  );
}

function StepperRow({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--aui-line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontWeight: 500 }}>{title}</b>
        <small style={{ color: "var(--aui-note)" }}>{note}</small>
      </div>
      {children}
    </div>
  );
}

function StepperCard() {
  const [opens, setOpens] = useState<number | null>(3);
  const [days, setDays] = useState<number | null>(1);
  const [stall, setStall] = useState<number | null>(3);
  return (
    <Panel title="步进器（− 数 +）" description="次数 / 天数这类小整数；同一个框，两端是幽灵小按钮，到上下限自动变灰">
      <div id="num-steppers">
        <StepperRow title="最多打开次数" note="访客打开这条分享链接的上限"><NumberStepper label="最多打开次数" value={opens} onChange={setOpens} min={1} max={10} unit="次" size="default" /></StepperRow>
        <StepperRow title="提前提醒" note="下次跟进前几天提醒负责人"><NumberStepper label="提前提醒天数" value={days} onChange={setDays} min={1} max={7} unit="天" /></StepperRow>
        <StepperRow title="停滞判定" note="几天没跟进算「停滞」（到下限 − 变灰）"><NumberStepper label="停滞天数" value={stall} onChange={setStall} min={3} max={30} unit="天" size="default" /></StepperRow>
        <StepperRow title="禁用" note="没有权限改"><NumberStepper label="禁用次数" value={5} onChange={() => undefined} unit="次" size="default" disabled /></StepperRow>
      </div>
    </Panel>
  );
}

function PercentCard() {
  const [win, setWin] = useState<number | null>(60);
  const [off, setOff] = useState<number | null>(8.5);
  return (
    <Panel title="百分比" description="框里写 %，存 0–100；旁边一条细进度条帮着看大小">
      <div style={{ display: "grid", gap: 16 }}>
        <FormField label="赢率" htmlFor="pct-win" hint="按阶段给默认值：报价 = 60%；↑ ↓ 一次 10">
          <PercentInput id="pct-win" value={win} onChange={setWin} step={10} bar />
        </FormField>
        <FormField label="折扣" htmlFor="pct-off" hint="中文习惯写「折」：8.5 折 = 原价 × 85%">
          <span style={{ display: "block", width: 140 }}><NumberInput id="pct-off" value={off} onChange={setOff} precision={1} unit="折" spin={false} /></span>
        </FormField>
      </div>
    </Panel>
  );
}

function MoneyCard() {
  const [currency, setCurrency] = useState("CNY");
  const [plan, setPlan] = useState<number | null>(8600000);
  const [deal, setDeal] = useState<number | null>(null);
  return (
    <Panel title="金额" description="币种是框里的一格（可选时带 ⌄）；打字时是纯数字，离开自动加千分位；一万以上下面写「约 X 万」">
      <div style={states} id="num-money">
        <FormField label="预计金额" htmlFor="money-plan">
          <MoneyInput id="money-plan" value={plan} onChange={setPlan} currency={currency} onCurrencyChange={setCurrency} />
        </FormField>
        <FormField label="成交金额（币种固定）" htmlFor="money-deal" hint="币种在字段设置里定，这里只读">
          <MoneyInput id="money-deal" value={deal} onChange={setDeal} />
        </FormField>
        <FormField label="出错" htmlFor="money-bad" error="金额不能是负数；退款请记在「退款」里">
          <MoneyInput id="money-bad" value={-200000} onChange={() => undefined} allowNegative />
        </FormField>
      </div>
    </Panel>
  );
}

function PhoneCard() {
  const [mobile, setMobile] = useState<string | null>("+8613800138000");
  const [bad, setBad] = useState<string | null>("+86138001");
  const [error, setError] = useState<string | null>(null);
  const stored = parsePhone("+8613933118552");
  return (
    <Panel title="电话" description="区号一格 + 号码；默认是本公司所在地（这里演示 +86）；按当地习惯分组显示，存成国际格式">
      <div style={states} id="num-phone">
        <FormField label="手机" htmlFor="phone-a" required hint="中国大陆手机 1 开头 11 位" error={error ?? undefined}>
          <PhoneInput id="phone-a" value={mobile} onChange={setMobile} defaultCountry="+86" mobile showError={false} onValidate={setError} />
        </FormField>
        <FormField label="出错（离开时才判断）" htmlFor="phone-b">
          <PhoneInput id="phone-b" value={bad} onChange={setBad} defaultCountry="+86" mobile />
        </FormField>
        <FormField label="只读（详情里）" htmlFor="phone-c" hint="外国号码才写区号；本地号码只写本地格式">
          <span id="phone-c" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <span className="aui-num" style={{ fontSize: 13.5 }}>{stored ? formatLocalPhone(stored.country, stored.local) : ""}</span>
            <IconButton size="sm" label="打电话" icon={<Phone />} />
            <IconButton size="sm" label="复制号码" icon={<Copy />} />
            <span style={{ color: "var(--aui-note)", fontSize: 12 }}>{phoneCountryLabel("+86")}</span>
          </span>
        </FormField>
      </div>
      <p className="aui-field-msg" id="phone-e164" style={{ marginTop: 8 }}>存成 <b style={{ fontFamily: "var(--aui-font-mono)" }}>{mobile ?? "—"}</b>，同一业务线里查重</p>
    </Panel>
  );
}

type Deal = { id: string; name: string; phone: string; amount: number | null; win: number | null; visits: number };
const DEALS: Deal[] = [
  { id: "d1", name: "赵静怡", phone: "+8613800138000", amount: 8600000, win: 60, visits: 4 },
  { id: "d2", name: "陈美玲", phone: "+886912345678", amount: 12800000, win: 30, visits: 2 },
  { id: "d3", name: "张建宏", phone: "+14155550132", amount: 24000000, win: 80, visits: 7 },
  { id: "d4", name: "蔡冠宇", phone: "+85251234567", amount: null, win: 10, visits: 1 },
];
const DEAL_FIELDS: GridField<Deal>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true, width: 120 },
  { key: "phone", title: "手机", type: "phone", width: 160, phoneCountry: "+86" },
  { key: "amount", title: "预计金额", type: "money", precision: 0, width: 150, editable: true },
  { key: "win", title: "赢率", type: "percent", width: 140, editable: true },
  { key: "visits", title: "跟进次数", type: "number", precision: 0, width: 100 },
];

function CellsCard() {
  const [rows, setRows] = useState(DEALS);
  const save = (changes: GridCellChange<Deal>[]) => {
    setRows((list) => list.map((row) => changes.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
  };
  return (
    <Panel title="表格格子里" description="数字类一律右对齐、等宽数字；双击编辑时币种 / % 还在，不会变成一个空白框" flush>
      <div style={{ display: "flex", gap: 24, padding: "12px 16px", alignItems: "center", flexWrap: "wrap" }} id="num-pct-bars">
        <span style={{ color: "var(--aui-note)", fontSize: 12 }}>PercentBar：</span>
        <PercentBar value={60} label="赢率" />
        <PercentBar value={30} label="赢率" />
        <PercentBar value={10} label="赢率" bar={false} />
      </div>
      <div id="num-grid">
        <BitableGrid caption="商机" rows={rows} getRowId={(r: Deal) => r.id} fields={DEAL_FIELDS} onCellsChange={save} toolbar={false} />
      </div>
    </Panel>
  );
}

function RatingCard() {
  const [intent, setIntent] = useState<number | null>(4);
  const [empty, setEmpty] = useState<number | null>(null);
  return (
    <Panel title="评分" description="实心星 + 注意色；没点亮的是浅灰实心星；悬停预览，再点一次当前值 = 清空；← → 调">
      <div style={states} id="num-rating">
        <FormField label="购买意向" htmlFor="rate-a"><Rating label="购买意向" value={intent} onChange={setIntent} size="md" labels={WORDS} /></FormField>
        <FormField label="装机满意度（未评）" htmlFor="rate-b"><Rating label="装机满意度" value={empty} onChange={setEmpty} size="md" labels={SATISFY} /></FormField>
        <FormField label="格子 · 13px" htmlFor="rate-c"><Rating label="格子评分" value={3} /></FormField>
        <FormField label="只读 / 禁用" htmlFor="rate-d">
          <span style={{ display: "inline-flex", gap: 16, alignItems: "center" }}>
            <Rating label="只读评分" value={5} size="md" />
            <Rating label="禁用评分" value={2} onChange={() => undefined} disabled />
          </span>
        </FormField>
      </div>
    </Panel>
  );
}

function SliderCard() {
  const [win, setWin] = useState<number | null>(60);
  const [budget, setBudget] = useState<number | null>(35);
  return (
    <Panel title="滑块（新增）" description="只给「大概值」用：赢率、满意度；精确数字还是数字框。滑块旁边带一个小数字框，可拖可打字">
      <div style={{ display: "grid", gap: 16 }} id="num-slider">
        <div style={{ maxWidth: 560 }}>
          <FormField label="赢率" htmlFor="slide-win" hint="一格 10%；方向键也能调">
            <span id="slide-win"><PercentInput slider label="赢率" value={win} onChange={setWin} step={10} /></span>
          </FormField>
        </div>
        <div style={states}>
          <FormField label="预算范围上限（带刻度文字）" htmlFor="slide-budget">
            <span id="slide-budget"><Slider label="预算范围上限" value={budget} onChange={setBudget} step={5} unit=" 万" scale /></span>
          </FormField>
          <FormField label="禁用" htmlFor="slide-off">
            <span id="slide-off"><Slider label="禁用滑块" value={40} onChange={() => undefined} disabled /></span>
          </FormField>
        </div>
      </div>
    </Panel>
  );
}
