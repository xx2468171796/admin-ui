import { useRef, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton, useCopy } from "@adminui/react";
import { useSite } from "./site-context";

const KEYWORDS = new Set([
  "import", "from", "export", "function", "const", "let", "return", "type", "if", "else", "await", "async", "new",
  "true", "false", "null", "undefined", "as", "default", "interface", "extends", "readonly", "typeof",
]);

/** Tiny highlighter: comments, strings, keywords, JSX tag names. Good enough for short TSX / shell snippets. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*)|\b([A-Za-z_]\w*)\b/g;
  let last = 0;
  let key = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [text, comment, str, tag, word] = m;
    if (comment) out.push(<span key={key++} className="tk-c">{text}</span>);
    else if (str) out.push(<span key={key++} className="tk-s">{text}</span>);
    else if (tag) out.push(<span key={key++} className="tk-t">{text}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={key++} className="tk-k">{text}</span>);
    else out.push(text);
    last = m.index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, lang = "tsx", title }: { code: string; lang?: string; title?: string }) {
  const { t } = useSite();
  const { result, copy } = useCopy();
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <div className="site-code">
      <div className="site-code-bar">
        <span>{title ?? lang}</span>
        <IconButton
          ref={btn}
          size="sm"
          label={result === "ok" ? t.copied : t.copy}
          icon={result === "ok" ? <Check /> : <Copy />}
          onClick={() => void copy(code, btn.current)}
        />
      </div>
      <pre tabIndex={0}>
        <code>{lang === "sh" || lang === "text" ? code : highlight(code)}</code>
      </pre>
    </div>
  );
}
