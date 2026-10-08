// Steps：做完 = 浅主色底 + 勾（字是正文色）· 当前 = 实心主色 + 浅光 + 加粗 · 等别人 = 注意色 · 出错 = 异常色 × · 没到 = 细边灰数字。
// 每步可以有一行说明；传 onStepClick 后做完的步骤能点回去；窄栏用 orientation="vertical"。
import { useState } from "react";
import { Steps } from "@adminui/react";

const IMPORT = [
  { key: "upload", label: "上传文件", description: "客户名单.xlsx · 128 行" },
  { key: "map", label: "对应字段", description: "12 列对上 10 个" },
  { key: "check", label: "检查数据", description: "查重、格式" },
  { key: "done", label: "完成导入" },
];

export function Demo() {
  const [at, setAt] = useState("check");
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <Steps stretch label="导入步骤" current={at} onStepClick={setAt} steps={IMPORT} />
      <Steps stretch label="报价审批" current="approve" steps={[
        { key: "submit", label: "提交报价", description: "陈一鸣 · 10/05" },
        { key: "approve", label: "主管审批", description: "等林晓确认 · 已等 2 天", status: "waiting" },
        { key: "send", label: "发给客户" },
      ]} />
      <Steps stretch label="导入结果" current="check" steps={[
        { key: "upload", label: "上传文件" },
        { key: "check", label: "检查数据", description: "7 行手机号格式不对", status: "error" },
        { key: "done", label: "完成导入" },
      ]} />
      <div style={{ maxWidth: 320 }}>
        <Steps orientation="vertical" label="开通进度" current="train" steps={[
          { key: "sign", label: "签约", description: "10/02 · 远航精密制造" },
          { key: "setup", label: "开通账号", description: "120 席位 · 10/03" },
          { key: "train", label: "上线培训", description: "今天 14:00 – 16:00" },
          { key: "accept", label: "验收" },
        ]} />
      </div>
    </div>
  );
}
