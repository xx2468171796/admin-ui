/**
 * IME-safe keys: while a Chinese / Japanese input method is composing, Enter picks a candidate and Esc
 * cancels the candidate list — they must not save, submit or close. Check this first in every onKeyDown that
 * acts on Enter / Escape. keyCode 229 covers browsers (Safari) that send the confirming keydown after
 * compositionend with `isComposing` already false; key "Process" is what Chrome reports for keys an IME takes.
 */
type KeyLike = { key?: string; isComposing?: boolean; keyCode?: number; nativeEvent?: { isComposing?: boolean; keyCode?: number } };

export function isComposingEvent(event: KeyLike): boolean {
  const native = event.nativeEvent ?? event;
  return Boolean(native.isComposing || event.isComposing) || native.keyCode === 229 || event.keyCode === 229 || event.key === "Process";
}
