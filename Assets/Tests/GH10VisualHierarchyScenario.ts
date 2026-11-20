// Visual hierarchy + layout from the user's eyes:
//  - the ghost hands are almost invisible inside (faint fill) and read as a glowing outline +
//    glowing fingertips, so the loop and ghost rope under them stay visible;
//  - the ghost rope tip is brighter than any part of the hands (the eye follows the rope);
//  - every control button lies completely inside the view while the user looks at the loop,
//    about 8 cm right of it, and clear of the rope tip where step 1 starts;
//  - the step label is one type size bigger (Headline1 instead of Headline2).
// Start card and Replay are real pinches; the rest reads live material / transform state.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ROPE_LOOP_SHAPE, stepPath} from "../Scripts/GhostHandsKnotData"
import {BUTTON_H, BUTTON_W} from "../Scripts/GhostHandsControlsUI"
import {LABEL_ROLE, LABEL_VIEW_DISTANCE_CM} from "../Scripts/GhostHandsStepMarkerUI"
import {roleSize} from "../Scripts/UIKitHelpers"
import {fmt, getMain, log, mustPoll, pinchButton, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

const BUTTON_ROOTS = ["ReplayButtonRoot", "SlowerButtonRoot", "TightenButtonRoot", "AgainButtonRoot"]

/** Largest |x| or |y| of the button's corners in normalised view coords (1 = frame edge). */
function frameFit(eye: vec3, lookAt: vec3, fovY: number, aspect: number, corners: vec3[]): number {
  const f = lookAt.sub(eye).normalize()
  const r = f.cross(vec3.up()).normalize()
  const u = r.cross(f)
  const tv = Math.tan(fovY / 2)
  let worst = 0
  for (const c of corners) {
    const p = c.sub(eye)
    const z = p.dot(f)
    if (z <= 0) return 99
    worst = Math.max(worst, Math.abs(p.dot(r) / z) / (tv * aspect), Math.abs(p.dot(u) / z) / tv)
  }
  return worst
}

@component
export class GH10VisualHierarchyScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    const ghost = main.ghost
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "userTurn" && ghost.isHolding(), 12000, "step 1 ghost holding end pose")

    // ---- 1. Hands = faint outline + fingertips; the ghost rope tip is the brightest element.
    const checkHierarchy = (what: string) => {
      const v = ghost.getVisualHierarchy()
      log(`${what}: hand fill opacity ${v.handBodyOpacity.toFixed(3)}, outline brightness ${v.handOutlineBrightness.toFixed(2)}, fingertips ${v.fingertipBrightness.toFixed(2)}, ghost rope tip ${v.tipBrightness.toFixed(2)} (glow shown ${v.tipGlowShown})`)
      expect(v.handBodyOpacity).toBeLessThan(0.05) // fill almost invisible
      expect(v.handOutlineBrightness).toBeGreaterThan(0.15) // the outline still glows
      expect(v.fingertipBrightness).toBeGreaterThan(0.15) // ...and the fingertips
      expect(v.tipBrightness).toBeGreaterThan(v.handOutlineBrightness * 1.5)
      expect(v.tipBrightness).toBeGreaterThan(v.fingertipBrightness * 1.2)
      expect(v.tipGlowShown).toBe(true)
    }
    checkHierarchy("step 1 hold")
    const rig = ghost.getRightRig()
    const tips = rig.fingertipGlowPositions()
    const pinch = rig.pinchPoint()
    let nearPinch = 0
    for (const p of tips) if (p.distance(pinch) < 1.5) nearPinch++
    log(`right fingertip glows: ${tips.length}, ${nearPinch} at the pinch point ${fmt(pinch)}`)
    expect(tips.length).toBe(5)
    expect(nearPinch).toBeGreaterThan(1) // thumb + index tips glow on the pinch

    // During a replay (hand moving) the tip still out-shines the hands.
    await pinchButton("ReplayButtonRootButton")
    await mustPoll(() => ghost.isPlaying(), 1500, "replay playing")
    await sleep(1200)
    checkHierarchy("replay mid-move")

    // ---- 2. Buttons inside the view while looking at the loop, ~8 cm right of it.
    const camObj = findSceneObjectByName("Camera Object")
    const cam = camObj.getComponent("Component.Camera") as Camera
    // The lesson is laid out for the user's eyes at the Camera's authored pose (origin, seated at
    // the table). The live preview camera may have been moved around, so measure from the design
    // eye, plus 4 cm head sway to either side.
    const liveEye = camObj.getTransform().getWorldPosition()
    const eyes = [vec3.zero(), new vec3(-4, 0, 0), new vec3(4, 0, 0)]
    const loopCenter = ropeWorld(new vec3(0, 0, -1))
    let loopRightX = -999
    for (const p of ROPE_LOOP_SHAPE.slice(4, 10)) loopRightX = Math.max(loopRightX, ropeWorld(p).x)
    const tailStart = ropeWorld(stepPath(1)[0])
    log(`camera fov ${(cam.fov * 180 / Math.PI).toFixed(1)} deg, aspect ${cam.aspect.toFixed(3)}, live preview eye ${fmt(liveEye)}; loop centre ${fmt(loopCenter)}, loop right edge x ${loopRightX.toFixed(1)}`)
    for (const rootName of BUTTON_ROOTS) {
      const btn = findSceneObjectByName(rootName + "Button")
      if (!btn) throw new Error(rootName + "Button not found")
      const t = btn.getTransform()
      const c = t.getWorldPosition()
      const rx = t.right.uniformScale(BUTTON_W / 2)
      const uy = t.up.uniformScale(BUTTON_H / 2)
      const corners = [c.add(rx).add(uy), c.add(rx).sub(uy), c.sub(rx).add(uy), c.sub(rx).sub(uy)]
      let fit = 0
      for (const e of eyes) fit = Math.max(fit, frameFit(e, loopCenter, cam.fov, cam.aspect, corners))
      let innerX = 999
      for (const k of corners) innerX = Math.min(innerX, k.x)
      const gap = innerX - loopRightX
      // Distance from the step-1 tail start (where the user first pinches the rope) to the button.
      const dx = Math.max(0, Math.abs(tailStart.x - c.x) - BUTTON_W / 2)
      const dz = Math.max(0, Math.abs(tailStart.z - c.z) - BUTTON_H / 2)
      const clear = Math.sqrt(dx * dx + dz * dz)
      log(`${rootName}: centre ${fmt(c)}, frame fit ${fit.toFixed(2)} (1 = view edge, worst of eye at origin / 4 cm sway), ${gap.toFixed(1)} cm right of the loop, ${clear.toFixed(1)} cm clear of the step-1 tip`)
      expect(fit).toBeLessThan(0.97) // the whole button inside the view, with a small margin
      expect(gap).toBeGreaterThan(6)
      expect(gap).toBeLessThan(10)
      expect(clear).toBeGreaterThan(0.8) // never on top of the rope tip glow
      expect(c.z).toBeGreaterThan(-47) // pulled toward the user (was up to -49)
    }

    // ---- 3. Step label one size bigger.
    const size = main.stepMarker.getLabelTextSize()
    const want = roleSize(LABEL_ROLE, LABEL_VIEW_DISTANCE_CM)
    const before = roleSize("Headline2", LABEL_VIEW_DISTANCE_CM)
    log(`step label size ${size.toFixed(1)} (role ${LABEL_ROLE} ${want.toFixed(1)}, was Headline2 ${before.toFixed(1)})`)
    expect(Math.abs(size - want)).toBeLessThan(0.01)
    expect(size).toBeGreaterThan(before)
  }
}
