import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Small tier: core entry only — no echarts / TanStack / markdown in the bundle.
export default defineConfig({ plugins: [react()], base: "./" });
