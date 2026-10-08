import { useState } from "react";
import { DescriptionList, Panel, Switch, Watermark } from "@adminui/react";

/**
 * 水印：斜铺、很淡（备注色），不挡点击、不挡选中文字，读屏不读。它只是「泄露可追溯」的提示，
 * 访客能拿到什么仍由服务端决定。公开页 SharedPageShell 默认就带（访客 IP + 打开时间）。
 */
export function Demo() {
  const [on, setOn] = useState(true);
  const card = (
    <Panel title="远航精密制造 · 续约报价">
      <DescriptionList
        items={[
          { label: "席位", value: "240 个" },
          { label: "年费", value: "¥388,000" },
          { label: "折扣", value: "92 折" },
          { label: "有效期", value: "2026-12-31" },
        ]}
      />
    </Panel>
  );
  return (
    <div className="aui-stack">
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Switch checked={on} onCheckedChange={setOn} aria-label="显示水印" />
        显示水印
      </label>
      {on ? <Watermark text={["访客 203.0.**.18", "2026-10-08 10:16"]}>{card}</Watermark> : card}
    </div>
  );
}
