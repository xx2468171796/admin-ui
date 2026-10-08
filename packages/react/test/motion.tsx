import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, Button, Dialog, Input, LoadingDots, MotionReveal, Skeleton } from "../src/index.ts";
import "../src/styles.css";
function Demo() {
  const [motion, setMotion] = useState<"none" | "system">("system");
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState(false);
  return <><div id="outside" style={{animation:"outside-spin 2s infinite"}}>outside</div>
    <AdminProvider storageKey="motion-test" motion={motion}>
      <Button onClick={() => setMotion(value => value === "none" ? "system" : "none")}>切换动效</Button>
      <Button onClick={() => setReplay(value => value + 1)}>重播</Button>
      <Button onClick={() => setOpen(true)}>打开弹窗</Button>
      <MotionReveal replayKey={replay} delay={60}><Input aria-label="保留输入" defaultValue=""/></MotionReveal>
      <Skeleton lines={3}/><LoadingDots/>
      <Dialog open={open} onClose={() => setOpen(false)} title="动效弹窗" description="保持键盘焦点"><p>弹窗内容</p></Dialog>
      <div style={{height:2000}}/>
    </AdminProvider></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Demo/></React.StrictMode>);
