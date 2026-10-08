import { useRef, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { Button, PopoverPanel } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

const CONDITIONS = ["阶段 是 商务谈判", "城市 是 上海", "年费 大于 ¥100,000"];

/**
 * 工具栏面板：贴按钮左边缘往下 6px；标题 + 「?」+ 右边计数；底栏放起步动作。
 * 触发按钮打开时浅灰底（aria-expanded），已生效时主色浅底 + 数字（data-applied）。
 */
export function Demo() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const matched = Math.max(3, CUSTOMERS.length - count * 7);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button ref={anchor} variant="ghost" aria-expanded={open} data-applied={count ? "" : undefined} onClick={() => setOpen((v) => !v)}>
        <Filter aria-hidden="true" />
        筛选{count ? ` ${count}` : ""}
      </Button>
      <PopoverPanel
        open={open}
        anchor={anchor.current}
        onClose={() => setOpen(false)}
        title="筛选"
        help="只改你自己的视图，自动保存。"
        headerExtra={count ? `符合 ${matched} / ${CUSTOMERS.length} 位` : undefined}
        sheet
        footer={
          <>
            <Button size="sm" variant="ghost" disabled={count >= CONDITIONS.length} onClick={() => setCount((n) => n + 1)}>
              <Plus aria-hidden="true" />
              添加条件
            </Button>
            <span style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" disabled={!count} onClick={() => setCount(0)}>清空</Button>
          </>
        }
      >
        {count ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {CONDITIONS.slice(0, count).map((c) => <li key={c}>{c}</li>)}
          </ul>
        ) : (
          <p className="aui-note" style={{ margin: 0 }}>还没有条件。点「添加条件」开始筛选。</p>
        )}
      </PopoverPanel>
    </div>
  );
}
