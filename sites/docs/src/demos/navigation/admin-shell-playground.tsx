// 应用外壳：左上标志 + 产品名 + 当前公司，左下头像行（账号菜单），顶栏面包屑 + 外观，胶囊工作标签。
// 点菜单打开页面，点 ⇤ 收起侧栏（64px），窄到 390 看手机抽屉。
import { useState } from "react";
import { Bell } from "lucide-react";
import { AdminShell, AppearanceButton, IconButton, PageBody, Panel, useNotify, type NavItem, type WorkspaceItem } from "@adminui/react";
import { ACCOUNT, ACCOUNT_MENU, BRAND, COMPANIES, LOGO, SHELL_NAV, navIcon, navTitle } from "../../data/navigation-data";

type Props = { company?: boolean; account?: boolean; badges?: boolean; crumbRoot?: string };

function DemoPage({ title }: { title: string }) {
  return (
    <PageBody>
      <Panel title={title}>
        <p className="aui-note">「{title}」页面的内容。切到别的标签再回来，这一页的输入和滚动位置都还在。</p>
      </Panel>
    </PageBody>
  );
}

const plain = (n: NavItem): NavItem => ({ ...n, badge: undefined, badgeTone: undefined, locked: undefined });

export function Demo({ company = true, account = true, badges = true, crumbRoot = "" }: Props) {
  const notify = useNotify();
  const [open, setOpen] = useState<string[]>(["home", "customers"]);
  const [active, setActive] = useState("customers");
  const [companyId, setCompanyId] = useState("hq");

  const navigate = (id: string) => {
    setOpen((list) => (list.includes(id) ? list : [...list, id]));
    setActive(id);
  };
  const close = (ids: readonly string[]) => {
    const rest = open.filter((id) => !ids.includes(id));
    setOpen(rest);
    if (ids.includes(active)) setActive(rest.at(-1) ?? "home");
  };
  const tabs: WorkspaceItem[] = open.map((id) => ({
    id,
    title: navTitle(id),
    icon: navIcon(id),
    pinned: id === "home",
    content: <DemoPage title={navTitle(id)} />,
  }));

  return (
    <div style={{ height: 600 }}>
      <AdminShell
        logo={LOGO}
        brand={BRAND}
        navigation={badges ? SHELL_NAV : SHELL_NAV.map(plain)}
        tabs={tabs}
        activeId={active}
        onNavigate={navigate}
        onCloseTab={(id) => close([id])}
        onCloseTabs={close}
        crumbRoot={crumbRoot || undefined}
        company={company ? { value: companyId, options: COMPANIES, onSwitch: (id) => { setCompanyId(id); notify("已切换公司", "success"); } } : undefined}
        account={account ? ACCOUNT : undefined}
        accountMenu={ACCOUNT_MENU.map((item) => (item.href ? item : { ...item, onSelect: () => notify(`打开「${item.label}」`, "info") }))}
        onSignOut={() => notify("已退出登录（演示）", "info")}
        headerActions={
          <>
            <IconButton label="通知" badge={5} icon={<Bell />} onClick={() => notify("打开通知中心", "info")} />
            <AppearanceButton />
          </>
        }
      />
    </div>
  );
}
