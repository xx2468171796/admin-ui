import { useState } from "react";
import { FormBrand, FormSuccess, PublicForm, formSummary, visibleFormQuestions, type FormAnswers, type FormDefinition, type FormField } from "@adminui/react/forms-public";

// T16 公开页：不用登录、从链接打开。没有后台外壳：品牌条 + 居中一栏 + 底部一句说明；手机整宽、进度吸顶。
const FIELDS: FormField[] = [
  { key: "company", title: "公司名称", type: "text", primary: true },
  { key: "name", title: "您的称呼", type: "text" },
  { key: "phone", title: "手机", type: "phone" },
  { key: "email", title: "工作邮箱", type: "email" },
  { key: "size", title: "公司规模", type: "singleSelect", options: [{ value: "s", label: "50 人以下" }, { value: "m", label: "50 – 200 人" }, { value: "l", label: "200 – 1000 人" }, { value: "xl", label: "1000 人以上" }] },
  {
    key: "modules", title: "想试用的功能", type: "multiSelect",
    options: [{ value: "crm", label: "客户管理", tone: "green" }, { value: "ticket", label: "工单", tone: "blue" }, { value: "invoice", label: "发票", tone: "yellow" }, { value: "report", label: "报表", tone: "violet" }],
  },
  { key: "note", title: "还想告诉我们的", type: "longText" },
];
const FORM: FormDefinition = {
  title: "申请免费试用",
  description: "填好后，我们的顾问会在 1 个工作日内联系您，开通 14 天的企业版试用。",
  successMessage: "顾问会在 1 个工作日内联系您",
  questions: [
    { field: "company", required: true, placeholder: "例如：远航精密制造" },
    { field: "name", required: true, placeholder: "例如：林女士" },
    { field: "phone", required: true },
    { field: "email", placeholder: "name@example.com" },
    { field: "size" },
    { field: "modules", required: true, description: "可多选，我们会按您选的功能准备演示数据" },
    { field: "note" },
  ],
};
const brand = <FormBrand logo="北" name="北辰云" subtitle="客户管理与服务平台" />;
const FOOTER = "由 北辰云 提供 · 您的信息仅用于联系您";

export function Demo() {
  const [answers, setAnswers] = useState<FormAnswers>({ company: "青禾教育", modules: ["crm"] });
  const [sent, setSent] = useState<{ answers: FormAnswers; at: string } | null>(null);

  if (sent) {
    return (
      <div style={{ height: 720, overflow: "auto" }}>
        <FormSuccess
          brand={brand}
          message={FORM.successMessage}
          meta={`${FORM.title} · ${sent.at} 提交`}
          footer={FOOTER}
          summary={formSummary(FORM, FIELDS, sent.answers, visibleFormQuestions(FORM, FIELDS, sent.answers))}
          onFillAgain={() => { setAnswers({}); setSent(null); }}
        />
      </div>
    );
  }
  return (
    <div style={{ height: 720, overflow: "auto" }}>
      <PublicForm
        form={FORM}
        fields={FIELDS}
        answers={answers}
        onAnswersChange={setAnswers}
        brand={brand}
        footer={FOOTER}
        onSubmit={async (submitted) => {
          await new Promise((r) => setTimeout(r, 500));
          setSent({ answers: submitted, at: new Date().toLocaleString("zh-CN", { hour12: false }) });
        }}
      />
    </div>
  );
}
