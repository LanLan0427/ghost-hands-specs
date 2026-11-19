// Real drags for every step: steps 1-4 are each completed with one continuous real
// InteractionKit pinch-drag of RopeTip along that step's authored path (paths 2-4 rise up to
// 2 cm off the table and pass under/through the loop). Natural ghost demos, no debug hooks.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {stepPath} from "../Scripts/GhostHandsKnotData"
import {dragTipAlongPath, fmt, getMain, log, mustPoll, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

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
      const t0 = getTime()
      await dragTipAlongPath(this, step, 2, step === 1 ? 12000 : 9000)
      await mustPoll(() => !!snaps[step], 3000, `step ${step} snapped by real drag`)
      const s = snaps[step]
      const pts = stepPath(step)
      const end = ropeWorld(pts[pts.length - 1])
      log(`step ${step}: snapped after ${(getTime() - t0).toFixed(1)} s, color ${s.color}, sfx ${s.sfx}, tip ${fmt(s.tip)} end ${fmt(end)} dots ${s.dots.join(",")}`)
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
