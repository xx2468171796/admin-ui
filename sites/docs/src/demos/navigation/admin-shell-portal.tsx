// 客户自助中心：variant="portal" 没有工作标签和面包屑，只挂当前页；手机底部一条导航（≤ 4 项 +「更多」）。
import { useState } from "react";
import { CreditCard, FileText, Headphones, Home, KeyRound, Users } from "lucide-react";
import { AdminShell, AppearanceButton, Button, PageBody, Panel, type NavItem, type WorkspaceItem } from "@adminui/react";
import { BRAND, LOGO } from "../../data/navigation-data";

const NAV: readonly NavItem[] = [
  { id: "overview", title: "概览", icon: Home },
  { id: "billing", title: "账单与发票", shortTitle: "账单", icon: CreditCard },
  { id: "seats", title: "席位与成员", shortTitle: "成员", icon: Users },
  { id: "keys", title: "密钥与接入", shortTitle: "接入", icon: KeyRound },
  { id: "tickets", title: "工单", icon: Headphones, badge: 2 },
  { id: "docs", title: "使用文档", icon: FileText },
];

export function Demo() {
  const [active, setActive] = useState("overview");
  const current = NAV.find((n) => n.id === active) ?? NAV[0];
  const tabs: WorkspaceItem[] = current
    ? [{
        id: current.id,
        title: current.title,
        icon: current.icon,
        content: (
          <PageBody>
            <Panel title={current.title} actions={<Button size="sm" variant="outline">联系客服</Button>}>
              <p className="aui-note">远航精密制造 · 专业版 120 席位。这里是「{current.title}」的内容。</p>
            </Panel>
          </PageBody>
        ),
      }]
    : [];
  return (
    <div style={{ height: 560 }}>
      <AdminShell
        variant="portal"
        logo={LOGO}
        brand={`${BRAND} 客户中心`}
        mobileTitle="客户中心"
        mobileNav={["overview", "billing", "seats", "tickets"]}
        navigation={NAV}
        tabs={tabs}
        activeId={active}
        onNavigate={setActive}
        onCloseTab={() => undefined}
        headerActions={<AppearanceButton />}
      />
    </div>
  );
}
