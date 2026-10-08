// 登录页 AuthLayout + LoginForm：居中 420 一栏，标志方块 +「登录 产品名」+ 一行说明。
// 登录按钮永远能点：空着点 → 字段下面写缺什么；onSubmit 抛 Error(人话) → 卡片顶上一条提示。密码少于 8 位算错。
import { Button, AuthLayout, LoginForm, useNotify } from "@adminui/react";
import { COMPANY } from "../../data/demo-data";

export function Demo() {
  const notify = useNotify();
  return (
    <div style={{ height: 600 }}>
      <AuthLayout
        logo={COMPANY.logo}
        title={`登录 ${COMPANY.name}`}
        description="用公司给你的账号登录"
        footer={`© ${COMPANY.en} · 登录遇到问题找公司管理员`}
      >
        <LoginForm
          remember={{ label: "7 天内自动登录" }}
          forgot={<Button variant="text" size="sm" onClick={() => notify("请找公司管理员重置密码", "info")}>忘记密码</Button>}
          onSubmit={async ({ password }) => {
            await new Promise((r) => window.setTimeout(r, 500));
            if (password.length < 8) throw Error("账号或密码不对，还能试 4 次；忘了找公司管理员重置");
            notify("登录成功（演示）", "success");
          }}
        />
      </AuthLayout>
    </div>
  );
}
