import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, Moon, Palette, RotateCcw, Smartphone, Sun } from "lucide-react";
import { Button, ButtonGroup, Checkbox, Choice, IconButton, Input, MoreMenu, NumberInput, PALETTES } from "@adminui/react";
import type { Control, DemoSpec } from "../content/types";
import { MSG_HEIGHT, MSG_STATE, encodeState, type PreviewMode, type PreviewState } from "./preview-protocol";
import { previewFrameProps } from "./preview-frame";
import { useSite } from "./site-context";

const DESKTOP_WIDTH = 1280;

export type PropValues = Record<string, string | number | boolean>;

export const defaultsOf = (controls: readonly Control[] | undefined): PropValues =>
  Object.fromEntries((controls ?? []).map((c) => [c.name, c.default]));

function ControlInput({ control, value, onChange }: { control: Control; value: string | number | boolean | undefined; onChange: (v: string | number | boolean) => void }) {
  const id = `ctl-${control.name}`;
  if (control.type === "boolean")
    return (
      <label className="site-ctl site-ctl-check" htmlFor={id}>
        <Checkbox id={id} checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
        <span>{control.label}</span>
      </label>
    );
  return (
    <label className="site-ctl" htmlFor={id}>
      <span>{control.label}</span>
      {control.type === "select" ? (
        <Choice id={id} label={control.label} value={String(value ?? control.default)} onChange={(v) => onChange(v)} options={control.options.map((o) => ({ value: o, label: o }))} size="sm" />
      ) : control.type === "number" ? (
        <NumberInput id={id} value={typeof value === "number" ? value : control.default} onChange={(v) => onChange(v ?? control.default)} min={control.min} max={control.max} step={control.step} size="sm" />
      ) : (
        <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} size="sm" />
      )}
    </label>
  );
}

/** The live preview: an iframe running preview.html, so a 390px width hits the library's real media queries. */
export function DemoStage({ demo, values, onValues }: { demo: DemoSpec; values: PropValues; onValues: (v: PropValues) => void }) {
  const site = useSite();
  const { t } = site;
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mode, setMode] = useState<PreviewMode>(site.mode);
  const [palette, setPalette] = useState(site.palette);
  const [height, setHeight] = useState(demo.height ?? 240);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCanvasWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setMode(site.mode), [site.mode]);
  useEffect(() => setPalette(site.palette), [site.palette]);
  useEffect(() => setHeight(demo.height ?? 240), [demo.id, demo.height]);

  const state = useMemo<PreviewState>(() => ({ demo: demo.id, mode, palette, props: values, bleed: demo.bleed }), [demo.id, demo.bleed, mode, palette, values]);
  // First load uses the URL; later changes go by postMessage so the demo keeps its own state.
  const [frameProps] = useState(() => previewFrameProps(state));
  useEffect(() => {
    // "*" because the docs may run in a sandboxed frame (opaque origin "null"); the data is not sensitive and the
    // preview checks that the message comes from its parent.
    frame.current?.contentWindow?.postMessage({ type: MSG_STATE, state }, "*");
  }, [state]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown };
      if (data.type === MSG_HEIGHT && typeof data.height === "number") setHeight(Math.max(demo.height ?? 120, Math.min(data.height, 1600)));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [demo.height]);

  const controls = demo.controls ?? [];
  // Whole pages (bleed demos) are laid out at a real desktop width and scaled to fit, so the library's wide layouts
  // (two columns, side menus) show even though the docs column is narrower than 1100px.
  const scale = device === "desktop" && demo.bleed && canvasWidth > 480 && canvasWidth < DESKTOP_WIDTH ? canvasWidth / DESKTOP_WIDTH : 1;
  const frameStyle = scale < 1 ? { width: DESKTOP_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "0 0" } : { height };
  return (
    <section className="site-stage" aria-label={demo.title}>
      <div className="site-stage-bar">
        <ButtonGroup label="预览宽度">
          <Button size="sm" variant="outline" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            <Monitor aria-hidden="true" />
            {t.desktop}
          </Button>
          <Button size="sm" variant="outline" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
            <Smartphone aria-hidden="true" />
            {t.mobile}
          </Button>
        </ButtonGroup>
        <IconButton size="sm" label={t.dark} pressed={mode === "dark"} icon={mode === "dark" ? <Moon /> : <Sun />} onClick={() => setMode(mode === "dark" ? "light" : "dark")} />
        <MoreMenu
          size="sm"
          icon={<Palette />}
          label={t.palette}
          sections={[{ items: PALETTES.map((p) => ({ key: p.id, label: p.name, checked: palette === p.id, onSelect: () => setPalette(p.id) })) }]}
        />
        <span className="site-grow" />
        <IconButton size="sm" label={t.openNew} icon={<ExternalLink />} onClick={() => window.open(`preview.html${encodeState(state)}`, "_blank", "noopener")} />
      </div>
      <div className="site-stage-body" data-controls={controls.length ? (demo.bleed ? "below" : "true") : undefined}>
        <div className="site-stage-main">
          <div ref={canvas} className="site-stage-canvas" data-device={device} style={scale < 1 ? { height: Math.ceil(height * scale), overflow: "hidden" } : undefined}>
            <iframe ref={frame} title={`${demo.title} 演示`} {...frameProps} style={frameStyle} loading="lazy" />
          </div>
          {scale < 1 && <p className="site-stage-note">按 {DESKTOP_WIDTH}px 桌面宽度排版、缩小显示（{Math.round(scale * 100)}%）</p>}
        </div>
        {controls.length > 0 && (
          <div className="site-controls" aria-label={t.playground}>
            <div className="site-controls-head">
              <strong>{t.playground}</strong>
              <Button size="xs" variant="ghost" onClick={() => onValues(defaultsOf(controls))}>
                <RotateCcw aria-hidden="true" />
                {t.reset}
              </Button>
            </div>
            {controls.map((c) => (
              <ControlInput key={c.name} control={c} value={values[c.name]} onChange={(v) => onValues({ ...values, [c.name]: v })} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** JSX-ish snippet of the current playground props (shown above the demo source). */
export function propsSnippet(component: string, values: PropValues, controls: readonly Control[]): string {
  const attrs = controls
    .filter((c) => values[c.name] !== c.default)
    .map((c) => {
      const v = values[c.name];
      if (typeof v === "boolean") return v ? c.name : `${c.name}={false}`;
      if (typeof v === "number") return `${c.name}={${v}}`;
      return `${c.name}="${String(v)}"`;
    });
  return `<${component}${attrs.length ? ` ${attrs.join(" ")}` : ""} />`;
}
