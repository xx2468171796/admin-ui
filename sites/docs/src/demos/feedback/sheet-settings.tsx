import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button, FormField, Input, SideSheet, Switch } from "@adminui/react";

/**
 * 设置类侧边弹层：贴右边、上下铺满；cards 让正文变浅灰底放白卡；
 * changes 让底栏左边写「改了 N 项，还没保存」，关的时候先问。
 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("7");
  const [remind, setRemind] = useState(true);
  const changes = (days !== "7" ? 1 : 0) + (remind ? 0 : 1);
  const reset = () => {
    setDays("7");
    setRemind(true);
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings2 aria-hidden="true" />
        表设置
      </Button>
      <SideSheet
        open={open}
        title="表设置"
        description="只影响「客户」这张表"
        cards
        changes={changes}
        onClose={() => {
          reset();
          setOpen(false);
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>取消</Button>
            <Button disabled={!changes} onClick={() => setOpen(false)}>保存</Button>
          </>
        }
      >
        <section className="aui-panel" style={{ padding: 16 }}>
          <FormField label="几天没跟进退回公海" htmlFor="sheet-days">
            <Input id="sheet-days" value={days} onChange={(e) => setDays(e.target.value)} suffix="天" />
          </FormField>
        </section>
        <section className="aui-panel" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>退回前一天提醒负责人</span>
            <Switch checked={remind} onCheckedChange={setRemind} aria-label="退回前一天提醒负责人" />
          </div>
        </section>
      </SideSheet>
    </>
  );
}
