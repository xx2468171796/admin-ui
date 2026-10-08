/**
 * What to tell people when the microphone can't be opened (审阅 07: the recorder showed the browser's raw
 * 「Not supported」). Maps the getUserMedia / MediaRecorder error name (and an insecure page) to a Chinese
 * title, steps that say what to do, whether 「再试一次」 can help, and a one-line version for HoldToTalk; the
 * browser's own words only go to `detail` (small print). Pure, no DOM.
 */

export type RecorderProblemState = "denied" | "unsupported" | "error";
export type RecorderFailure = { name?: string; message?: string };
export type RecorderProblem = {
  state: RecorderProblemState;
  title: string;
  /** What to do, in order (1–2 short sentences). */
  steps: string[];
  /** One line for tight places (HoldToTalk). */
  short: string;
  /** Whether 「再试一次」 can help (false when the page / browser itself can't record). */
  retry: boolean;
  /** The browser's own reason (「NotReadableError: Could not start audio source」), for small print; "" when none. */
  detail: string;
};

const DENIED: Omit<RecorderProblem, "state" | "detail"> = {
  title: "浏览器没有麦克风权限",
  steps: ["点地址栏左侧的锁图标，把「麦克风」改成「允许」，再点「再试一次」。", "已经允许还是不行：到系统设置的「隐私 → 麦克风」里允许这个浏览器。"],
  short: "浏览器没有麦克风权限：点地址栏左侧的锁图标允许麦克风后再按",
  retry: true,
};
const NO_DEVICE: Omit<RecorderProblem, "state" | "detail"> = {
  title: "没有找到麦克风",
  steps: ["插上耳机或麦克风后点「再试一次」。", "电脑没有麦克风：可以用手机录好再上传录音文件。"],
  short: "没有找到麦克风：插上耳机或麦克风后再按",
  retry: true,
};
const BUSY: Omit<RecorderProblem, "state" | "detail"> = {
  title: "麦克风被别的程序占用",
  steps: ["关掉正在用麦克风的程序（会议软件、别的浏览器标签页）后点「再试一次」。", "还是不行：拔下麦克风重新插上，或重启浏览器。"],
  short: "麦克风被别的程序占用：关掉会议软件等再按",
  retry: true,
};
const NOT_SUPPORTED: Omit<RecorderProblem, "state" | "detail"> = {
  title: "这个浏览器打不开麦克风",
  steps: ["换用新版 Chrome / Edge / Safari 打开这个页面再录。", "也可以用手机录好，再上传录音文件。"],
  short: "这个浏览器不能录音：换新版 Chrome / Edge / Safari，或上传录音文件",
  retry: false,
};
const INSECURE: Omit<RecorderProblem, "state" | "detail"> = {
  title: "这个网址不能用麦克风",
  steps: ["浏览器只让 https 开头（或本机 localhost）的网页用麦克风：换成 https 地址打开。", "也可以用手机录好，再上传录音文件。"],
  short: "这个网址不能用麦克风：换成 https 地址打开，或上传录音文件",
  retry: false,
};
const OTHER: Omit<RecorderProblem, "state" | "detail"> = {
  title: "没能打开麦克风",
  steps: ["检查麦克风有没有插好、是不是被别的程序占用，然后点「再试一次」。", "还是不行：可以用手机录好再上传录音文件。"],
  short: "没能打开麦克风：检查麦克风后再按",
  retry: true,
};

const BY_NAME: Readonly<Record<string, Omit<RecorderProblem, "state" | "detail">>> = {
  NotAllowedError: DENIED,
  PermissionDeniedError: DENIED,
  SecurityError: DENIED,
  NotFoundError: NO_DEVICE,
  DevicesNotFoundError: NO_DEVICE,
  OverconstrainedError: NO_DEVICE,
  ConstraintNotSatisfiedError: NO_DEVICE,
  NotReadableError: BUSY,
  TrackStartError: BUSY,
  AbortError: BUSY,
  NotSupportedError: NOT_SUPPORTED,
  TypeError: NOT_SUPPORTED,
};

/** The error name / message of whatever getUserMedia or `new MediaRecorder` threw. */
export function recorderFailure(error: unknown): RecorderFailure {
  if (typeof error !== "object" || error === null) return typeof error === "string" ? { message: error } : {};
  const { name, message } = error as { name?: unknown; message?: unknown };
  return { ...(typeof name === "string" && name ? { name } : {}), ...(typeof message === "string" && message ? { message } : {}) };
}

/**
 * The message for a recorder that can't record. `state` is the hook's (denied / unsupported / error);
 * `secure` = window.isSecureContext (false → the page itself can't use the mic, whatever the error).
 */
export function recorderProblem(state: RecorderProblemState, failure: RecorderFailure = {}, env: { secure?: boolean } = {}): RecorderProblem {
  const detail = [failure.name, failure.message].filter(Boolean).join(": ");
  if (env.secure === false) return { ...INSECURE, state: "unsupported", detail };
  const text = (failure.name && BY_NAME[failure.name]) || (state === "denied" ? DENIED : state === "unsupported" ? NOT_SUPPORTED : OTHER);
  return { ...text, state, detail };
}
