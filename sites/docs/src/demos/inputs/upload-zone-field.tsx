import { useState } from "react";
import { FormField, UploadDropZone, UploadField, useNotify, type UploadFieldValue } from "@adminui/react";
import { fakeUpload } from "../../data/inputs-data";

const MB = 1024 * 1024;
const grid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", alignItems: "start" } as const;
let seq = 0;

/** 一种拖放区（拖进来变主色实线）；表单里单个文件用「一行版」UploadField，传完显示缩略图 + 换一张 / 删除。 */
export function Demo() {
  const notify = useNotify();
  const [cover, setCover] = useState<UploadFieldValue | null>({ name: "产品手册-封面.png", size: 1.2 * MB });
  const upload = (file: File, ctx: { signal: AbortSignal; onProgress: (p: number) => void }) =>
    fakeUpload(file, { ...ctx, key: `field-${(seq += 1)}`, attempt: 1 });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <UploadDropZone
        onFiles={(files) => notify(`选了 ${files.length} 个文件`, "info")}
        maxBytes={1024 * MB}
        hint="合同、报价单、截图都行 · 单个 1 GB 以内 · 也能直接粘贴截图"
      />
      <div style={grid}>
        <UploadDropZone onFiles={() => undefined} accept={["image/png", "image/jpeg"]} maxBytes={5 * MB} error="只能传 PNG、JPG" />
        <UploadDropZone onFiles={() => undefined} disabled disabledText="已停止收集" />
      </div>
      <div style={grid}>
        <FormField label="营业执照" htmlFor="up-license" hint="单个文件，表单里用一行">
          <UploadField id="up-license" label="上传营业执照" accept={["image/png", "image/jpeg", ".pdf"]} maxBytes={10 * MB} upload={upload} onUploaded={(r) => notify(`${r.name} 上传成功`, "success")} />
        </FormField>
        <FormField label="封面（已上传）" htmlFor="up-cover">
          <UploadField
            id="up-cover"
            accept={["image/png", "image/jpeg"]}
            maxBytes={5 * MB}
            value={cover}
            onRemove={() => setCover(null)}
            upload={upload}
            onUploaded={(r) => setCover({ name: r.name, url: r.url })}
          />
        </FormField>
      </div>
    </div>
  );
}
