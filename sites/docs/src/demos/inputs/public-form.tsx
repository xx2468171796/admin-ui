import { useState } from "react";
import { ChevronsRight, ShieldCheck } from "lucide-react";
import { Button } from "@adminui/react";
import { FormBrand, FormSuccess, PublicForm, formSummary, visibleFormQuestions, type FormAnswers } from "@adminui/react/forms-public";
import { FORM_DEFINITION, FORM_FIELDS, fakeUpload } from "../../data/inputs-data";

const brand = <FormBrand logo="北" name="北辰云" subtitle="Northstar Cloud" />;
const footer = "你的信息只用于安排演示";

/**
 * 公开填写页（不用登录）：品牌头 + 进度、控件 44px、提交时顶部汇总 + 每题标红；成功页：打勾 + 摘要（手机号打码）+ 再填一份。
 * 不填直接点「提交」看出错；选上「开放接口」会多出一道上传题（显示条件）。
 */
export function Demo() {
  const [answers, setAnswers] = useState<FormAnswers>({ name: "林女士", modules: ["crm"] });
  const [captcha, setCaptcha] = useState(false);
  const [sent, setSent] = useState<FormAnswers | null>(null);
  const [round, setRound] = useState(0);
  const again = () => {
    setSent(null);
    setAnswers({});
    setCaptcha(false);
    setRound((n) => n + 1);
  };
  return (
    // 演示框固定高度、内部滚动；真实页面里它们就是整页。
    <div style={{ height: 620, overflow: "auto" }}>
      {sent ? (
        <FormSuccess
          brand={brand}
          footer={footer}
          message={FORM_DEFINITION.successMessage}
          meta={`${FORM_DEFINITION.title} · 刚刚提交`}
          summary={formSummary(FORM_DEFINITION, FORM_FIELDS, sent, visibleFormQuestions(FORM_DEFINITION, FORM_FIELDS, sent), { maskPhones: true, home: "+86" })}
          onFillAgain={again}
        />
      ) : (
        <PublicForm
          key={round}
          form={FORM_DEFINITION}
          fields={FORM_FIELDS}
          answers={answers}
          onAnswersChange={setAnswers}
          brand={brand}
          footer={footer}
          upload={fakeUpload}
          defaultCountry="+86"
          captchaDone={captcha}
          captcha={
            // 真实页面这里放人机验证（滑块），通过后 captchaDone = true。
            <Button variant="outline" aria-pressed={captcha} onClick={() => setCaptcha(true)}>
              {captcha ? <ShieldCheck aria-hidden="true" /> : <ChevronsRight aria-hidden="true" />}
              {captcha ? "已通过验证" : "点这里模拟人机验证"}
            </Button>
          }
          onSubmit={async (submitted) => {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            setSent(submitted);
          }}
        />
      )}
    </div>
  );
}
