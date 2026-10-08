// 菜单与行操作（一种外观、行高 32、中性悬停、快捷键写短、灰掉写原因、多选菜单头、手机操作单）、
// 弹出面板（贴按钮、触发按钮打开 / 已生效两种样子）、操作结果提示（六种）与行内提示（四种口气 × 三种密度 + 横幅）。
import { useRef, useState } from "react";
import { Copy, Download, FileText, Filter, Link2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  Button,
  ContextMenu,
  InlineAlert,
  MenuButton,
  MoreMenu,
  Panel,
  PopoverPanel,
  CompactTable,
  useNotify,
  useUndoToast,
  type MenuSection,
} from "@adminui/react";

const ROW = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } as const;
const CUSTOMERS = ["赵静怡", "陈冠宇", "张建宏", "蔡佩珊"];

const cellMenu = (name: string): MenuSection[] => [
  {
    items: [
      { key: "copy", label: "复制", icon: <Copy />, shortcut: "Mod+C" },
      { key: "open", label: "展开记录", icon: <FileText />, shortcut: "Shift+Enter" },
      { key: "star", label: "关注", icon: <Star />, checked: true },
      {
        key: "move",
        label: "移到阶段",
        icon: <Link2 />,
        items: [{ items: [{ key: "s1", label: "首通" }, { key: "s2", label: "需求确认" }, { key: "s3", label: "报价" }, { key: "s4", label: "谈判" }] }],
      },
    ],
  },
  { items: [{ key: "export", label: "导出这一行", icon: <Download />, disabled: true, disabledReason: "管理员关掉了导出" }] },
  { items: [{ key: "delete", label: `删除「${name}」`, icon: <Trash2 />, danger: true, shortcut: "Mod+Backspace" }] },
];

export function MenusDemo() {
  const notify = useNotify();
  const undoable = useUndoToast();
  const [rows, setRows] = useState(CUSTOMERS);
  const newMenu: MenuSection[] = [{ items: [{ key: "rec", label: "新建记录", icon: <Plus />, shortcut: "N" }, { key: "imp", label: "从 Excel 导入", icon: <Download /> }, { key: "form", label: "新建表单", icon: <FileText /> }] }];
  const multi: MenuSection[] = [{ items: [{ key: "assign", label: "转交 {count} 条", count: 3, icon: <Pencil /> }] }, { items: [{ key: "del", label: "删除 {count} 条记录", count: 3, icon: <Trash2 />, danger: true }] }];
  return (
    <Panel title="菜单与行操作" description="一种外观：圆角 12、行高 32、悬停中性浅底；鼠标打开不高亮、键盘打开高亮第一项；危险项在最后；手机上「⋯」是底部操作单。">
      <div id="ov-menus" style={ROW}>
        <MenuButton variant="outline" label="新建" sections={newMenu}>
          <Plus />
          新建 ▾
        </MenuButton>
        <MoreMenu label="视图更多" sections={[{ items: [{ key: "rename", label: "重命名视图", icon: <Pencil /> }, { key: "dup", label: "复制视图", icon: <Copy /> }] }, { items: [{ key: "del", label: "删除视图", icon: <Trash2 />, danger: true }] }]} />
        <MenuButton variant="outline" label="已选 3 条" header={<><b>已选 3 条</b>：赵静怡、陈冠宇…</>} sections={multi}>
          批量操作 ▾
        </MenuButton>
      </div>
      <ContextMenu label="单元格菜单" sections={(target) => cellMenu(target.closest("tr")?.querySelector("td, th[scope=row]")?.textContent?.trim() ?? "")}>
        <div id="ov-menu-table" style={{ marginTop: 12 }}>
          <CompactTable
            caption="客户（右键试试）"
            rows={rows.map((name) => ({ id: name, name }))}
            getRowId={(row) => row.id}
            fields={[{ key: "name", title: "客户（右键试试）", type: "text" }]}
            rowActions={(row) => [
              { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => notify(`编辑 ${row.name}`, "info") },
              { key: "copy", label: "复制", icon: <Copy />, onSelect: () => notify(`已复制 ${row.name}`) },
              { key: "export", label: "导出", icon: <Download />, disabled: true, disabledReason: "管理员关掉了导出", onSelect: () => undefined },
              {
                key: "delete",
                label: "删除",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => {
                  const before = rows;
                  void undoable({ title: "已删除客户", description: row.name, run: () => setRows((list) => list.filter((n) => n !== row.name)), undo: () => setRows(before) });
                },
              },
            ]}
          />
        </div>
      </ContextMenu>
    </Panel>
  );
}

export function PopoverDemo() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(0);
  return (
    <Panel title="弹出面板" description="贴触发按钮左边缘往下；触发按钮打开时浅灰底，已生效时主色浅底 + 数字。">
      <div id="ov-popover" style={ROW}>
        <Button ref={anchor} variant="ghost" aria-expanded={open} data-applied={applied ? "" : undefined} onClick={() => setOpen((v) => !v)}>
          <Filter />
          筛选{applied ? ` ${applied}` : ""}
        </Button>
      </div>
      <PopoverPanel
        open={open}
        anchor={anchor.current}
        onClose={() => setOpen(false)}
        title="筛选"
        help="只改你的个人设置，自动保存。"
        headerExtra={applied ? `符合 23 / 168 位` : undefined}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setApplied((n) => n + 1)}>
              <Plus />
              添加条件
            </Button>
            <span style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" disabled={!applied} onClick={() => setApplied(0)}>
              清空
            </Button>
          </>
        }
      >
        {applied ? <p>阶段 是 谈判{applied > 1 ? "，且 区域 是 上海" : ""}</p> : <p className="aui-note">还没有条件。点「添加条件」开始筛选。</p>}
      </PopoverPanel>
    </Panel>
  );
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export function ToastsDemo() {
  const notify = useNotify();
  const undoable = useUndoToast();
  return (
    <Panel title="操作结果提示与行内提示" description="成功 4 秒、带操作 8 秒（按钮倒数 + 底部细条）、失败不自动消失、鼠标放上去暂停、最多 3 条；进行中完成后原地变结果。">
      <div id="ov-toasts" style={ROW}>
        <Button variant="outline" onClick={() => notify.show({ title: "已保存", description: "赵静怡 · 智能家居客户" })}>
          成功
        </Button>
        <Button variant="outline" onClick={() => notify.show({ title: "已生成报价单", description: "Q-2026-0412", action: { label: "打开", onClick: () => notify("打开报价单", "info") } })}>
          带操作
        </Button>
        <Button variant="outline" onClick={() => void undoable({ title: "已移到「谈判」", description: "赵静怡", undo: () => undefined })}>
          能撤销
        </Button>
        <Button variant="outline" onClick={() => notify.show({ title: "导入了 125 行，3 行没导入", description: "第 12、48、90 行电话格式不对", tone: "warning", action: { label: "看明细", onClick: () => undefined } })}>
          部分成功
        </Button>
        <Button variant="outline" onClick={() => notify.show({ title: "复制失败", description: "浏览器不让写剪贴板，请用 Ctrl + C", tone: "error", action: { label: "再试一次", onClick: () => undefined } })}>
          失败
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const job = notify.progress({ title: "正在导出…", description: "168 位客户" });
            await wait(2000);
            job.update({ title: "导出好了", description: "客户 2026-10-07.xlsx", action: { label: "下载", onClick: () => undefined } });
          }}
        >
          进行中 → 完成
        </Button>
      </div>
      <div id="ov-alerts" style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <InlineAlert title="这张表开启了字段权限">销售看不到「底价」，表管理员可以在表设置里调整。</InlineAlert>
        <InlineAlert tone="success" title="同步完成" action={<Button size="sm" variant="outline">查看</Button>}>
          LINE 客服 128 条消息已归档到客户记录。
        </InlineAlert>
        <InlineAlert tone="warning" density="compact" title="还有 3 位客户没分配负责人" action={<Button size="sm" variant="text">去分配</Button>} />
        <InlineAlert tone="error" density="subtle" title="手机号格式不对">中国大陆手机是 1 开头 11 位。</InlineAlert>
        <InlineAlert tone="info" banner title="系统将于今晚 23:00 维护 30 分钟" onClose={() => undefined} />
      </div>
    </Panel>
  );
}
