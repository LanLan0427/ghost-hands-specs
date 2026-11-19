// GhostHandsLessonState.ts
// Owns: pure lesson logic - phase, current step (1..4), round (1..3), per-step done
// flags, the Slower flag, and everything derived from them (button mode, ghost alpha,
// step-marker dot states). No scene access, no timers, no events.
// Expects: nothing (plain class, instantiated by GhostHandsMain).
// Must not: touch SceneObjects/components, import UIKit, or schedule callbacks.

import {
  ButtonMode,
  DotState,
  LessonPhase,
  MAX_ROUND,
  STEP_COUNT,
} from "./GhostHandsSceneContracts";

export class GhostHandsLessonState {
  phase: LessonPhase = "start";
  step = 1;
  round = 1;
  slow = false;
  stepDone: boolean[] = [false, false, false, false];

  /** Back to the start card (round 1, nothing done). */
  reset(): void {
    this.phase = "start";
    this.step = 1;
    this.round = 1;
    this.slow = false;
    this.clearSteps();
  }

  clearSteps(): void {
    this.stepDone = [];
    for (let i = 0; i < STEP_COUNT; i++) this.stepDone.push(false);
  }

  /** Enter a step. Demo phase when the round shows a ghost, otherwise straight to user turn. */
  beginStep(step: number): void {
    this.step = Math.max(1, Math.min(STEP_COUNT, step));
    this.phase = this.showsGhost() ? "demo" : "userTurn";
  }

  beginUserTurn(): void {
    if (this.phase === "demo" || this.phase === "userTurn") this.phase = "userTurn";
  }

  /** Mark the current step done. Returns the next step number, or 0 when all 4 are done. */
  completeStep(): number {
    this.stepDone[this.step - 1] = true;
    this.phase = "stepDone";
    return this.step < STEP_COUNT ? this.step + 1 : 0;
  }

  allStepsDone(): boolean {
    return this.stepDone.every((d) => d);
  }

  enterTightenReady(): void {
    this.phase = "tightenReady";
  }

  beginTighten(): boolean {
    if (this.phase !== "tightenReady") return false;
    this.phase = "tightening";
    return true;
  }

  finishTighten(): void {
    this.phase = "finished";
  }

  /** Again: next round (capped at 3), back to step 1. Caller then calls beginStep(1). */
  again(): void {
    this.round = Math.min(MAX_ROUND, this.round + 1);
    this.step = 1;
    this.clearSteps();
  }

  setSlow(on: boolean): void {
    this.slow = on;
  }

  /** Round 3 has no ghost at all (path + checkpoints only). */
  showsGhost(): boolean {
    return this.round < 3;
  }

  /** Ghost alpha for this round: base, half in round 2, 0 in round 3. */
  ghostAlpha(baseAlpha: number): number {
    if (this.round >= 3) return 0;
    if (this.round === 2) return baseAlpha * 0.5;
    return baseAlpha;
  }

  isStepPhase(): boolean {
    return this.phase === "demo" || this.phase === "userTurn" || this.phase === "stepDone";
  }

  buttonMode(): ButtonMode {
    switch (this.phase) {
      case "demo":
      case "userTurn":
      case "stepDone":
        return "steps";
      case "tightenReady":
        return "tighten";
      case "finished":
        return "again";
      default:
        return "hidden";
    }
  }

  dotStates(): DotState[] {
    const out: DotState[] = [];
    for (let i = 0; i < STEP_COUNT; i++) {
      if (this.stepDone[i]) out.push("done");
      else if (this.isStepPhase() && i === this.step - 1) out.push("current");
      else out.push("pending");
    }
    return out;
  }
}
