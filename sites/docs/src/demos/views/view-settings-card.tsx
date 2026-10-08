import { useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button, PopoverPanel, useNotify } from "@adminui/react";
import { CardSettings, RecordCard, ViewSettingsFooter, countSettingChanges, type CardConfig } from "@adminui/react/views";
import { BOARD_SLOTS, DEAL_FIELDS, TODAY, TIME_ZONE, dealFields, initialDeals } from "../../data/views-data";

const SHARED: CardConfig = { coverField: null, fields: [], density: "normal", showLabels: false };
const sample = initialDeals()[0];

/**
 * 卡片设置（看板 / 画册）：上面是实时预览卡，改密度、字段名、字段立刻看到。
 * 底栏写「已改 N 处，只对你生效」；没改时「恢复」禁用；「保存给所有人」只给有维护权限的人。
 */
export function Demo() {
  const notify = useNotify();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CardConfig>(SHARED);
  const changes = countSettingChanges(SHARED, card);

  return (
    <>
      <Button ref={anchor} variant="outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Settings2 aria-hidden="true" />
        卡片设置
      </Button>
      <PopoverPanel
        open={open}
        anchor={anchor.current}
        onClose={() => setOpen(false)}
        title="卡片设置 · 阶段看板（标准视图）"
        width={440}
        sheet
        footer={
          <ViewSettingsFooter
            changes={changes}
            onReset={() => setCard(SHARED)}
            onSaveAsNew={() => notify("已另存为我的视图", "success")}
            onSaveForAll={() => notify("已保存给所有人", "success")}
          />
        }
      >
        <CardSettings
          fields={DEAL_FIELDS}
          coverFields={[{ value: "files", label: "现场照片" }]}
          value={card}
          onChange={setCard}
          preview={
            sample && (
              <RecordCard
                record={sample}
                title={sample.name}
                {...BOARD_SLOTS}
                fields={dealFields(card.fields)}
                showLabels={card.showLabels === true}
                density={card.density}
                attachments={card.coverField ? sample.files : undefined}
                today={TODAY}
                timeZone={TIME_ZONE}
              />
            )
          }
        />
      </PopoverPanel>
    </>
  );
}
