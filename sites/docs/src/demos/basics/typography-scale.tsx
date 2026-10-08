/** 8 级字号 × 3 种字重：用 `aui-text-*` 工具类；数字等宽，单位小一号次要色。 */
export function Demo() {
  const levels = [
    { cls: "aui-text-display", name: "大数字 28", sample: "¥1,284,000" },
    { cls: "aui-text-title", name: "页面 / 记录标题 22", sample: "远航精密制造" },
    { cls: "aui-text-dialog", name: "区块大标题 18", sample: "新建客户" },
    { cls: "aui-text-card", name: "卡片标题 14.5", sample: "跟进记录" },
    { cls: "aui-text-body", name: "正文 14", sample: "客户希望下周安排一次产品演示。" },
    { cls: "aui-text-control", name: "表格 / 控件 13", sample: "华东销售组 · 陈一鸣" },
    { cls: "aui-text-tag", name: "标签 12.5", sample: "重点客户" },
    { cls: "aui-text-note", name: "备注 / 表头 12", sample: "更新于 10-08 14:20" },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {levels.map((l) => (
        <div key={l.cls} style={{ display: "grid", gridTemplateColumns: "minmax(96px, 150px) minmax(0, 1fr)", gap: 16, alignItems: "baseline" }}>
          <span className="aui-text-note">{l.name}</span>
          <span className={l.cls}>{l.sample}</span>
        </div>
      ))}
    </div>
  );
}
