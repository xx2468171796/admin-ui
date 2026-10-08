// bt/templates：T16 公开页（样稿 D18 填表 / D18m 手机填表 / D18s 提交成功 / D21 访客页 / D21m 密码门）——不在后台外壳里：
// 品牌条 + 居中一栏 + 底部说明；手机上整宽、进度吸顶、控件 ≥ 44px。
// 地址 #template=t16-form | t16-success | t16-expired | t16-visitor | t16-password（加 &dark 看深色）。
// 填表 = PublicForm、提交成功 = FormSuccess（@adminui/react/forms-public，题目与「表单」示例同一份 forms-demo）；
// 访客页、密码门直接用分享套件。不是表单的公开结果页（链接已失效、已撤回）用 PublicPageLayout + PublicResult（t16-expired）。
import { useState } from "react";
import { Box, ChevronsRight, ShieldCheck } from "lucide-react";
import { Button, PublicPageLayout, PublicResult } from "@adminui/react";
import { FormBrand, FormSuccess, PublicForm, formSummary, visibleFormQuestions, type FormAnswers } from "@adminui/react/forms-public";
import { FORM_DEFINITION, FORM_FIELDS, demoUpload } from "./forms-demo";
import { SharePublicDemo } from "./SharePublicDemo";

export type PublicTemplateKind = "form" | "success" | "expired" | "visitor" | "password";
const brand = <FormBrand logo="A" name="Acme" subtitle="智能家居" />;
const FOOTER = "由 Acme 多维表格 提供 · 你的信息仅用于联系你";
/** What the visitor has typed so far (a half-filled form, as in D18). */
const START: FormAnswers = {
  name: "陈雅婷",
  region: "sh",
  products: ["lock", "curtain"],
  files: [
    { id: "t16-living", name: "客厅.jpg", kind: "image", size: 3.2 * 1024 * 1024 },
    { id: "t16-plan", name: "户型图-滨江区.pdf", kind: "pdf", size: 2.1 * 1024 * 1024 },
  ],
  budget: "b2",
};
/** The success page shows what was sent (or a typical submission when opened directly). */
let lastSent: { answers: FormAnswers; at: string } = {
  answers: { ...START, phone: "+86 13800138000", contactAt: "2026-10-08" },
  at: "2026-10-05 14:32",
};

export function TemplatePublic({ kind }: { kind: PublicTemplateKind }) {
  if (kind === "visitor") return <SharePublicDemo kind="visitor" />;
  if (kind === "password") return <SharePublicDemo kind="password" />;
  if (kind === "success") return <SuccessPage />;
  if (kind === "expired") return <ExpiredPage />;
  return <FormPage />;
}

function FormPage() {
  const [answers, setAnswers] = useState<FormAnswers>(START);
  const [captcha, setCaptcha] = useState(false);
  return (
    <PublicForm form={FORM_DEFINITION} fields={FORM_FIELDS} answers={answers} onAnswersChange={setAnswers} brand={brand} footer={FOOTER} upload={demoUpload} defaultCountry="+86" captchaDone={captcha}
      captcha={(
        // 演示用：真实页面放人机验证组件（如滑块），验证通过后 captchaDone = true。
        <Button variant="outline" aria-pressed={captcha} onClick={() => setCaptcha(true)}>
          {captcha ? <ShieldCheck /> : <ChevronsRight />}{captcha ? "已通过验证" : "拖动滑块完成验证"}
        </Button>
      )}
      onSubmit={async (submitted) => {
        await new Promise((r) => setTimeout(r, 300));
        lastSent = { answers: submitted, at: "2026-10-05 14:32" };
        window.location.hash = "template=t16-success";
      }} />
  );
}

function SuccessPage() {
  const visible = visibleFormQuestions(FORM_DEFINITION, FORM_FIELDS, lastSent.answers);
  return (
    <FormSuccess brand={brand} message={FORM_DEFINITION.successMessage} meta={`${FORM_DEFINITION.title} · ${lastSent.at} 提交`} footer={FOOTER}
      summary={formSummary(FORM_DEFINITION, FORM_FIELDS, lastSent.answers, visible, { home: "+86" })}
      onFillAgain={() => { window.location.hash = "template=t16-form"; }} />
  );
}

/** A public link that no longer works: PublicPageLayout (narrow) + PublicResult. */
function ExpiredPage() {
  return (
    <PublicPageLayout brand={<><Box aria-hidden="true" />Acme</>} brandNote="智能家居" width="narrow" footer={FOOTER}>
      <PublicResult
        tone="warning"
        title="这个表单已停止收集"
        description="官网咨询表单 10 月 1 日起不再接受新的填写。想联系顾问，请拨打 400-123-4567（周一至周六 9:00–18:00）。"
        meta="Acme · 客户服务部"
        actions={<Button variant="outline" size="lg" onClick={() => { window.location.hash = "template=t16-form"; }}>看看现在的咨询表单</Button>}
        note="可以关闭这个页面了"
      />
    </PublicPageLayout>
  );
}
