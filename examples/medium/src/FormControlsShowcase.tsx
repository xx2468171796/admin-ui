import { useState } from "react";
import { CalendarDays, LayoutGrid, List, Lock, Users } from "lucide-react";
import {
  CellTags,
  Checkbox,
  Choice,
  ChoiceTags,
  ChoiceTiles,
  DatePicker,
  DateTimePicker,
  FormField,
  FormSection,
  MultiChoice,
  OPTION_HUES,
  OPTION_HUE_LABELS,
  OptionSwatchPicker,
  PageBody,
  PageHeader,
  Panel,
  RadioGroup,
  SegmentedControl,
  Switch,
  type OptionHueTone,
  type SelectItem,
} from "@adminui/react";
import { LEGACY_SAMPLE, OPERATORS, PEOPLE, PRODUCTS, REGIONS, SAMPLE_OF, STAGES, STATUS, now } from "./form-controls-demo";

// 表单控件（审阅通过的五组）：本页用 T08 设置页的分节。日期 / 下拉 / 单选标签 / 多选 / 勾选类
// 全部是 SDK 组件，页面不写一行控件样式。演示日期固定在 2026-10-07（周三）。
const ROW = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } as const;
const COL = { display: "grid", gap: 2, justifyItems: "start" } as const;
const SETTING = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--aui-line)", cursor: "pointer" } as const;
const plain = (items: readonly SelectItem[]) => items.map((o) => ({ value: o.value, label: o.label, tone: o.tone }));
const FIELDS: SelectItem[] = [
  { value: "f1", label: "客户名称", group: "基本" },
  { value: "f2", label: "手机", group: "基本" },
  { value: "f3", label: "阶段", group: "销售" },
  { value: "f4", label: "感兴趣产品", group: "销售" },
  { value: "f5", label: "下次跟进", group: "销售" },
  { value: "f6", label: "负责人", group: "归属" },
  { value: "f7", label: "协作人", group: "归属", disabledReason: "没有权限" },
];

export function FormControlsShowcase() {
  return (
    <>
      <PageHeader title="表单控件" description="日期、下拉、单选标签、多选、勾选类五组控件的统一样子：一种输入框、一种弹层、选项 10 色；手机上弹层变成底部弹层。" />
      <PageBody>
        <DateSection />
        <SelectSection />
        <TagSection />
        <MultiSection />
        <CheckSection />
      </PageBody>
    </>
  );
}

function DateSection() {
  const [next, setNext] = useState("2026-10-08");
  const [visit, setVisit] = useState("2026-10-09T14:30");
  const [last, setLast] = useState("2026-10-03");
  const [empty, setEmpty] = useState("");
  return (
    <Panel title="日期" description="值后面跟「周四 · 明天」；到期字段（deadline）明天到期是注意色、过期是异常色；悬停出清空 ×。弹层顶上一排快捷，今天 = 主色字 + 小圆点；日期 + 时间在月历右边有半小时一档的时间列。">
      <FormSection>
        <div className="aui-form-grid">
          <FormField label="下次跟进" htmlFor="fc-next" hint="到期字段：明天到期用注意色">
            <DatePicker id="fc-next" value={next} onChange={setNext} clearable deadline now={now} />
          </FormField>
          <FormField label="回访时间" htmlFor="fc-visit">
            <DateTimePicker id="fc-visit" value={visit} onChange={setVisit} clearable minuteStep={15} now={now} />
          </FormField>
          <FormField label="上次联系" htmlFor="fc-last" hint="过期 = 异常色">
            <DatePicker id="fc-last" value={last} onChange={setLast} deadline now={now} />
          </FormField>
          <FormField label="合同到期" htmlFor="fc-empty" hint="空的框只写「选择日期」，不放示例日期">
            <DatePicker id="fc-empty" value={empty} onChange={setEmpty} clearable now={now} />
          </FormField>
          <FormField label="成交日期（禁用）" htmlFor="fc-dis">
            <DatePicker id="fc-dis" value="2026-10-05" onChange={() => undefined} disabled now={now} />
          </FormField>
          <FormField label="预约上门（出错）" htmlFor="fc-err" error="下次跟进不能早于今天">
            <DatePicker id="fc-err" value="2026-10-03" onChange={() => undefined} aria-invalid now={now} />
          </FormField>
        </div>
      </FormSection>
    </Panel>
  );
}

function SelectSection() {
  const [stage, setStage] = useState("s2");
  const [regions, setRegions] = useState<SelectItem[]>(REGIONS);
  const [region, setRegion] = useState("");
  const [owner, setOwner] = useState("u1");
  const [field, setField] = useState("f3");
  const [op, setOp] = useState("any");
  const [values, setValues] = useState<string[]>(["s1", "s2"]);
  return (
    <Panel title="下拉选择" description="一种触发器 + 一种弹层：选项多于 6 个自动出搜索，分组小标题，单选的勾在右；清空是悬停出现的 ×，不是假选项；不能选的灰掉并写原因；搜不到可以就地新建。">
      <FormSection>
        <div className="aui-form-grid">
          <FormField label="阶段" htmlFor="fc-stage" hint="分组 + 说明 + 灰掉的选项">
            <Choice id="fc-stage" label="阶段" value={stage} onChange={setStage} options={STAGES} clearable placeholder="选择阶段" />
          </FormField>
          <FormField label="区域" htmlFor="fc-region" hint="搜「漠河」试试：回车直接建，颜色自动轮下一个">
            <Choice id="fc-region" label="区域" value={region} onChange={setRegion} options={regions} clearable placeholder="选择区域"
              onCreate={(label) => {
                const value = `r${regions.length + 1}`;
                setRegions((list) => [...list, { value, label, tone: "gray" }]);
                return value;
              }} />
          </FormField>
          <FormField label="负责人" htmlFor="fc-owner" hint="头像 + 名字 + 部门">
            <Choice id="fc-owner" label="负责人" value={owner} onChange={setOwner} options={PEOPLE} />
          </FormField>
          <FormField label="是否续约" htmlFor="fc-plain" hint="纯文字选项（没有颜色）">
            <Choice id="fc-plain" label="是否续约" value="yes" onChange={() => undefined} options={[{ value: "yes", label: "是" }, { value: "no", label: "否" }]} />
          </FormField>
          <FormField label="来源（禁用）" htmlFor="fc-src-dis">
            <Choice id="fc-src-dis" label="来源" value="s3" onChange={() => undefined} options={plain(STAGES)} disabled />
          </FormField>
          <FormField label="阶段（出错）" htmlFor="fc-src-err" error="请选择阶段">
            <Choice id="fc-src-err" label="阶段" value="" onChange={() => undefined} options={plain(STAGES)} placeholder="选择阶段" aria-invalid />
          </FormField>
          <FormField label="成交阶段（只读）" htmlFor="fc-src-ro">
            <Choice id="fc-src-ro" label="成交阶段" value="s5" onChange={() => undefined} options={plain(STAGES)} readOnly />
          </FormField>
        </div>
      </FormSection>
      <div style={{ ...ROW, marginTop: 16 }} role="group" aria-label="筛选条示例">
        <span className="aui-note">筛选条（字段 / 条件 / 值都是 28px 小号）：当</span>
        <span style={{ width: 150 }}><Choice size="sm" label="筛选字段" value={field} onChange={setField} options={FIELDS} /></span>
        <span style={{ width: 130 }}><Choice size="sm" label="条件" value={op} onChange={setOp} options={OPERATORS} /></span>
        <span style={{ width: 240 }}><MultiChoice size="sm" label="筛选值" value={values} onChange={setValues} options={plain(STAGES)} placeholder="选择值" /></span>
      </div>
    </Panel>
  );
}

function TagSection() {
  const [tone, setTone] = useState<OptionHueTone>("violet");
  const [status, setStatus] = useState("t2");
  return (
    <Panel title="单选标签" description="选项 10 色：绿 = 主色、灰 = 备注色，其余 8 个取异常色的明度和彩度只转色相，换色卡和深色自动跟随。圆角 6 的软方块、不加边框；格子 20 / 字段行 22 / 表单 26px；实心只给最重要的一个值。">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 8, marginBottom: 16 }} role="list" aria-label="10 色色板">
        {OPTION_HUES.map((hue) => (
          <div key={hue} role="listitem" style={{ ...COL, gap: 6, padding: 10, border: "1px solid var(--aui-line)", borderRadius: 10 }}>
            <span className="aui-chip" data-tone={hue} data-size="md"><span className="aui-chip-label">{SAMPLE_OF[hue]}</span></span>
            <span className="aui-chip" data-tone={`${hue}Solid`}><span className="aui-chip-label">实心</span></span>
            <span style={{ ...ROW, gap: 6, fontSize: 12 }}><span className="aui-tone-dot" data-tone={hue} aria-hidden="true" />{SAMPLE_OF[hue]}</span>
            <small className="aui-note">{OPTION_HUE_LABELS[hue]}</small>
          </div>
        ))}
      </div>
      <FormSection>
        <div className="aui-form-grid">
          <FormField label="旧 7 色名照样显示（brand → 绿 …）" htmlFor="fc-legacy">
            <CellTags label="旧色名" items={LEGACY_SAMPLE} />
          </FormField>
          <FormField label="三种尺寸：格子 20 · 字段行 22 · 表单 26" htmlFor="fc-sizes">
            <span style={ROW}>
              <span className="aui-chip" data-tone="yellow"><span className="aui-chip-label">报价</span></span>
              <span className="aui-chip" data-tone="yellow" data-size="md"><span className="aui-chip-label">报价</span></span>
              <span className="aui-chip" data-tone="yellow" data-size="lg"><span className="aui-chip-label">报价</span></span>
            </span>
          </FormField>
          <FormField label="状态" htmlFor="fc-status" hint="表单里 ≤ 6 个选项平铺成带颜色的标签按钮，多了用下拉">
            <ChoiceTags label="状态" value={status} onChange={setStatus} options={STATUS} />
          </FormField>
          <FormField label="选项颜色挑选器" htmlFor="fc-swatch" hint="10 个色块 + 实心开关">
            <span style={ROW}>
              <OptionSwatchPicker label="选项「转介绍」的颜色" value={tone} sample="转介绍" onChange={setTone} />
              <span className="aui-note">点小方块打开</span>
            </span>
          </FormField>
        </div>
        <OptionSwatchPicker variant="inline" label="内嵌的颜色挑选器" value={tone} sample="转介绍" onChange={setTone} />
      </FormSection>
    </Panel>
  );
}

function MultiSection() {
  const [products, setProducts] = useState<SelectItem[]>(PRODUCTS);
  const [chosen, setChosen] = useState<string[]>(["p1", "p3", "p5"]);
  const [team, setTeam] = useState<string[]>(["u2", "u3"]);
  const [three, setThree] = useState<string[]>(["p1", "p3", "p4"]);
  const [small, setSmall] = useState<string[]>(["p1", "p3", "p4", "p5"]);
  return (
    <Panel title="多选" description="已选 = 可删标签（× 悬停才变深）；字段里换行，小号（筛选、格子）一行、放不下收成 +N。弹层：勾选框在左、搜索、新建、底部「已选 N 项 · 清空」；点外面就保存，不要「完成」按钮（手机底部弹层右上角「完成」）。">
      <FormSection>
        <div className="aui-form-grid">
          <FormField label="感兴趣产品" htmlFor="fc-products" hint="搜不到的可以新建">
            <MultiChoice id="fc-products" label="感兴趣产品" value={chosen} onChange={setChosen} options={products} placeholder="选择产品"
              onCreate={(label) => {
                const value = `p${products.length + 1}`;
                setProducts((list) => [...list, { value, label, tone: "gray" }]);
                return value;
              }} />
          </FormField>
          <FormField label="协作人" htmlFor="fc-team" hint="头像小胶囊 + 部门">
            <MultiChoice id="fc-team" label="协作人" value={team} onChange={setTeam} options={PEOPLE} placeholder="选择协作人" />
          </FormField>
          <FormField label="重点产品" htmlFor="fc-three" error={three.length >= 3 ? "最多选 3 项" : undefined}>
            <MultiChoice id="fc-three" label="重点产品" value={three} onChange={setThree} options={PRODUCTS} max={3} aria-invalid={three.length >= 3} />
          </FormField>
          <FormField label="小号 28px（筛选值）" htmlFor="fc-small">
            <MultiChoice id="fc-small" size="sm" label="筛选产品" value={small} onChange={setSmall} options={PRODUCTS} />
          </FormField>
          <FormField label="禁用" htmlFor="fc-mdis">
            <MultiChoice id="fc-mdis" label="产品（禁用）" value={["p1", "p3"]} onChange={() => undefined} options={PRODUCTS} disabled />
          </FormField>
          <FormField label="只读" htmlFor="fc-mro">
            <MultiChoice id="fc-mro" label="产品（只读）" value={["p1", "p3"]} onChange={() => undefined} options={PRODUCTS} readOnly />
          </FormField>
        </div>
      </FormSection>
    </Panel>
  );
}

function CheckSection() {
  const [notify, setNotify] = useState<Record<string, boolean>>({ site: true, line: true, mail: false });
  const [assign, setAssign] = useState("round");
  const [toggles, setToggles] = useState({ remind: true, pool: false });
  const [match, setMatch] = useState("all");
  const [view, setView] = useState("cards");
  const [period, setPeriod] = useState("today");
  const [scope, setScope] = useState("me");
  const channels = [["site", "站内通知"], ["line", "LINE"], ["mail", "邮件"]] as const;
  return (
    <Panel title="勾选类" description="勾选框 16px 圆角 4、单选圆点 16px；选中 = 主色实底白勾；聚焦一律 3px 主色光圈（和输入框同一个）。开关 32 × 18（小号 26 × 14）放右边、立即生效。分段 = 浅底槽 + 白色凸起的选中块，主色只留给真正的按钮。">
      <div style={{ display: "grid", gap: 16 }}>
        <div role="group" aria-label="勾选框的状态" style={{ ...ROW, gap: 20 }}>
          <label className="aui-check-row"><Checkbox checked={false} aria-label="未选" />未选</label>
          <label className="aui-check-row"><Checkbox checked aria-label="选中" />选中</label>
          <label className="aui-check-row"><Checkbox checked="indeterminate" aria-label="半选" />半选</label>
          <label className="aui-check-row"><Checkbox disabled aria-label="禁用" />禁用</label>
          <label className="aui-check-row"><Checkbox checked disabled aria-label="禁用已选" />禁用已选</label>
          <label className="aui-check-row"><Checkbox aria-invalid aria-label="出错" />出错</label>
        </div>
        <FormSection>
          <div className="aui-form-grid">
            <FormField label="提醒方式" htmlFor="fc-notify">
              <span style={COL}>
                {channels.map(([key, text]) => (
                  <label key={key} className="aui-check-row"><Checkbox checked={notify[key]} onCheckedChange={(v) => setNotify((n) => ({ ...n, [key]: v === true }))} />{text}</label>
                ))}
                <label className="aui-check-row"><Checkbox disabled />短信（未开通）</label>
              </span>
            </FormField>
            <FormField label="分配方式" htmlFor="fc-assign">
              <RadioGroup label="分配方式" value={assign} onValueChange={setAssign} options={[
                { value: "round", label: "轮流分配", description: "按顺序一人一个" },
                { value: "region", label: "按区域", description: "区域对应的组长先接" },
                { value: "manual", label: "手动", description: "进公海等人认领" },
              ]} />
            </FormField>
          </div>
        </FormSection>
        <div style={{ display: "grid", maxWidth: 560 }} role="group" aria-label="设置列表">
          <label style={SETTING}><span style={COL}><b>到期前一天提醒</b><small className="aui-note">下次跟进的前一天 9:00 发站内通知</small></span><Switch checked={toggles.remind} onCheckedChange={(v) => setToggles((t) => ({ ...t, remind: v }))} aria-label="到期前一天提醒" /></label>
          <label style={SETTING}><span style={COL}><b>超 7 天没跟进自动进公海</b><small className="aui-note">只对「跟进中」的客户</small></span><Switch checked={toggles.pool} onCheckedChange={(v) => setToggles((t) => ({ ...t, pool: v }))} aria-label="超 7 天没跟进自动进公海" /></label>
          <label style={SETTING}><span style={COL}><b>允许组员改负责人</b><small className="aui-note">管理员才能改这项</small></span><Switch checked disabled aria-label="允许组员改负责人" /></label>
          <label style={SETTING}><span style={COL}><b>小号开关</b><small className="aui-note">表格行里、紧凑设置</small></span><Switch size="sm" checked={toggles.remind} onCheckedChange={(v) => setToggles((t) => ({ ...t, remind: v }))} aria-label="小号开关" /></label>
        </div>
        <div style={{ ...ROW, gap: 12 }}>
          <SegmentedControl label="条件关系" value={match} onValueChange={setMatch} options={[{ value: "all", label: "全部满足" }, { value: "any", label: "任一满足" }]} />
          <SegmentedControl label="视图" value={view} onValueChange={setView} options={[{ value: "list", label: "列表", icon: List }, { value: "cards", label: "卡片", icon: LayoutGrid }, { value: "cal", label: "日历", icon: CalendarDays }]} />
          <SegmentedControl size="sm" label="时间" value={period} onValueChange={setPeriod} options={[{ value: "today", label: "今天" }, { value: "week", label: "本周" }, { value: "month", label: "本月" }, { value: "custom", label: "自定义", disabled: true }]} />
        </div>
        <ChoiceTiles label="谁能看这个视图" value={scope} onValueChange={setScope} columns={3} options={[
          { value: "me", label: "只有我", hint: "别人看不到这个视图", icon: <Lock /> },
          { value: "team", label: "本组", hint: "销售一组都能看", icon: <Users /> },
          { value: "all", label: "全公司", hint: "需要管理员同意", icon: <LayoutGrid /> },
        ]} />
      </div>
    </Panel>
  );
}
