"use client";
/**
 * GrantList's 「添加人、部门或角色」 box when the host gives an `orgSource`: the
 * OrgPickerField (typing searches the whole organisation with paths, 「组织架构」 opens the OrgPicker),
 * loaded lazily — its JS and CSS chunk only arrive on pages that render a GrantList with an org source.
 * Subjects already on the list (and the locked holders) are greyed out as 「已授权 · 可读写」.
 */
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { Input } from "./primitives.tsx";
import { entryFromPick, grantedNotes, type GrantEntry, type GrantLevel, type GrantSubjectKind } from "./grant-list-core.ts";
import type { OrgDataSource } from "./org-picker/org-picker-core.ts";
import type { OrgPickerFieldProps } from "./org-picker/org-picker-field.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grants.css";

import { lazyPart, whenIdle } from "./lazy-part.ts";

const fieldPart = lazyPart(() => import("./org-picker/org-picker-field.tsx").then((m) => m.OrgPickerField));
const OrgPickerField = fieldPart.Part as (props: OrgPickerFieldProps) => ReactNode;

/** OrgPicker options GrantList / ShareDialog pass through (tabs, scope, default focus, shortcuts, wording …). */
export type GrantOrgPickerOptions = Omit<OrgPickerFieldProps, "source" | "value" | "onChange" | "chips" | "commit" | "mode" | "disabled" | "placeholder">;

export type GrantOrgFieldProps = {
  source: OrgDataSource;
  options?: GrantOrgPickerOptions;
  entries: readonly GrantEntry[];
  locked?: readonly { id: string; kind?: GrantSubjectKind; level?: string; tag?: string }[];
  levels: readonly GrantLevel[];
  level: string;
  placeholder: string;
  disabled?: boolean;
  /** The new subjects of one pick / one 「确定」, as entries at `level` (GrantList adds them together). */
  onAdd: (entries: GrantEntry[]) => void;
};

export function GrantOrgField({ source, options, entries, locked, levels, level, placeholder, disabled, onAdd }: GrantOrgFieldProps) {
  // The field is a lazy chunk (fetched while idle). Until it is there the box is a stand-in that works like it: a
  // click or typing into it is handed over — the real field mounts focused with the typed text — instead of hitting
  // a disabled input and getting lost.
  useEffect(() => whenIdle(fieldPart.preload), []);
  const [focused, setFocused] = useState(false);
  const typed = useRef("");
  const fallback = (
    <label className="aui-grant-search">
      <UserPlus aria-hidden="true" />
      <Input disabled={disabled} placeholder={placeholder} aria-label={placeholder} defaultValue=""
        onPointerDown={fieldPart.preload}
        onFocus={() => {
          fieldPart.preload();
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          typed.current = e.currentTarget.value;
        }} />
    </label>
  );
  return (
    <Suspense fallback={fallback}>
      <OrgPickerField
        {...options}
        autoFocus={focused}
        defaultQuery={typed.current}
        source={source}
        value={[]}
        chips={false}
        commit="instant"
        placeholder={placeholder}
        disabled={disabled}
        existing={{ ...grantedNotes(entries, levels, locked), ...options?.existing }}
        onChange={(next) => {
          const added = next.filter((pick) => !entries.some((e) => e.id === pick.id)).map((pick) => entryFromPick(pick, level));
          if (added.length) onAdd(added);
        }}
      />
    </Suspense>
  );
}
