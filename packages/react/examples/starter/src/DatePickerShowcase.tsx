import { useState } from "react";
import { CalendarClock, Plus, X } from "lucide-react";
import {
  Button,
  CalendarButton,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  DescriptionList,
  FormDialog,
  FormField,
  FormSection,
  PageBody,
  PageHeader,
  Panel,
  QuickDatePresets,
  TimeInput,
  dateRangePresets,
  useNotify,
  type HolidayMarks,
} from "@adminui/react";

// 日期选择（bt/datepicker）：本页用 T08 设置页的分节 + 表单分组。所有日期框都是 DatePicker 家族，
// 值的格式和原生输入框一样（YYYY-MM-DD / YYYY-MM-DDTHH:mm / HH:mm）；节假日由宿主给，SDK 不带日历。
const NOW = new Date(2026, 9, 5, 9, 30); // 演示固定在 2026-10-05（周一）09:30
const now = () => NOW;
const HOLIDAYS: HolidayMarks = {
  "2026-10-01": "off", "2026-10-02": "off", "2026-10-03": "off", "2026-10-04": "off",
  "2026-10-05": "off", "2026-10-06": "off", "2026-10-07": "off", "2026-10-10": "work",
};
const RANGE_PRESETS = dateRangePresets(["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "last7", "last30"], { now: NOW });
const shortDay = (day: string) => `${day.slice(5, 7)}-${day.slice(8)}`;

export function DatePickerShowcase() {
  const notify = useNotify();
  const [install, setInstall] = useState("2026-10-12");
  const [visit, setVisit] = useState("2026-10-09T10:00");
  const [expires, setExpires] = useState("");
  const [remind, setRemind] = useState("09:00");
  const [range, setRange] = useState({ from: "2026-09-29", to: "2026-10-05" });
  const [makeup, setMakeup] = useState<string[]>(["2026-10-10"]);
  const [dialog, setDialog] = useState(false);
  const [moveTo, setMoveTo] = useState("2026-10-09T14:30");
  return (
    <>
      <PageHeader title="日期选择" description="DatePicker / DateTimePicker / TimeInput / DateRangePicker：可以直接输入（2026-10-05、2026/10/5、10/5），也可以点开日历选；↓ 打开日历，方向键换天，PageUp / PageDown 换月，Enter 选中，Esc 关闭。" />
      <PageBody>
        <Panel title="安装排期" description="安装日期不能早于今天，国庆休息日标「休」、10-10 补班标「班」；周日不派单。">
          <FormSection>
            <FormField label="安装日期" htmlFor="dp-install" hint="周日不能选">
              <DatePicker id="dp-install" value={install} onChange={setInstall} min="2026-10-05" holidays={HOLIDAYS} isDisabledDate={(d) => new Date(`${d}T00:00:00`).getDay() === 0} now={now} />
            </FormField>
            <FormField label="预约上门时间" htmlFor="dp-visit" hint="每 15 分钟一档，09:00 前不上门">
              <DateTimePicker id="dp-visit" value={visit} onChange={setVisit} min="2026-10-05T09:00" max="2026-12-31T18:00" minuteStep={15} holidays={HOLIDAYS} now={now} />
            </FormField>
            <FormField label="每日提醒时间" htmlFor="dp-remind" hint="↑ ↓ 每次 5 分钟">
              <TimeInput id="dp-remind" value={remind} onChange={setRemind} minuteStep={5} />
            </FormField>
            <FormField label="补班日" htmlFor="dp-makeup" hint="工期计算时照常计入">
              <span role="list" aria-label="已添加的补班日" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {makeup.map((d) => (
                  <Button key={d} role="listitem" size="sm" variant="secondary" aria-label={`移除补班日 ${d}`} onClick={() => setMakeup((list) => list.filter((x) => x !== d))}>
                    {shortDay(d)}
                    <X aria-hidden="true" />
                  </Button>
                ))}
                <CalendarButton id="dp-makeup" label="添加补班日" initialDay="2026-10-10" holidays={{ ...HOLIDAYS, ...Object.fromEntries(makeup.map((d) => [d, "work" as const])) }} isDisabledDate={(d) => makeup.includes(d)} onSelect={(d) => setMakeup((list) => [...list, d].sort())} now={now}>
                  <Plus aria-hidden="true" />添加
                </CalendarButton>
              </span>
            </FormField>
          </FormSection>
        </Panel>
        <Panel
          title="授权与报表"
          description="到期留空 = 永久；报表区间左侧是快捷范围，先点开始再点结束，顺序反了会自动对调。"
          actions={
            <Button size="sm" variant="outline" onClick={() => setDialog(true)}>
              <CalendarClock aria-hidden="true" />改约上门
            </Button>
          }
        >
          <FormSection>
            <div>
              <FormField label="授权到期" htmlFor="dp-expires" hint="留空 = 永久；到期后立即失效">
                <DateTimePicker id="dp-expires" clearable value={expires} onChange={setExpires} min="2026-10-05T09:30" now={now} />
              </FormField>
              <QuickDatePresets label="快捷到期" permanent onPick={setExpires} now={now} />
            </div>
            <FormField label="报表区间" htmlFor="dp-range" hint="最多看 1 年">
              <DateRangePicker id="dp-range" aria-label="报表区间" value={range} onChange={setRange} presets={RANGE_PRESETS} min="2025-10-05" max="2026-10-05" clearable now={now} />
            </FormField>
          </FormSection>
        </Panel>
        <Panel title="提交给服务端的值">
          <DescriptionList
            items={[
              { label: "安装日期", value: install || null },
              { label: "预约上门时间", value: visit || null },
              { label: "每日提醒时间", value: remind || null },
              { label: "补班日", value: makeup.join("、") || null },
              { label: "授权到期", value: expires || "永久" },
              { label: "报表区间", value: range.from && range.to ? `${range.from} → ${range.to}` : null },
            ]}
          />
        </Panel>
      </PageBody>
      <FormDialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="改约上门"
        description="客户要求改时间时用；改完会通知安装师傅。"
        submitLabel="确认改约"
        onSubmit={async () => {
          if (!moveTo) throw new Error("请选新的上门时间");
          setVisit(moveTo);
          notify(`已改约到 ${moveTo.replace("T", " ")}`, "success");
        }}
      >
        <FormField label="新的上门时间" htmlFor="dp-move" hint="只能约今天之后，15 分钟一档">
          <DateTimePicker id="dp-move" value={moveTo} onChange={setMoveTo} min="2026-10-05T09:00" minuteStep={15} holidays={HOLIDAYS} now={now} />
        </FormField>
      </FormDialog>
    </>
  );
}
