import { PageBody, PageHeader } from "@adminui/react";
import { InputsCoreSections } from "./inputs-core-demo";
import { NumbersSection } from "./inputs-numbers-demo";
import { UploadPasswordSection } from "./inputs-upload-demo";
import { ConditionFieldSection } from "./inputs-condition-demo";

// 输入与表单演示页：各分区在自己的文件里。
export function InputsShowcase() {
  return (
    <>
      <PageHeader title="输入与表单" description="文本框、数字与金额、上传与密码、条件编辑器与字段配置。" />
      <PageBody>
        <InputsCoreSections />
        <div id="inputs-numbers"><NumbersSection /></div>
        <div id="inputs-upload"><UploadPasswordSection /></div>
        <div id="inputs-condition"><ConditionFieldSection /></div>
      </PageBody>
    </>
  );
}
