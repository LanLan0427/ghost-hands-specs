// GhostHandsLeafHelpers.ts - shared helpers for the Ghost Hands LEAF scenarios (test-only).
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {GhostHandsMain} from "../Scripts/GhostHandsMain"
import {stepPath, cumulativeLengths, tangentAtProgress, pointAtProgress} from "../Scripts/GhostHandsKnotData"

export function log(msg: string): void {
  print("[GhostHandsLEAF] " + msg)
}

export function getMain(): GhostHandsMain {
  const root = findSceneObjectByName("LessonRoot")
  if (!root) throw new Error("LessonRoot not found")
  const main = root.getComponent(GhostHandsMain.getTypeName()) as GhostHandsMain
  if (!main) throw new Error("GhostHandsMain not found on LessonRoot")
  return main
}

/** Poll every frame until pred() is true. Returns elapsed ms, or -1 on timeout. */
export async function pollUntil(pred: () => boolean, timeoutMs: number): Promise<number> {
  const t0 = getTime()
  while ((getTime() - t0) * 1000 < timeoutMs) {
    if (pred()) return (getTime() - t0) * 1000
    await nextFrame()
  }
  return pred() ? (getTime() - t0) * 1000 : -1
}

export async function mustPoll(pred: () => boolean, timeoutMs: number, what: string): Promise<number> {
  const ms = await pollUntil(pred, timeoutMs)
  if (ms < 0) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}`)
  return ms
}

export function ropeWorld(local: vec3): vec3 {
  const rope = findSceneObjectByName("Rope")
  if (!rope) throw new Error("Rope not found")
  return rope.getTransform().getWorldTransform().multiplyPoint(local)
}

export function fmt(v: vec3): string {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`
}

export function planarDist(a: vec3, b: vec3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/** Start the lesson with a real InteractionKit pinch (scripted LEAF interactor) on CardButton. */
export async function pinchStartCard(): Promise<void> {
  const card = findInteractableByName("CardButton")
  if (!card) throw new Error("CardButton interactable not found")
  const it = new DefaultLeafInteractor("GH_StartPinch")
  it.eventTimeoutMs = 3000
  await it.trigger(card)
  await sleep(200)
}

/** Real pinch on a control button (UIKit Button -> Interactable). */
export async function pinchButton(name: string): Promise<void> {
  const btn = findInteractableByName(name)
  if (!btn) throw new Error(`${name} interactable not found`)
  if (!btn.getSceneObject().isEnabledInHierarchy) throw new Error(`${name} is not enabled in hierarchy`)
  const it = new DefaultLeafInteractor("GH_Button_" + name)
  it.eventTimeoutMs = 3000
  await it.trigger(btn)
  await sleep(200)
}

function waypointProgress(pts: vec3[]): number[] {
  const cum = cumulativeLengths(pts)
  const total = Math.max(1e-6, cum[cum.length - 1])
  return cum.map((c) => c / total)
}

/**
 * One continuous real pinch-drag on RopeTip (DefaultLeafInteractor -> InteractionKit drag
 * events). The drag vector object is mutated in place every frame by `steer`, so the
 * simulated hand ray follows whatever course steer() chooses. Releases when durationMs
 * elapses. If the Interactable gets disabled mid-drag (step snap) LEAF times out waiting
 * for onTriggerUpdate; that error is swallowed when `endedOk()` is true.
 */
export async function steeredTipDrag(
  owner: BaseScriptComponent,
  steer: (out: vec3) => void,
  durationMs: number,
  endedOk: () => boolean,
): Promise<void> {
  const tipIa = findInteractableByName("RopeTip")
  if (!tipIa) throw new Error("RopeTip interactable not found")
  const vec = new vec3(0, 0, 0)
  const ev = owner.createEvent("UpdateEvent")
  ev.bind(() => steer(vec))
  const it = new DefaultLeafInteractor("GH_TipDrag")
  it.eventTimeoutMs = 1000
  try {
    await it.drag(tipIa, vec, durationMs)
  } catch (e) {
    if (!endedOk()) throw e
  } finally {
    ev.enabled = false
  }
}

/** Steering that walks the tip along step `step`'s path toward its next waypoint.
 *  Returns false (zero vector) once progress >= stopAtProgress. */
export function makePathSteer(step: number, stopAtProgress: number = 2, maxPerFrame: number = 0.35): (out: vec3) => boolean {
  const main = getMain()
  const pts = stepPath(step)
  const wpProg = waypointProgress(pts)
  let frames = 0
  return (out: vec3): boolean => {
    frames++
    const p = main.getTipProgress()
    if (p >= stopAtProgress || main.getPhase() !== "userTurn" || main.getCurrentStep() !== step) {
      out.x = 0; out.y = 0; out.z = 0
      return false
    }
    let idx = wpProg.length - 1
    for (let i = 0; i < wpProg.length; i++) {
      if (wpProg[i] > p + 0.004) { idx = i; break }
    }
    let targetLocal = pts[idx]
    if (stopAtProgress <= 1 && wpProg[idx] > stopAtProgress) targetLocal = pointAtProgress(pts, Math.min(1, stopAtProgress + 0.02))
    const target = ropeWorld(targetLocal)
    const tip = main.getTipWorldPosition()
    let d = new vec3(target.x - tip.x, 0, target.z - tip.z)
    const dist = d.length
    if (dist < 0.05) {
      const tan = tangentAtProgress(pts, Math.min(1, p + 0.01))
      d = new vec3(tan.x, 0, tan.z)
    }
    const s = Math.max(0.03, Math.min(maxPerFrame, dist / 3))
    const n = d.normalize()
    out.x = n.x * s; out.y = 0; out.z = n.z * s
    if (frames % 20 === 0) log(`steer f${frames} t=${getTime().toFixed(2)}: progress ${p.toFixed(3)} wp ${idx} tip ${fmt(tip)} color ${main.getTipColorState()}`)
    return true
  }
}

/** Continuous real drag along the whole step path until it snaps (or stopAtProgress). */
export async function dragTipAlongPath(owner: BaseScriptComponent, step: number, stopAtProgress: number = 2, durationMs: number = 6000): Promise<void> {
  const main = getMain()
  const steer = makePathSteer(step, stopAtProgress)
  await steeredTipDrag(owner, (o) => { steer(o) }, durationMs,
    () => !(main.getPhase() === "userTurn" && main.getCurrentStep() === step))
}
