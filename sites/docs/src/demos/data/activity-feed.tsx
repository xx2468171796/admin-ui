import { useState } from "react";
import { ActivityFeed, SegmentedControl, type FeedMarker, type FeedTone } from "@adminui/react";

type Event = { id: string; at: number; what: string; who?: string; whoId?: string; detail?: string; size?: string; tone?: FeedTone };

const MIN = 60_000;
const now = Date.now();
const EVENTS: Event[] = [
  { id: "e1", at: now - 4 * MIN, what: "导出客户列表", who: "林晓", whoId: "u01", detail: "筛选：华东 · 商务谈判", size: "24 条" },
  { id: "e2", at: now - 38 * MIN, what: "每日备份成功", tone: "success", size: "1.2 GB" },
  { id: "e3", at: now - 95 * MIN, what: "邮件同步失败", tone: "danger", detail: "邮箱密码已过期，请重新授权。" },
  { id: "e4", at: now - 26 * 60 * MIN, what: "新增客户「松果智能」", who: "赵思远", whoId: "u04" },
  { id: "e5", at: now - 27 * 60 * MIN, what: "席位用量超过 90%", tone: "warning", detail: "当前 1,152 / 1,280 个席位。" },
  { id: "e6", at: now - 50 * 60 * MIN, what: "版本更新到 8.0", tone: "brand" },
];

const marker = (e: Event): FeedMarker | null => (e.who ? { kind: "person", name: e.who, key: e.whoId } : null);

/** 窄栏动态：最新在上、按天分组，相对时间（悬停看精确时间）；附注是普通文字，不是状态胶囊。切换看加载和空状态。 */
export function Demo() {
  const [state, setState] = useState<"rows" | "loading" | "empty">("rows");
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
      <div>
        <SegmentedControl size="sm" label="状态" value={state} onValueChange={setState}
        options={[{ value: "rows", label: "有数据" }, { value: "loading", label: "加载中" }, { value: "empty", label: "空" }]} />
      </div>
      <ActivityFeed
        caption="最近动态"
        items={state === "rows" ? EVENTS : []}
        loading={state === "loading"}
        emptyLabel="最近 30 天没有动态"
        getId={(e) => e.id}
        time={(e) => e.at}
        title={(e) => e.what}
        actor={(e) => e.who}
        description={(e) => e.detail}
        meta={(e) => e.size}
        tone={(e) => e.tone}
        marker={marker}
        maxItems={5}
      />
    </div>
  );
}
