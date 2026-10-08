import { useState } from "react";
import { Button, BottomSheet, FormField, Textarea } from "@adminui/react";

/** 手机上的快速表单：BottomSheet 传 onDone，头部变成「取消 · 标题 · 完成」。没填内容时「完成」灰掉。 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Button variant="outline" onClick={() => { setText(""); setOpen(true); }}>写跟进</Button>
      {saved && <span className="aui-note">刚记下：{saved}</span>}
      <BottomSheet
        open={open}
        title="写跟进"
        doneDisabled={!text.trim()}
        onClose={() => setOpen(false)}
        onDone={() => {
          setSaved(text.trim());
          setOpen(false);
        }}
      >
        <FormField label="跟进内容" htmlFor="sheet-bottom-text">
          <Textarea id="sheet-bottom-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="电话沟通了报价…" />
        </FormField>
      </BottomSheet>
    </div>
  );
}
