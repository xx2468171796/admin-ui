/** Source text of each demo for the 代码 tab (the docs page imports this, never the demo modules themselves). */
const sources = import.meta.glob<string>("./*/*.tsx", { query: "?raw", import: "default" });

export async function loadSource(id: string): Promise<string> {
  const load = sources[`./${id}.tsx`];
  return load ? load() : "";
}
