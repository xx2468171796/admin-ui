"use client";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileUp } from "lucide-react";
import { Button, Textarea } from "./primitives.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/markdown.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/markdown.css";
export function MarkdownEditor({
  value,
  onChange,
  maxBytes = 1024 * 1024,
}: {
  value: string;
  onChange: (value: string) => void;
  maxBytes?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="aui-markdown">
      <header>
        <strong>Markdown 编辑与预览</strong>
        <Button
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
        >
          <FileUp />
          导入 MD
        </Button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".md,.markdown,text/markdown"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (!/\.(md|markdown)$/i.test(file.name) || file.size > maxBytes) {
              setError("请选择大小符合限制的 Markdown 文件");
              return;
            }
            try {
              onChange(await file.text());
            } catch {
              setError("文件读取失败");
            }
          }}
        />
      </header>
      {error && (
        <p className="aui-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <Textarea
          aria-label="Markdown 内容"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <article className="aui-markdown-preview" aria-label="实时预览">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
            {value}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
