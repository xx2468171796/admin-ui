// admin-ui-audit fixture: a consumer page written against 7.x (every 8.0 removal once).
import { AdminShell, BatchBar, Button, CommentThread, DataTable, IconButton, MenuButton, RecordHeader, ThemePicker, type LegacyOptionTone } from "@adminui/react";
import { resolveBrandColors } from "@adminui/react/charts";
import { gridRowFill } from "@adminui/react/src/grid-core.ts";

const STAGES = [
  { value: "lead", label: "线索", tone: "neutral" },
  { value: "won", label: "成交", tone: "solid" },
];
const layout = { title: () => "x", sections: [], display: "tiles" };

export function OldPage() {
  return (
    <AdminShell profile={<span />} brand="x" navigation={[]} tabs={[]} activeId="a" onNavigate={() => {}} onCloseTab={() => {}}>
      <Button size="icon" variant="ghost" aria-label="刷新"><span /></Button>
      <Button variant="link">查看全部</Button>
      <Button title="说明">保存</Button>
      <IconButton label="关闭" title="关闭" icon={<span />} />
      <MenuButton size="icon" label="更多" sections={[]} />
      <CommentThread comments={[]} unresolvedOnly onUnresolvedOnlyChange={() => {}} />
      <DataTable batchMode batchActions={<BatchBar count={1} actions={null} onClear={() => {}} />} rows={[]} columns={[]} rowKey={() => ""} caption="x" />
      <RecordHeader title="x" variant="flat" />
      <div className="aui-button-icon aui-menu-item" />
      <ThemePicker />
    </AdminShell>
  );
}
