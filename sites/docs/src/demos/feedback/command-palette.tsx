import { Building2, Plus } from "lucide-react";
import { CommandPalette, navCommands, useNotify, type CommandItem, type CommandProvider } from "@adminui/react";
import { CUSTOMERS, personName, stageLabel } from "../../data/demo-data";

const NAV = [
  { id: "dashboard", title: "工作台", group: "首页" },
  { id: "customers", title: "客户", group: "销售", keywords: "客户列表 公司" },
  { id: "deals", title: "商机", group: "销售" },
  { id: "reports", title: "报表", group: "分析" },
  { id: "members", title: "成员与权限", group: "设置", keywords: "账号 角色" },
];

/**
 * 搜索与命令（Ctrl / ⌘ K）：navCommands 把菜单变成「页面」组；providers 每个模块一组（这里是假的客户搜索）；
 * 搜不到时给 emptyActions 退路。试试输入「青禾」「报表」或「花莲」。
 */
export function Demo() {
  const notify = useNotify();
  const commands = navCommands(NAV, (id) => notify(`打开页面：${id}`, "info"), [
    { id: "new-customer", label: "新建客户", shortcut: "N", run: () => notify("新建客户", "info") },
    { id: "password", label: "修改密码", keywords: "安全", run: () => notify("修改密码", "info") },
    { id: "dark", label: "切换深色模式", run: () => notify("已切换", "info") },
  ]);
  const customers: CommandProvider = {
    id: "customers",
    label: "客户",
    icon: <Building2 />,
    search: async (q, { signal, limit }) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (signal.aborted) return [];
      return CUSTOMERS.filter((c) => c.name.includes(q))
        .slice(0, limit)
        .map((c): CommandItem => ({ id: c.id, title: c.name, meta: `${stageLabel(c.stage)} · ${c.city} · ${personName(c.owner)}` }));
    },
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <CommandPalette
        commands={commands}
        providers={[customers]}
        placeholder="搜索客户、页面，或输入命令…"
        onSelect={(item) => notify(`打开客户：${item.title}`, "info")}
        onSearchAll={(q) => notify(`在全部客户里搜「${q}」`, "info")}
        emptyActions={(q) => [{ id: `create:${q}`, title: `新建客户「${q}」`, icon: <Plus />, run: () => notify(`新建客户「${q}」`) }]}
      />
      <span className="aui-note">点搜索框，或按 Ctrl K</span>
    </div>
  );
}
