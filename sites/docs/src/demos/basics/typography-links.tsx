import type { MouseEvent } from "react";
import { Button, Link } from "@adminui/react";

/** 4 种链接：跳到别处 = 链接，在原地做事 = 文字按钮。（演示里的站内链接不会跳走） */
export function Demo() {
  const stay = (event: MouseEvent) => event.preventDefault();
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0 }}>
        合同模板已更新，<Link href="#contract" onClick={stay}>查看合同模板</Link>后再发给客户。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <Link kind="quiet" href="#c1001" onClick={stay}>远航精密制造</Link>
        <Link kind="quiet" href="#c1002" onClick={stay}>青禾教育</Link>
        <Link kind="quiet" href="#c1003" onClick={stay}>星河物流</Link>
      </div>
      <p style={{ margin: 0 }}>
        还有 2 个字段没填：<Link kind="anchor" href="#address" onClick={stay}>地址</Link>、
        <Link kind="anchor" href="#region" onClick={stay}>区域</Link>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <Link kind="next" href="#all" onClick={stay}>查看全部</Link>
        <Link kind="external" href="https://example.com/help">帮助中心</Link>
        <Link href="#locked" disabled>无权查看</Link>
        <Button variant="text" size="sm">标记为已读</Button>
      </div>
    </div>
  );
}
