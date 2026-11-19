// GhostHandsControlsUI.ts — lesson control buttons (Replay / Slower / Tighten / Again).
//
// Passive view: renders the mode / dim / toggle state pushed by the controller and
// reports user intent through events. Holds no domain state.
//
// Four authored roots (flat on the table, local +Z up). Under each root ONE child
// host "<Root>Host" (Canvas 12x6) holds one UIKit Button 12 x 6 cm with a companion
// ElementContent label + leading icon. Hidden via host.enabled — never the root,
// never `inactive`, never scale.

import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {Button, ElementContent, UI_THEME, addButtonLabel, fitElementCollider, obj, roleSize} from "./UIKitHelpers"

export type ControlsMode = "hidden" | "steps" | "tighten" | "again"
export type ControlName = "replay" | "slower" | "tighten" | "again"

const BUTTON_W = 12
const BUTTON_H = 6
const ICON_SIZE_CM = 2.2
const DIM_OPACITY = 0.7
const ORDER: ControlName[] = ["replay", "slower", "tighten", "again"]

interface ControlSlot {
  name: ControlName
  rootName: string
  label: string
  host?: SceneObject
  button?: Button
  content?: ElementContent
}

@component
export class GhostHandsControlsUI extends BaseScriptComponent {
  @input
  @allowUndefined
  replayRoot: SceneObject

  @input
  @allowUndefined
  slowerRoot: SceneObject

  @input
  @allowUndefined
  tightenRoot: SceneObject

  @input
  @allowUndefined
  againRoot: SceneObject

  @input
  @allowUndefined
  replayIcon: Texture

  @input
  @allowUndefined
  slowerIcon: Texture

  @input
  @allowUndefined
  tightenIcon: Texture

  @input
  @allowUndefined
  againIcon: Texture

  // ─── Events (field initializers so subscribers can bind at any time) ───
  private onReplayEvent = new Event<void>()
  public readonly onReplay: PublicApi<void> = this.onReplayEvent.publicApi()

  private onSlowerToggleEvent = new Event<boolean>()
  public readonly onSlowerToggle: PublicApi<boolean> = this.onSlowerToggleEvent.publicApi()

  private onTightenEvent = new Event<void>()
  public readonly onTighten: PublicApi<void> = this.onTightenEvent.publicApi()

  private onAgainEvent = new Event<void>()
  public readonly onAgain: PublicApi<void> = this.onAgainEvent.publicApi()

  // ─── Pushed view state ───
  private mode: ControlsMode = "hidden"
  private dimmed: boolean = false
  private slowerOn: boolean = false
  private suppressSlowerEvent: boolean = false
  private built: boolean = false

  private slots: Record<ControlName, ControlSlot> = {
    replay: {name: "replay", rootName: "ReplayButtonRoot", label: "Replay step"},
    slower: {name: "slower", rootName: "SlowerButtonRoot", label: "Slower"},
    tighten: {name: "tighten", rootName: "TightenButtonRoot", label: "Tighten"},
    again: {name: "again", rootName: "AgainButtonRoot", label: "Again"}
  }

  onAwake(): void {
    this.build()
  }

  // ─── Public API ───

  public setMode(mode: ControlsMode): void {
    if (mode !== "hidden" && mode !== "steps" && mode !== "tighten" && mode !== "again") {
      print("[GhostHandsControlsUI] unknown mode " + mode)
      return
    }
    this.mode = mode
    this.applyMode()
  }

  public setStepButtonsDimmed(dimmed: boolean): void {
    this.dimmed = !!dimmed
    this.applyDim()
  }

  public setSlowerToggled(on: boolean): void {
    this.slowerOn = !!on
    this.applySlowerVisual()
  }

  public getVisibleButtons(): string[] {
    const out: string[] = []
    for (const name of ORDER) {
      const host = this.slots[name].host
      if (host && !isNull(host) && host.enabled) out.push(name)
    }
    return out
  }

  public pressForTest(name: ControlName): void {
    switch (name) {
      case "replay":
        this.handleReplay()
        break
      case "tighten":
        this.handleTighten()
        break
      case "again":
        this.handleAgain()
        break
      case "slower": {
        const btn = this.slots.slower.button
        if (btn && !isNull(btn) && btn.initialized) {
          // Unsuppressed: routes through onValueChange exactly like a real pinch.
          btn.isOn = !this.slowerOn
        } else {
          this.handleSlowerValue(this.slowerOn ? 0 : 1)
        }
        break
      }
      default:
        print("[GhostHandsControlsUI] pressForTest: unknown button " + name)
    }
  }

  // ─── Intent handlers (shared by real pinch and pressForTest) ───

  private handleReplay(): void {
    this.onReplayEvent.invoke()
  }

  private handleTighten(): void {
    this.onTightenEvent.invoke()
  }

  private handleAgain(): void {
    this.onAgainEvent.invoke()
  }

  private handleSlowerValue(v: number): void {
    if (this.suppressSlowerEvent) return
    this.slowerOn = v === 1
    this.onSlowerToggleEvent.invoke(this.slowerOn)
  }

  // ─── Build ───

  private build(): void {
    const roots: Record<ControlName, SceneObject | undefined> = {
      replay: this.resolveRoot(this.replayRoot, this.slots.replay.rootName),
      slower: this.resolveRoot(this.slowerRoot, this.slots.slower.rootName),
      tighten: this.resolveRoot(this.tightenRoot, this.slots.tighten.rootName),
      again: this.resolveRoot(this.againRoot, this.slots.again.rootName)
    }
    const icons: Record<ControlName, Texture | undefined> = {
      replay: this.resolveIcon(this.replayIcon, "replay"),
      slower: this.resolveIcon(this.slowerIcon, "slow_motion_video"),
      tighten: this.resolveIcon(this.tightenIcon, "compress"),
      again: this.resolveIcon(this.againIcon, "restart_alt")
    }

    for (const name of ORDER) {
      const root = roots[name]
      if (!root) continue
      this.buildSlot(this.slots[name], root, icons[name])
    }

    this.built = true
    this.applyMode()
    this.applyDim()
    this.applySlowerVisual()
    print("[GhostHandsControlsUI] built")
  }

  private buildSlot(slot: ControlSlot, root: SceneObject, icon: Texture | undefined): void {
    const host = obj(root, slot.rootName + "Host")
    new CanvasController(host).ensure(new vec2(BUTTON_W, BUTTON_H))
    slot.host = host

    const btnObj = obj(host, slot.rootName + "Button")
    const btn = btnObj.createComponent(Button.getTypeName()) as Button
    // Pre-init variant — must precede size and every init-dependent write.
    btn.setVariant({theme: UI_THEME, shape: "Rectangle", style: "Primary"})
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    fitElementCollider(btn, BUTTON_W, BUTTON_H)
    if (slot.name === "slower") {
      btn.setIsToggleable(true)
    }
    btn.onInitialized.add(() => {
      btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
      fitElementCollider(btn, BUTTON_W, BUTTON_H)
      this.applyDim()
      if (slot.name === "slower") this.applySlowerVisual()
    })

    // Companion label: sibling ElementContent on the Button's own SceneObject.
    const content = addButtonLabel(btnObj, slot.label, "Button", {
      align: "center",
      leadingIcon: icon,
      iconSizeCM: icon ? ICON_SIZE_CM : undefined
    })
    content.textSize = roleSize("Button", 120)
    slot.content = content
    slot.button = btn

    btn.initialize()

    // Wire right after initialize().
    switch (slot.name) {
      case "replay":
        btn.onTriggerUp.add(() => this.handleReplay())
        break
      case "tighten":
        btn.onTriggerUp.add(() => this.handleTighten())
        break
      case "again":
        btn.onTriggerUp.add(() => this.handleAgain())
        break
      case "slower":
        btn.onValueChange.add((v: number) => this.handleSlowerValue(v))
        break
    }
  }

  // ─── Apply pushed state ───

  private applyMode(): void {
    if (!this.built) return
    const show: Record<ControlName, boolean> = {
      replay: this.mode === "steps",
      slower: this.mode === "steps",
      tighten: this.mode === "tighten",
      again: this.mode === "again"
    }
    for (const name of ORDER) {
      const host = this.slots[name].host
      if (host && !isNull(host)) host.enabled = show[name]
    }
    // Dimming must survive mode switches — re-assert after re-enabling hosts.
    this.applyDim()
  }

  private applyDim(): void {
    if (!this.built) return
    const opacity = this.dimmed ? DIM_OPACITY : 1
    for (const name of ["replay", "slower"] as ControlName[]) {
      const slot = this.slots[name]
      if (slot.button && !isNull(slot.button) && slot.button.initialized) {
        slot.button.opacity = opacity
      }
      if (slot.content && !isNull(slot.content)) {
        slot.content.opacity = opacity
      }
    }
  }

  private applySlowerVisual(): void {
    const btn = this.slots.slower.button
    if (!btn || isNull(btn) || !btn.initialized) return // re-applied in onInitialized / end of build
    if (btn.isOn === this.slowerOn) return
    this.suppressSlowerEvent = true
    try {
      btn.isOn = this.slowerOn
    } finally {
      this.suppressSlowerEvent = false
    }
  }

  // ─── Resolution ───

  private resolveRoot(input: SceneObject | undefined, name: string): SceneObject | undefined {
    if (input && !isNull(input)) return input
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const found = this.findByName(global.scene.getRootObject(i), name)
      if (found) return found
    }
    print("[GhostHandsControlsUI] root " + name + " not found")
    return undefined
  }

  private findByName(node: SceneObject, name: string): SceneObject | undefined {
    if (!node || isNull(node)) return undefined
    if (node.name === name) return node
    const n = node.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const found = this.findByName(node.getChild(i), name)
      if (found) return found
    }
    return undefined
  }

  private resolveIcon(input: Texture | undefined, file: string): Texture | undefined {
    if (input && !isNull(input)) return input
    let tex: Texture | undefined
    try {
      switch (file) {
        case "replay":
          tex = requireAsset("../Icons/replay.png") as Texture
          break
        case "slow_motion_video":
          tex = requireAsset("../Icons/slow_motion_video.png") as Texture
          break
        case "compress":
          tex = requireAsset("../Icons/compress.png") as Texture
          break
        case "restart_alt":
          tex = requireAsset("../Icons/restart_alt.png") as Texture
          break
      }
    } catch (e) {
      tex = undefined
    }
    if (!tex) print("[GhostHandsControlsUI] icon " + file + " unavailable — text-only face")
    return tex
  }
}
