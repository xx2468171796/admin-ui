import { useState } from "react";
import { CommentThread } from "@adminui/react";
import { RECORD_COMMENTS, searchPeople } from "../../data/collab-data";

/** 空状态、加载、出错 + 重试（点「重试」后变成只读的评论栏）：同一个 CommentThread 的几种状态。 */
export function Demo() {
  const [failed, setFailed] = useState(true);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
      <div style={{ height: 320 }}>
        <CommentThread title="空状态" comments={[]} defaultFilter="all" onSend={async () => undefined} searchMentions={searchPeople} fill />
      </div>
      <div style={{ height: 320 }}>
        <CommentThread title="加载中" comments={[]} loading fill />
      </div>
      <div style={{ height: 320 }}>
        {failed ? (
          <CommentThread title="出错" comments={[]} error="评论没加载出来：网络中断" onRetry={() => setFailed(false)} fill />
        ) : (
          <CommentThread title="只读" comments={RECORD_COMMENTS} defaultFilter="all" readOnly fill />
        )}
      </div>
    </div>
  );
}
