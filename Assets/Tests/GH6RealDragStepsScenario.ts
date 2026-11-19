// Real drags for every step: steps 1-4 are each completed with one continuous real
// InteractionKit pinch-drag of RopeTip along that step's authored path (paths 2-4 rise up to
// 2 cm off the table and pass under/through the loop). Natural ghost demos, no debug hooks.
// While dragging, every frame is sampled: the tip must stay on the path (never orange / off
// the line by more than the 3 cm threshold), progress must only move forward, and the rope's
// end must follow the tip (the rope bends with the drag instead of the tip moving alone).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {stepPath, nearestOnPolyline} from "../Scripts/GhostHandsKnotData"
import {dragTipAlongPath, fmt, getMain, log, mustPoll, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

interface DragStats {
  frames: number
  warningFrames: number
  maxOffPathCm: number
  maxBackslide: number
  maxRopeEndGapCm: number
  checkpointsPassed: number
}

@component
export class GH6RealDragStepsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()

    const snaps: {[step: number]: {color: string; sfx: string; tip: vec3; dots: string[]}} = {}
    const unsub = main.tip.onStepComplete.add((step: number) => {
      if (snaps[step]) return
      snaps[step] = {
        color: main.getTipColorState(),
        sfx: main.getLastSfx(),
        tip: main.getTipWorldPosition(),
        dots: main.getStepDotStates().slice(),
      }
    })

    for (let step = 1; step <= 4; step++) {
      await mustPoll(() => main.getPhase() === "userTurn" && main.getCurrentStep() === step, 15000, `step ${step} user turn`)
      expect(main.isPathVisible()).toBe(true)
      expect(main.isTipGlowing()).toBe(true)

      // Per-frame sampler for the duration of this step's real drag.
      const pts = stepPath(step)
      const rope = main.rope
      const ropeInv = rope.getSceneObject().getTransform().getInvertedWorldTransform()
      const stats: DragStats = {frames: 0, warningFrames: 0, maxOffPathCm: 0, maxBackslide: 0, maxRopeEndGapCm: 0, checkpointsPassed: 0}
      let bestProgress = main.getTipProgress()
      let lastCheckpoint = main.getLastCheckpointProgress()
      const sampler = this.createEvent("UpdateEvent")
      sampler.bind(() => {
        if (main.getPhase() !== "userTurn" || main.getCurrentStep() !== step) return
        stats.frames++
        if (main.getTipColorState() === "warning") stats.warningFrames++
        const tipLocal = ropeInv.multiplyPoint(main.getTipWorldPosition())
        stats.maxOffPathCm = Math.max(stats.maxOffPathCm, nearestOnPolyline(pts, tipLocal, true).distance)
        const p = main.getTipProgress()
        stats.maxBackslide = Math.max(stats.maxBackslide, bestProgress - p)
        bestProgress = Math.max(bestProgress, p)
        const cp = main.getLastCheckpointProgress()
        if (cp > lastCheckpoint + 1e-4) { stats.checkpointsPassed++; lastCheckpoint = cp }
        const cps = rope.getControlPoints()
        if (cps.length > 0) stats.maxRopeEndGapCm = Math.max(stats.maxRopeEndGapCm, cps[cps.length - 1].distance(tipLocal))
      })

      const t0 = getTime()
      await dragTipAlongPath(this, step, 2, step === 1 ? 12000 : 9000)
      await mustPoll(() => !!snaps[step], 3000, `step ${step} snapped by real drag`)
      sampler.enabled = false

      const s = snaps[step]
      const end = ropeWorld(pts[pts.length - 1])
      log(`step ${step}: snapped after ${(getTime() - t0).toFixed(1)} s over ${stats.frames} frames, color ${s.color}, sfx ${s.sfx}, tip ${fmt(s.tip)} end ${fmt(end)} dots ${s.dots.join(",")}`)
      log(`step ${step} drag: warningFrames ${stats.warningFrames}, maxOffPath ${stats.maxOffPathCm.toFixed(2)} cm, maxBackslide ${stats.maxBackslide.toFixed(3)}, checkpoints passed ${stats.checkpointsPassed}, rope end gap ${stats.maxRopeEndGapCm.toFixed(3)} cm`)
      expect(stats.frames).toBeGreaterThan(20) // it really was dragged over time, not teleported
      expect(stats.warningFrames).toBe(0) // never orange while following the line
      expect(stats.maxOffPathCm).toBeLessThan(3) // stayed within the off-path threshold
      expect(stats.maxBackslide).toBeLessThan(0.02) // progress only moves forward
      expect(stats.maxRopeEndGapCm).toBeLessThan(0.6) // the rope end follows the tip (<= 1 frame lag)
      expect(s.color).toBe("success")
      expect(s.sfx).toBe("StepSuccessChime")
      expect(s.tip.distance(end)).toBeLessThan(0.15)
      expect(s.dots[step - 1]).toBe("done")
    }
    if (typeof unsub === "function") unsub()

    await mustPoll(() => main.getPhase() === "tightenReady", 3000, "Tighten ready after real step 4")
    const btns = main.getVisibleButtons()
    log(`after real step 4: phase ${main.getPhase()} buttons [${btns.join(",")}]`)
    expect(btns.length).toBe(1)
    expect(btns[0]).toBe("tighten")
  }
}
