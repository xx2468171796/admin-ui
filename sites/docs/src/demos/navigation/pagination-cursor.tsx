// 游标分页：服务端不给总数时用 mode="cursor"，只有「第 N 页」和 ‹ ›（传 total 编译不过）。
import { useState } from "react";
import { DataTable, type Column } from "@adminui/react";
import { PEOPLE, type Person } from "../../data/demo-data";

const COLUMNS: readonly Column<Person>[] = [
  { key: "name", title: "姓名", render: (r) => r.name },
  { key: "title", title: "岗位", render: (r) => r.title },
  { key: "email", title: "邮箱", render: (r) => r.email, minWidth: 200 },
];
const SIZE = 3;

export function Demo() {
  const [index, setIndex] = useState(0);
  const rows = PEOPLE.slice(index * SIZE, index * SIZE + SIZE);
  return (
    <DataTable
      caption="登录日志里的成员"
      rows={rows}
      rowKey={(r) => r.id}
      columns={COLUMNS}
      pagination={{
        mode: "cursor",
        pageIndex: index,
        pageSize: SIZE,
        onPageSizeChange: () => undefined,
        canPrev: index > 0,
        canNext: (index + 1) * SIZE < PEOPLE.length,
        onPrev: () => setIndex((i) => i - 1),
        onNext: () => setIndex((i) => i + 1),
      }}
    />
  );
}
