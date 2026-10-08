import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { StatePanel, useAdminTheme } from "@adminui/react";
import type { TargetBarInput } from "@adminui/react/charts";

// 图表在可选子路径 @adminui/react/charts（ECharts），按需加载，不进首屏包。
const Chart = lazy(() => import("@adminui/react/charts").then((m) => ({ default: m.AdminChart })));
const chartsModule = import("@adminui/react/charts");

/** 柱子 + 目标刻度（targetBarOption → AdminChart）：当期没结束画虚线空心，没开始的留空。 */
export function TargetBars({ input, label, height = 180, active = true }: { input: Omit<TargetBarInput, "mode">; label: string; height?: number; active?: boolean }) {
  const { mode } = useAdminTheme();
  const [builders, setBuilders] = useState<typeof import("@adminui/react/charts") | null>(null);
  useEffect(() => {
    let live = true;
    void chartsModule.then((m) => live && setBuilders(m));
    return () => {
      live = false;
    };
  }, []);
  const option = useMemo(() => builders?.targetBarOption({ ...input, mode }), [builders, input, mode]);
  const table = useMemo(
    () => ({
      columns: ["周期", input.name ?? "实际", ...(input.targets ? [input.targetName ?? "目标"] : [])],
      rows: input.categories.map((c, i) => [c, input.values[i] ?? null, ...(input.targets ? [input.targets[i] ?? null] : [])]),
    }),
    [input],
  );
  const loading = <StatePanel kind="loading" />;
  return <Suspense fallback={loading}>{option ? <Chart visible={active} option={option} label={label} height={height} table={table} /> : loading}</Suspense>;
}
