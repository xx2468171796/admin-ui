// bt/builders-a：公开填写页 + 提交成功页（样稿 D18 / D18m / D18s）。在后台外壳外面，只有 AdminProvider。
// 地址 #form-public=fill（加 &dark 看深色）；手机宽度下有吸顶条「已填 4 / 7 题」。上传走演示存储（假进度，「主卧」文件第一次会失败）。
import { useMemo, useState } from "react";
import { ShieldCheck, ChevronsRight } from "lucide-react";
import { Button } from "@adminui/react";
import { FormBrand, FormSuccess, PublicForm, formSummary, parsePrefill, visibleFormQuestions, type FormAnswers } from "@adminui/react/forms-public";
import { FORM_DEFINITION, FORM_FIELDS, demoUpload } from "./forms-demo";

const brand = <FormBrand logo="A" name="Acme" subtitle="智能家居" />;
const footer = "由 Acme 多维表格 提供 · 你的信息仅用于联系你";
const START: FormAnswers = {
  name: "陈雅婷",
  region: "tp",
  products: ["lock", "curtain"],
  files: [
    { id: "f-living", name: "客厅.jpg", kind: "image", size: 3.2 * 1024 * 1024 },
    { id: "f-plan", name: "户型图-滨江区.pdf", kind: "pdf", size: 2.1 * 1024 * 1024 },
  ],
  budget: "b2",
};

export function FormPublicDemo() {
  // A prefill link (?prefill_来源=展会&hide_来源=1) fills answers and hides those questions.
  const prefill = useMemo(() => parsePrefill(window.location.search, FORM_FIELDS), []);
  const [answers, setAnswers] = useState<FormAnswers>({ ...START, ...prefill.answers });
  const [captcha, setCaptcha] = useState(false);
  const [sent, setSent] = useState<{ answers: FormAnswers; at: string } | null>(null);
  const [round, setRound] = useState(0);
  if (sent) {
    const visible = visibleFormQuestions(FORM_DEFINITION, FORM_FIELDS, sent.answers);
    return (
      <FormSuccess brand={brand} message={FORM_DEFINITION.successMessage} meta={`${FORM_DEFINITION.title} · ${sent.at} 提交`} footer={footer}
        summary={formSummary(FORM_DEFINITION, FORM_FIELDS, sent.answers, visible, { home: "+86" })}
        onFillAgain={() => { setSent(null); setAnswers({}); setCaptcha(false); setRound((n) => n + 1); }} />
    );
  }
  return (
    <PublicForm key={round} form={FORM_DEFINITION} fields={FORM_FIELDS} answers={answers} onAnswersChange={setAnswers} hiddenQuestions={prefill.hidden}
      brand={brand} footer={footer} upload={demoUpload} defaultCountry="+86" captchaDone={captcha}
      captcha={(
        // 演示用：真实页面放人机验证组件（如滑块），验证通过后 captchaDone = true。
        <Button variant="outline" aria-pressed={captcha} onClick={() => setCaptcha(true)}>
          {captcha ? <ShieldCheck /> : <ChevronsRight />}{captcha ? "已通过验证" : "拖动滑块完成验证"}
        </Button>
      )}
      onSubmit={async (submitted) => {
        await new Promise((r) => setTimeout(r, 300));
        if (String(submitted.name ?? "").includes("失败")) throw new Error("网络不稳，没提交成功；已填的内容还在，请再点一次提交");
        setSent({ answers: submitted, at: "2026-10-05 14:32" });
      }} />
  );
}
