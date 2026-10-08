// 演示数据是中文语境：明确设地区默认值（SDK 默认中性：浏览器时区、不带币种、区号按浏览器语言）。
export const DEMO_DEFAULTS = { timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" } as const;
