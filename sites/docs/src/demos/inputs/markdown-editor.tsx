import { useState } from "react";
import { MarkdownEditor } from "@adminui/react/markdown";

const START = `## 产品演示安排

本周四下午为 **远航精密制造** 做线上演示，时长 30 分钟。

- 客户管理：线索 → 商机 → 合同
- 工单：自动分派与超时提醒
- 数据看板：本月新增与赢单率

| 时间 | 内容 | 负责人 |
| --- | --- | --- |
| 14:00 | 产品介绍 | 陈一鸣 |
| 14:20 | 答疑 | 吴昊 |

> 演示环境地址见 [内部文档](https://docs.example.com/demo)。
`;

/** 左边写 Markdown，右边实时预览（支持表格、任务列表等 GFM 语法）；可以导入 .md 文件。 */
export function Demo() {
  const [value, setValue] = useState(START);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MarkdownEditor value={value} onChange={setValue} maxBytes={512 * 1024} />
      <p className="aui-text-note" style={{ margin: 0 }}>{value.length} 字</p>
    </div>
  );
}
