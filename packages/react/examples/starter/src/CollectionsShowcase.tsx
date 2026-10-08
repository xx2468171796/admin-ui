import { ActivityFeed, CompactTable, PageBody, PageHeader, Panel, StatusChecklist, useNotify, type RecordLayout } from "@adminui/react";
import { FollowUpTimelineDemo, LogTimelineStatesDemo, SelectListDemo } from "./timeline-demo";
import type { GridField } from "@adminui/react/grid";

// 轻量集合示例：不是所有列表都该用多维表格（见 TABLES.md §1）。
// 排行 / 统计 / 弹窗里的几行 → CompactTable；按时间发生的事 → ActivityFeed；几项检查 → StatusChecklist。
type Ranking = { id: string; name: string; calls: number; failRate: number; cost: number; owner: string; note: string };
const ranking: Ranking[] = [
  { id: "t1", name: "run_command", calls: 18234, failRate: 1.2, cost: 4210, owner: "运维组", note: "执行命令；超时多半是长任务没用 start_job" },
  { id: "t2", name: "db_query", calls: 9120, failRate: 0.4, cost: 1888, owner: "数据组", note: "" },
  { id: "t3", name: "read_file", calls: 7710, failRate: 3.8, cost: 902, owner: "运维组", note: "大文件读一半会截断" },
  { id: "t4", name: "knowledge_search", calls: 5012, failRate: 0.1, cost: 640, owner: "知识库", note: "" },
  { id: "t5", name: "backup_status", calls: 230, failRate: 0, cost: 20, owner: "备份", note: "" },
];
const rankingFields: GridField<Ranking>[] = [
  { key: "name", title: "工具", type: "text", primary: true },
  { key: "calls", title: "调用次数", type: "number", precision: 0 },
  { key: "failRate", title: "出错率 %", type: "number", precision: 1 },
  { key: "cost", title: "耗时（秒）", type: "number", precision: 0 },
  { key: "owner", title: "负责", type: "text" },
  { key: "note", title: "说明", type: "longText" },
];

type Event = { id: string; at: string; what: string; who: string; tone: "success" | "warning" | "danger" | "neutral"; detail: string; size?: string };
const base = Date.now();
const ago = (m: number) => new Date(base - m * 60_000).toISOString();
const events: Event[] = [
  { id: "e1", at: ago(2), what: "备份成功：订单主库", who: "定时任务", tone: "success", detail: "上传到 3 个目标，耗时 41 秒", size: "1.2 GB" },
  { id: "e2", at: ago(38), what: "体检失败：网关节点", who: "运维平台", tone: "danger", detail: "SSH 连接超时（10 秒），已重试 3 次；最近一次成功是 40 分钟前" },
  { id: "e3", at: ago(95), what: "修改授权：张三 → 日志集群", who: "admin", tone: "neutral", detail: "能看密码：否 → 是；到期：永久" },
  { id: "e4", at: ago(60 * 20), what: "磁盘超过 85%", who: "常驻服务", tone: "warning", detail: "/data 已用 87%，预计 3 天写满" },
  { id: "e5", at: ago(60 * 30), what: "备份成功：订单主库", who: "定时任务", tone: "success", detail: "上传到 3 个目标", size: "1.1 GB" },
  { id: "e6", at: ago(60 * 50), what: "接入新机器：AI 训练机", who: "admin", tone: "neutral", detail: "一键脚本接入，推上专用公钥" },
];
const eventLayout: RecordLayout<Event> = {
  title: (e) => e.what,
  subtitle: (e) => new Date(e.at).toLocaleString("zh-CN"),
  sections: [{ key: "a", fields: [{ key: "who", label: "谁", value: (e) => e.who }, { key: "detail", label: "详情", value: (e) => e.detail, full: true }, { key: "size", label: "大小", value: (e) => e.size ?? null, hideEmpty: true }] }],
};

type Check = { id: string; name: string; status: "ok" | "warning" | "error" | "pending"; reason: string; version?: string };
const checks: Check[] = [
  { id: "c1", name: "客户端版本", status: "ok", reason: "0.2.79，已是最新", version: "0.2.79" },
  { id: "c2", name: "中转线路", status: "warning", reason: "直连不通，正在走中转（延迟 180ms）" },
  { id: "c3", name: "麦克风映射", status: "error", reason: "没装虚拟声卡驱动" },
  { id: "c4", name: "画面编码", status: "pending", reason: "正在测速…" },
];

export function CollectionsShowcase() {
  const notify = useNotify();
  return (
    <>
      <PageHeader title="轻量集合" description="不是所有列表都用多维表格：几行的排行和统计用紧凑表格，按时间发生的事用时间线，几项检查用状态清单。点一行打开同样的记录详情。" />
      <PageBody>
        <Panel title="工具排行（紧凑表格）" description="排行 / 统计 / 弹窗里的几行：没有工具栏、行号和统计栏；隐藏的字段在详情里看。">
          <CompactTable caption="工具排行" rows={ranking} getRowId={(r) => r.id} fields={rankingFields} columns={["name", "calls", "failRate", "cost"]}
            sort={{ key: "calls", direction: "desc" }} maxRows={4} viewAll={{ label: "去完整列表筛选 →", onClick: () => notify("这里链到整页的多维表格", "info") }}
            rowActions={(r) => [{ key: "copy", label: "复制", onSelect: () => notify(`已复制 ${r.name}`, "success") }]} />
        </Panel>
        <Panel title="最近动态（时间线）" description="最新在上、按天分组；悬停时间看精确时刻；点一条看详情。">
          <ActivityFeed caption="最近动态" items={events} getId={(e) => e.id} time={(e) => e.at} title={(e) => e.what} actor={(e) => e.who}
            description={(e) => e.detail} tone={(e) => e.tone} meta={(e) => e.size ?? null} layout={eventLayout} maxItems={5}
            marker={(e) => (e.who === "admin" ? { kind: "person", name: "管理员", key: "admin" } : null)} />
        </Panel>
        <FollowUpTimelineDemo />
        <SelectListDemo />
        <LogTimelineStatesDemo />
        <Panel title="连接自检（状态清单）" description="每项有图标 + 文字状态 + 原因，最多一个操作。">
          <StatusChecklist caption="连接自检" items={checks} getId={(c) => c.id} label={(c) => c.name} status={(c) => c.status} reason={(c) => c.reason}
            meta={(c) => c.version ?? null} action={(c) => (c.status === "error" ? { label: "去安装", onSelect: () => notify("打开安装说明", "info") } : null)} />
        </Panel>
      </PageBody>
    </>
  );
}
