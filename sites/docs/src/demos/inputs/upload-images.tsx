import { useEffect, useState } from "react";
import { FormField, ImageUploadGrid, type ImageUploadTile } from "@adminui/react";
import { fakeUpload, placeholderPhoto } from "../../data/inputs-data";

/** 照片：96px 方块，第一张是封面；上传中圆环 + 百分比，失败红边 + 重试；「添加照片 · 还能加 N 张」。 */
export function Demo() {
  const [photos, setPhotos] = useState<ImageUploadTile[]>([]);
  useEffect(() => {
    setPhotos([
      { id: "p1", url: placeholderPhoto("blue"), name: "前台.png" },
      { id: "p2", url: placeholderPhoto("green"), name: "会议室.png" },
      { id: "p3", url: placeholderPhoto("yellow"), name: "机房.png" },
    ]);
  }, []);
  return (
    <FormField label="现场照片" htmlFor="img-grid" hint="最多 6 张，单张 20 MB 以内；点「添加照片」选本机图片试试">
      <div id="img-grid">
        <ImageUploadGrid
          label="现场照片"
          images={photos}
          max={6}
          maxBytes={20 * 1024 * 1024}
          upload={fakeUpload}
          onUploaded={(result, file) => setPhotos((list) => [...list, { id: result.id, url: URL.createObjectURL(file), name: result.name }])}
          onRemove={(img) => setPhotos((list) => list.filter((p) => p.id !== img.id))}
        />
      </div>
    </FormField>
  );
}
