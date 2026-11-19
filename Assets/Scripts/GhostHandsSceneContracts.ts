// GhostHandsSceneContracts.ts
// Owns: stable SceneObject names, sfx/icon asset paths, default copy (step labels,
// start-card text) and shared enum-like string unions for the Ghost Hands lesson.
// Expects: nothing (pure constants, no @inputs).
// Must not: touch the scene, import UIKit, or hold runtime state.

/** Authored root names (created by the bootstrap step; LessonRoot local == world). */
export const SCENE_NAMES = {
  lessonRoot: "LessonRoot",
  table: "Table (stand-in)",
  rope: "Rope",
  ropeTip: "RopeTip",
  dottedPath: "DottedPath",
  ghostHands: "GhostHands",
  ghostRopeTip: "GhostRopeTip",
  stepMarkerRoot: "StepMarkerRoot",
  replayButtonRoot: "ReplayButtonRoot",
  slowerButtonRoot: "SlowerButtonRoot",
  tightenButtonRoot: "TightenButtonRoot",
  againButtonRoot: "AgainButtonRoot",
  startCardRoot: "StartCardRoot",
  finishedBadgeRoot: "FinishedBadgeRoot",
  audioRoot: "AudioRoot",
} as const;

/** Project-relative asset paths (informational; requireAsset needs literals in-file). */
export const SFX_PATHS = {
  success: "Assets/GeneratedSFX/StepSuccessChime.wav",
  warning: "Assets/GeneratedSFX/OffPathWarning.wav",
  finished: "Assets/GeneratedSFX/KnotFinishedChime.wav",
  tap: "Assets/GeneratedSFX/ButtonTap.wav",
} as const;

export const ICON_PATHS = {
  replay: "Assets/Icons/replay.png",
  slower: "Assets/Icons/slow_motion_video.png",
  tighten: "Assets/Icons/compress.png",
  again: "Assets/Icons/restart_alt.png",
  check: "Assets/Icons/check_circle.png",
  start: "Assets/Icons/play_arrow.png",
} as const;

/** Names returned by GhostHandsAudioController.getLastSfx(). */
export type SfxName = "" | "StepSuccessChime" | "OffPathWarning" | "KnotFinishedChime" | "ButtonTap";

export const STEP_COUNT = 4;
export const MAX_ROUND = 3;

export const DEFAULT_STEP_LABELS: string[] = [
  "Make the hole",
  "Up through the hole",
  "Around the tree",
  "Back down the hole",
];

export const START_CARD_TEXT = {
  title: "Bowline",
  subtitle: "The rabbit comes out of the hole, around the tree, and back down the hole.",
  prompt: "Pinch to start",
};

export type LessonPhase =
  | "start"
  | "demo"
  | "userTurn"
  | "stepDone"
  | "tightenReady"
  | "tightening"
  | "finished";

export type ButtonMode = "hidden" | "steps" | "tighten" | "again";

/** Step-marker dot states pushed to GhostHandsStepMarkerUI.setDotStates. */
export type DotState = "pending" | "current" | "done";

/** Tip colour state exposed by GhostHandsTipController.getColorState(). */
export type TipColorState = "none" | "glow" | "warning" | "success";

export type ControlButtonName = "replay" | "slower" | "tighten" | "again";

/** Hex "#RRGGBB" -> vec4 (alpha a). Pure helper, used for colour defaults. */
export function hexColor(hex: string, a: number = 1): vec4 {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return new vec4(r, g, b, a);
}

export const COLORS = {
  rope: "#F3EBDD",
  ghost: "#8FD3FF",
  tipGlow: "#FFFFFF",
  warning: "#FF9A3C",
  success: "#5BE37D",
  pathDot: "#8FD3FF",
} as const;
