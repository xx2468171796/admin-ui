import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, NotificationProvider, isPaletteId } from "@adminui/react";
import { registerIsland, type IslandName } from "../islands";
import { useHome } from "../store";

export type IslandPart = { view: ComponentType; /** Always dark (the dark band), whatever the page mode. */ dark?: boolean };

function IslandRoot({ name, dark, children }: { name: string; dark?: boolean; children: ReactNode }) {
  const { mode, palette } = useHome();
  return (
    <AdminProvider storageKey={`aui-home-${name}`} palette={isPaletteId(palette) ? palette : "forest"} mode={dark ? "dark" : mode} className="h-island">
      <NotificationProvider>{children}</NotificationProvider>
    </AdminProvider>
  );
}

/** Registers an island bundle's parts; the shell's IslandSlot mounts one part per slot into its own root. */
export function defineIsland(name: IslandName, parts: Record<string, IslandPart>) {
  registerIsland(name, {
    mount(el, part) {
      const def = parts[part];
      if (!def) throw new Error(`没有这个演示部件：${name}/${part}`);
      const View = def.view;
      const root = createRoot(el);
      root.render(
        <IslandRoot name={name} dark={def.dark}>
          <View />
        </IslandRoot>,
      );
      return () => root.unmount();
    },
  });
}
