import "@adminui/react/styles.css";
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, NotificationProvider, StatePanel, isPaletteId } from "@adminui/react";
import { loadDemo } from "./demos/registry";
import { MSG_HEIGHT, MSG_STATE, decodeHash, parseState, type PreviewState } from "./shell/preview-protocol";
import { DEMO_DEFAULTS } from "./shell/site-defaults";
import "./preview.css";


class DemoBoundary extends Component<{ children: ReactNode; demo: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidUpdate(prev: { demo: string }) {
    if (prev.demo !== this.props.demo && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <StatePanel kind="error" title="演示出错了" message={this.state.error} />;
    return this.props.children;
  }
}

const cache = new Map<string, ComponentType<Record<string, unknown>>>();
function lazyDemo(id: string) {
  const hit = cache.get(id);
  if (hit) return hit;
  const made = lazy(async () => ({ default: await loadDemo(id) }));
  cache.set(id, made);
  return made;
}

function PreviewApp({ initial }: { initial: PreviewState | null }) {
  const [state, setState] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || window.parent === window) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null || (data as { type?: unknown }).type !== MSG_STATE) return;
      const next = parseState((data as { state?: unknown }).state);
      if (next) setState(next);
    };
    const onHash = () => setState(decodeHash(window.location.hash));
    window.addEventListener("message", onMessage);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  // Tell the docs page how tall the demo is, and paint the page background with the theme surface.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const report = () => {
      const surface = getComputedStyle(el).getPropertyValue("--aui-surface").trim();
      if (surface) document.documentElement.style.background = surface;
      if (window.parent !== window) window.parent.postMessage({ type: MSG_HEIGHT, height: Math.ceil(el.getBoundingClientRect().height) }, "*");
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, [state?.mode, state?.palette]);

  const Demo = useMemo(() => (state ? lazyDemo(state.demo) : null), [state?.demo]);
  const palette = state && isPaletteId(state.palette) ? state.palette : "forest";
  return (
    <AdminProvider storageKey="aui-site-demo" defaults={DEMO_DEFAULTS} palette={palette} mode={state?.mode ?? "light"}>
      <NotificationProvider>
        <div ref={rootRef} className="site-demo" data-bleed={state?.bleed ? "true" : undefined}>
          {!state || !Demo ? (
            <StatePanel kind="empty" title="没有选择演示" message="从文档页打开演示。" />
          ) : (
            <DemoBoundary demo={state.demo}>
              <Suspense fallback={<StatePanel kind="loading" title="加载演示…" />}>
                <Demo {...state.props} />
              </Suspense>
            </DemoBoundary>
          )}
        </div>
      </NotificationProvider>
    </AdminProvider>
  );
}

const root = document.getElementById("root");
// Production frames are srcdoc documents with the state inlined (see shell/preview-frame.ts); `preview.html#…` uses the hash.
const inlined = parseState((window as { __PREVIEW_STATE__?: unknown }).__PREVIEW_STATE__);
if (root) createRoot(root).render(<PreviewApp initial={decodeHash(window.location.hash) ?? inlined} />);
