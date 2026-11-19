// GhostHandsMain.ts
// Owns: lesson orchestration for Ghost Hands (bowline). Lives on LessonRoot. Validates
// wired refs in onAwake, binds every UI/IK/controller event in OnStartEvent, drives the
// state machine in GhostHandsLessonState, pushes state into controllers + UI modules,
// and exposes LEAF getters + debug drive hooks.
// Expects @inputs: the 4 UI modules (StartCard, StepMarker, Controls, FinishedBadge) and
// the 5 controllers (Rope, Tip, Path, Ghost, Audio), plus tuning knobs.
// Size reason: single orchestration table plus the 19 LEAF getters and 6 debug hooks the plan requires on one component.
// Must not: call into sibling components from onAwake, create text/UIKit components,
// or own any geometry (controllers do).

import { GhostHandsStartCardUI } from "./GhostHandsStartCardUI";
import { GhostHandsStepMarkerUI } from "./GhostHandsStepMarkerUI";
import { GhostHandsControlsUI } from "./GhostHandsControlsUI";
import { GhostHandsFinishedBadgeUI } from "./GhostHandsFinishedBadgeUI";
import { GhostHandsRopeController } from "./GhostHandsRopeController";
import { GhostHandsTipController } from "./GhostHandsTipController";
import { GhostHandsPathController } from "./GhostHandsPathController";
import { GhostHandsGhostController } from "./GhostHandsGhostController";
import { GhostHandsAudioController } from "./GhostHandsAudioController";
import { GhostHandsLessonState } from "./GhostHandsLessonState";
import { START_CARD_TEXT, STEP_COUNT } from "./GhostHandsSceneContracts";

@component
export class GhostHandsMain extends BaseScriptComponent {
  // Inspector toggle: wireframe every collider under LessonRoot (Hard Rule 6.7).
  @input
  debugColliders: boolean = false;

  @input
  @hint("Print state transitions to the log")
  debugLogging: boolean = true;

  // --- UI modules (owned by the ui step; typed as their classes) ---
  @input startCard!: GhostHandsStartCardUI;
  @input stepMarker!: GhostHandsStepMarkerUI;
  @input controls!: GhostHandsControlsUI;
  @input finishedBadge!: GhostHandsFinishedBadgeUI;

  // --- Controllers ---
  @input rope!: GhostHandsRopeController;
  @input tip!: GhostHandsTipController;
  @input path!: GhostHandsPathController;
  @input ghost!: GhostHandsGhostController;
  @input audio!: GhostHandsAudioController;

  // --- Tuning ---
  @input
  @hint("World Y of the table top (cm); rope should rest 0.5 cm above it")
  tableTopY: number = -65;

  @input
  @hint("Expected horizontal distance from the user to the rope (cm)")
  workDistanceCm: number = 45;

  @input
  @hint("Delay after a step snaps before the next step's demo starts (s)")
  autoAdvanceDelaySec: number = 0.5;

  @input
  @hint("Duration of the Tighten animation (s)")
  tightenSec: number = 1.6;

  @input
  @hint("One label per step (rhyme defaults)")
  stepLabels: string[] = ["Make the hole", "Up through the hole", "Around the tree", "Back down the hole"];

  private state = new GhostHandsLessonState();
  private refsOk = false;
  private started = false;
  private advanceEvent: DelayedCallbackEvent | null = null;
  private pendingNextStep = 0;
  private tightenElapsed = 0;

  onAwake(): void {
    this.refsOk = this.validateRefs();
    // Own-component construction only: timers + lifecycle binds.
    this.advanceEvent = this.createEvent("DelayedCallbackEvent");
    this.advanceEvent.bind(() => this.onAdvanceTimer());
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  // ------------------------------------------------------------------ lifecycle

  private onStart(): void {
    if (!this.refsOk) {
      print("GhostHandsMain: required @input missing - lesson disabled. Check bootstrap wiring.");
      return;
    }
    if (this.debugColliders) {
      this.setColliderDebugAll(this.getSceneObject(), true);
    }

    this.startCard.onStart.add(() => this.beginLesson());
    this.controls.onReplay.add(() => this.onReplay());
    this.controls.onSlowerToggle.add((on: boolean) => this.onSlowerToggle(on));
    this.controls.onTighten.add(() => this.onTighten());
    this.controls.onAgain.add(() => this.onAgain());
    this.tip.onStepComplete.add((step: number) => this.onStepComplete(step));
    this.tip.onOffPath.add(() => this.onOffPath());
    this.ghost.onHold.add((step: number) => this.onGhostHold(step));

    this.started = true;
    this.checkPlacement();
    this.enterStart();
  }

  private onUpdate(): void {
    if (!this.started) return;
    const phase = this.state.phase;
    if (phase === "userTurn" || phase === "demo") {
      this.rope.setStepProgress(this.state.step, this.tip.getProgress(), this.tip.getLocalPosition());
      if (phase === "userTurn") this.path.setProgress(this.tip.getProgress());
    } else if (phase === "tightening") {
      this.tightenElapsed += getDeltaTime();
      const k = Math.min(1, this.tightenElapsed / Math.max(0.05, this.tightenSec));
      this.rope.setTightenProgress(k);
      if (k >= 1) this.finishTighten();
    }
  }

  // ------------------------------------------------------------------ flow

  private enterStart(): void {
    this.cancelAdvance();
    this.state.reset();
    this.startCard.setTexts(START_CARD_TEXT.title, START_CARD_TEXT.subtitle, START_CARD_TEXT.prompt);
    this.startCard.showStartCard();
    this.rope.resetShape();
    this.rope.setVisible(false);
    this.ghost.hide();
    this.path.hide();
    this.tip.prepareStep(1);
    this.stepMarker.setVisible(false);
    this.controls.setSlowerToggled(false);
    this.controls.setMode("hidden");
    this.finishedBadge.hideBadge();
    this.log("phase start");
  }

  private beginLesson(): void {
    if (!this.started || this.state.phase !== "start") return;
    this.audio.playTap();
    this.startCard.hideStartCard();
    this.rope.resetShape();
    this.rope.setVisible(true);
    this.stepMarker.setVisible(true);
    this.startStep(1);
  }

  private startStep(step: number): void {
    this.cancelAdvance();
    this.state.beginStep(step);
    this.tip.prepareStep(this.state.step);
    this.rope.setStepProgress(this.state.step, 0, null);
    this.path.hide();
    this.refreshMarker();
    this.refreshButtons();
    if (this.state.showsGhost()) {
      this.ghost.setAlpha(this.state.ghostAlpha(this.ghost.getBaseAlpha()));
      this.ghost.play(this.state.step, this.state.slow);
      this.log(`step ${this.state.step} demo (round ${this.state.round})`);
    } else {
      this.ghost.hide();
      this.enterUserTurn();
    }
  }

  private onGhostHold(step: number): void {
    if (this.state.phase === "demo" && step === this.state.step) {
      this.enterUserTurn();
    }
  }

  private enterUserTurn(): void {
    this.state.beginUserTurn();
    this.tip.activate();
    this.path.showPath(this.state.step);
    this.path.setProgress(this.tip.getProgress());
    this.refreshMarker();
    this.log(`step ${this.state.step} user turn`);
  }

  private onStepComplete(step: number): void {
    if (step !== this.state.step || this.state.phase !== "userTurn") return;
    this.audio.playSuccess();
    this.rope.setStepProgress(step, 1, null);
    this.path.hide();
    if (this.ghost.isVisible()) this.ghost.fadeOut();
    const next = this.state.completeStep();
    this.refreshMarker();
    this.log(`step ${step} complete`);
    this.pendingNextStep = next;
    this.scheduleAdvance(this.autoAdvanceDelaySec);
  }

  private onAdvanceTimer(): void {
    if (!this.started || this.state.phase !== "stepDone") return;
    if (this.pendingNextStep > 0) {
      this.startStep(this.pendingNextStep);
    } else {
      this.enterTightenReady();
    }
  }

  private enterTightenReady(): void {
    this.state.enterTightenReady();
    this.tip.deactivate();
    this.path.hide();
    this.ghost.hide();
    this.refreshMarker();
    this.refreshButtons();
    this.log("tighten ready");
  }

  private onTighten(): void {
    if (!this.state.beginTighten()) return;
    this.audio.playTap();
    this.tightenElapsed = 0;
    this.refreshButtons();
    if (this.state.showsGhost()) {
      this.ghost.setAlpha(this.state.ghostAlpha(this.ghost.getBaseAlpha()));
      this.ghost.playTighten(this.tightenSec);
    }
    this.log("tightening");
  }

  private finishTighten(): void {
    this.state.finishTighten();
    this.rope.setTightenProgress(1);
    this.audio.playFinished();
    this.finishedBadge.showBadge(`Bowline tied - round ${this.state.round}`);
    this.refreshButtons();
    this.log("finished");
  }

  private onAgain(): void {
    if (this.state.phase !== "finished") return;
    this.audio.playTap();
    this.state.again();
    this.finishedBadge.hideBadge();
    this.ghost.hide();
    this.rope.resetShape();
    this.startStep(1);
  }

  private onReplay(): void {
    if (!this.state.isStepPhase() || this.state.phase === "stepDone") return;
    this.audio.playTap();
    if (!this.state.showsGhost()) return;
    this.ghost.setAlpha(this.state.ghostAlpha(this.ghost.getBaseAlpha()));
    this.ghost.play(this.state.step, this.state.slow);
    this.log("replay");
  }

  private onSlowerToggle(on: boolean): void {
    this.state.setSlow(on);
    this.controls.setSlowerToggled(on);
    if (!this.state.isStepPhase() || this.state.phase === "stepDone") return;
    this.audio.playTap();
    if (!this.state.showsGhost()) return;
    this.ghost.play(this.state.step, this.state.slow);
    this.log(`slower ${on}`);
  }

  private onOffPath(): void {
    if (this.state.phase !== "userTurn") return;
    this.audio.playWarning();
    this.path.pulse();
  }

  // ------------------------------------------------------------------ helpers

  private refreshMarker(): void {
    this.stepMarker.setDotStates(this.state.dotStates());
    const idx = this.state.step - 1;
    const label = idx >= 0 && idx < this.stepLabels.length ? this.stepLabels[idx] : "";
    if (this.state.phase === "tightenReady" || this.state.phase === "tightening") {
      this.stepMarker.setLabel("Pull it tight");
    } else if (this.state.phase === "finished") {
      this.stepMarker.setLabel("Bowline!");
    } else {
      this.stepMarker.setLabel(`${this.state.step}. ${label}`);
    }
  }

  private refreshButtons(): void {
    const mode = this.state.buttonMode();
    this.controls.setMode(mode);
    if (mode === "steps") this.controls.setStepButtonsDimmed(true);
  }

  private scheduleAdvance(sec: number): void {
    if (this.advanceEvent) this.advanceEvent.reset(Math.max(0, sec));
  }

  private cancelAdvance(): void {
    this.pendingNextStep = 0;
    if (this.advanceEvent) this.advanceEvent.cancel();
  }

  private checkPlacement(): void {
    const p = this.rope.getWorldPosition();
    const dy = Math.abs(p.y - (this.tableTopY + 0.5));
    const dist = Math.sqrt(p.x * p.x + p.z * p.z);
    if (dy > 2 || Math.abs(dist - this.workDistanceCm) > 8) {
      print(`GhostHandsMain: rope at ${p} is off the plan (table top ${this.tableTopY}, ~${this.workDistanceCm} cm away).`);
    }
  }

  private validateRefs(): boolean {
    const missing: string[] = [];
    if (!this.startCard) missing.push("startCard");
    if (!this.stepMarker) missing.push("stepMarker");
    if (!this.controls) missing.push("controls");
    if (!this.finishedBadge) missing.push("finishedBadge");
    if (!this.rope) missing.push("rope");
    if (!this.tip) missing.push("tip");
    if (!this.path) missing.push("path");
    if (!this.ghost) missing.push("ghost");
    if (!this.audio) missing.push("audio");
    if (missing.length > 0) {
      print("GhostHandsMain: required @input not wired: " + missing.join(", "));
      return false;
    }
    return true;
  }

  private log(msg: string): void {
    if (this.debugLogging) print("[GhostHands] " + msg);
  }

  private setColliderDebugAll(obj: SceneObject, enable: boolean): void {
    const c = obj.getComponent("Physics.ColliderComponent") as ColliderComponent | null;
    if (c) c.debugDrawEnabled = enable;
    const b = obj.getComponent("Physics.BodyComponent") as ColliderComponent | null;
    if (b) b.debugDrawEnabled = enable;
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      this.setColliderDebugAll(obj.getChild(i), enable);
    }
  }

  // ------------------------------------------------------------------ LEAF getters

  getPhase(): string {
    return this.state.phase;
  }

  getCurrentStep(): number {
    return this.state.step;
  }

  getRound(): number {
    return this.state.round;
  }

  isStartCardVisible(): boolean {
    return this.started ? this.startCard.isShown() : false;
  }

  isRopeVisible(): boolean {
    return this.started ? this.rope.isVisible() : false;
  }

  getRopeWorldPosition(): vec3 {
    return this.refsOk ? this.rope.getWorldPosition() : vec3.zero();
  }

  isGhostVisible(): boolean {
    return this.started ? this.ghost.isVisible() : false;
  }

  isGhostHolding(): boolean {
    return this.started ? this.ghost.isHolding() : false;
  }

  getGhostAlpha(): number {
    return this.started ? this.ghost.getAlpha() : 0;
  }

  isPathVisible(): boolean {
    return this.started ? this.path.isVisible() : false;
  }

  getTipColorState(): string {
    return this.started ? this.tip.getColorState() : "none";
  }

  isTipGlowing(): boolean {
    return this.started ? this.tip.isGlowing() : false;
  }

  getTipProgress(): number {
    return this.started ? this.tip.getProgress() : 0;
  }

  getLastCheckpointProgress(): number {
    return this.started ? this.tip.getLastCheckpointProgress() : 0;
  }

  getTipWorldPosition(): vec3 {
    return this.refsOk ? this.tip.getWorldPosition() : vec3.zero();
  }

  getStepDotStates(): string[] {
    return this.state.dotStates();
  }

  getVisibleButtons(): string[] {
    return this.started ? this.controls.getVisibleButtons() : [];
  }

  isFinishedBadgeVisible(): boolean {
    return this.started ? this.finishedBadge.isShown() : false;
  }

  getLastSfx(): string {
    return this.started ? this.audio.getLastSfx() : "";
  }

  getStepCount(): number {
    return STEP_COUNT;
  }

  // ------------------------------------------------------------------ LEAF debug drive

  /** Press the start card (through the UI module), falling back to the direct transition. */
  debugStart(): void {
    if (!this.started) return;
    this.startCard.pressForTest();
    if (this.state.phase === "start") this.beginLesson();
  }

  /** Skip the ghost demo: freeze the ghost at its end pose and hand over to the user. */
  debugSkipDemo(): void {
    if (!this.started || this.state.phase !== "demo") return;
    this.ghost.holdEndPose();
    if (this.state.phase === "demo") this.enterUserTurn();
  }

  /** Drive the tip as if dragged to `progress` (0..1) with a lateral offset `offPathCm`. */
  debugDragTip(progress: number, offPathCm: number): void {
    if (!this.started) return;
    this.tip.debugDrag(progress, offPathCm);
  }

  debugReleaseTip(): void {
    if (!this.started) return;
    this.tip.debugRelease();
  }

  /** name: "start" | "replay" | "slower" | "tighten" | "again" - routed through the UI modules. */
  debugPressButton(name: string): void {
    if (!this.started) return;
    const n = (name || "").toLowerCase();
    if (n === "start") {
      this.debugStart();
    } else if (n === "replay" || n === "slower" || n === "tighten" || n === "again") {
      this.controls.pressForTest(n);
    } else {
      print("GhostHandsMain.debugPressButton: unknown button " + name);
    }
  }

  /** Jump the delayed auto-advance (tests that do not want to wait). */
  debugAdvanceNow(): void {
    if (!this.started) return;
    this.cancelAdvanceTimerOnly();
    this.onAdvanceTimer();
  }

  private cancelAdvanceTimerOnly(): void {
    if (this.advanceEvent) this.advanceEvent.cancel();
  }
}
