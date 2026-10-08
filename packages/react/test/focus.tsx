import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AdminProvider,
  Button,
  Dialog,
  FormDialog,
  Input,
  AppearanceButton,
} from "../src/index.ts";
import "../src/styles.css";
/**
 * Adversarial focus harness. The starter always keeps its trigger mounted, so it cannot
 * tell a working return-focus implementation from one that is quietly riding on Radix.
 * Here the host also re-creates the trigger while the dialog is open, which is what a
 * real console does when saving refreshes the list the trigger lives in.
 */
function Harness() {
  const [plain, setPlain] = useState(false);
  const [form, setForm] = useState(false);
  const [value, setValue] = useState("");
  const [volatile, setVolatile] = useState(false);
  const [generation, setGeneration] = useState(0);
  return (
    <>
      {/* A non-focusable element right next to the triggers: focus must never land here. */}
      <style>{".focus-probe-style{color:red}"}</style>
      <Button id="open-plain" onClick={() => setPlain(true)}>
        打开只读弹层
      </Button>
      <Button id="open-form" onClick={() => setForm(true)}>
        打开表单弹层
      </Button>
      <span key={generation}>
        <Button
          id="open-volatile"
          onClick={() => {
            setVolatile(true);
            // The trigger's identity is destroyed while the dialog is open.
            setTimeout(() => setGeneration((n) => n + 1), 0);
          }}
        >
          打开后销毁触发按钮
        </Button>
      </span>
      <output id="focus-state" />
      <Dialog
        open={plain}
        title="只读弹层"
        description="没有保存动作。"
        onClose={() => setPlain(false)}
        footer={
          <Button id="plain-footer" onClick={() => setPlain(false)}>
            关闭
          </Button>
        }
      >
        <p>结果内容。</p>
      </Dialog>
      <Dialog
        open={volatile}
        title="触发按钮已被销毁"
        onClose={() => setVolatile(false)}
      >
        <p>关闭后开启者已经不在文档里。</p>
      </Dialog>
      <FormDialog
        open={form}
        title="表单弹层"
        description="保存后关闭。"
        dirty={false}
        onClose={() => setForm(false)}
        onSubmit={async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }}
      >
        <label htmlFor="focus-value">内容</label>
        <Input
          id="focus-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </FormDialog>
      <AppearanceButton label="色卡设置" icon="palette" />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <AdminProvider storageKey="test-focus">
    <Harness />
  </AdminProvider>,
);
