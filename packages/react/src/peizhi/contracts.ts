/**
 * Shapes of the peizhi management API (dictionaries + system parameters), mirrored from
 * `peizhi/contracts` so this package does not depend on peizhi. Tones map 1:1 to StatusBadge.
 * Pure types and constants: no React / DOM imports.
 */

export const DICT_TONES = ["neutral", "success", "warning", "danger", "brand"] as const;
export type DictTone = (typeof DICT_TONES)[number];
export const DICT_TONE_LABEL: Readonly<Record<DictTone, string>> = { neutral: "灰色", success: "绿色", warning: "橙色", danger: "红色", brand: "主题色" };

export type ConfigStatus = "enabled" | "disabled";
export type ParamType = "string" | "number" | "boolean" | "json" | "enum";
export type CustomParamType = Exclude<ParamType, "enum">;
export const PARAM_TYPE_LABEL: Readonly<Record<ParamType, string>> = { string: "文本", number: "数字", boolean: "开关", json: "JSON", enum: "选项" };

/** Default codes (peizhi `PEIZHI_PERMISSIONS`); hosts may rename them. */
export const PEIZHI_CODES = { dictManage: "peizhi:dict.manage", paramManage: "peizhi:param.manage" } as const;

export type DictTypeDto = {
  code: string;
  name: string;
  status: ConfigStatus;
  remark: string;
  /** Defined in code: cannot be deleted, only relabelled / disabled. */
  builtin: boolean;
  /** Items may be added in the console (built-in dictionaries default to false). */
  extensible: boolean;
  /** A built-in dictionary relabelled in the console (code changes no longer override it). */
  customized: boolean;
  itemCount: number;
  updatedAt: string | null;
  updatedBy: string | null;
};
export type DictItemDto = {
  type: string;
  value: string;
  label: string;
  labels: Readonly<Record<string, string>>;
  tone: DictTone;
  sort: number;
  isDefault: boolean;
  status: ConfigStatus;
  remark: string;
  builtin: boolean;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};
export type DictTypeInput = { code: string; name: string; status?: ConfigStatus; remark?: string };
export type DictTypePatch = Partial<Pick<DictTypeInput, "name" | "status" | "remark">>;
export type DictItemInput = { value: string; label: string; labels?: Record<string, string>; tone?: DictTone; sort?: number; isDefault?: boolean; status?: ConfigStatus; remark?: string };
export type DictItemPatch = Partial<Omit<DictItemInput, "value">>;

export type ParamDto = {
  key: string;
  type: ParamType;
  label: string;
  hint: string;
  group: string;
  /** Secret: value / defaultValue are always null; only hasValue. */
  secret: boolean;
  public: boolean;
  builtin: boolean;
  /** In the database but no longer declared in code (may be deleted). */
  orphan: boolean;
  value: unknown;
  defaultValue: unknown;
  overridden: boolean;
  hasValue: boolean;
  /** The stored value was invalid and the default is used: why. */
  invalid: string | null;
  options?: readonly string[];
  optionLabels?: Readonly<Record<string, string>>;
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  multiline?: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};
export type CustomParamInput = { key: string; type: CustomParamType; value: unknown; label: string; hint?: string; group?: string; secret?: boolean; public?: boolean };

/** One change event (peizhi `ChangeEvent`); secret values arrive as "******". */
export type ConfigChangeEvent = {
  kind: "dict_type" | "dict_item" | "param" | "version";
  action: "create" | "update" | "delete" | "reset" | "restore" | "sync" | "refresh";
  target: string;
  actor: { id: string; name?: string } | null;
  before: unknown;
  after: unknown;
  secret: boolean;
  at: string;
};

export const CONFIG_SECRET_MASK = "******";
