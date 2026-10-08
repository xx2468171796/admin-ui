import { useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button, Checkbox, PopoverPanel, StatePanel } from "@adminui/react";

const FIELDS = ["客户名称", "行业", "城市", "负责人", "阶段", "年费", "席位", "下次跟进"];
type Phase = "ready" | "loading" | "error";

/** 右对齐（align="end"）、窄档（width="sm"）的字段面板；面板里的加载和出错就地显示，不另开弹框。 */
export function Demo() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [shown, setShown] = useState<readonly string[]>(FIELDS.slice(0, 6));
  const toggle = (field: string) => setShown((list) => (list.includes(field) ? list.filter((f) => f !== field) : [...list, field]));
  const reload = () => {
    setPhase("loading");
    setTimeout(() => setPhase("ready"), 900);
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Button variant="ghost" onClick={() => setPhase("error")}>模拟出错</Button>
      <Button ref={anchor} variant="ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Columns3 aria-hidden="true" />
        字段
      </Button>
      <PopoverPanel
        open={open}
        anchor={anchor.current}
        onClose={() => setOpen(false)}
        title="显示的字段"
        headerExtra={`显示 ${shown.length} / ${FIELDS.length}`}
        width="sm"
        align="end"
        sheet
      >
        {phase === "error" ? (
          <StatePanel kind="error" size="compact" title="字段没加载出来" onRetry={reload} />
        ) : phase === "loading" ? (
          <StatePanel kind="loading" size="compact" />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {FIELDS.map((f) => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Checkbox checked={shown.includes(f)} onCheckedChange={() => toggle(f)} />
                {f}
              </label>
            ))}
          </div>
        )}
      </PopoverPanel>
    </div>
  );
}
