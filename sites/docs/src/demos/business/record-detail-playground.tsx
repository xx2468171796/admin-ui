import { useState } from "react";
import { RecordDetail, defaultRecordDetailSpec, type RecordDetailPreset } from "@adminui/react";
import { DEAL_DAYS, DEAL_FIELDS, DEAL_SECTIONS, DEAL_STEPS, DEALS, dealKeyNumbers, type Deal } from "../../data/business-data";

// 在线调试：版式（spec.preset）、阶段条（stage）、只读阶段（stage.readOnly）、关键数（keyNumbers）、关注（follow）、编辑布局（layoutEditor）。

type Props = { preset?: string; showStage?: boolean; readOnly?: boolean; showKeyNumbers?: boolean; showFollow?: boolean; editable?: boolean };

const SLOTS = { activity: { title: "跟进", count: 3, render: () => <p className="aui-note" style={{ margin: 0 }}>跟进记录（宿主画的块）</p> } };

export function Demo({ preset = "cards", showStage = true, readOnly = false, showKeyNumbers = true, showFollow = true, editable = false }: Props) {
  const [current, setCurrent] = useState("proposal");
  const [following, setFollowing] = useState(false);
  const deal: Deal | undefined = DEALS[0];
  if (!deal) return null;
  const spec = defaultRecordDetailSpec({
    fields: DEAL_FIELDS.map((f) => f.key), slots: ["activity"], stage: showStage, keyNumbers: showKeyNumbers,
    sections: DEAL_SECTIONS, preset: preset as RecordDetailPreset,
  });
  return (
    <RecordDetail<Deal>
      key={`${preset}-${String(showStage)}-${String(showKeyNumbers)}`}
      row={deal} recordKey={deal.id} title={deal.name}
      badges={[{ label: "跟进中", tone: "green" }]}
      meta={[deal.customer, { person: "陈一鸣", suffix: "负责" }]}
      fields={DEAL_FIELDS} spec={spec} slots={SLOTS}
      stage={showStage ? {
        steps: DEAL_STEPS.map((s) => ({ ...s, days: DEAL_DAYS[s.id] })), current, readOnly,
        onSelect: setCurrent, onMarkLost: () => setCurrent("lost"), labels: { markLost: "标记输单" },
      } : undefined}
      keyNumbers={showKeyNumbers ? dealKeyNumbers(deal) : undefined}
      follow={showFollow ? { on: following, onToggle: () => setFollowing((v) => !v) } : null}
      layoutEditor={editable ? { onSave: async () => new Promise((r) => setTimeout(r, 300)) } : undefined}
    />
  );
}
