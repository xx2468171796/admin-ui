import { useMemo, useState } from "react";
import { SearchField } from "@adminui/react";
import { CAPABILITIES, TOOLS } from "@adminui/react/catalog";
import source from "./md/ai.md?raw";
import { CodeBlock } from "../shell/code-block";
import { Prose } from "../shell/prose";

export function ForAi() {
  const [intro = "", rest = ""] = source.split("<!--catalog-->");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return CAPABILITIES.filter((c) => {
      const hay = `${c.id} ${c.entry} ${c.exports.join(" ")} ${c.rule}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q]);
  const tool = TOOLS[0];
  return (
    <article className="site-doc">
      <Prose source={intro} />
      <h2 className="site-h2">能力清单（catalog）</h2>
      <p className="site-note">
        共 {CAPABILITIES.length} 组能力。下面就是包里 <code>@adminui/react/catalog</code> 的内容，AI 可以直接 import 查询“有没有、从哪导入、规则是什么”。
      </p>
      <SearchField value={q} onChange={setQ} placeholder="搜索能力或导出名，如 DatePicker、批量、甘特" label="搜索能力清单" />
      <div className="site-catalog">
        {list.map((c) => (
          <details key={c.id} className="site-cap">
            <summary>
              <strong>{c.id}</strong>
              <code>{c.entry}</code>
              <span>{c.exports.length} 个导出</span>
            </summary>
            <p>{c.rule}</p>
            <div className="site-exports">
              {c.exports.map((e) => (
                <code key={e}>{e}</code>
              ))}
            </div>
          </details>
        ))}
      </div>
      {tool && (
        <>
          <h2 className="site-h2">界面漂移审计</h2>
          <CodeBlock code={tool.usage.replace(/（.*$/, "")} lang="sh" title="命令" />
          <div className="site-exports">
            {tool.rules.map((r) => (
              <code key={r}>{r}</code>
            ))}
          </div>
        </>
      )}
      <Prose source={rest} />
    </article>
  );
}
