// 顶栏 + 工作标签：面包屑（crumbRoot → 菜单分组 / 自定义 crumbs → 当前页）、搜索与命令（Ctrl/⌘ K）、通知、外观。
// 标签放不下时两头渐隐，右端「N ⌄」列出全部；右键 / 列表里有「关闭其他 / 关闭右侧」；「合同」没保存，琥珀圆点。
import { useState } from "react";
import { Bell, FileText } from "lucide-react";
import {
  AdminShell,
  AppearanceButton,
  CommandPalette,
  IconButton,
  PageBody,
  Panel,
  navCommands,
  useNotify,
  type WorkspaceItem,
} from "@adminui/react";
import { ACCOUNT, BRAND, COMPANIES, LOGO, SHELL_NAV, navIcon, navTitle } from "../../data/navigation-data";
import { CUSTOMERS } from "../../data/demo-data";

const FIRST = ["home", "customers", "deals", "contracts", "reports", "billing", "members", "roles", "settings"];
const RECORD = CUSTOMERS[0];

export function Demo() {
  const notify = useNotify();
  const [open, setOpen] = useState<string[]>([...FIRST, "record"]);
  const [active, setActive] = useState("record");
  const navigate = (id: string) => {
    if (SHELL_NAV.some((n) => n.id === id && n.locked)) return;
    setOpen((list) => (list.includes(id) ? list : [...list, id]));
    setActive(id);
  };
  const close = (ids: readonly string[]) => {
    // 没保存的标签不直接关：真实项目里先弹确认。
    const closing = ids.filter((id) => id !== "contracts");
    if (closing.length < ids.length) notify("「合同」有没保存的改动，先保存或放弃", "info");
    const rest = open.filter((id) => !closing.includes(id));
    setOpen(rest);
    if (closing.includes(active)) setActive(rest.at(-1) ?? "home");
  };
  const tabs: WorkspaceItem[] = open.map((id) => {
    const isRecord = id === "record";
    const title = isRecord ? RECORD?.name ?? "客户详情" : navTitle(id);
    return {
      id,
      title,
      icon: isRecord ? FileText : navIcon(id),
      pinned: id === "home",
      dirty: id === "contracts",
      crumbs: isRecord ? [{ label: "业务" }, { label: "客户", onClick: () => navigate("customers") }] : undefined,
      content: (
        <PageBody>
          <Panel title={title}>
            <p className="aui-note">顶栏面包屑由外壳自动生成；这一页的上一级「客户」可以点。</p>
          </Panel>
        </PageBody>
      ),
    };
  });
  return (
    <div style={{ height: 560 }}>
      <AdminShell
        logo={LOGO}
        brand={BRAND}
        crumbRoot={BRAND}
        company={{ value: "hq", options: COMPANIES, onSwitch: () => notify("已切换公司", "success") }}
        account={ACCOUNT}
        onSignOut={() => notify("已退出登录（演示）", "info")}
        navigation={SHELL_NAV}
        tabs={tabs}
        activeId={active}
        onNavigate={navigate}
        onCloseTab={(id) => close([id])}
        onCloseTabs={close}
        headerActions={
          <>
            <CommandPalette commands={navCommands(SHELL_NAV, navigate)} placeholder="搜索页面、客户，或输入命令…" />
            <IconButton label="通知" badge={5} icon={<Bell />} onClick={() => notify("打开通知中心", "info")} />
            <AppearanceButton />
          </>
        }
      />
    </div>
  );
}
