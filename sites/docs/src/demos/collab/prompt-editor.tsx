import { useState } from "react";
import { Panel, PromptEditor, VersionList, useNotify } from "@adminui/react";
import { PROMPT_DRAFT, PROMPT_PUBLISHED, PROMPT_VARIABLES, PROMPT_VERSIONS } from "../../data/collab-data";

/**
 * 提示词编辑：行号、变量小标（{{…}}，点「插入变量」加）、和已发布版本对比（加的行主色浅底、删的行删除线）、字数。
 * 版本历史：当前在用的版本号主色实底；对比 / 回退悬停才出；回退 = 生成一个新版本，不删旧版本。
 */
export function Demo() {
  const notify = useNotify();
  const [draft, setDraft] = useState(PROMPT_DRAFT);
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>
        <PromptEditor
          label="沟通复盘"
          value={draft}
          onChange={setDraft}
          base={PROMPT_PUBLISHED}
          baseLabel="v3"
          variables={PROMPT_VARIABLES}
          footerExtra={<span>每次约 <b>2,300</b> 字给 AI</span>}
        />
      </div>
      <Panel title="版本历史">
        <VersionList
          items={PROMPT_VERSIONS}
          selected={viewing}
          onView={(v) => setViewing(viewing === v.id ? null : v.id)}
          rollbackHint={(v) => `回退到 ${v.version}：会生成 v5 = ${v.version} 的内容，不会删掉 v3`}
          onRollback={async (v) => {
            await new Promise((r) => setTimeout(r, 400));
            notify(`已生成 v5 = ${v.version} 的内容`, "success");
          }}
        />
      </Panel>
    </div>
  );
}
