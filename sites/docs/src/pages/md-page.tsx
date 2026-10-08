import { useEffect, useState } from "react";
import { StatePanel } from "@adminui/react";
import { Prose } from "../shell/prose";

const PAGES = import.meta.glob<string>("./md/*.md", { query: "?raw", import: "default" });

export function MdPage({ slug }: { slug: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setSource(null);
    const load = PAGES[`./md/${slug}.md`];
    if (load) void load().then((s) => live && setSource(s));
    return () => {
      live = false;
    };
  }, [slug]);
  if (source === null) return <StatePanel kind="loading" />;
  return (
    <article className="site-doc">
      <Prose source={source} />
    </article>
  );
}
