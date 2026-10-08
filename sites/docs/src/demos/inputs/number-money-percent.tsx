import { useState } from "react";
import { FormField, MoneyInput, NumberInput, PercentBar, PercentInput, rangeMessage } from "@adminui/react";

const grid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", alignItems: "start" } as const;

/** 数字框、金额（币种一格 + 千分位 + 「约 X 万」）、百分比（框里写 % + 细条）。 */
export function Demo() {
  const [seats, setSeats] = useState<number | null>(120);
  const [area, setArea] = useState<number | null>(1200);
  const [win, setWin] = useState<number | null>(120);
  const [currency, setCurrency] = useState("CNY");
  const [plan, setPlan] = useState<number | null>(8_600_000);
  const [deal, setDeal] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(60);
  const winError = rangeMessage(win, 0, 100, "%");
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={grid}>
        <FormField label="席位数" htmlFor="nm-seats" hint="↑ ↓ 加减，Shift 一次 10">
          <NumberInput id="nm-seats" value={seats} onChange={setSeats} min={0} />
        </FormField>
        <FormField label="办公面积" htmlFor="nm-area" hint="离开时加千分位">
          <NumberInput id="nm-area" value={area} onChange={setArea} thousands unit="㎡" />
        </FormField>
        <FormField label="赢率（超出范围）" htmlFor="nm-win" error={winError ? `赢率${winError}` : undefined}>
          <NumberInput id="nm-win" value={win} onChange={setWin} min={0} max={100} unit="%" clamp={false} />
        </FormField>
      </div>
      <div style={grid}>
        <FormField label="预计金额" htmlFor="nm-plan">
          <MoneyInput id="nm-plan" value={plan} onChange={setPlan} currency={currency} onCurrencyChange={setCurrency} />
        </FormField>
        <FormField label="成交金额（币种固定）" htmlFor="nm-deal" hint="币种在字段设置里定，这里只读">
          <MoneyInput id="nm-deal" value={deal} onChange={setDeal} currency="CNY" />
        </FormField>
        <FormField label="续费折扣" htmlFor="nm-rate">
          <PercentInput id="nm-rate" value={rate} onChange={setRate} step={10} bar />
        </FormField>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <span className="aui-text-note">表格格子里的百分比：</span>
        <PercentBar value={60} label="赢率" />
        <PercentBar value={25} label="赢率" />
        <PercentBar value={10} label="赢率" bar={false} />
      </div>
    </div>
  );
}
