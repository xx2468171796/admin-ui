/* 上传、密码与密钥：拖放区、一行版单文件、上传队列、图片方块、附件面板空状态；密码框、强度、再输一次、初始密码、分格密码。 */
import { useEffect, useState } from "react";
import { Camera, Mic } from "lucide-react";
import { AttachmentGallery, Button, CodeInput, FormField, Panel, UploadDropZone, UploadField, UploadQueue, useNotify, type UploadQueueAdapter, type UploadResult, ImageUploadGrid, type ImageUploadTile, InitialPasswordField, PasswordConfirmHint, PasswordInput, PasswordStrength, type InitialPasswordValue, passwordsMatch } from "@adminui/react";
import { demoPhoto } from "./media-demo";

const MB = 1024 * 1024;
const grid = (min: number) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 16, alignItems: "start" }) as const;
const stack = { display: "grid", gap: 12, minWidth: 0 } as const;
const cap = { margin: 0, color: "var(--aui-note)", fontSize: 12 } as const;

/** 演示用上传：名字里有「失败」的第一次在 30% 断网，重试从断点接着传；「大」字头的慢一点。 */
const resumeAt = new Map<string, number>();
const demoUpload: UploadQueueAdapter<UploadResult> = (file, { signal, onProgress, key, attempt }) =>
  new Promise((resolve, reject) => {
    let p = resumeAt.get(key) ?? 0;
    const step = file.name.startsWith("大") ? 1.2 : 9;
    const timer = setInterval(() => {
      p = Math.min(100, p + step);
      onProgress(p);
      if (file.name.includes("失败") && attempt === 1 && p >= 30) {
        clearInterval(timer);
        resumeAt.set(key, 30);
        reject(new Error("网络中断，已传 30%，重试会接着传"));
      } else if (p >= 100) {
        clearInterval(timer);
        resolve({ id: key, name: file.name, url: `/files/${encodeURIComponent(file.name)}` });
      }
    }, 160);
    signal.addEventListener("abort", () => clearInterval(timer));
  });

function UploadDemo() {
  const notify = useNotify();
  const [photos, setPhotos] = useState<ImageUploadTile[]>([]);
  useEffect(() => setPhotos([{ id: "c1", url: demoPhoto(0), name: "门口.jpg" }, { id: "c2", url: demoPhoto(1), name: "客厅.jpg" }]), []);
  const [cover, setCover] = useState<{ name: string; size: number; url: string } | null>(null);
  useEffect(() => setCover({ name: "智能门锁安装入门-封面.png", size: 1.2 * MB, url: demoPhoto(1) }), []);
  return (
    <div style={stack}>
      <Panel title="拖放区" description="一种样子：虚线、圆角 12、中性图标块；拖进来变主色实线 + 浅底；格式写人话">
        <div style={stack}>
          <UploadDropZone onFiles={(files) => notify(`选了 ${files.length} 个文件`, "info")} maxBytes={1024 * MB} hint="平面图、报价单、现场照片都行 · 单个 1 GB 以内 · 也能直接粘贴截图" />
          <div style={grid(220)} id="upload-states">
            <UploadDropZone onFiles={() => undefined} accept={["image/png", "image/jpeg"]} maxBytes={5 * MB} error="只能传 PNG、JPG" />
            <UploadDropZone onFiles={() => undefined} disabled disabledText="已收集结束" />
          </div>
          <div style={grid(320)}>
            <FormField label="课程封面" htmlFor="cover-empty" hint="单个文件，表单里用一行">
              <UploadField id="cover-empty" label="上传封面" hint="PNG、JPG，5 MB 以内；建议 16:9" accept={["image/png", "image/jpeg"]} maxBytes={5 * MB} upload={(file, ctx) => demoUpload(file, { ...ctx, key: file.name, attempt: 1 })} onUploaded={(r) => notify(`${r.name} 上传成功`, "success")} />
            </FormField>
            <FormField label="课程封面（已上传）" htmlFor="cover-done">
              <UploadField id="cover-done" accept={["image/png", "image/jpeg"]} maxBytes={5 * MB} value={cover} onRemove={() => setCover(null)} upload={(file, ctx) => demoUpload(file, { ...ctx, key: file.name, attempt: 1 })} onUploaded={(r) => setCover({ name: r.name, size: 0, url: r.url })} />
            </FormField>
          </div>
        </div>
      </Panel>
      <Panel title="上传队列" description="一行一个文件：类型方块 + 名字 + 4px 细条；失败写原因 + 重试，顶上「全部重试」">
        <UploadQueue upload={demoUpload} maxBytes={1024 * MB} accept={["image/*", "video/*", ".pdf", ".xlsx"]} layout="stack" hideEmptyQueue={false} onUploaded={(r) => notify(`${r.name} 上传成功`, "success")} />
      </Panel>
      <div style={grid(420)}>
        <Panel title="图片上传" description="96px 方块；第一张是封面；上传中圆环 + 百分比，失败红边 + 重试">
          <ImageUploadGrid
            label="现场照片"
            images={photos}
            max={7}
            maxBytes={20 * MB}
            upload={demoUpload}
            onUploaded={(r, file) => setPhotos((list) => [...list, { id: r.id, url: URL.createObjectURL(file), name: r.name }])}
            onRemove={(img) => setPhotos((list) => list.filter((p) => p.id !== img.id))}
          />
        </Panel>
        <Panel title="附件面板（空）" description="空的时候只有一个拖放区，选择文件 / 拍照 / 录音都在里面">
          <AttachmentGallery
            label="赵静怡的附件"
            items={[]}
            toolbar={false}
            onFiles={(files) => notify(`选了 ${files.length} 个文件`, "info")}
            emptyActions={
              <>
                <Button variant="outline" size="sm" onClick={() => notify("宿主打开相机", "info")}>
                  <Camera />
                  拍照
                </Button>
                <Button variant="outline" size="sm" onClick={() => notify("宿主打开录音", "info")}>
                  <Mic />
                  录音
                </Button>
              </>
            }
          />
        </Panel>
      </div>
    </div>
  );
}

function ChangePassword() {
  const [old, setOld] = useState("Xx000000");
  const [next, setNext] = useState("linhome26");
  const [again, setAgain] = useState("linhome62");
  const mismatch = passwordsMatch(next, again) === "mismatch";
  return (
    <div style={{ ...stack, maxWidth: 420 }} id="pw-change">
      <FormField label="原密码" htmlFor="pw-old" required>
        <PasswordInput id="pw-old" value={old} onChange={(e) => setOld(e.target.value)} />
      </FormField>
      <div style={{ display: "grid", gap: 6 }}>
        <FormField label="新密码" htmlFor="pw-new" required>
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </FormField>
        <PasswordStrength value={next} hint="打字试试" />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <FormField label="再输一次" htmlFor="pw-again" required>
          <PasswordInput id="pw-again" autoComplete="new-password" value={again} aria-invalid={mismatch || undefined} aria-describedby="pw-again-hint" onChange={(e) => setAgain(e.target.value)} />
        </FormField>
        <PasswordConfirmHint id="pw-again-hint" password={next} confirm={again} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button disabled={mismatch}>改密码</Button>
        <span style={cap}>改完其他设备要重新登录</span>
      </div>
    </div>
  );
}

function CodeDemo() {
  const [code, setCode] = useState("");
  const [fails, setFails] = useState(0);
  const [opened, setOpened] = useState(false);
  const check = (value: string) => {
    if (value === "A7K2") setOpened(true);
    else {
      setFails((n) => Math.min(5, n + 1));
      setCode("");
    }
  };
  return (
    <div style={grid(260)} id="pw-code">
      <div style={stack}>
        <p style={cap}>试试输入 A7K2（对）或别的（错）</p>
        <CodeInput label="密码" value={code} onChange={setCode} onComplete={check} error={opened ? undefined : fails ? `密码不对，还能试 ${5 - fails} 次` : undefined} maxTries={5} triesLeft={5 - fails} disabled={opened || fails >= 5} />
        {opened && <p style={{ ...cap, color: "var(--aui-primary)" }}>密码对了，正在打开…</p>}
      </div>
      <div style={stack}>
        <p style={cap}>锁定（连续输错 5 次）</p>
        <CodeInput label="已锁定的密码" value="" onChange={() => undefined} disabled />
      </div>
    </div>
  );
}

function PasswordDemo() {
  const [initial, setInitial] = useState<InitialPasswordValue>({ mode: "auto", password: "" });
  const [plain, setPlain] = useState("Lin@2026home");
  return (
    <div style={stack}>
      <Panel title="密码框" description="右边一个眼睛切换显示；大写锁定开着时提醒；等宽字体">
        <div style={grid(220)} id="pw-states">
          <FormField label="默认（点眼睛试试）" htmlFor="pw-a">
            <PasswordInput id="pw-a" value={plain} onChange={(e) => setPlain(e.target.value)} />
          </FormField>
          <FormField label="已显示" htmlFor="pw-b">
            <PasswordInput id="pw-b" defaultVisible defaultValue="Lin@2026home" />
          </FormField>
          <FormField label="出错" htmlFor="pw-c" error="原密码不对，还能试 4 次">
            <PasswordInput id="pw-c" defaultValue="wrongpass" />
          </FormField>
          <FormField label="禁用" htmlFor="pw-d">
            <PasswordInput id="pw-d" defaultValue="Lin@2026home" disabled />
          </FormField>
        </div>
      </Panel>
      <div style={grid(420)}>
        <Panel title="改密码" description="强度条 + 四条要求随打字打勾；两次不一致当场说">
          <ChangePassword />
        </Panel>
        <Panel title="新建员工的初始密码" description="不再是「留空 = 自动生成」的暗规则：两种方式摆明">
          <FormField label="初始密码" htmlFor="pw-initial">
            <InitialPasswordField id="pw-initial" value={initial} onChange={setInitial} />
          </FormField>
        </Panel>
      </div>
      <Panel title="分格密码（密码门 / 验证码）" description="格子 44 × 52；自动跳格、可粘贴整段；错了只变红边 + 抖一下 + 剩余次数小点">
        <CodeDemo />
      </Panel>
    </div>
  );
}

export function UploadPasswordSection() {
  return (
    <div style={stack}>
      <UploadDemo />
      <PasswordDemo />
    </div>
  );
}
