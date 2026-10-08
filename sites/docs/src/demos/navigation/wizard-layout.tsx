// 向导外框 WizardLayout：头部步骤条 · 中间一次一步 · 底部「上一步 / 下一步」，不能下一步时旁边写原因。
import { useState } from "react";
import { Checkbox, FormField, Input, WizardLayout, useNotify } from "@adminui/react";

const STEPS = [
  { key: "upload", label: "上传文件" },
  { key: "map", label: "对应字段" },
  { key: "check", label: "检查数据" },
  { key: "done", label: "完成导入" },
];

export function Demo() {
  const notify = useNotify();
  const [at, setAt] = useState(0);
  const [file, setFile] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const step = STEPS[at] ?? STEPS[0];
  const last = at === STEPS.length - 1;
  const blocked = at === 0 && !file.trim() ? "先填文件名（演示）" : undefined;
  return (
    <WizardLayout
      title="导入客户"
      note="关掉也没关系，进度会保留"
      steps={STEPS}
      current={step?.key ?? "upload"}
      onBack={() => setAt((i) => Math.max(0, i - 1))}
      onNext={() => (last ? notify("已导入 121 个客户", "success") : setAt((i) => i + 1))}
      nextLabel={last ? "完成导入" : "下一步"}
      nextDisabledReason={blocked}
      width={720}
    >
      {at === 0 && (
        <FormField label="文件" htmlFor="wz-file" hint="xlsx 或 csv，最多 5,000 行">
          <Input id="wz-file" value={file} placeholder="例如 客户名单.xlsx" onChange={(e) => setFile(e.target.value)} />
        </FormField>
      )}
      {at === 1 && <p className="aui-note">12 列里对上了 10 个字段；「备注 2」「来源渠道」没有对应，导入时跳过。</p>}
      {at === 2 && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Checkbox checked={dedupe} onCheckedChange={(v) => setDedupe(v === true)} />
          按客户名称查重，重复的只更新不新建
        </label>
      )}
      {at === 3 && <p className="aui-note">准备导入 121 个客户（7 行格式不对，已跳过）。</p>}
    </WizardLayout>
  );
}
