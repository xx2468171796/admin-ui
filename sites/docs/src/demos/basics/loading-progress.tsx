import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Button, Meter, ProgressBar, SkeletonBlock, Spinner, StepProgress } from "@adminui/react";

/** 进度条 4 / 6 / 8、不确定进度、阶段分段条、配额条（≥ 80% 注意色、≥ 95% 异常色）；转圈只给形状未知的地方。 */
export function Demo() {
  const [upload, setUpload] = useState<number | null>(null);
  useEffect(() => {
    if (upload === null || upload >= 1) return;
    const timer = window.setTimeout(() => setUpload((v) => Math.min(1, (v ?? 0) + 0.1)), 250);
    return () => window.clearTimeout(timer);
  }, [upload]);
  const uploading = upload !== null && upload < 1;
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 520 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button size="sm" variant="outline" onClick={() => setUpload(0)} disabled={uploading}>
            <Upload aria-hidden="true" />开始上传
          </Button>
          <span className="aui-text-note">
            {upload === null ? "合同扫描件.pdf · 2.4 MB" : upload >= 1 ? "上传完成" : `正在上传… ${Math.round(upload * 100)}%`}
          </span>
        </div>
        <ProgressBar value={upload ?? 0} label="上传合同扫描件" />
        <ProgressBar value={null} label="正在导入客户" size={4} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>阶段 3 / 6</span>
        <StepProgress total={6} done={2} label="商机阶段" />
      </div>
      <Meter label="席位" ratio={38 / 50} value="38 / 50 席" detail="还可以邀请 12 人" />
      <Meter label="文件空间" ratio={0.96} size={8} detail="快满了：清理旧文件或加购空间" />
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Spinner />
        <Spinner size={20} tone="brand" />
        <Spinner size={32} tone="brand" label="正在搜索…" />
        <SkeletonBlock width={120} />
        <SkeletonBlock shape="pill" width={48} />
        <SkeletonBlock shape="circle" height={24} />
      </div>
    </div>
  );
}
