// 公开表单 PublicPageLayout：白色品牌带（标志 + 名字 + 小字）+ 右上「已填 N / 3 题」+ 带底细进度线；
// 提交后换成 PublicResult（大圆图标 + 标题 + 下一步 + 灰色时间）。手机上品牌带吸顶，能点的都是 44px。
import { useState } from "react";
import { Button, FormField, Input, PublicPageLayout, PublicResult, Textarea } from "@adminui/react";
import { COMPANY } from "../../data/demo-data";

export function Demo() {
  const [values, setValues] = useState({ company: "", phone: "", need: "" });
  const [sent, setSent] = useState(false);
  const done = Object.values(values).filter((v) => v.trim()).length;
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  return (
    <div style={{ minHeight: 640 }}>
      <PublicPageLayout
        logo={COMPANY.logo}
        brand={COMPANY.name}
        brandNote="免费试用申请"
        title={sent ? undefined : "申请免费试用"}
        description={sent ? undefined : "留下联系方式，顾问会在 1 个工作日内联系你。"}
        progress={sent ? undefined : { done, total: 3 }}
        width={sent ? "narrow" : "form"}
        footer="你的信息只用于联系你，不会给第三方。"
      >
        {sent ? (
          <PublicResult
            title="提交成功"
            description="顾问会在 1 个工作日内打电话给你。"
            meta="免费试用申请 · 2026-10-08 14:32 提交"
            actions={<Button variant="outline" onClick={() => { setSent(false); setValues({ company: "", phone: "", need: "" }); }}>再填一份</Button>}
          />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <FormField label="公司名称" htmlFor="pf-company" required>
              <Input id="pf-company" value={values.company} onChange={set("company")} />
            </FormField>
            <FormField label="手机号" htmlFor="pf-phone" required>
              <Input id="pf-phone" value={values.phone} inputMode="tel" placeholder="例如 13800000000" onChange={set("phone")} />
            </FormField>
            <FormField label="想解决什么问题" htmlFor="pf-need">
              <Textarea id="pf-need" value={values.need} rows={3} onChange={set("need")} />
            </FormField>
            <Button onClick={() => setSent(true)}>提交</Button>
          </div>
        )}
      </PublicPageLayout>
    </div>
  );
}
