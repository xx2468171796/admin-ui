import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { SiteLink } from "./site-context";

const textOf = (node: ReactNode): string =>
  typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : "";

const components: Components = {
  a({ href, children }) {
    const m = href ? /^([a-z0-9-]+)\.html(?:#(.+))?$/.exec(href) : null;
    if (m?.[1]) return <SiteLink to={m[1]} hash={m[2]}>{children}</SiteLink>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    const text = textOf(children);
    if (!lang && !text.includes("\n")) return <code>{children}</code>;
    return <CodeBlock code={text.replace(/\n$/, "")} lang={lang ?? "text"} />;
  },
  table({ children }) {
    return (
      <div className="site-table-wrap">
        {/* admin-ui-audit-ignore raw-control: Markdown 正文里的表格，是文档内容，不是后台数据表 */}
        <table className="site-table">{children}</table>
      </div>
    );
  },
};

/** Guide pages are Markdown (one source for the site and the repo docs). */
export function Prose({ source }: { source: string }) {
  return (
    <div className="site-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
