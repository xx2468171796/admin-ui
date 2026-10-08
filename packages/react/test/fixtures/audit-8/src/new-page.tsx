// admin-ui-audit fixture: the same page on 8.0 — no findings from the 8.0 rules.
import { AdminShell, Button, CommentThread, DataTable, IconButton, MoreMenu, RecordHeader, AppearanceButton, legacyTone, StatusBadge } from "@adminui/react";
import { resolveVizTokens } from "@adminui/react/charts";
import "@adminui/react/styles.css";

const STAGES = [
  { value: "lead", label: "线索", tone: "gray" },
  { value: "won", label: "成交", tone: legacyTone("solid") ?? "greenSolid" },
];
const alerts = [{ key: "a", tone: "danger", title: "售价没填" }];

export function NewPage() {
  return (
    <AdminShell account={{ name: "陈" }} onSignOut={() => {}} brand="x" navigation={[]} tabs={[]} activeId="a" onNavigate={() => {}} onCloseTab={() => {}}>
      <IconButton label="刷新" icon={<span />} />
      <Button variant="text">查看全部</Button>
      <Button tooltip="说明">保存</Button>
      <MoreMenu label="更多" sections={[]} />
      <CommentThread comments={[]} filter="open" />
      <DataTable bulkActions={[]} rows={[]} columns={[]} rowKey={() => ""} caption="x" />
      <RecordHeader title="x" />
      <StatusBadge tone="danger">异常</StatusBadge>
      <AppearanceButton />
    </AdminShell>
  );
}
