import type { ComponentType } from "react";

/** Every file under src/demos exports `Demo`. Only the preview frame imports this (it pulls in every demo). */
type DemoModule = { Demo: ComponentType<Record<string, unknown>> };

const modules = import.meta.glob<DemoModule>("./*/*.tsx");

export async function loadDemo(id: string): Promise<DemoModule["Demo"]> {
  const load = modules[`./${id}.tsx`];
  if (!load) throw new Error(`没有这个演示：${id}`);
  return (await load()).Demo;
}
