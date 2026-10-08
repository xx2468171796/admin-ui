import { useState } from "react";
import { Button, FormField, PasswordConfirmHint, PasswordInput, PasswordStrength, passwordsMatch } from "@adminui/react";

/** 改密码：眼睛切换显示、大写锁定提醒；强度条 + 要求随打字打勾；「再输一次」当场比对。 */
export function Demo() {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("northstar26");
  const [again, setAgain] = useState("northstar62");
  const mismatch = passwordsMatch(next, again) === "mismatch";
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 400 }}>
      <FormField label="原密码" htmlFor="pw-old" required>
        <PasswordInput id="pw-old" value={old} placeholder="当前使用的密码" onChange={(e) => setOld(e.target.value)} />
      </FormField>
      <div style={{ display: "grid", gap: 6 }}>
        <FormField label="新密码" htmlFor="pw-new" required>
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </FormField>
        <PasswordStrength value={next} hint="打字试试" />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <FormField label="再输一次" htmlFor="pw-again" required>
          <PasswordInput
            id="pw-again"
            autoComplete="new-password"
            value={again}
            aria-invalid={mismatch || undefined}
            aria-describedby="pw-again-hint"
            onChange={(e) => setAgain(e.target.value)}
          />
        </FormField>
        <PasswordConfirmHint id="pw-again-hint" password={next} confirm={again} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button disabled={mismatch} disabledReason={mismatch ? "两次输入的新密码不一样" : undefined}>改密码</Button>
        <span className="aui-text-note">改完其他设备要重新登录</span>
      </div>
    </div>
  );
}
