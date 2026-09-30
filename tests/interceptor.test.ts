import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SELF_ID,
  capturedFactories,
  capturedLines,
  installInterceptor,
  resetInterceptor,
  setCaptureOrder,
  setSuppressing,
} from "../src/interceptor.ts";

/**
 * The interceptor sits between every extension and the TUI, so the cases worth
 * pinning down are the ones where it could do harm rather than the ones where it
 * works: it must never swallow something it cannot show, it must never touch
 * the panel's own slot, and it must always let the original call through.
 *
 * The module holds the captured state, so every case resets it first.
 */
function fakeUi() {
  const widgets: Array<{ key: string; content: unknown }> = [];
  const statuses: Array<{ key: string; text: unknown }> = [];
  const ui = {
    setWidget(key: string, content: unknown): void {
      widgets.push({ key, content });
    },
    setStatus(key: string, text: unknown): void {
      statuses.push({ key, text });
    },
  };
  return { ui, widgets, statuses };
}

test("a widget given as lines is captured", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("cwl-index", ["CWL index line"]);

  assert.deepEqual(capturedLines(), ["CWL index line"]);
});

test("the original call still happens when a widget is captured", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("cwl-index", ["kept"]);

  assert.equal(widgets.length, 1, "the source's own call must not be dropped");
  assert.equal(widgets[0].key, "cwl-index");
});

test("with suppression off a captured widget is still drawn by the TUI", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  setSuppressing(false);
  ui.setWidget("cwl-index", ["kept"]);

  assert.deepEqual(widgets[0].content, ["kept"], "nothing may be hidden while the panel is down");
  assert.deepEqual(capturedLines(), ["kept"]);
});

test("with suppression on the captured widget leaves the TUI", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  setSuppressing(true);
  ui.setWidget("cwl-index", ["moved"]);

  assert.equal(widgets[0].content, undefined, "the line now lives in the panel only");
  assert.deepEqual(capturedLines(), ["moved"]);
});

test("a widget factory is captured and hidden: the panel renders it itself", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  setSuppressing(true);
  const factory = () => "rendered component";
  ui.setWidget("pi-lens", factory);

  assert.equal(widgets[0].content, undefined, "the TUI stops drawing it: the panel draws it instead");
  assert.deepEqual(capturedLines(), [], "a factory is not a line: it must not be reported as one");
  const captured = capturedFactories();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].id, "pi-lens");
  assert.equal(captured[0].factory, factory, "the function itself is kept, not its result");
});

test("a cleared factory is forgotten, so the panel stops drawing it", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("pi-lens", () => "component");
  assert.equal(capturedFactories().length, 1);
  ui.setWidget("pi-lens", undefined);
  assert.deepEqual(capturedFactories(), [], "undefined clears the factory too");
});

test("an unknown id that draws a factory is captured as well", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  const factory = () => "component";
  ui.setWidget("an-extension-we-never-heard-of", factory);
  const captured = capturedFactories();
  assert.equal(captured.length, 1, "the mechanism is generic, not a list of names");
  assert.equal(captured[0].id, "an-extension-we-never-heard-of");
});

test("the panel's own widget is never captured nor hidden", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  setSuppressing(true);
  ui.setWidget(SELF_ID, ["the panel itself"]);

  assert.deepEqual(widgets[0].content, ["the panel itself"]);
  assert.deepEqual(capturedLines(), []);
});

test("a status is captured and suppressed like a widget", () => {
  resetInterceptor();
  const { ui, statuses } = fakeUi();
  installInterceptor(ui);
  setSuppressing(true);
  ui.setStatus("pi-lens-lsp", "LSP ready");

  assert.equal(statuses[0].text, undefined);
  assert.deepEqual(capturedLines(), ["LSP ready"]);
});

test("an empty status is a removal, not a line", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setStatus("pi-lens-lsp", "LSP ready");
  ui.setStatus("pi-lens-lsp", undefined);

  assert.deepEqual(capturedLines(), []);
});

test("clearing a widget removes its captured lines", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("cwl-index", ["line"]);
  ui.setWidget("cwl-index", undefined);

  assert.deepEqual(capturedLines(), []);
});

test("a configured id comes first, the others after in first-seen order", () => {
  resetInterceptor();
  setCaptureOrder(["known-source"]);
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("unknown-a", ["A"]);
  ui.setStatus("unknown-b", "B");
  ui.setWidget("known-source", ["KNOWN"]);

  const lines = capturedLines();
  assert.deepEqual(lines, ["KNOWN", "A", "B"], "the configured source keeps its place");
});

test("with no configured order, sources follow first-seen order", () => {
  resetInterceptor();
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("declared-first", ["FIRST"]);
  ui.setWidget("declared-second", ["SECOND"]);

  assert.deepEqual(
    capturedLines(),
    ["FIRST", "SECOND"],
    "the default needs no knowledge of who is installed: first-seen order",
  );
});

test("a configured id that is absent contributes nothing", () => {
  resetInterceptor();
  setCaptureOrder(["never-installed", "present"]);
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("present", ["only me"]);

  assert.deepEqual(capturedLines(), ["only me"]);
});

test("a malformed captureOrder cannot make a source vanish", () => {
  resetInterceptor();
  setCaptureOrder([42, "", "   ", null, "real"]);
  const { ui } = fakeUi();
  installInterceptor(ui);
  ui.setWidget("other", ["OTHER"]);
  ui.setWidget("real", ["REAL"]);

  assert.deepEqual(
    capturedLines(),
    ["REAL", "OTHER"],
    "junk entries are dropped, the valid ones keep their place, the rest follow",
  );
});

test("installing twice on the same object does not double-wrap", () => {
  resetInterceptor();
  const { ui, widgets } = fakeUi();
  installInterceptor(ui);
  installInterceptor(ui);
  ui.setWidget("cwl-index", ["once"]);

  assert.equal(widgets.length, 1, "a second wrap would duplicate every call");
});

test("a new ui object is wrapped too, by identity", () => {
  resetInterceptor();
  const first = fakeUi();
  installInterceptor(first.ui);
  first.ui.setWidget("cwl-index", ["from the first object"]);

  const second = fakeUi();
  installInterceptor(second.ui);
  setSuppressing(true);
  second.ui.setWidget("cwl-index", ["from the second object"]);

  assert.equal(second.widgets[0].content, undefined, "the new object must be wrapped as well");
  assert.deepEqual(capturedLines(), ["from the second object"]);
});

test("a ui object without setWidget or setStatus is refused, not wrapped", () => {
  resetInterceptor();
  const partial = { setWidget: () => {} } as any;
  installInterceptor(partial);
  assert.equal(partial.setStatus, undefined, "a partial ui must be left alone");
});
