import { useState } from "react";
import { ShareAccessLog, ShareManager, useNotify, type ShareKind, type ShareState } from "@adminui/react";
import { ACCESS_LOG, H, SHARE_ITEMS, SHARE_STATS, demoNow } from "../../data/collab-data";

/**
 * 我的分享：指标带 → 一行筛选 → 列表 → 分页。每行最多露 3 个操作（复制链接 · 改设置 · ⋯）；
 * 点行展开访问记录（ShareAccessLog），和表格同宽。真实项目里筛选和分页都由服务端做。
 */
export function Demo() {
  const notify = useNotify();
  const [items, setItems] = useState(SHARE_ITEMS);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ShareKind | "all">("all");
  const [status, setStatus] = useState<ShareState>("active");
  const [expanded, setExpanded] = useState<string | null>("s1");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const shown = items.filter((i) => i.state === status && (kind === "all" || i.kind === kind) && (!search || `${i.title} ${i.subtitle ?? ""}`.includes(search)));
  const count = (s: ShareState) => items.filter((i) => i.state === s).length;
  const patch = (id: string, next: Partial<(typeof items)[number]>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...next } : i)));

  return (
    <ShareManager
      stats={SHARE_STATS}
      items={shown.slice((page - 1) * pageSize, page * pageSize)}
      total={shown.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      kind={kind}
      onKindChange={(k) => { setKind(k); setPage(1); }}
      status={status}
      onStatusChange={(s) => { setStatus(s); setPage(1); }}
      counts={{ active: count("active"), paused: count("paused"), void: count("void") }}
      expanded={expanded}
      onExpandedChange={setExpanded}
      renderLog={(item) => <ShareAccessLog events={item.id === "s1" ? ACCESS_LOG : []} />}
      onCopyLink={(item) => notify(`已复制「${item.title}」的链接`, "success")}
      onEdit={(item) => notify(`打开「${item.title}」的分享设置`, "info")}
      onExtend={(item) => item.expiresAt !== null && patch(item.id, { expiresAt: item.expiresAt + 7 * 24 * H })}
      extendLabel={() => "延长 7 天"}
      onPausedChange={(item, paused) => patch(item.id, { state: paused ? "paused" : "active" })}
      onReshare={(item) => notify(`按「${item.title}」的设置新建了一条分享`, "success")}
      onVoid={async (item) => {
        await new Promise((r) => setTimeout(r, 300));
        patch(item.id, { state: "void" });
        notify(`已作废「${item.title}」的链接`, "success");
      }}
      policyNote="公司要求：对外必须设密码，最长 30 天"
      now={demoNow}
    />
  );
}
