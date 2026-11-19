// Done criterion 3: dragging the tip along the path to the end snaps it into place, turns the
// step dot green with a chime, and the ghost starts the next step by itself.
// Input: real InteractionKit pinch on CardButton + real InteractionKit drag events on RopeTip
// (DefaultLeafInteractor ray, chunked along the path). Natural demo wait, no debug hooks.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {stepPath} from "../Scripts/GhostHandsKnotData"
import {dragTipAlongPath, fmt, getMain, log, mustPoll, pinchStartCard, pollUntil, ropeWorld} from "./GhostHandsLeafHelpers"

@component
export class GH3DragSnapScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "userTurn", 9000, "step 1 user turn after demo")
    expect(main.getStepDotStates()[0]).toBe("current")

    const audio = main.audio
    const playsBefore = audio.getPlayCount()
    let snap: {t: number; color: string; dots: string[]; sfx: string; plays: number; tip: vec3; markerDots: string[]} | null = null
    const unsub = main.tip.onStepComplete.add((step: number) => {
      if (step !== 1 || snap) return
      snap = {
        t: getTime(),
        color: main.getTipColorState(),
        dots: main.getStepDotStates().slice(),
        sfx: main.getLastSfx(),
        plays: audio.getPlayCount(),
        tip: main.getTipWorldPosition(),
        markerDots: main.stepMarker.getDotStates(),
      }
    })
    let step2At = -1
    let step2State: {ghostVisible: boolean; ghostPlaying: boolean; dots: string[]} | null = null
    const watcher = pollUntil(() => {
      if (main.getCurrentStep() === 2 && main.getPhase() === "demo") {
        step2At = getTime()
        step2State = {ghostVisible: main.isGhostVisible(), ghostPlaying: main.ghost.isPlaying(), dots: main.getStepDotStates().slice()}
        return true
      }
      return false
    }, 40000)

    await dragTipAlongPath(this, 1, 2, 20000)
    await watcher
    if (typeof unsub === "function") unsub()

    expect(snap !== null).toBe(true)
    const s = snap!
    const end = ropeWorld(stepPath(1)[stepPath(1).length - 1])
    log(`snap: color ${s.color} dots ${s.dots.join(",")} marker ${s.markerDots.join(",")} sfx ${s.sfx} plays ${playsBefore}->${s.plays} tip ${fmt(s.tip)} end ${fmt(end)}`)
    expect(s.color).toBe("success")
    expect(s.tip.distance(end)).toBeLessThan(0.1) // snapped exactly onto the path end
    expect(s.dots[0]).toBe("done")
    expect(s.markerDots[0]).toBe("done") // what the UI module renders (green)
    expect(s.sfx).toBe("StepSuccessChime")
    expect(s.plays).toBe(playsBefore + 1)

    // Ghost starts step 2 on its own after ~0.5 s
    expect(step2At).toBeGreaterThan(0)
    const delay = step2At - s.t
    log(`auto-advance delay ${delay.toFixed(3)} s`)
    expect(delay).toBeGreaterThan(0.3)
    expect(delay).toBeLessThan(1.2)
    const st = step2State!
    log(`step 2 start: ghostVisible ${st.ghostVisible} ghostPlaying ${st.ghostPlaying} dots ${st.dots.join(",")}`)
    expect(st.ghostVisible).toBe(true)
    expect(st.ghostPlaying).toBe(true)
    expect(st.dots[0]).toBe("done")
    expect(st.dots[1]).toBe("current")
    expect(main.getCurrentStep()).toBe(2)
    expect(findSceneObjectByName("StepMarkerHost").enabled).toBe(true)
  }
}
