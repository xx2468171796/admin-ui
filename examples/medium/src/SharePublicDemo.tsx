import { useEffect, useState } from "react";
import { Ban, Coins, Download, Eye, FileText, KeyRound, Link2, MapPin, MessageCircle, Pencil, Phone, Star, User, Bell, Box } from "lucide-react";
import {
  Button,
  PasswordGate,
  Rating,
  SecretReveal,
  SharedMediaCard,
  SharedPageShell,
  SharedRecordCard,
  Tag,
  type MediaItem,
} from "@adminui/react";
import { demoPhoto, demoTone } from "./media-demo";

// 公开分享页示例（样稿 D21 访客页、D21m 手机密码门、D21s 一次性密钥）：在 AdminShell 外面，只有 AdminProvider。
// 地址 #share-public=visitor | password | secret（加 &dark 看深色；访客页水印默认开，地址加 ?nowm 演示 watermark={false}）。密码检查、次数、作废都是服务端的事，这里在内存里模拟。
export type PublicKind = "visitor" | "password" | "secret";
const brand = (
  <>
    <Box aria-hidden="true" />
    Acme
  </>
);

export function SharePublicDemo({ kind }: { kind: PublicKind }) {
  if (kind === "visitor") return <VisitorPage />;
  if (kind === "password") return <PasswordPage />;
  return (
    <SharedPageShell brand={brand} variant="narrow" product="Acme" footerNote="全程加密">
      <SecretPage />
    </SharedPageShell>
  );
}

function VisitorPage() {
  const [photo, setPhoto] = useState<{ a: string; b: string } | null>(null);
  useEffect(() => setPhoto({ a: demoPhoto(0), b: demoPhoto(1) }), []);
  const [audio] = useState(() => demoTone(36, 5));
  const [next, setNext] = useState("2026-10-11");
  const [note, setNote] = useState("周六 10 点到滨江样品间看 KNX 面板，太太一起来；大门想加装人脸识别门锁，麻烦一并报价，主卧窗帘要能接 Apple Home");
  const media: MediaItem[] = [
    { id: "v", name: "现场走一圈.mp4", size: 24 * 1024 ** 2, duration: 42, meta: "10-05 拍摄" },
    { id: "p1", name: "客厅.jpg", size: 2.1 * 1024 ** 2, url: photo?.a, thumbUrl: photo?.a },
    { id: "p2", name: "配电箱.jpg", size: 1.8 * 1024 ** 2, url: photo?.b, thumbUrl: photo?.b },
    { id: "f", name: "报价单 v2.pdf", pages: 3, size: 1.2 * 1024 ** 2 },
    { id: "a", name: "客户语音留言.m4a", duration: 36, url: audio.url, peaks: audio.peaks, meta: "微信转存 · 10-04" },
  ];
  const save = (set: (v: string) => void) => async (value: string) => {
    await new Promise((r) => setTimeout(r, 300));
    if (!value.trim()) throw new Error("不能为空");
    set(value);
  };
  return (
    <SharedPageShell
      brand={brand}
      sharedBy={{ name: "小王", text: "分享给你的客户记录", org: "智能家居业务 · 华南子公司" }}
      verified
      status={{ text: <><b>7 天后失效</b> · 还能打开 17 次</>, title: "2026-10-12 18:00 失效；最多打开 20 次，已打开 3 次" }}
      actions={<Button size="sm" variant="outline"><Download />下载全部附件</Button>}
      visitor={{ ip: "203.0.113.18", at: Date.UTC(2026, 9, 5, 12, 16) }}
      watermark={!new URLSearchParams(window.location.search).has("nowm")}
      product="Acme 多维表格"
      footerNote="本页带水印，打开、下载、修改都会记录"
      onReport={() => window.alert("演示：这里打开举报表单")}
    >
      <SharedRecordCard
        title="李承恩（滨江豪宅）"
        avatar="李"
        status={<Tag>报价</Tag>}
        meta="客户记录 · 负责人 小王 · 更新于 10-05 19:07"
        fields={[
          { key: "intent", label: "意向", icon: <Star />, value: <Rating value={5} label="意向" />, sub: "非常有意向" },
          { key: "amount", label: "预计金额", icon: <Coins />, value: "¥2,180,000" },
          { key: "phone", label: "手机", icon: <Phone />, value: "139****5781", masked: true },
          { key: "region", label: "地区 · 来源", icon: <MapPin />, value: <><Tag>杭州</Tag><Tag>转介绍</Tag></> },
          { key: "next", label: "下次跟进", icon: <Bell />, value: next, sub: next === "2026-10-11" ? "你 19:07 改过（原 10-09）" : "刚改过", edit: { kind: "date", value: next, onSave: save(setNext), note: "你的修改会通知 小王" } },
          { key: "owner", label: "负责人", icon: <User />, value: "小王", sub: "智能家居顾问" },
          { key: "note", label: "备注", icon: <FileText />, value: note, span: "full", edit: { kind: "textarea", value: note, maxLength: 500, onSave: save(setNote), note: "你的修改会通知 小王" } },
        ]}
        permissions={[
          { key: "view", icon: <Eye />, text: "看 9 个字段" },
          { key: "edit", icon: <Pencil />, text: "改 下次跟进、备注" },
          { key: "dl", icon: <Download />, text: "下载附件" },
          { key: "copy", icon: <Ban />, text: "复制文字已关闭", denied: true },
        ]}
        contact={{ name: "小王", hint: "智能家居顾问 · 平日 9:00–21:00 回复", actions: <><Button size="sm" variant="outline"><MessageCircle />微信联系</Button><Button size="sm" variant="outline"><Phone />打电话</Button></> }}
      />
      <SharedMediaCard title="现场资料" summary="视频 1 · 图片 2 · PDF 1 · 语音 1" items={media} onDownload={() => undefined} downloadAllLabel="全部下载 · 38 MB" />
    </SharedPageShell>
  );
}

/** D21m → D21s：输对 7K2Q 打开一次性密钥；连错 3 次要过（模拟的）滑块，5 次锁住。 */
function PasswordPage() {
  const [failed, setFailed] = useState(0);
  const [slid, setSlid] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <SharedPageShell brand={brand} variant="narrow" product="Acme" footerNote="全程加密">
      {opened ? (
        <SecretPage />
      ) : (
        <PasswordGate
          sharedBy={{ name: "郑主管", org: "华南子公司" }}
          title="郑主管 分享给你一个密码"
          hint="输入郑主管另外告诉你的 4 位密码"
          burn={{ title: "打开后只显示一次，关闭即销毁", text: "看完请记好；关掉页面或 60 秒后就再也看不到" }}
          failed={failed}
          maxAttempts={5}
          captchaAfter={3}
          captcha={
            <Button variant="outline" aria-pressed={slid} onClick={() => setSlid(true)}>
              {slid ? "已通过滑块验证" : "（演示）拖动滑块完成验证"}
            </Button>
          }
          captchaDone={slid}
          contactHint="密码不在这条链接里，问问郑主管（微信或电话）"
          expiresText="10-06 20:30 前有效"
          locked={failed >= 5 ? "试错太多次，这个链接已锁定，请联系郑主管重新分享" : undefined}
          onSubmit={async (code) => {
            await new Promise((r) => setTimeout(r, 250));
            if (code.toUpperCase() === "7K2Q") setOpened(true);
            else {
              setFailed((n) => n + 1);
              setSlid(false);
              throw new Error("wrong");
            }
          }}
        />
      )}
    </SharedPageShell>
  );
}

function SecretPage() {
  return (
    <SecretReveal
      title="企业微信管理后台"
      sharedBy={{ name: "郑主管" }}
      sharedAt="10-05 20:30"
      voided={{ title: "这个链接已作废，刷新后无法再看", text: "阅后即焚：只有你看到，郑主管已收到「已查看」通知" }}
      fields={[
        { key: "account", label: "账号", icon: <User />, value: "smarthome@example.com" },
        { key: "password", label: "密码", icon: <KeyRound />, value: "Ln#8vQ2-xT9k", secret: true },
        { key: "url", label: "登录网址", icon: <Link2 />, value: "work.weixin.qq.com", href: "https://work.weixin.qq.com" },
      ]}
      memo={<><b>郑主管：</b>登录后到「成员」给自己开子账号，别长期用这个总账号。</>}
      onDestroy={async () => {
        await new Promise((r) => setTimeout(r, 250));
      }}
    />
  );
}
