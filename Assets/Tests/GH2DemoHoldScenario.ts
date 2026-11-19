// Done criterion 2: the ghost hands loop step 1 and then hold their end pose; the rope tip
// glows and a dotted path appears.
// Input: real InteractionKit pinch (DefaultLeafInteractor) on CardButton; then pure observation
// (no debug hooks) of the natural ~5 s demo.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, mustPoll, pinchStartCard, ghostHandPoint} from "./GhostHandsLeafHelpers"

@component
export class GH2DemoHoldScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "demo", 2000, "demo phase")
    const ghost = main.ghost
    const t0 = getTime()

    // Watch the ghost hand position over time: it should move (loop) and restart (loop > 1).
    let playingSamples = 0
    let minZ = 1e9
    let maxZ = -1e9
    let maxX = -1e9
    let minX = 1e9
    let holdAt = -1
    let tipGlowDuringDemo = false
    let pathVisibleDuringDemo = false
    while ((getTime() - t0) < 9) {
      if (main.getPhase() === "demo") {
        if (ghost.isPlaying()) playingSamples++
        const p = ghostHandPoint(main)
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
        if (main.isTipGlowing()) tipGlowDuringDemo = true
        if (main.isPathVisible()) pathVisibleDuringDemo = true
      }
      if (main.isGhostHolding()) { holdAt = getTime() - t0; break }
      await sleep(50)
    }
    const loopSec = (ghost as any).loopSec as number
    const loopCount = (ghost as any).loopCount as number
    log(`ghost held after ${holdAt.toFixed(2)} s (loopSec ${loopSec} x loopCount ${loopCount}); playing samples ${playingSamples}; hand x range ${(maxX - minX).toFixed(2)} cm z range ${(maxZ - minZ).toFixed(2)} cm`)
    expect(holdAt).toBeGreaterThan(0)
    // It loops: holds only after >1 full loop, roughly loopSec*loopCount
    expect(holdAt).toBeGreaterThan(loopSec * 1.2)
    expect(Math.abs(holdAt - loopSec * loopCount)).toBeLessThan(1.0)
    expect(playingSamples).toBeGreaterThan(20)
    expect(Math.max(maxX - minX, maxZ - minZ)).toBeGreaterThan(3) // hand actually travels the path
    expect(tipGlowDuringDemo).toBe(false)
    expect(pathVisibleDuringDemo).toBe(false)

    // End pose held, user's turn: tip glows, dotted path shown
    await sleep(300)
    expect(main.isGhostVisible()).toBe(true)
    expect(main.isGhostHolding()).toBe(true)
    expect(ghost.isPlaying()).toBe(false)
    expect(main.getPhase()).toBe("userTurn")
    expect(main.getCurrentStep()).toBe(1)
    expect(main.isTipGlowing()).toBe(true)
    expect(main.getTipColorState()).toBe("glow")
    expect(findSceneObjectByName("TipGlow").enabled).toBe(true)
    expect(main.isPathVisible()).toBe(true)
    const dots = main.path.getDotCount()
    log(`path dots ${dots}`)
    expect(dots).toBeGreaterThan(3)
    // End pose stays held (no further looping)
    const p1 = ghostHandPoint(main)
    await sleep(1000)
    const p2 = ghostHandPoint(main)
    expect(p1.distance(p2)).toBeLessThan(0.05)
    expect(main.isGhostHolding()).toBe(true)
  }
}
