// Done criterion 1: pinching the Bowline start card makes the rope and ghost hands appear on
// the table ~45 cm in front, below eye level, and the card disappears.
// Input: REAL IK avatar pinch (createIKInteractor) on CardButton - doubles as reachability check.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {getMain, log, fmt, mustPoll, ghostHandPoint} from "./GhostHandsLeafHelpers"

@component
export class GH1StartCardScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    expect(main.getPhase()).toBe("start")
    expect(main.isStartCardVisible()).toBe(true)
    expect(main.isRopeVisible()).toBe(false)
    expect(main.isGhostVisible()).toBe(false)

    const card = findInteractableByName("CardButton")
    expect(card !== null && card !== undefined).toBe(true)
    const ik = createIKInteractor()
    await ik.trigger(card)
    await mustPoll(() => main.getPhase() !== "start", 3000, "lesson to leave the start phase after IK pinch")
    await sleep(800)

    // Card gone
    expect(main.isStartCardVisible()).toBe(false)
    const host = findSceneObjectByName("StartCardHost")
    expect(host.enabled).toBe(false)

    // Rope on the table ~45 cm in front, below eye level (head = origin at start)
    expect(main.isRopeVisible()).toBe(true)
    const rp = main.getRopeWorldPosition()
    const ropeDist = Math.sqrt(rp.x * rp.x + rp.z * rp.z)
    log(`rope world ${fmt(rp)} horizontal distance ${ropeDist.toFixed(2)} cm`)
    expect(Math.abs(ropeDist - 45)).toBeLessThan(5)
    expect(rp.z).toBeLessThan(-30) // in front (-Z)
    expect(Math.abs(rp.y - (-64.5))).toBeLessThan(1.5) // resting on the table (top y=-65)
    expect(rp.y).toBeLessThan(-40) // well below eye level

    // Ghost hands appear over the rope on the table
    expect(main.getPhase()).toBe("demo")
    expect(main.isGhostVisible()).toBe(true)
    expect(main.getGhostAlpha()).toBeGreaterThan(0.1)
    const handRoot = findSceneObjectByName("GhostHandRoot")
    expect(handRoot.isEnabledInHierarchy).toBe(true)
    const hp = ghostHandPoint(main)
    const handDist = Math.sqrt(hp.x * hp.x + hp.z * hp.z)
    log(`ghost hand world ${fmt(hp)} horizontal distance ${handDist.toFixed(2)} cm, alpha ${main.getGhostAlpha().toFixed(3)}`)
    expect(hp.y).toBeLessThan(-45)
    expect(hp.y).toBeGreaterThan(-66)
    expect(Math.abs(handDist - 45)).toBeLessThan(12)
    expect(main.getLastSfx()).toBe("ButtonTap")
  }
}
