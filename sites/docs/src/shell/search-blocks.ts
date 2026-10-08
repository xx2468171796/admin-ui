import type { CommandItem } from "@adminui/react";
import type { ComponentDoc } from "../content/types";

/**
 * Local full-text search over the component docs (no external service). Each doc becomes a few text blocks;
 * a hit needs every query word. Page titles are matched by the palette's own command list. Pure: the docs bundle
 * builds the blocks in the browser, the build writes them to assets/search-index.js for the light home page.
 */
export type SearchBlock = { slug: string; title: string; where: string; anchor?: string; text: string };

export function buildSearchBlocks(docs: readonly ComponentDoc[]): SearchBlock[] {
  const out: SearchBlock[] = [];
  for (const d of docs) {
    const add = (where: string, parts: readonly string[] | undefined, anchor?: string) => {
      if (parts?.length) out.push({ slug: d.slug, title: d.title, where, anchor, text: parts.join(" ") });
    };
    add("简介", [d.summary, d.subtitle, d.keywords ?? ""]);
    add("什么时候用", [...d.when, ...(d.whenNot ?? [])]);
    add("推荐 / 避免", [...d.dos, ...d.donts]);
    add("结构与状态", [...(d.anatomy ?? []), ...(d.states ?? [])]);
    add("无障碍", d.a11y);
    add("属性", (d.props ?? []).flatMap((p) => [p.component, ...p.rows.map((r) => `${r.name} ${r.description}`)]));
    add("示例", d.demos.map((x) => `${x.title} ${x.description ?? ""}`));
  }
  return out;
}

function snippet(text: string, word: string): string {
  const i = text.toLowerCase().indexOf(word);
  if (i < 0) return text.slice(0, 60);
  const start = Math.max(0, i - 18);
  return (start > 0 ? "…" : "") + text.slice(start, start + 60) + (start + 60 < text.length ? "…" : "");
}

export function searchBlocks(blocks: readonly SearchBlock[], query: string, limit: number): CommandItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: CommandItem[] = [];
  for (const b of blocks) {
    const hay = b.text.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    hits.push({ id: `${b.slug}:${b.where}`, title: `${b.title} · ${b.where}`, subtitle: snippet(b.text, words[0] ?? ""), href: `${b.slug}.html`, kind: "文档" });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Search function the layout's palette uses (the docs bundle searches in memory, the home page loads the index). */
export type DocSearch = (query: string, limit: number) => CommandItem[] | Promise<CommandItem[]>;
