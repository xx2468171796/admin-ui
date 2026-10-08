import { useState } from "react";
import { Box, KeyRound, Link2, User } from "lucide-react";
import { Button, PasswordGate, SecretReveal, SharedPageShell } from "@adminui/react";

/**
 * 密码门 → 一次性密钥：输入 7K2Q 打开；输错抖一下 + 写「还能再试 N 次」，连错 3 次出滑块（插槽，这里用按钮模拟），
 * 5 次锁住。打开后只显示一次：倒计时到点自动隐藏，「我记好了，立即销毁」通知服务端。
 */
const brand = (
  <>
    <Box aria-hidden="true" />
    北辰云
  </>
);

export function Demo() {
  const [failed, setFailed] = useState(0);
  const [slid, setSlid] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <div style={{ height: 680, overflow: "auto" }}>
      <SharedPageShell brand={brand} variant="narrow" product="北辰云" footerNote="全程加密">
        {opened ? (
          <SecretReveal
            title="测试环境管理员账号"
            sharedBy={{ name: "吴昊" }}
            sharedAt="10-08 09:30"
            voided={{ title: "这个链接已作废，刷新后无法再看", text: "阅后即焚：吴昊 已收到「已查看」通知" }}
            fields={[
              { key: "account", label: "账号", icon: <User />, value: "admin@example.com" },
              { key: "password", label: "密码", icon: <KeyRound />, value: "Demo#8vQ2-xT9k", secret: true },
              { key: "url", label: "登录网址", icon: <Link2 />, value: "staging.example.com", href: "https://staging.example.com" },
            ]}
            memo={<><b>吴昊：</b>登录后给自己开子账号，别长期用这个总账号。</>}
            onDestroy={async () => {
              await new Promise((r) => setTimeout(r, 250));
            }}
          />
        ) : (
          <PasswordGate
            sharedBy={{ name: "吴昊", org: "北辰云 · 研发部" }}
            title="吴昊 分享给你一个密码"
            hint="输入吴昊另外告诉你的 4 位密码（演示：7K2Q）"
            burn={{ title: "打开后只显示一次，关闭即销毁", text: "看完请记好；关掉页面或 60 秒后就再也看不到" }}
            failed={failed}
            maxAttempts={5}
            captchaAfter={3}
            captcha={
              <Button variant="outline" aria-pressed={slid} onClick={() => setSlid(true)}>
                {slid ? "已通过滑块验证" : "（演示）拖动滑块完成验证"}
              </Button>
            }
            captchaDone={slid}
            contactHint="密码不在这条链接里，问问吴昊"
            expiresText="10-09 20:30 前有效"
            locked={failed >= 5 ? "试错太多次，这个链接已锁定，请联系吴昊重新分享" : undefined}
            onSubmit={async (code) => {
              await new Promise((r) => setTimeout(r, 250));
              if (code.toUpperCase() === "7K2Q") return setOpened(true);
              setFailed((n) => n + 1);
              setSlid(false);
              throw new Error("wrong");
            }}
          />
        )}
      </SharedPageShell>
    </div>
  );
}
