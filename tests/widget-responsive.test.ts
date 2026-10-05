import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldRenderCompact,
  MINI_EMOTES,
  renderCompactFrame,
  createWidgetFactory,
} from "../src/widget.ts";
import type { Config, EmoteState } from "../src/types.ts";

const BASE_CONFIG: Config = {
  enabled: true,
  debug: false,
  size: 8,
  asciiCanvas: { cols: 24, rows: 12 },
  readingSpeed: 4,
  hideBelow: 40,
  hideBelowRows: 15,
  compactMode: "auto",
  compactBelowRows: 35,
  compactBelowCols: 80,
  holdDuration: { hi: 2000, success: 1200, failure: 1200 },
  blinkInterval: [3000, 6000],
  talkTickMs: 120,
  cycleMs: 500,
  emotes: [],
  terminals: [],
  theme: {
    "model-name": "accent",
    "token-info": "dim",
    "working-directory": "warning",
    border: "border",
    "vertical-separator": "border",
  },
  showTokenStats: true,
  board: false,
  captureOrder: [],
};

const MOCK_THEME = {
  fg: (_color: string, s: string) => s,
  bold: (s: string) => s,
  getThinkingBorderColor: () => (s: string) => s,
};

test("shouldRenderCompact: auto activates on small height or narrow width", () => {
  // Height below 35 -> compact
  assert.equal(shouldRenderCompact(100, 24, BASE_CONFIG), true);
  // Width below 80 -> compact
  assert.equal(shouldRenderCompact(70, 40, BASE_CONFIG), true);
  // Both below -> compact
  assert.equal(shouldRenderCompact(60, 20, BASE_CONFIG), true);
  // Large terminal -> full mode
  assert.equal(shouldRenderCompact(120, 45, BASE_CONFIG), false);
});

test("shouldRenderCompact: respect always and never modes", () => {
  const alwaysConfig = { ...BASE_CONFIG, compactMode: "always" as const };
  assert.equal(shouldRenderCompact(200, 60, alwaysConfig), true);

  const neverConfig = { ...BASE_CONFIG, compactMode: "never" as const };
  assert.equal(shouldRenderCompact(60, 20, neverConfig), false);
});

test("shouldRenderCompact: respect custom thresholds", () => {
  const customConfig = { ...BASE_CONFIG, compactBelowRows: 30, compactBelowCols: 90 };
  assert.equal(shouldRenderCompact(100, 32, customConfig), false);
  assert.equal(shouldRenderCompact(100, 28, customConfig), true);
  assert.equal(shouldRenderCompact(85, 40, customConfig), true);
});

test("MINI_EMOTES: covers all 10 EmoteState keys", () => {
  const states: EmoteState[] = [
    "hi",
    "idle",
    "think",
    "talk",
    "read",
    "write",
    "tool",
    "success",
    "failure",
    "compact",
  ];
  for (const s of states) {
    assert.ok(typeof MINI_EMOTES[s] === "string" && MINI_EMOTES[s].length > 0, `Missing mini emote for ${s}`);
  }
});

test("renderCompactFrame: ultra-compact layout on terminalRows < 24", () => {
  const mockAnimator = { currentState: "think" as EmoteState } as any;
  const mockCtx = {
    model: { name: "claude-3-7-sonnet" },
    getContextUsage: () => ({ tokens: 12500, percent: 6.2, contextWindow: 200000 }),
    sessionManager: {
      getCwd: () => "/home/riccardo/progetti/test",
      getEntries: () => [],
    },
  };
  const mockPi = { getThinkingLevel: () => "high" };

  const lines = renderCompactFrame(
    70,
    20, // < 24 rows
    mockAnimator,
    BASE_CONFIG,
    mockCtx,
    mockPi,
    MOCK_THEME,
    "─".repeat(70),
    (s) => s,
  );

  // Exactly 2 lines (border + 1 status line)
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes("(•_ • )?"));
  assert.ok(lines[1].includes("claude-3-7-sonnet"));
});

test("renderCompactFrame: standard compact layout on terminalRows 24-34", () => {
  const mockAnimator = { currentState: "tool" as EmoteState } as any;
  const mockCtx = {
    model: { name: "scrocco-model" },
    getContextUsage: () => ({ tokens: 50000, percent: 25.0, contextWindow: 200000 }),
    sessionManager: {
      getCwd: () => "/home/riccardo/PiAgent",
      getEntries: () => [],
    },
  };
  const mockPi = { getThinkingLevel: () => "low" };

  const lines = renderCompactFrame(
    75,
    28, // 24-34 rows
    mockAnimator,
    BASE_CONFIG,
    mockCtx,
    mockPi,
    MOCK_THEME,
    "─".repeat(75),
    (s) => s,
  );

  // Exactly 3 lines (border + row 1 [emote, model, bar] + row 2 [pwd, stats])
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes("( • ω•)/"));
  assert.ok(lines[1].includes("scrocco-model"));
  assert.ok(lines[2].includes("~/PiAgent"));
});

test("createWidgetFactory: hides completely below hideBelow or hideBelowRows", () => {
  const mockAnimator = {
    setTui: () => {},
    getRenderedFrame: () => ({ kind: "text", lines: ["hello"] }),
  } as any;
  const factory = createWidgetFactory({
    animator: mockAnimator,
    config: BASE_CONFIG,
    pi: {},
    getCtxRef: () => null,
    getCurrentEmoteSet: () => "default",
  });

  const tinyWidthTui = { terminal: { rows: 40 } };
  const widget1 = factory(tinyWidthTui, MOCK_THEME);
  assert.deepEqual(widget1.render(30), []); // width 30 < hideBelow 40

  const tinyRowsTui = { terminal: { rows: 12 } }; // rows 12 < hideBelowRows 15
  const widget2 = factory(tinyRowsTui, MOCK_THEME);
  assert.deepEqual(widget2.render(80), []);
});
