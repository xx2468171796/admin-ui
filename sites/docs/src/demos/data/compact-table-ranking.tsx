import { Mail } from "lucide-react";
import { CompactTable, Panel, useNotify } from "@adminui/react";
import type { GridField } from "@adminui/react/grid";
import { PEOPLE } from "../../data/demo-data";

type Rep = { id: string; name: string; dept: string; deals: number; amount: number; winRate: number; email: string };

const REPS: Rep[] = PEOPLE.slice(1, 6).map((p, i) => ({
  id: p.id, name: p.name, dept: p.title, deals: [14, 11, 9, 7, 4][i] ?? 0,
  amount: [86_000_000, 72_400_000, 51_000_000, 38_600_000, 12_000_000][i] ?? 0, winRate: [42, 38, 35, 31, 22][i] ?? 0, email: p.email,
}));

// 和 BitableGrid 同一套字段定义；没放进 columns 的字段在点开的详情里
const fields: GridField<Rep>[] = [
  { key: "name", title: "销售", type: "text", primary: true },
  { key: "dept", title: "岗位", type: "text" },
  { key: "deals", title: "赢单", type: "number", precision: 0 },
  { key: "amount", title: "签约金额", type: "money", precision: 0 },
  { key: "winRate", title: "赢单率", type: "progress" },
  { key: "email", title: "邮箱", type: "email" },
];

/** 卡片里的排行：表头一行、行高固定、数字右对齐、没有工具栏；先显示 3 条，再「显示更多」；底部「去完整列表」。 */
export function Demo() {
  const notify = useNotify();
  return (
    <div style={{ maxWidth: 560 }}>
      <Panel title="本月销售排行" count="按签约金额" flush>
        <CompactTable
          caption="本月销售排行"
          rows={REPS}
          getRowId={(r) => r.id}
          fields={fields}
          columns={["name", "deals", "amount"]}
          sort={{ key: "amount", direction: "desc" }}
          maxRows={3}
          rowActions={(r) => [{ key: "mail", label: "发邮件", icon: <Mail />, onSelect: () => notify(`给${r.name}发邮件`, "info") }]}
          viewAll={{ label: "去完整列表", onClick: () => notify("打开完整的业绩报表", "info") }}
        />
      </Panel>
    </div>
  );
}
