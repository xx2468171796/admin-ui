import { useState } from "react";
import { Button, Choice, Dialog, FormField, Input, LoadingDots, MotionReveal, PageHeader,
  Panel, Skeleton, Switch, useAdminMotion, useNotify } from "@adminui/react";

export function MotionShowcase({ active, motion, onMotionChange }: {
  active: boolean; motion: "system" | "none"; onMotionChange: (value: "system" | "none") => void;
}) {
  const [effect, setEffect] = useState<"fade" | "rise" | "scale">("rise");
  const [replay, setReplay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const enabled = useAdminMotion();
  const notify = useNotify();
  return <>
    <PageHeader title="动效示例" actions={<Switch aria-label="启用轻动效" checked={motion === "system"}
      onCheckedChange={value => onMotionChange(value ? "system" : "none")}/>}/>
    <div className="aui-stack">
    <Panel title="界面反馈" description={enabled ? "轻动效已开启，按下按钮试试。" : "当前使用静态反馈，所有功能仍可操作。"}
      actions={<><Button onClick={() => notify("操作已完成", "success")}>显示成功通知</Button>
        <Button variant="outline" onClick={() => setOpen(true)}>打开预览弹窗</Button></>}>{null}</Panel>
    <Panel title="卡片入场" description="切换入场方式再重播，填写的内容会保留。"
      actions={<><Choice label="入场方式" value={effect} onChange={value => setEffect(value as typeof effect)}
        options={[{value:"fade",label:"淡入"},{value:"rise",label:"轻移入场"},{value:"scale",label:"轻缩放"}]}/>
        <Button onClick={() => setReplay(value => value + 1)}>重播入场</Button></>}>
      <MotionReveal effect={effect} replayKey={replay} active={active}>
        <FormField label="试填内容" htmlFor="motion-draft"><Input id="motion-draft" value={draft} onChange={event => setDraft(event.target.value)}/></FormField>
      </MotionReveal>
    </Panel>
    <Panel title="加载反馈" description="这是加载状态预览，实际页面由接口状态决定何时结束。"
      actions={<Button variant="outline" onClick={() => setLoading(value => !value)}>{loading ? "显示内容" : "显示骨架"}</Button>}>
      {loading ? <div className="aui-stack"><Skeleton lines={3} paused={!active} label="正在加载清单"/>
        <LoadingDots label="正在读取内容" paused={!active}/></div> : <p>内容已就绪，可以继续操作。</p>}
    </Panel>
    </div>
    <Dialog open={open} onClose={() => setOpen(false)} title="预览详情" description="短暂淡入与轻缩放，关闭后回到原来的按钮。">
      <p>弹窗中的内容始终正常显示，关闭动画不会延迟你的下一步操作。</p>
    </Dialog>
  </>;
}
