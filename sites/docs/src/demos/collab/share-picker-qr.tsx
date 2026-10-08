import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button, QrCode, SharePicker, downloadQrPng, type ShareGrant } from "@adminui/react";
import { SHARE_PEOPLE } from "../../data/collab-data";

/**
 * 左：SharePicker（= GrantList mode="list"）——勾选要分享的人，勾上后选权限。
 * 右：QrCode 内置编码器，两种主题下都是浅底深码（扫码器需要），可带中心标记、下载 PNG。
 */
const LEVELS = [
  { value: "view", label: "可看" },
  { value: "plain", label: "可看明文" },
];
const LINK = "https://example.com/s/Kp7xQ2";

export function Demo() {
  const [value, setValue] = useState<ShareGrant[]>([{ id: "u05", level: "view" }]);
  const box = useRef<HTMLDivElement>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 24, alignItems: "start" }}>
      <SharePicker subjects={SHARE_PEOPLE} value={value} onChange={setValue} levels={LEVELS} label="分享给" />
      <div ref={box} className="aui-stack" style={{ justifyItems: "start" }}>
        <QrCode value={LINK} size={132} mark="北" label="分享链接二维码" />
        <Button variant="outline" size="sm" onClick={() => void downloadQrPng(LINK, "分享二维码.png", box.current)}>
          <Download aria-hidden="true" />下载 PNG
        </Button>
      </div>
    </div>
  );
}
