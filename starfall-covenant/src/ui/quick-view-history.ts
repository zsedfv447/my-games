// Only the read-only card preview uses this same-URL history entry.
// It never changes hashes, so browser Back closes it without remounting the page.
const KEY = 'starfallCardPreview';
let active: { close: () => void; original: unknown; marker: number } | undefined;
let pendingBack = false;
let queuedNavigation: (() => void) | undefined;
let installed = false;
let serial = 0;
function withoutMarker(state: Record<string, unknown> | null): unknown {
  if (!state || !(KEY in state)) return state;
  const { [KEY]: _marker, ...rest } = state;
  return Object.keys(rest).length ? rest : null;
}
function onPop(): void {
  pendingBack = false;
  if (active && history.state?.[KEY] !== active.marker) {
    const previous = active; active = undefined; previous.close();
  } else if (!active && history.state?.[KEY]) {
    // Forward after a closed preview must not leave an invisible active marker.
    history.replaceState(withoutMarker(history.state), '', location.href);
  }
  const next = queuedNavigation; queuedNavigation = undefined; next?.();
}
export function beginQuickViewHistory(close: () => void): boolean {
  if (pendingBack) return false;
  if (!installed) { window.addEventListener('popstate', onPop); installed = true; }
  if (active) return false;
  const original = history.state;
  const marker = ++serial;
  active = { close, original, marker };
  history.pushState({ ...original, [KEY]: marker }, '', location.href);
  return true;
}
export function deferWhileQuickViewClosing(navigate: () => void): boolean {
  if (!pendingBack) return false;
  queuedNavigation = navigate;
  return true;
}

export const hasQuickView = (): boolean => active !== undefined;

/** Close/escape/in-app Back consumes the one preview entry. */
export function dismissQuickView(): boolean {
  if (!active) return pendingBack;
  const previous = active; active = undefined;
  previous.close();
  if (history.state?.[KEY] === previous.marker) { pendingBack = true; history.back(); }
  return true;
}
/** Explicit route navigation consumes the marker in place, without an async back race. */
export function leaveQuickView(): void {
  if (!active) return;
  const previous = active; active = undefined;
  if (history.state?.[KEY] === previous.marker) history.replaceState(previous.original, '', location.href);
  previous.close();
}
