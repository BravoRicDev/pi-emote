/**
 * Interception of the TUI output of every extension.
 *
 * Pi hands the SAME `ui` object to every extension: `ExtensionRunner.createContext()`
 * builds `get ui() { return runner.uiContext; }`, and the runner keeps a single
 * uiContext. Wrapping `setWidget`/`setStatus` once therefore captures what every
 * extension draws — pi-lens, pi-subagents, pi-arc, anything loaded later — without
 * those extensions knowing about this widget. The alternative, a writer per source,
 * requires every source to know it must publish, and a source that forgets is
 * invisible in silence.
 *
 * Three rules keep the interception honest:
 *
 *  - the original call always happens, so intercepting can never change what an
 *    extension does;
 *  - only what can actually be SHOWN is suppressed. A widget factory is kept as
 *    the function itself and rendered by the panel against the real TUI, which is
 *    the same object pi would have handed it; a factory that throws while
 *    rendering is skipped, so the worst case is a line missing from the panel and
 *    never a broken TUI;
 *  - suppression is off unless the panel is mounted. Moving lines into a panel that
 *    is not there would empty the TUI instead of reorganising it.
 */

/**
 * Widget ids in draw order, from configuration.
 *
 * Empty by default, and that default is the point: with no list the sources are
 * drawn in the order they first declared themselves, so the panel needs no
 * knowledge of who is installed. A user who wants a stable order across restarts
 * lists the ids in `captureOrder`.
 */
let captureOrder: string[] = [];

/**
 * Set the draw order. Non-strings and blank strings are dropped, so a malformed
 * config cannot make a source vanish. An empty list is the default: first-seen
 * order.
 */
export function setCaptureOrder(ids: readonly unknown[] | undefined): void {
  if (!Array.isArray(ids)) {
    captureOrder = [];
    return;
  }
  captureOrder = ids.filter((id): id is string => typeof id === "string" && id.trim() !== "");
}

/** The panel's own widget: it must never capture itself. */
export const SELF_ID = "emote";

/** id -> lines, exactly as the source declared them (styling included). */
const widgets = new Map<string, string[]>();

/** id -> widget factory, kept as the function: the panel renders it itself. */
const factories = new Map<string, (tui: any, theme: any) => any>();

/** id -> status text. */
const statuses = new Map<string, string>();

/** The ui object we wrapped, compared by identity: pi swaps it when the UI is ready. */
let attached: any = null;

/** Whether captured lines are withheld from the TUI. Off until the panel is up. */
let suppressing = false;

/** True when the interceptor is attached to the object pi is currently handing out. */
export function isAttached(): boolean {
  return attached !== null;
}

/**
 * Move captured lines out of the TUI, or let them draw where they always did.
 * pi-emote turns this on only while its widget is mounted.
 */
export function setSuppressing(value: boolean): void {
  suppressing = value;
}

/** Captured lines, in the configured order then first-seen order. */
export function capturedLines(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const lines = widgets.get(id);
    if (lines) {
      for (const line of lines) {
        const text = line.trimEnd();
        if (text) out.push(text);
      }
    }
    const status = statuses.get(id);
    if (status) out.push(status.trimEnd());
  };
  for (const id of captureOrder) take(id);
  for (const id of widgets.keys()) take(id);
  for (const id of statuses.keys()) take(id);
  return out;
}

/**
 * Captured widget factories, in the configured order then first-seen order. The panel
 * calls each one with the real TUI and renders the component it returns, which is
 * exactly what pi would have done with it.
 */
export function capturedFactories(): { id: string; factory: (tui: any, theme: any) => any }[] {
  const out: { id: string; factory: (tui: any, theme: any) => any }[] = [];
  const seen = new Set<string>();
  const take = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const factory = factories.get(id);
    if (factory) out.push({ id, factory });
  };
  for (const id of captureOrder) take(id);
  for (const id of factories.keys()) take(id);
  return out;
}

/** Test seam: forget everything captured, restore the default order, and detach. */
export function resetInterceptor(): void {
  widgets.clear();
  factories.clear();
  statuses.clear();
  attached = null;
  suppressing = false;
  captureOrder = [];
}

/**
 * Wrap `setWidget` and `setStatus` on the shared ui object.
 *
 * Idempotent by identity: calling it again with the object already wrapped does
 * nothing, and calling it with a NEW object (pi recreates the ui context when the
 * UI becomes available) wraps that one instead.
 */
export function installInterceptor(ui: any): void {
  if (!ui || typeof ui.setWidget !== "function" || typeof ui.setStatus !== "function") return;
  if (attached === ui) return;

  const originalSetWidget = ui.setWidget.bind(ui);
  const originalSetStatus = ui.setStatus.bind(ui);

  ui.setWidget = (key: string, content: any, options?: any): void => {
    // `string[]` is the already-rendered form; a function is a factory the panel
    // renders itself against the real TUI. Both are showable, so both are kept.
    const readable = Array.isArray(content);
    const isFactory = typeof content === "function";
    if (key !== SELF_ID) {
      if (readable) {
        if (content.length > 0) widgets.set(key, [...content]);
        else widgets.delete(key);
        factories.delete(key);
      } else if (isFactory) {
        factories.set(key, content);
        widgets.delete(key);
      } else if (content === undefined) {
        widgets.delete(key);
        factories.delete(key);
      }
    }
    if (key !== SELF_ID && (readable || isFactory) && suppressing) {
      // The source keeps declaring its state; the TUI stops duplicating it.
      originalSetWidget(key, undefined, options);
      return;
    }
    originalSetWidget(key, content, options);
  };

  ui.setStatus = (key: string, text?: string): void => {
    if (key !== SELF_ID) {
      if (typeof text === "string" && text.trim()) statuses.set(key, text);
      else statuses.delete(key);
    }
    if (key !== SELF_ID && suppressing) {
      originalSetStatus(key, undefined);
      return;
    }
    originalSetStatus(key, text);
  };

  attached = ui;
}
