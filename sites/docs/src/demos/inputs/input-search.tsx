import { useMemo, useState } from "react";
import { Highlight, QueryBar, SearchField } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

/** 列表搜索打字就筛（停 0.3 秒）、命中高亮、写命中几条、按 / 聚焦；很慢的列表改成回车才搜。 */
export function Demo() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [slow, setSlow] = useState("");
  const [slowApplied, setSlowApplied] = useState("");
  const [side, setSide] = useState("");
  const hits = useMemo(() => CUSTOMERS.filter((c) => !applied.trim() || c.name.includes(applied.trim())).slice(0, 6), [applied]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <QueryBar
        variant="bare"
        value={q}
        onChange={setQ}
        onSearch={() => setApplied(q)}
        onReset={() => { setQ(""); setApplied(""); }}
        hits={applied ? hits.length : undefined}
        shortcut="/"
        placeholder="搜索客户（试试「科技」）"
      />
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }} aria-label="搜索结果">
        {hits.map((c) => <li key={c.id}><Highlight text={c.name} query={applied} /></li>)}
        {hits.length === 0 && <li className="aui-text-note">没有匹配「{applied}」的客户</li>}
      </ul>
      <QueryBar
        variant="bare"
        searchMode="enter"
        value={slow}
        onChange={setSlow}
        onSearch={() => setSlowApplied(slow)}
        onReset={() => { setSlow(""); setSlowApplied(""); }}
        placeholder="搜索审计日志"
      />
      <p className="aui-text-note" style={{ margin: 0 }}>已搜索：{slowApplied || "（还没搜，按回车）"}</p>
      <div style={{ maxWidth: 260 }}>
        <SearchField value={side} onChange={setSide} variant="subtle" size="sm" placeholder="在侧栏里搜" />
      </div>
    </div>
  );
}
