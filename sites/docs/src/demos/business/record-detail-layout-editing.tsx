import { useState } from "react";
import {
  Panel, RecordDetailBody, RecordLayoutBar, RecordLayoutButton, defaultRecordDetailSpec, normalizeRecordDetailSpec, recordDetailCatalog, useNotify, useRecordLayoutEditor,
  type RecordDetailScope, type RecordDetailSpec, type RecordLayoutEditor,
} from "@adminui/react";
import { DEAL_FIELDS, DEAL_SECTIONS, DEALS, dealKeyNumbers, type Deal } from "../../data/business-data";

// 编辑布局：点「编辑布局」→ 拖卡片换位置 / 换栏、「整理字段」把字段拖到别的分区、隐藏卡片或字段、换版式、恢复默认。
// 布局是一份 JSON（RecordDetailSpec）；这里存在组件 state 里，真实项目存到服务端，保存前用 normalizeRecordDetailSpec 校验。
// 只要正文、头部自己画时，用 useRecordLayoutEditor + RecordLayoutBar + RecordLayoutButton + RecordDetailBody 组合。

const SLOTS = {
  activity: { title: "跟进", count: 3, render: () => <p className="aui-note" style={{ margin: 0 }}>跟进记录（宿主画的块）</p> },
  files: { title: "附件", count: 2, render: () => <p className="aui-note" style={{ margin: 0 }}>报价单.pdf · 现场照片.zip</p> },
};
const CATALOG = recordDetailCatalog({ fields: DEAL_FIELDS, slots: SLOTS, stage: false, keyNumbers: true });
const FALLBACK = defaultRecordDetailSpec({ ...CATALOG, sections: DEAL_SECTIONS });

type Saved = { default?: RecordDetailSpec; mine?: RecordDetailSpec };

export function Demo() {
  const notify = useNotify();
  const [saved, setSaved] = useState<Saved>({});
  const companyDefault = normalizeRecordDetailSpec(saved.default, CATALOG, FALLBACK);
  const spec = normalizeRecordDetailSpec(saved.mine, CATALOG, companyDefault);

  const editor: RecordLayoutEditor = {
    canEditDefault: true,
    onSave: async (next: RecordDetailSpec, scope: RecordDetailScope) => {
      await new Promise((r) => setTimeout(r, 300));
      setSaved((s) => (scope === "default" ? { default: next } : { ...s, mine: next }));
      notify(scope === "default" ? "已保存为所有人的默认布局" : "已保存你自己的布局", "success");
    },
    onReset: () => {
      setSaved((s) => ({ default: s.default }));
      notify("已恢复默认布局", "success");
    },
  };
  const editing = useRecordLayoutEditor(spec, editor);
  const deal: Deal | undefined = DEALS[0];
  if (!deal) return null;

  return (
    <Panel flush title={deal.name} description="商机 · 自己的页面里只放正文" actions={<RecordLayoutButton editing={editing} />}>
      <RecordLayoutBar editing={editing} />
      <RecordDetailBody<Deal> row={deal} title={deal.name} fields={DEAL_FIELDS} spec={spec} editing={editing} keyNumbers={dealKeyNumbers(deal)} slots={SLOTS} />
    </Panel>
  );
}
