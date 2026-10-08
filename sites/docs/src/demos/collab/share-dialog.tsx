import { useRef, useState } from "react";
import { Building2, CalendarDays, Coins, FileText, Paperclip, Phone, Rows3, Share2, TextCursorInput, User, CircleDot } from "lucide-react";
import { Button, ShareDialog, applySharePolicy, randomPin, useNotify, type ShareFieldChoice, type ShareGrant, type ShareSettings } from "@adminui/react";
import { SHARE_PEOPLE, SHARE_POLICY, SHARE_SETTINGS, demoNow } from "../../data/collab-data";

/**
 * 分享一条客户记录：改任何设置都立即保存（onApply），第一次选「30 天」演示保存失败 → 改回原值、底栏写原因 + 重试。
 * 公司策略要求对外必须设密码、最长 30 天：密码开关锁住、「永久」划线并写原因。
 */
const FIELDS: ShareFieldChoice[] = [
  { key: "name", label: "客户名称", icon: <TextCursorInput /> },
  { key: "stage", label: "阶段", icon: <CircleDot /> },
  { key: "owner", label: "负责人", icon: <User /> },
  { key: "amount", label: "预计金额", icon: <Coins /> },
  { key: "phone", label: "联系电话", icon: <Phone />, masked: true },
  { key: "files", label: "附件", icon: <Paperclip /> },
  { key: "next", label: "下次跟进", icon: <CalendarDays />, editable: true },
  { key: "note", label: "备注", icon: <FileText />, editable: true },
  { key: "industry", label: "行业", icon: <Building2 /> },
  { key: "price", label: "成交价", icon: <Coins />, forbidden: "成交价由管理员禁止对外" },
];
const LEVELS = [
  { value: "view", label: "只能看" },
  { value: "comment", label: "可评论" },
  { value: "edit", label: "可编辑" },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Demo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  // 打开前把设置拉回策略内（去掉禁止对外的字段、强制密码、封顶有效期）
  const [settings, setSettings] = useState<ShareSettings>(() => applySharePolicy(SHARE_SETTINGS, SHARE_POLICY, FIELDS, () => randomPin(4), demoNow()).settings);
  const [people, setPeople] = useState<ShareGrant[]>([{ id: "u05", level: "view" }]);
  const [paused, setPaused] = useState(false);
  const failedOnce = useRef(false);

  const apply = async (next: ShareSettings) => {
    await wait(400);
    if (next.expiryPreset === "30d" && !failedOnce.current) {
      failedOnce.current = true;
      throw new Error("网络中断");
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Share2 aria-hidden="true" />分享记录</Button>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title="远航精密制造"
        objectLabel="客户记录"
        objectIcon={<Rows3 />}
        meta="陈一鸣 10-05 创建 · 改了立刻生效"
        link={{ url: "https://example.com/s/Kp7xQ2", token: "Kp7xQ2" }}
        settings={settings}
        onChange={setSettings}
        onApply={apply}
        fields={FIELDS}
        policy={SHARE_POLICY}
        people={{
          subjects: SHARE_PEOPLE,
          value: people,
          onChange: setPeople,
          levels: LEVELS,
          locked: [{ id: "u02", name: "陈一鸣", tag: "负责人", hint: "华东销售组 · 默认能看，去不掉", level: "edit" }],
          summary: <>共 <b>{people.length + 1}</b> 人能打开</>,
        }}
        opened={3}
        paused={paused}
        onPausedChange={setPaused}
        onVoid={async () => {
          await wait(300);
          setOpen(false);
          notify("链接已作废", "success");
        }}
        onOpenLog={() => notify("打开访问记录", "info")}
        logCount={6}
        onPreview={() => notify("以访客身份预览", "info")}
        previewText="记录卡片 · 8 个字段 · 附件可预览"
        passwordHint="连错 3 次要过滑块验证；密码和链接分开发更安全"
        qrMark="北"
        now={demoNow}
      />
    </>
  );
}
