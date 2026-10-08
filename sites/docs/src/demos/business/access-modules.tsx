import { useMemo, useState } from "react";
import { useNotify } from "@adminui/react";
import { ModulePermissionEditor, PermissionDiff, diffModuleGrants, type ModuleGrants } from "@adminui/react/access";
import { ACCESS_MODULES, LEAD_DRAFT, LEAD_IMPACT, LEAD_SAVED, ORG_TREE, SCOPE_LABELS } from "../../data/business-data";

// 角色「销售主管」的模块权限：每个模块一行（档位 + 能看到的数据 + 细调）。已经改了两个模块，
// 点改动条的「保存…」看改动和影响（PermissionDiff），写原因后保存。影响名单来自服务端试算，这里是演示数据。

export function Demo() {
  const notify = useNotify();
  const [saved, setSaved] = useState<ModuleGrants>(LEAD_SAVED);
  const [draft, setDraft] = useState<ModuleGrants>(LEAD_DRAFT);
  const [confirm, setConfirm] = useState(false);
  const changes = useMemo(() => diffModuleGrants(ACCESS_MODULES, saved, draft, { scope: SCOPE_LABELS }), [saved, draft]);

  return (
    <>
      <ModulePermissionEditor
        modules={ACCESS_MODULES}
        value={draft}
        savedValue={saved}
        onChange={setDraft}
        scopeLabels={SCOPE_LABELS}
        orgTree={ORG_TREE}
        roleName="销售主管"
        onDiscard={() => setDraft(saved)}
        onSave={() => setConfirm(true)}
      />
      <PermissionDiff
        open={confirm}
        title="保存「销售主管」的改动"
        changes={changes}
        impact={LEAD_IMPACT}
        onClose={() => setConfirm(false)}
        onConfirm={async (reason) => {
          await new Promise((r) => setTimeout(r, 400));
          setSaved(draft);
          setConfirm(false);
          notify(`已保存（原因：${reason}），3 个人下一次操作就生效`, "success");
        }}
      />
    </>
  );
}
