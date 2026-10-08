// PublicResult 四种语气：success（默认）· info · warning · danger。失效 / 撤回的链接用 danger。
import { useState } from "react";
import { Button, PublicResult, SegmentedControl } from "@adminui/react";

const CASES = {
  success: { title: "提交成功", description: "顾问会在 1 个工作日内联系你。" },
  info: { title: "这份表单已经填过了", description: "同一个链接只能提交一次；要改内容请联系发给你链接的人。" },
  warning: { title: "表单暂停收集", description: "发起人暂停了这份表单，稍后再试。" },
  danger: { title: "链接已失效", description: "这个分享链接已过期或被撤回，请向发起人要一个新链接。" },
} as const;
type Tone = keyof typeof CASES;

export function Demo() {
  const [tone, setTone] = useState<Tone>("danger");
  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
      <SegmentedControl label="语气" value={tone} onValueChange={setTone} options={(Object.keys(CASES) as Tone[]).map((t) => ({ value: t, label: t }))} />
      <div style={{ width: "100%", maxWidth: 440 }}>
        <PublicResult tone={tone} title={CASES[tone].title} description={CASES[tone].description} meta="免费试用申请 · 2026-10-08" actions={<Button variant="outline">回到首页</Button>} />
      </div>
    </div>
  );
}
