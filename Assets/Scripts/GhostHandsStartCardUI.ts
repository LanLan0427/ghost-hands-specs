// GhostHandsStartCardUI.ts — passive start card for Ghost Hands.
//
// Renders a pinchable 26 x 14 cm light-blue card (UIKit Button, System3 /
// Rectangle / Primary) with a title, a wrapped subtitle and a "Pinch to begin"
// prompt. A pinch anywhere on the card hides it and emits onStart once per show.
// Holds no domain state: the controller pushes texts and show/hide requests.

import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {
  Button,
  ElementContent,
  FlexAlign,
  FlexJustify,
  TextRole,
  UI_THEME,
  addColumnText,
  contentHost,
  fitElementCollider,
  flexColumn,
  obj,
  roleSize
} from "./UIKitHelpers"

const CARD_W = 26
const CARD_H = 14
const COLUMN_W = 24
const COLUMN_H = 12
const TEXT_W = 23
const VIEW_DISTANCE_CM = 80
const TEXT_WHITE = new vec4(1, 1, 1, 1)

@component
export class GhostHandsStartCardUI extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("StartCardRoot (falls back to this SceneObject)")
  startCardRoot: SceneObject

  @input
  @allowUndefined
  playIcon: Texture

  @input
  titleText: string = "Bowline"

  @input
  subtitleText: string = "The rabbit comes out of the hole, around the tree, and back down the hole."

  @input
  promptText: string = "Pinch to begin"

  private onStartEvent = new Event<void>()
  public readonly onStart: PublicApi<void> = this.onStartEvent.publicApi()

  private root: SceneObject | null = null
  private host: SceneObject | null = null
  private button: Button | null = null
  private titleEc: ElementContent | null = null
  private subtitleEc: ElementContent | null = null
  private promptEc: ElementContent | null = null
  private built = false

  // Requested state (passive view: applied whenever built).
  private shown = true
  private title = ""
  private subtitle = ""
  private prompt = ""
  private textsPushed = false

  onAwake(): void {
    if (!this.textsPushed) {
      this.title = this.titleText ?? "Bowline"
      this.subtitle = this.subtitleText ?? ""
      this.prompt = this.promptText ?? "Pinch to begin"
    }
    this.build()
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  public showStartCard(): void {
    this.shown = true
    this.applyVisibility()
  }

  public hideStartCard(): void {
    this.shown = false
    this.applyVisibility()
  }

  public isShown(): boolean {
    return this.shown
  }

  public setTexts(title: string, subtitle: string, prompt: string): void {
    this.title = title ?? ""
    this.subtitle = subtitle ?? ""
    this.prompt = prompt ?? ""
    this.textsPushed = true
    this.applyTexts()
  }

  /** Same code path as a real pinch on the card. */
  public pressForTest(): void {
    this.handlePress()
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private handlePress(): void {
    if (!this.shown) return // ignore repeat presses while hidden
    this.shown = false
    this.applyVisibility()
    this.onStartEvent.invoke()
  }

  private applyVisibility(): void {
    if (!this.built || !this.host || isNull(this.host)) return
    this.host.enabled = this.shown
  }

  private applyTexts(): void {
    if (!this.built) return
    if (this.titleEc) this.titleEc.text = this.title
    if (this.subtitleEc) this.subtitleEc.text = this.subtitle
    if (this.promptEc) this.promptEc.text = this.prompt
  }

  private loadPlayIcon(): Texture | undefined {
    if (this.playIcon) return this.playIcon
    let tex: Texture | undefined
    try {
      tex = requireAsset("../Icons/play_arrow.png") as Texture
    } catch (e) {
      tex = undefined
    }
    return tex
  }

  private styleText(ec: ElementContent, role: TextRole): void {
    ec.textSize = roleSize(role, VIEW_DISTANCE_CM)
    ec.useTextColorOverride = true
    ec.textColorOverride = TEXT_WHITE
  }

  private build(): void {
    this.root = this.startCardRoot ? this.startCardRoot : this.sceneObject
    if (!this.root || isNull(this.root)) {
      print("[GhostHandsStartCardUI] root StartCardRoot not found")
      return
    }

    const host = obj(this.root, "StartCardHost")
    this.host = host
    new CanvasController(host).ensure(new vec2(CARD_W, CARD_H))

    // Card face = the pinch target + hover highlight.
    const btnObj = obj(host, "CardButton")
    const btn = btnObj.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: UI_THEME, shape: "Rectangle", style: "Primary"})
    btn.size = new vec3(CARD_W, CARD_H, 1)
    fitElementCollider(btn, CARD_W, CARD_H)
    btn.onInitialized.add(() => {
      btn.size = new vec3(CARD_W, CARD_H, 1)
      fitElementCollider(btn, CARD_W, CARD_H)
    })
    btn.initialize()
    btn.onTriggerUp.add(() => this.handlePress())
    this.button = btn

    // Content layer above the face (created after it so the Canvas paints it on top).
    const content = contentHost(host, "CardContent")
    const column = flexColumn(content, COLUMN_W, COLUMN_H, {
      gap: 0.6,
      justify: FlexJustify.Center,
      align: FlexAlign.Center
    })

    this.titleEc = addColumnText(column, this.title, "Title2", TEXT_W, 2.6, "center")
    this.styleText(this.titleEc, "Title2")

    this.subtitleEc = addColumnText(column, this.subtitle, "Body", TEXT_W, 3.0, "center")
    this.subtitleEc.wrapText = true
    this.styleText(this.subtitleEc, "Body")

    const icon = this.loadPlayIcon()
    this.promptEc = addColumnText(column, this.prompt, "Callout", TEXT_W, 2.0, "center", icon)
    this.styleText(this.promptEc, "Callout")

    this.built = true
    this.applyTexts()
    this.applyVisibility()
    print("[GhostHandsStartCardUI] built")
  }
}
