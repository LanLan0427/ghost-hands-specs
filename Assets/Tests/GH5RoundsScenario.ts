// Done criterion 5: after step 4, Tighten appears; pressing it shows the finished knot with a
// check, then Again restarts with a half-transparent ghost, and round 3 shows only the path.
// Input: real InteractionKit pinches on CardButton, TightenButtonRootButton, AgainButtonRootButton.
// Step completion inside each round uses DEBUG hooks (debugSkipDemo + debugDragTip(1,0)) to
// keep the 12 steps fast; real drag is covered by GH3/GH4.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, mustPoll, pinchButton, pinchStartCard} from "./GhostHandsLeafHelpers"
import {GhostHandsMain} from "../Scripts/GhostHandsMain"

async function completeFourStepsDebug(main: GhostHandsMain, round: number): Promise<void> {
  for (let step = 1; step <= 4; step++) {
    await mustPoll(() => main.getCurrentStep() === step && (main.getPhase() === "demo" || main.getPhase() === "userTurn"), 3000, `round ${round} step ${step} start`)
    if (main.getPhase() === "demo") main.debugSkipDemo()
    await mustPoll(() => main.getPhase() === "userTurn", 1000, `round ${round} step ${step} user turn`)
    main.debugDragTip(1, 0)
    await mustPoll(() => main.getPhase() === "stepDone" || main.getPhase() === "tightenReady", 1000, `round ${round} step ${step} done`)
    await mustPoll(() => main.getPhase() !== "stepDone", 2000, `round ${round} auto-advance after step ${step}`)
  }
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

@component
export class GH5RoundsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "demo", 2000, "round 1 demo")
    await sleep(100)
    const alphaR1 = main.getGhostAlpha()
    expect(main.getRound()).toBe(1)
    expect(main.isGhostVisible()).toBe(true)

    for (let round = 1; round <= 2; round++) {
      if (round === 2) {
        // fall through from the Again press below
      }
      await completeFourStepsDebug(main, round)
      expect(main.getPhase()).toBe("tightenReady")
      const btns = main.getVisibleButtons()
      log(`round ${round} after step 4: buttons [${btns.join(",")}] dots [${main.getStepDotStates().join(",")}]`)
      expect(sameList(btns, ["tighten"])).toBe(true)
      expect(main.isFinishedBadgeVisible()).toBe(false)

      await pinchButton("TightenButtonRootButton")
      await mustPoll(() => main.getPhase() === "tightening" || main.getPhase() === "finished", 1500, "tightening after Tighten pinch")
      await mustPoll(() => main.getPhase() === "finished", 4000, "finished after tighten animation")
      await sleep(200)
      const badgeHost = findSceneObjectByName("FinishedBadgeHost")
      log(`round ${round} finished: badge ${main.isFinishedBadgeVisible()} host ${badgeHost ? badgeHost.enabled : "n/a"} sfx ${main.getLastSfx()} buttons [${main.getVisibleButtons().join(",")}]`)
      expect(main.isFinishedBadgeVisible()).toBe(true)
      expect(badgeHost.isEnabledInHierarchy).toBe(true)
      expect(main.getLastSfx()).toBe("KnotFinishedChime")
      expect(sameList(main.getStepDotStates(), ["done", "done", "done", "done"])).toBe(true)
      expect(sameList(main.getVisibleButtons(), ["again"])).toBe(true)
      expect(main.isRopeVisible()).toBe(true)

      await pinchButton("AgainButtonRootButton")
      await mustPoll(() => main.getRound() === round + 1, 1500, `round ${round + 1} after Again pinch`)
      expect(main.isFinishedBadgeVisible()).toBe(false)
      expect(main.getCurrentStep()).toBe(1)

      if (round === 1) {
        await mustPoll(() => main.getPhase() === "demo", 1000, "round 2 demo")
        await sleep(100)
        const alphaR2 = main.getGhostAlpha()
        log(`ghost alpha round1 ${alphaR1.toFixed(3)} round2 ${alphaR2.toFixed(3)} ratio ${(alphaR2 / alphaR1).toFixed(3)}`)
        expect(main.isGhostVisible()).toBe(true)
        expect(alphaR1).toBeGreaterThan(0.1)
        expect(Math.abs(alphaR2 - 0.5 * alphaR1)).toBeLessThan(0.01)
      }
    }

    // Round 3: no ghost at all, path + glowing tip only, straight to the user turn.
    await sleep(300)
    log(`round 3: phase ${main.getPhase()} ghostVisible ${main.isGhostVisible()} alpha ${main.getGhostAlpha()} path ${main.isPathVisible()} tip ${main.getTipColorState()}`)
    expect(main.getRound()).toBe(3)
    expect(main.getPhase()).toBe("userTurn")
    expect(main.isGhostVisible()).toBe(false)
    expect(main.getGhostAlpha()).toBe(0)
    expect(findSceneObjectByName("GhostVisualRoot").isEnabledInHierarchy).toBe(false)
    expect(main.isPathVisible()).toBe(true)
    expect(main.getTipColorState()).toBe("glow")
    // Stays ghost-free on the next round-3 step too
    main.debugDragTip(1, 0)
    await mustPoll(() => main.getCurrentStep() === 2 && main.getPhase() === "userTurn", 2000, "round 3 step 2 user turn")
    expect(main.isGhostVisible()).toBe(false)
    expect(main.isPathVisible()).toBe(true)
  }
}
