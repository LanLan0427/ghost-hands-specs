// GhostHandsStepMarkerUI.ts — passive step-progress marker lying flat on the table.
// Renders 4 status dots (pending / current / done) and a one-line step label.
// Holds no domain state: it renders what GhostHandsMain pushes. No interaction, no colliders.

import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {
  FlexAlign,
  FlexJustify,
  RoundedRectangle,
  applyTextRole,
  dynamicText,
  flexChild,
  flexColumn,
  flexRow,
  makeCardRect,
  obj,
  tintRoundedRect
} from "./UIKitHelpers"

const PANEL_W = 22
const PANEL_H = 4.6
const DOT_SIZE = 1.2
const DOT_GAP = 1.8 // 3 cm center pitch
const DOT_COUNT = 4
const LABEL_H = 2.8
const VIEW_DISTANCE_CM = 80
/** One step up from Headline2 so the step label reads at a glance on the table. */
export const LABEL_ROLE = "Headline1" as const
export const LABEL_VIEW_DISTANCE_CM = 80

const COLOR_TEXT = new vec4(1, 1, 1, 1)
const COLOR_PENDING = new vec4(0.82, 0.85, 0.9, 0.95)
const COLOR_CURRENT = new vec4(0.56, 0.83, 1.0, 1) // #8FD3FF
const COLOR_DONE = new vec4(0.36, 0.89, 0.49, 1) // #5BE37D

@component
export class GhostHandsStepMarkerUI extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("StepMarkerRoot (falls back to this SceneObject)")
  stepMarkerRoot: SceneObject

  private host: SceneObject | null = null
  private dots: RoundedRectangle[] = []
  private labelText: Text | null = null
  private built = false

  // Requested state (applied immediately when built, and once at end of build).
  private visible = false
  private states: string[] = ["current", "pending", "pending", "pending"]
  private label = "Make the hole"

  onAwake(): void {
    this.build()
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  public setVisible(visible: boolean): void {
    this.visible = !!visible
    this.applyVisible()
  }

  public setDotStates(states: string[]): void {
    const next: string[] = []
    for (let i = 0; i < DOT_COUNT; i++) {
      next.push(GhostHandsStepMarkerUI.normalize(states ? states[i] : undefined))
    }
    this.states = next
    this.applyDots()
  }

  public setLabel(text: string): void {
    this.label = text === undefined || text === null ? "" : String(text)
    this.applyLabel()
  }

  /** Live label text size and the label string (for tests). */
  public getLabelTextSize(): number {
    return this.labelText && !isNull(this.labelText) ? this.labelText.size : 0
  }

  public getDotStates(): string[] {
    return this.states.slice()
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  private build(): void {
    const root = this.stepMarkerRoot && !isNull(this.stepMarkerRoot) ? this.stepMarkerRoot : this.sceneObject
    if (!root || isNull(root)) {
      print("[GhostHandsStepMarkerUI] root StepMarkerRoot not found")
      return
    }

    const host = obj(root, "StepMarkerHost")
    this.host = host
    new CanvasController(host).ensure(new vec2(PANEL_W, PANEL_H))

    const column = flexColumn(host, PANEL_W, PANEL_H, {
      gap: 0.4,
      justify: FlexJustify.Center,
      align: FlexAlign.Center
    })

    const rowW = DOT_COUNT * DOT_SIZE + (DOT_COUNT - 1) * DOT_GAP
    const row = flexRow(column, rowW, DOT_SIZE, {
      gap: DOT_GAP,
      justify: FlexJustify.Center,
      align: FlexAlign.Center
    })

    this.dots = []
    for (let i = 0; i < DOT_COUNT; i++) {
      flexChild(row, {w: DOT_SIZE, h: DOT_SIZE}, (cell) => {
        cell.name = "Dot" + i
        const rr = makeCardRect(cell, DOT_SIZE, DOT_SIZE, {
          cornerRadius: DOT_SIZE / 2,
          color: COLOR_PENDING
        })
        this.dots.push(rr)
      })
    }

    const t = dynamicText(column, this.label, LABEL_ROLE, PANEL_W, LABEL_H, COLOR_TEXT)
    applyTextRole(t, LABEL_ROLE, VIEW_DISTANCE_CM)
    this.labelText = t

    this.built = true
    this.applyDots()
    this.applyLabel()
    this.applyVisible()
    print("[GhostHandsStepMarkerUI] built")
  }

  // ─── Apply ───────────────────────────────────────────────────────────────

  private applyVisible(): void {
    if (!this.built || !this.host || isNull(this.host)) return
    this.host.enabled = this.visible
  }

  private applyDots(): void {
    if (!this.built) return
    for (let i = 0; i < this.dots.length; i++) {
      tintRoundedRect(this.dots[i], GhostHandsStepMarkerUI.colorFor(this.states[i]))
    }
  }

  private applyLabel(): void {
    if (!this.built || !this.labelText || isNull(this.labelText)) return
    this.labelText.text = this.label
  }

  private static normalize(s: string | undefined): string {
    return s === "current" || s === "done" ? s : "pending"
  }

  private static colorFor(state: string): vec4 {
    if (state === "current") return COLOR_CURRENT
    if (state === "done") return COLOR_DONE
    return COLOR_PENDING
  }
}
