/**
 * Typed ECharts formatter callbacks. ECharts types every formatter's params as its widest union
 * (`CallbackDataParams | CallbackDataParams[]`, `(value, index, extra)` …), so a callback that declares the
 * subset it reads (`{ dataIndex: number }[]`) does not type-check against the option and used to be cast
 * `as never` at every call site. `chartFormatter` is that cast in one place: it keeps the callback's own
 * params typed for its body and hands ECharts a `(params: unknown) => string`, which every formatter slot
 * (tooltip, axisLabel, label, legend) accepts. Declare only fields ECharts really passes for that slot.
 */
export type ChartFormatter = (params: unknown) => string;

export function chartFormatter<P>(format: (params: P) => string): ChartFormatter {
  return format as ChartFormatter;
}
