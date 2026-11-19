// After Tighten the rope settles into a recognisable bowline: a fixed loop (>= 6 cm wide,
// >= 8 cm deep) hanging from a tight collar, with the tail end lying INSIDE the fixed loop.
// Steps 1-4 use debug hooks (covered for real by GH6); Tighten is a real pinch.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FINISHED_KNOT_SHAPE, FIXED_LOOP_RANGE, KNOT_CENTER, finishedKnotFacts, insideXZ, nearestOnPolyline} from "../Scripts/GhostHandsKnotData"
import {fmt, getMain, log, mustPoll, pinchButton, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

@component
export class GH8FinishedKnotScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    for (let step = 1; step <= 4; step++) {
      await mustPoll(() => main.getCurrentStep() === step && (main.getPhase() === "demo" || main.getPhase() === "userTurn"), 3000, `step ${step} start`)
      if (main.getPhase() === "demo") main.debugSkipDemo()
      await mustPoll(() => main.getPhase() === "userTurn", 1000, `step ${step} user turn`)
      main.debugDragTip(1, 0)
      await mustPoll(() => main.getPhase() === "stepDone" || main.getPhase() === "tightenReady", 1000, `step ${step} done`)
      await mustPoll(() => main.getPhase() !== "stepDone", 2000, `advance after step ${step}`)
    }
    await mustPoll(() => main.getPhase() === "tightenReady", 1000, "tighten ready")

    await pinchButton("TightenButtonRootButton")
    await mustPoll(() => main.getPhase() === "tightening", 1500, "tightening")
    // Both ghost hands demonstrate the pull: right holds loop + tail, left pulls the standing part.
    await mustPoll(() => main.ghost.isLeftHandShown(), 1000, "left ghost hand shown during Tighten")
    expect(main.ghost.usesRiggedHands()).toBe(true)
    // ...and the left hand really pulls ON the rope: its pinch stays on the standing part
    // every frame while the rope is drawn tight.
    const ropeInv = main.rope.getSceneObject().getTransform().getInvertedWorldTransform()
    let maxGripGap = 0
    let gripFrames = 0
    const grip = this.createEvent("UpdateEvent")
    grip.bind(() => {
      if (main.getPhase() !== "tightening" || !main.ghost.isLeftHandShown()) return
      const cps = main.rope.getControlPoints()
      if (cps.length < 2) return
      const local = ropeInv.multiplyPoint(main.ghost.getLeftRig().pinchPoint())
      maxGripGap = Math.max(maxGripGap, nearestOnPolyline(cps, local, false).distance)
      gripFrames++
    })
    await mustPoll(() => main.getPhase() === "finished", 4000, "finished")
    grip.enabled = false
    log(`Tighten: left-hand grip sampled ${gripFrames} frames, max gap to rope ${maxGripGap.toFixed(2)} cm`)
    expect(gripFrames).toBeGreaterThan(10)
    expect(maxGripGap).toBeLessThan(1.5)
    await sleep(200)

    const pts = main.rope.getControlPoints()
    let maxDev = 0
    if (pts.length === FINISHED_KNOT_SHAPE.length) {
      for (let i = 0; i < pts.length; i++) maxDev = Math.max(maxDev, pts[i].distance(FINISHED_KNOT_SHAPE[i]))
    }
    const facts = finishedKnotFacts()
    const [a, b] = FIXED_LOOP_RANGE
    const loop = pts.slice(a, b + 1)
    const tail = pts[pts.length - 1]
    const standingStart = pts[0]
    log(`finished rope: ${pts.length} pts (shape ${FINISHED_KNOT_SHAPE.length}), maxDev ${maxDev.toFixed(3)} cm, loop ${facts.loopWidthCm.toFixed(1)} x ${facts.loopDepthCm.toFixed(1)} cm, tailInside ${facts.tailInsideLoop}`)
    expect(pts.length).toBe(FINISHED_KNOT_SHAPE.length)
    expect(maxDev).toBeLessThan(0.01) // the rope shows exactly the dressed bowline
    expect(facts.loopWidthCm).toBeGreaterThan(6)
    expect(facts.loopDepthCm).toBeGreaterThan(8)
    expect(insideXZ(tail, loop)).toBe(true) // tail end lies inside the fixed loop
    expect(insideXZ(standingStart, loop)).toBe(false) // standing part leads away, outside

    // Bowline geometry: the standing part leaves the collar on the side AWAY from the fixed loop
    // (roughly in line with it, as a loaded bowline lies), not alongside it.
    let lx = 0, lz = 0
    for (const p of loop) { lx += p.x; lz += p.z }
    lx /= loop.length; lz /= loop.length
    const toLoop = new vec3(lx - KNOT_CENTER.x, 0, lz - KNOT_CENTER.z).normalize()
    const toStanding = new vec3(standingStart.x - KNOT_CENTER.x, 0, standingStart.z - KNOT_CENTER.z).normalize()
    log(`standing part vs loop direction from collar: dot ${toStanding.dot(toLoop).toFixed(2)}`)
    expect(toStanding.dot(toLoop)).toBeLessThan(-0.4)

    // The check badge must not cover the collar from the user's eyes: where the eye->collar
    // sight line passes the badge's depth, it must be clearly below the badge.
    expect(main.isFinishedBadgeVisible()).toBe(true)
    const eye = findSceneObjectByName("Camera Object").getTransform().getWorldPosition()
    const collar = ropeWorld(KNOT_CENTER)
    const badge = findSceneObjectByName("FinishedBadgeRoot").getTransform().getWorldPosition()
    const k = (badge.z - eye.z) / (collar.z - eye.z)
    const sightY = eye.y + (collar.y - eye.y) * k
    log(`badge ${fmt(badge)} collar ${fmt(collar)}: sight line at badge depth y ${sightY.toFixed(1)} (badge y ${badge.y.toFixed(1)})`)
    expect(badge.y - sightY).toBeGreaterThan(4) // > badge half-height + margin: collar stays visible
    expect(main.isRopeVisible()).toBe(true)
  }
}
