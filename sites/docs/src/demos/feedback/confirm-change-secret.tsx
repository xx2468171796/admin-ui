import { useState } from "react";
import { Button, ChangeList, ConfirmDialog, OneTimeSecretDialog } from "@adminui/react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 改配置先给看改动清单（ChangeList）再确认；新建密钥用 OneTimeSecretDialog——没复制或没勾「我已保存」关不掉。 */
export function Demo() {
  const [review, setReview] = useState(false);
  const [secret, setSecret] = useState("");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button variant="outline" onClick={() => setReview(true)}>保存公海规则</Button>
      <Button variant="outline" onClick={() => setSecret("sk_test_7f3a9c21e84b4d0fa6c2b19e5d830a71")}>新建 API 密钥</Button>
      <ConfirmDialog
        open={review}
        size="md"
        title="保存公海规则的 3 处改动？"
        description="保存后对全部销售生效。"
        confirmLabel="保存改动"
        reason={{ label: "改动说明", placeholder: "写给以后查记录的人看" }}
        onConfirm={() => wait(500)}
        onClose={() => setReview(false)}
      >
        <ChangeList
          items={[
            { label: "几天没跟进退回公海", from: 7, to: 14, unit: "天", effect: "立即" },
            { label: "每人认领上限", from: 50, to: 80, unit: "位", effect: "立即" },
            { label: "退回前提醒", from: "关", to: "提前 1 天", effect: "明天起" },
          ]}
        />
      </ConfirmDialog>
      <OneTimeSecretDialog
        open={Boolean(secret)}
        title="API 密钥已生成"
        description="用于调用开放接口，权限与你的账号相同。"
        secret={secret}
        usage={<span>请求头写 <code>Authorization: Bearer &lt;密钥&gt;</code></span>}
        onClose={() => setSecret("")}
      />
    </div>
  );
}
