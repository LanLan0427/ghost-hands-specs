// After Tighten the rope settles into a recognisable bowline: a fixed loop (>= 6 cm wide,
// >= 8 cm deep) hanging from a tight collar, with the tail end lying INSIDE the fixed loop.
// Steps 1-4 use debug hooks (covered for real by GH6); Tighten is a real pinch.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FINISHED_KNOT_SHAPE, FIXED_LOOP_RANGE, finishedKnotFacts, insideXZ} from "../Scripts/GhostHandsKnotData"
import {getMain, log, mustPoll, pinchButton, pinchStartCard} from "./GhostHandsLeafHelpers"

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
    await mustPoll(() => main.getPhase() === "finished", 4000, "finished")
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
    expect(main.isFinishedBadgeVisible()).toBe(true)
    expect(main.isRopeVisible()).toBe(true)
  }
}
