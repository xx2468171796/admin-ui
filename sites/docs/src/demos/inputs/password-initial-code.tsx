import { useState } from "react";
import { CodeInput, FormField, InitialPasswordField, type InitialPasswordValue } from "@adminui/react";

/** 新建成员的初始密码（自动生成 / 我来设，摆在明面上）；分格密码：自动跳格、可粘贴整段、错了红边 + 抖一下。 */
export function Demo() {
  const [initial, setInitial] = useState<InitialPasswordValue>({ mode: "auto", password: "" });
  const [code, setCode] = useState("");
  const [fails, setFails] = useState(0);
  const [opened, setOpened] = useState(false);
  const check = (value: string) => {
    if (value === "A7K2") setOpened(true);
    else {
      setFails((n) => Math.min(5, n + 1));
      setCode("");
    }
  };
  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", alignItems: "start" }}>
      <FormField label="初始密码" htmlFor="pw-initial">
        <InitialPasswordField id="pw-initial" value={initial} onChange={setInitial} autoHelp="建好后只显示这一次，请当面告诉对方；他第一次登录时要改。" />
      </FormField>
      <div style={{ display: "grid", gap: 8 }}>
        <p className="aui-text-note" style={{ margin: 0 }}>访问密码：试试 A7K2（对）或别的（错）</p>
        <CodeInput
          label="访问密码"
          value={code}
          onChange={setCode}
          onComplete={check}
          error={opened ? undefined : fails ? `密码不对，还能试 ${5 - fails} 次` : undefined}
          maxTries={5}
          triesLeft={5 - fails}
          shakeKey={fails}
          disabled={opened || fails >= 5}
        />
        {opened && <p className="aui-text-note" style={{ margin: 0 }}>密码对了，正在打开…</p>}
      </div>
    </div>
  );
}
