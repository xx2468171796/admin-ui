import "@adminui/react/styles.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSXRuntime from "react/jsx-runtime";
import { useEffect } from "react";
import { AdminProvider, isPaletteId } from "@adminui/react";
import { HomePage } from "./page";
import { useHome } from "./store";
import "./home.css";

declare const __SITE_ESM__: boolean;

/**
 * Homepage entry (index.html). Kept small on purpose: the live demos are islands loaded on demand (islands.ts).
 * Sandbox build: the island bundles are built with React as an external and read it from these globals, so the page
 * runs one React (dev and the web build share it as an ordinary module chunk).
 */
if (!__SITE_ESM__) Object.assign(window, { __auiReact: React, __auiReactDOM: ReactDOM, __auiReactDOMClient: ReactDOMClient, __auiJSX: JSXRuntime });

function App() {
  const { mode, palette } = useHome();
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    // Overscroll / rubber-band areas show the page colour, not white in dark mode.
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(".h-home");
      const surface = el ? getComputedStyle(el).getPropertyValue("--aui-surface").trim() : "";
      if (surface) document.documentElement.style.background = surface;
    });
    return () => cancelAnimationFrame(raf);
  }, [mode, palette]);
  return (
    <AdminProvider storageKey="aui-home" palette={isPaletteId(palette) ? palette : "forest"} mode={mode} className="h-home">
      <HomePage />
    </AdminProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOMClient.createRoot(root).render(<App />);
  // `index.html#ai` (or a page that sets window.__homeFocus): the sections exist only after React renders.
  const focus = window.location.hash.slice(1) || (window as { __homeFocus?: unknown }).__homeFocus;
  if (typeof focus === "string" && /^[a-z-]+$/.test(focus)) window.setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: "start" }), 150);
}
