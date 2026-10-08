import { useMemo, useState } from "react";
import { Share2, UserRoundCheck } from "lucide-react";
import { Button, DescriptionList, useAdminTheme, useIsMobile } from "@adminui/react";
import { OrgPicker, type PickedSubject } from "@adminui/react/org-picker";
import { createDemoOrgSource, demoViewerProps } from "../../data/org-picker-data";
import { previewFrameProps } from "../../shell/preview-frame";

/**
 * 手机（≤ 760）：整屏弹层，部门树换成一层层点进去的下钻列表，已选收成底部一条；单选转交没有已选条。
 * 宽屏上这个演示把自己放进一个 390 宽的框里，命中组件真正的手机断点。
 */
const PHONE = { width: 390, height: 780 };

function PhoneFrame() {
  const { mode, paletteChoice } = useAdminTheme();
  const palette = typeof paletteChoice === "string" ? paletteChoice : "forest";
  const frame = previewFrameProps({ demo: "business/org-picker-mobile", mode, palette, props: {} });
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <iframe title="手机 390 宽的人员选择器" {...frame} style={{ ...PHONE, maxWidth: "100%", border: "1px solid var(--aui-border)", borderRadius: 24 }} />
    </div>
  );
}

function PhoneDemo() {
  const source = useMemo(() => createDemoOrgSource(), []);
  const common = useMemo(() => ({ source, ...demoViewerProps("wang") }), [source]);
  const [open, setOpen] = useState<"share" | "transfer" | null>(null);
  const [shared, setShared] = useState<PickedSubject[]>([]);
  const [owner, setOwner] = useState<PickedSubject[]>([]);
  const close = () => setOpen(null);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Button onClick={() => setOpen("share")}>
        <Share2 aria-hidden="true" />
        分享给同事
      </Button>
      <Button variant="outline" onClick={() => setOpen("transfer")}>
        <UserRoundCheck aria-hidden="true" />
        转交负责人（单选）
      </Button>
      <DescriptionList
        items={[
          { label: "分享给", value: shared.map((s) => s.label).join("、") || "—" },
          { label: "新负责人", value: owner[0]?.label ?? "—" },
        ]}
      />
      <OrgPicker {...common} open={open === "share"} onClose={close} title="分享给同事" value={shared} onChange={setShared} />
      <OrgPicker
        {...common}
        open={open === "transfer"}
        onClose={close}
        mode="single"
        selectable={["person"]}
        title="转交客户"
        description="接手人会收到通知"
        value={owner}
        onChange={setOwner}
      />
    </div>
  );
}

/** Narrow (the real phone breakpoint): the picker itself; wide: a 390 frame that loads this same demo. */
export function Demo() {
  return useIsMobile() ? <PhoneDemo /> : <PhoneFrame />;
}
