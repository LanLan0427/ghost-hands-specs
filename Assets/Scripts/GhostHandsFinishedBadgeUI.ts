// GhostHandsFinishedBadgeUI.ts — passive "Bowline done!" success badge.
// Renders what is pushed (showBadge/hideBadge); holds no domain state, emits no events.
// Built in the root's LOCAL XY plane (+Z toward the viewer); the root's pose is authored in the scene.

import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {
  addColumnText,
  applyTextRole,
  contentHost,
  dynamicText,
  ElementContent,
  FlexAlign,
  FlexJustify,
  flexColumn,
  makeCardRect,
  obj,
  roleSize
} from "./UIKitHelpers"

const BADGE_W = 12
const BADGE_H = 5
const CONTENT_W = 11
const CONTENT_H = 4.4
const LINE1_H = 2.2
const LINE2_H = 1.6
const VIEW_DISTANCE_CM = 80

const WHITE = new vec4(1, 1, 1, 1)
const SOFT_GREEN = new vec4(0.36, 0.89, 0.49, 0.45)

@component
export class GhostHandsFinishedBadgeUI extends BaseScriptComponent {
  @input
  @allowUndefined
  badgeRoot: SceneObject

  @input
  @allowUndefined
  checkIcon: Texture

  @input
  doneText: string = "Bowline done!"

  private host: SceneObject | null = null
  private headline: ElementContent | null = null
  private roundLabel: Text | null = null
  private built = false

  // Requested state (applied immediately if built, and once at the end of the build).
  private shown = false
  private roundText = "Round 1 of 3"

  onAwake(): void {
    this.build()
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  public showBadge(roundText: string): void {
    if (roundText !== undefined && roundText !== null) this.roundText = roundText
    this.shown = true
    this.apply()
  }

  public hideBadge(): void {
    this.shown = false
    this.apply()
  }

  public isShown(): boolean {
    return this.shown
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  private build(): void {
    const root = this.badgeRoot && !isNull(this.badgeRoot) ? this.badgeRoot : this.sceneObject
    if (!root || isNull(root)) {
      print("[GhostHandsFinishedBadgeUI] root FinishedBadgeRoot not found")
      return
    }

    let icon: Texture | undefined = this.checkIcon && !isNull(this.checkIcon) ? this.checkIcon : undefined
    if (!icon) {
      try {
        icon = requireAsset("../Icons/check_circle.png") as Texture
      } catch (e) {
        icon = undefined
      }
    }

    const host = obj(root, "FinishedBadgeHost")
    this.host = host
    new CanvasController(host).ensure(new vec2(BADGE_W, BADGE_H))

    // Backing pill (light green — nothing dark on the additive display).
    makeCardRect(host, BADGE_W, BADGE_H, {cornerRadius: BADGE_H / 2, color: SOFT_GREEN})

    // Content layer one absolute +Z above the pill.
    const content = contentHost(host, "BadgeContent")
    const col = flexColumn(content, CONTENT_W, CONTENT_H, {
      gap: 0.3,
      justify: FlexJustify.Center,
      align: FlexAlign.Center
    })

    const doneLabel = this.doneText && this.doneText.length > 0 ? this.doneText : "Bowline done!"
    const headline = addColumnText(col, doneLabel, "Headline1", CONTENT_W, LINE1_H, "center", icon)
    headline.textSize = roleSize("Headline1", VIEW_DISTANCE_CM)
    headline.useTextColorOverride = true
    headline.textColorOverride = WHITE
    if (icon) headline.leadingIconSize = 1.6
    this.headline = headline

    const round = dynamicText(col, this.roundText, "Body", CONTENT_W, LINE2_H, WHITE)
    applyTextRole(round, "Body", VIEW_DISTANCE_CM)
    this.roundLabel = round

    this.built = true
    this.apply()
    print("[GhostHandsFinishedBadgeUI] built")
  }

  private apply(): void {
    if (!this.built) return
    if (this.roundLabel && !isNull(this.roundLabel)) this.roundLabel.text = this.roundText
    if (this.host && !isNull(this.host)) this.host.enabled = this.shown
  }
}
