// 弹框（五档宽度 + 全屏、底栏顺序、提交中 / 出错 / 未保存关闭）、确认弹框（三种口气、影响清单、输入名称、原因、能撤销就不问）、
// 侧边 / 底部弹层（设置类带底栏、不挡表格的评论、手机表单头）。
import { useState } from "react";
import { LayoutDashboard, Link2, MessageSquare, Settings2, Trash2, Users } from "lucide-react";
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  Dialog,
  DialogFooter,
  FormDialog,
  FormField,
  Input,
  Panel,
  SideSheet,
  Switch,
  Textarea,
  useUndoToast,
  type DialogSize,
} from "@adminui/react";

const ROW = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } as const;
const SIZES: { size: DialogSize; label: string }[] = [
  { size: "sm", label: "sm 420" },
  { size: "md", label: "md 560" },
  { size: "lg", label: "lg 800" },
  { size: "xl", label: "xl 1080" },
  { size: "full", label: "全屏" },
];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function LongText() {
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <p key={i}>第 {i + 1} 段：报价单预览——智能门锁 × 2、窗帘电机 × 4、安装费、远程调试，合计 ¥86,400。滚动起来头部下面才出现分隔线。</p>
      ))}
    </>
  );
}

export function DialogsDemo() {
  const [size, setSize] = useState<DialogSize | null>(null);
  const [form, setForm] = useState(false);
  const [name, setName] = useState("");
  const undoable = useUndoToast();
  return (
    <Panel title="弹框" description="sm 420 · md 560 · lg 800 · xl 1080 · 全屏；圆角 12、无模糊、底栏白色；正文滚动时才出分隔线；主操作最右、危险操作最左。">
      <div id="ov-dialogs" style={ROW}>
        {SIZES.map((item) => (
          <Button key={item.size} variant="outline" data-open-size={item.size} onClick={() => setSize(item.size)}>
            {item.label}
          </Button>
        ))}
        <Button
          onClick={() => {
            setName("");
            setForm(true);
          }}
        >
          新建客户（表单）
        </Button>
      </div>
      <Dialog
        open={size !== null}
        size={size ?? "md"}
        title={size === "full" ? "报价单预览" : "导入预览"}
        description="确认没问题再导入；可以先下载核对。"
        onClose={() => setSize(null)}
        footer={
          <DialogFooter hint="共 128 行，3 行有问题">
            <Button variant="outline" onClick={() => setSize(null)}>
              取消
            </Button>
            <Button variant="outline">下载核对表</Button>
            <Button onClick={() => setSize(null)}>导入 125 行</Button>
          </DialogFooter>
        }
      >
        <LongText />
      </Dialog>
      <FormDialog
        open={form}
        title="新建客户"
        description="客户名称必填；电话按中国大陆习惯填写。"
        dirty={Boolean(name)}
        submitLabel="保存"
        dangerAction={
          <Button
            variant="ghost"
            onClick={() => {
              setForm(false);
              void undoable({ title: "已删除草稿", description: name || "未命名客户", undo: () => setForm(true) });
            }}
          >
            <Trash2 />
            删除草稿
          </Button>
        }
        secondaryActions={<Button variant="outline">保存并新建下一个</Button>}
        onClose={() => setForm(false)}
        onSubmit={async () => {
          await wait(800);
          if (name.trim() === "失败") throw new Error("服务器暂时不可用，输入都还在，稍后再保存一次。");
        }}
      >
        <FormField label="客户名称" htmlFor="ov-cust-name" required hint="填「失败」试试保存失败">
          <Input id="ov-cust-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="备注" htmlFor="ov-cust-note" optional>
          <Textarea id="ov-cust-note" />
        </FormField>
      </FormDialog>
    </Panel>
  );
}

export function ConfirmDemo() {
  const [open, setOpen] = useState<"" | "line" | "person" | "transfer" | "fail">("");
  const [people, setPeople] = useState(["赵静怡", "陈冠宇", "张建宏"]);
  const undoable = useUndoToast();
  const close = () => setOpen("");
  return (
    <Panel title="确认弹框" description="能撤销的（单条删除、移动、改阶段）不再弹确认，直接做 + 「撤销」8 秒；撤不回或影响别人的才问。">
      <div id="ov-confirm" style={ROW}>
        <Button variant="destructive-outline" onClick={() => setOpen("line")}>
          删除业务线（输入名称）
        </Button>
        <Button variant="outline" onClick={() => setOpen("transfer")}>
          停用账号（写原因）
        </Button>
        <Button variant="outline" onClick={() => setOpen("person")}>
          转交客户（普通）
        </Button>
        <Button variant="outline" onClick={() => setOpen("fail")}>
          失败的确认
        </Button>
      </div>
      <div style={{ ...ROW, marginTop: 12 }} id="ov-undo-list">
        {people.map((person) => (
          <Button
            key={person}
            variant="ghost"
            data-undo-row={person}
            onClick={() => {
              const before = people;
              void undoable({ title: "已删除客户", description: person, run: () => setPeople((list) => list.filter((p) => p !== person)), undo: () => setPeople(before) });
            }}
          >
            <Trash2 />
            直接删「{person}」
          </Button>
        ))}
        {!people.length && <span className="aui-note">都删了，点提示条上的「撤销」放回来</span>}
      </div>
      <ConfirmDialog
        open={open === "line"}
        destructive
        title="删除业务线「智能家居客户」？"
        description="删除后不能恢复，相关的数据和链接都会失效。"
        impact={[
          <>
            <Users /> <b>168 位客户</b>和他们的跟进记录
          </>,
          <>
            <LayoutDashboard /> 两个仪表盘
          </>,
          <>
            <Link2 /> 所有分享链接立即失效
          </>,
        ]}
        typeToConfirm="智能家居客户"
        confirmLabel="删除业务线"
        onConfirm={() => wait(600)}
        onClose={close}
      />
      <ConfirmDialog
        open={open === "transfer"}
        tone="warning"
        title="停用「周经理」的账号？"
        description="他会立刻被登出，名下 23 位客户需要转交。"
        reason={{ label: "原因", required: true, placeholder: "例如：离职交接" }}
        confirmLabel="停用账号"
        onConfirm={() => wait(600)}
        onClose={close}
      />
      <ConfirmDialog open={open === "person"} title="把 23 位客户转交给小王？" description="小王会收到通知，原负责人仍能看到历史记录。" confirmLabel="转交 23 位" onConfirm={() => wait(400)} onClose={close} />
      <ConfirmDialog
        open={open === "fail"}
        destructive
        title="作废报价单 Q-2026-0412？"
        description="作废后客户打开链接会看到「已作废」。"
        confirmLabel="作废"
        onConfirm={async () => {
          await wait(500);
          throw new Error("这张报价单已经签约，先去作废合同。");
        }}
        onClose={close}
      />
    </Panel>
  );
}

export function SheetsDemo() {
  const [open, setOpen] = useState<"" | "settings" | "comments" | "bottom">("");
  const [days, setDays] = useState("7");
  const [notify, setNotify] = useState(true);
  const changes = (days !== "7" ? 1 : 0) + (notify ? 0 : 1);
  return (
    <Panel title="侧边 / 底部弹层" description="侧边贴右边、上下铺满、不做圆角；设置类带遮罩和底栏，评论类不挡表格；手机上表单头「取消 · 标题 · 完成」。">
      <div id="ov-sheets" style={ROW}>
        <Button variant="outline" onClick={() => setOpen("settings")}>
          <Settings2 />
          表设置
        </Button>
        <Button variant="outline" onClick={() => setOpen("comments")}>
          <MessageSquare />
          评论（不挡表格）
        </Button>
        <Button variant="outline" onClick={() => setOpen("bottom")}>
          写跟进（底部弹层）
        </Button>
      </div>
      <SideSheet
        open={open === "settings"}
        title="表设置"
        description="只影响这张表"
        cards
        changes={changes}
        onClose={() => {
          setDays("7");
          setNotify(true);
          setOpen("");
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen("")}>
              取消
            </Button>
            <Button onClick={() => setOpen("")}>保存</Button>
          </>
        }
      >
        <section className="aui-panel" style={{ padding: 16 }}>
          <FormField label="几天没跟进退回公海" htmlFor="ov-sheet-days">
            <Input id="ov-sheet-days" value={days} onChange={(e) => setDays(e.target.value)} suffix="天" />
          </FormField>
        </section>
        <section className="aui-panel" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ ...ROW, justifyContent: "space-between" }}>
            <span>退回前一天提醒负责人</span>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="退回前一天提醒负责人" />
          </div>
        </section>
      </SideSheet>
      <SideSheet open={open === "comments"} modal={false} title="评论 · 赵静怡" onClose={() => setOpen("")}>
        <p>小王：客户说下周三来看样品，记得准备窗帘电机。</p>
        <p>小陈：好的，已经约了安装师傅。</p>
        <Textarea aria-label="写评论" placeholder="写评论，@ 提到同事" />
      </SideSheet>
      <BottomSheet open={open === "bottom"} title="写跟进" onClose={() => setOpen("")} onDone={() => setOpen("")}>
        <FormField label="跟进内容" htmlFor="ov-bs-text">
          <Textarea id="ov-bs-text" placeholder="电话沟通了报价…" />
        </FormField>
      </BottomSheet>
    </Panel>
  );
}
