"use client";
/**
 * Record detail extras (bt/records R4, demo D11):
 * - SubTableSection: a child table embedded in the record (跟进记录): card header with icon, title,
 *   count, a grey note (「子表 · 能看这个客户的人就能看」), 「在表格中打开」 and 「显示列」; the table itself
 *   is the host's (CompactTable, or BitableGrid with `toolbar={false}` for inline editing); footer
 *   「+ 添加跟进 · 共 9 条，显示最近 4 条 · 查看全部 →」.
 * - HiddenFieldsPill: 「2 个字段你看不到」 in a section footer (field permissions; never the fields).
 * - FieldTileButton: one small icon button / link on a field tile (call, reveal, custom actions).
 */
import { useRef, useState, type ReactNode } from "react";
import { Columns3, ExternalLink, EyeOff, Plus } from "lucide-react";
import { Button, Checkbox } from "./primitives.tsx";
import { PopoverPanel } from "./popover-panel.tsx";
import { Count, IconBlock } from "./kit.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

export type SubTableColumn = { key: string; label: string; visible: boolean; /** Can't be hidden (the first / name column). */ locked?: boolean };
export type SubTableSectionProps = {
  title: string;
  icon?: ReactNode;
  /** All child rows the viewer may see (「9」 after the title, 「共 9 条」 in the footer). */
  total?: number;
  /** Rows shown here (「显示最近 4 条」); leave out when all are shown. */
  shown?: number;
  /** Grey note after the title: who can see it, what it is. */
  note?: ReactNode;
  /** 「在表格中打开」: the child table filtered to this record. */
  onOpenInTable?: () => void;
  openLabel?: string;
  /** 「显示列」: columns with visibility; the panel toggles them (`onColumnsChange`). */
  columns?: readonly SubTableColumn[];
  onColumnsChange?: (next: SubTableColumn[]) => void;
  /** 「+ 添加跟进」 */
  onAdd?: () => void;
  addLabel?: string;
  /** 「查看全部 →」 (the full child list / the record's tab). */
  onViewAll?: () => void;
  viewAllLabel?: string;
  /** Extra buttons in the header (before 显示列). */
  actions?: ReactNode;
  /** The embedded table (CompactTable / BitableGrid toolbar={false}) or an empty state. */
  children: ReactNode;
};

export function SubTableSection({ title, icon, total, shown, note, onOpenInTable, openLabel = "在表格中打开", columns, onColumnsChange, onAdd, addLabel = "添加", onViewAll, viewAllLabel = "查看全部", actions, children }: SubTableSectionProps) {
  const columnsButton = useRef<HTMLButtonElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const visibleCount = columns?.filter((c) => c.visible).length ?? 0;
  const footerText = total === undefined ? null : shown !== undefined && shown < total ? `共 ${total} 条，显示最近 ${shown} 条` : `共 ${total} 条`;
  return (
    <section className="aui-scard aui-subtable" aria-label={title}>
      <div className="aui-scard-head">
        {icon && <IconBlock size="sm">{icon}</IconBlock>}
        <h3>{title}</h3>
        {total !== undefined && <Count label={`共 ${total} 条`}>{total}</Count>}
        {note && <small className="aui-subtable-note">{note}</small>}
        <div className="aui-scard-tools">
          {actions}
          {onOpenInTable && <Button size="sm" variant="ghost" onClick={onOpenInTable}><ExternalLink aria-hidden="true" />{openLabel}</Button>}
          {columns && onColumnsChange && (
            <>
              <Button ref={columnsButton} size="sm" variant="outline" aria-haspopup="dialog" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((v) => !v)}>
                <Columns3 aria-hidden="true" />显示列
              </Button>
              <PopoverPanel
                open={columnsOpen}
                anchor={columnsButton.current}
                width="sm"
                align="end"
                title="显示列"
                headerExtra={<span className="aui-note">{visibleCount} / {columns.length}</span>}
                onClose={(back) => {
                  setColumnsOpen(false);
                  if (back) columnsButton.current?.focus();
                }}
              >
                <ul className="aui-subtable-columns" aria-label={`${title}的列`}>
                  {columns.map((column) => (
                    <li key={column.key}>
                      <label>
                        <Checkbox
                          checked={column.visible}
                          disabled={column.locked || (column.visible && visibleCount <= 1)}
                          onCheckedChange={(on) => onColumnsChange(columns.map((c) => (c.key === column.key ? { ...c, visible: on === true } : c)))}
                        />
                        <span>{column.label}</span>
                        {column.locked && <small className="aui-note">固定</small>}
                      </label>
                    </li>
                  ))}
                </ul>
              </PopoverPanel>
            </>
          )}
        </div>
      </div>
      <div className="aui-subtable-body">{children}</div>
      {(onAdd || footerText || onViewAll) && (
        <div className="aui-subtable-foot">
          {onAdd && <Button size="sm" variant="ghost" className="aui-subtable-add" onClick={onAdd}><Plus aria-hidden="true" />{addLabel}</Button>}
          {footerText && <span className="aui-note">{footerText}</span>}
          {onViewAll && <Button size="sm" variant="text" className="aui-subtable-all" onClick={onViewAll}>{viewAllLabel} →</Button>}
        </div>
      )}
    </section>
  );
}

export const HIDDEN_FIELDS_HINT = "管理员设置了字段权限，这些字段不对你显示；需要时找上级申请";

/** 「N 个字段你看不到」: attention pill with an eye-off icon; the reason on hover and for screen readers. */
export function HiddenFieldsPill({ count, hint = HIDDEN_FIELDS_HINT }: { count: number; hint?: string }) {
  if (!(count > 0)) return null;
  return (
    <span className="aui-hidden-fields" data-tip={hint}>
      <EyeOff aria-hidden="true" />
      {count} 个字段你看不到
      <span className="aui-sr-only">：{hint}</span>
    </span>
  );
}

/** A small icon button (or link) at a field tile's top-right corner. */
export function FieldTileButton({ label, icon, onSelect, href, pressed, disabled }: { label: string; icon: ReactNode; onSelect?: () => void; href?: string; pressed?: boolean; disabled?: boolean }) {
  if (href) {
    const external = !/^(tel|mailto|sms):/i.test(href);
    return (
      <a className="aui-icon-button" href={href} aria-label={label} data-tip={label} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" className="aui-icon-button" aria-label={label} data-tip={label} aria-pressed={pressed} disabled={disabled} onClick={onSelect}>
      {icon}
    </button>
  );
}
