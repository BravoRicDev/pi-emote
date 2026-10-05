export type EmoteState = "hi" | "idle" | "think" | "talk" | "read" | "write" | "tool" | "success" | "failure" | "compact";

export type ThemeColor =
  | "accent" | "border" | "borderAccent" | "borderMuted"
  | "success" | "error" | "warning" | "muted" | "dim" | "text" | "thinkingText"
  | "userMessageText" | "customMessageText" | "customMessageLabel"
  | "toolTitle" | "toolOutput"
  | "mdHeading" | "mdLink" | "mdLinkUrl" | "mdCode" | "mdCodeBlock" | "mdCodeBlockBorder"
  | "mdQuote" | "mdQuoteBorder" | "mdHr" | "mdListBullet"
  | "toolDiffAdded" | "toolDiffRemoved" | "toolDiffContext"
  | "syntaxComment" | "syntaxKeyword" | "syntaxFunction" | "syntaxVariable" | "syntaxString"
  | "syntaxNumber" | "syntaxType" | "syntaxOperator" | "syntaxPunctuation"
  | "thinkingOff" | "thinkingMinimal" | "thinkingLow" | "thinkingMedium"
  | "thinkingHigh" | "thinkingXhigh" | "thinkingMax" | "bashMode";

/** A widget color: a pi theme token or the special "thinking-level-color" flag. */
export type WidgetColor = ThemeColor | "thinking-level-color";

export interface ProgressBarTheme {
  default?: WidgetColor;
  "cache-hit"?: WidgetColor;
  "cache-miss"?: WidgetColor;
  "almost-full"?: WidgetColor;
}

export interface WidgetTheme {
  "model-name"?: WidgetColor;
  "progress-bar"?: ProgressBarTheme;
  "token-info"?: WidgetColor;
  "working-directory"?: WidgetColor;
  border?: WidgetColor;
  "vertical-separator"?: WidgetColor;
}

/** Geometry of the ASCII text canvas the widget reserves for the avatar. */
export interface AsciiCanvas {
  cols: number;
  rows: number;
}

export interface Config {
  enabled: boolean;
  debug: boolean;
  size: number;
  asciiCanvas: AsciiCanvas;
  readingSpeed: number;
  hideBelow: number;
  /** Terminal rows threshold below which the widget is completely hidden (default: 15). */
  hideBelowRows?: number;
  /** Responsive compact mode: "auto" adapts based on terminal size, "always" forces compact, "never" disables. */
  compactMode?: "auto" | "always" | "never";
  /** Terminal rows threshold below which compact mode activates (default: 35). */
  compactBelowRows?: number;
  /** Terminal columns threshold below which compact mode activates (default: 80). */
  compactBelowCols?: number;
  holdDuration: { hi: number; success: number; failure: number };
  blinkInterval: [number, number];
  talkTickMs: number;
  cycleMs: number;
  emotes: EmoteMapping[];
  terminals: TerminalMapping[];
  theme: WidgetTheme;
  /** Draw the token/cost line (↑ ↓ ⇞ $) in the widget. Upstream behavior: true. */
  showTokenStats: boolean;
  /** Draw the lines the other extensions drew, intercepted from the shared ui object (see interceptor.ts). */
  board: boolean;
  /**
   * Widget ids to draw first, in this order. Ids not listed follow in first-seen
   * order; an empty list (the default) means first-seen order for everything.
   */
  captureOrder: string[];
}

export interface EmoteMapping {
  model?: string;
  "thinking-level"?: string;
  "emote-set": string;
}

export interface TerminalMapping {
  match: string;
  render: "kitty" | "kitty-unicode" | "iterm2" | "ascii" | "auto";
}

export interface ResolvedRenderer {
  protocol: "kitty" | "kitty-unicode" | "iterm2" | "ascii";
  multiplexer: "tmux" | "screen" | "zellij" | null;
  warning: string | null;
  warningLevel: "warning" | "info";
}

export interface EmotesConfig {
  idle?: { default?: string; blink?: string };
  think?: { default?: string; hard?: string };
  talk?: { weights?: Record<string, number> };
}

export interface FrameSet {
  files: string[];
  base64Cache: Map<string, string>;
}
