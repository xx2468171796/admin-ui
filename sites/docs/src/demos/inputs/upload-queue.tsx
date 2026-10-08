import { Camera, FlaskConical } from "lucide-react";
import { Button, UploadDropZone, UploadQueueList, useUploadQueue } from "@adminui/react";
import { fakeFiles, fakeUpload } from "../../data/inputs-data";

const MB = 1024 * 1024;

/**
 * 多文件：useUploadQueue 管并发、进度、取消、重试；UploadDropZone + UploadQueueList 负责样子。
 * 点「模拟上传」放 3 个文件进来：名字带「失败」的会在 30% 断一次，「全部重试」从断点接着传。
 */
export function Demo() {
  const queue = useUploadQueue({ upload: fakeUpload, maxBytes: 1024 * MB, accept: ["image/*", ".pdf", ".xlsx"] });
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", alignItems: "start" }}>
      <UploadDropZone
        onFiles={queue.add}
        accept={["image/*", ".pdf", ".xlsx"]}
        maxBytes={1024 * MB}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => queue.add(fakeFiles(["报价单-远航精密.pdf", "大-需求调研录音整理.pdf", "合同扫描件-失败.pdf"]))}>
              <FlaskConical aria-hidden="true" />模拟上传
            </Button>
            <Button variant="outline" size="sm"><Camera aria-hidden="true" />拍照</Button>
          </>
        }
      />
      <UploadQueueList
        items={queue.items}
        now={queue.now}
        onCancel={queue.cancel}
        onRetry={queue.retry}
        onRemove={queue.remove}
        canRetry={queue.canRetry}
        previewOf={queue.previewOf}
      />
    </div>
  );
}
