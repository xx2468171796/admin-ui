import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, CellTags, DataTable, SegmentedControl, type Column } from "@adminui/react";
import { STAGES, formatAmount, type Customer } from "../../data/demo-data";
import { CUSTOMERS } from "../../data/data-data";

type Kind = "loading" | "empty" | "no-results" | "error" | "rows";

const columns: Column<Customer>[] = [
  { key: "name", title: "客户", width: 200, render: (r) => r.name },
  { key: "stage", title: "阶段", width: 112, skeleton: "tag", render: (r) => { const s = STAGES.find((x) => x.value === r.stage); return s ? <CellTags items={[{ label: s.label, tone: s.tone }]} /> : null; } },
  { key: "city", title: "城市", width: 96, render: (r) => r.city },
  { key: "amount", title: "合同金额", numeric: true, skeleton: "number", render: (r) => formatAmount(r.amount) },
];

/** 空表、筛选无结果、出错、加载各有一种样子：加载用和列宽一致的骨架行，出错给请求号和重试。 */
export function Demo() {
  const [kind, setKind] = useState<Kind>("loading");
  const retry = () => {
    setKind("loading");
    window.setTimeout(() => setKind("rows"), 1200);
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <SegmentedControl<Kind> size="sm" label="表格状态" value={kind} onValueChange={setKind}
        options={[{ value: "loading", label: "加载中" }, { value: "empty", label: "空表" }, { value: "no-results", label: "无结果" }, { value: "error", label: "出错" }, { value: "rows", label: "有数据" }]} />
      </div>
      <DataTable
        caption="客户"
        rows={kind === "rows" ? CUSTOMERS.slice(0, 5) : []}
        columns={columns}
        rowKey={(r) => r.id}
        loading={kind === "loading"}
        error={kind === "error" ? "客户列表加载失败，请稍后重试" : undefined}
        errorDetails="请求号 req-7f3a9c · HTTP 503"
        onRetry={retry}
        emptyKind={kind === "no-results" ? "no-results" : "empty"}
        emptyLabel={kind === "no-results" ? "没有符合「华南 · 赢单」的客户" : "还没有客户"}
        emptyAction={kind === "empty" ? <Button size="sm"><Plus aria-hidden="true" />新建客户</Button> : <Button size="sm" variant="outline" onClick={() => setKind("rows")}>清空筛选</Button>}
        pagination={{ mode: "all" }}
      />
    </div>
  );
}
