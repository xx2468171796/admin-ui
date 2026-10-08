import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Large tier: everything, with the heavy parts (grid / views / charts / markdown) behind lazy routes.
export default defineConfig({ plugins: [react()], base: "./" });
