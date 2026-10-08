import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { ActivityFeed, Button, Panel, RecordPage, useNotify, useRecordDetail, type RecordLayout } from "@adminui/react";
import { DEAL_DAYS, DEAL_FIELDS, DEAL_SECTIONS, DEAL_STEPS, DEALS, FOLLOW_UPS, dealKeyNumbers, type Deal } from "../../data/business-data";
import { formatAmount, personName } from "../../data/demo-data";

// 一份 RecordLayout，三档展示：① 简要（小弹框）② 详情（大弹框，给了 cards 就是卡片分区）③ 整页（RecordPage）。
// 列表、卡片、搜索结果里打开都用 useRecordDetail：open(id, level)，上一条 / 下一条、Esc 关闭、焦点回到打开它的地方。

const byKey = new Map(DEAL_FIELDS.map((f) => [f.key, f]));

export function Demo() {
  const notify = useNotify();
  const [page, setPage] = useState<Deal | null>(null);
  const layout = useMemo((): RecordLayout<Deal> => ({
    title: (d) => d.name,
    subtitle: (d) => `${d.code} · ${personName(d.owner)} 负责`,
    badges: () => [{ label: "跟进中", tone: "green" }],
    meta: (d) => [d.customer, { person: personName(d.owner), suffix: "负责" }, d.city],
    sections: DEAL_SECTIONS.map((s) => ({
      key: s.id, title: s.title,
      fields: s.fields.flatMap((k) => { const f = byKey.get(k); return f ? [{ ...f, peek: ["contact", "phone", "city", "seats"].includes(k) }] : []; }),
    })),
    actions: (d) => [
      { key: "page", label: "在整页打开", icon: <Maximize2 aria-hidden="true" />, onSelect: () => setPage(d) },
      { key: "quote", label: "发报价", primary: true, onSelect: () => notify("已打开报价单（演示）", "info") },
    ],
    cards: {
      spec: null,
      stage: () => ({ steps: DEAL_STEPS.map((s) => ({ ...s, days: DEAL_DAYS[s.id] })), current: "proposal", readOnly: true }),
      keyNumbers: dealKeyNumbers,
      slots: () => ({ activity: { title: "跟进", count: FOLLOW_UPS.length, render: () => <ActivityFeed caption="跟进记录" items={FOLLOW_UPS} getId={(f) => f.id} time={(f) => f.at} title={(f) => f.what} actor={(f) => f.who} description={(f) => f.text || null} /> } }),
    },
  }), [notify]);
  const detail = useRecordDetail<Deal>({ rows: DEALS, rowKey: (d) => d.id, layout, defaultLevel: "expanded" });

  if (page) {
    return <RecordPage layout={layout} row={page} back={{ label: "商机", onClick: () => setPage(null) }} />;
  }
  return (
    <>
      <Panel title="商机" flush>
        {DEALS.map((d) => (
          <div key={d.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 16px" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div>{d.name}</div>
              <div className="aui-note">{d.customer} · {formatAmount(d.amount)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => detail.open(d.id, "peek")}>简要</Button>
            <Button size="sm" variant="outline" onClick={() => detail.open(d.id, "expanded")}>详情</Button>
            <Button size="sm" variant="ghost" onClick={() => setPage(d)}>整页</Button>
          </div>
        ))}
      </Panel>
      {detail.element}
    </>
  );
}
