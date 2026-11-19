// Replay step and Slower with real InteractionKit pinches on the table buttons.
//  - Replay replays the current ghost loop (then holds again); the user turn stays active.
//  - Slower (toggle) replays at half speed and stays slow (Replay while slow is also slow);
//    pressing it again returns to normal speed.
// Speed is measured as the time from the press until the ghost holds its end pose again.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, mustPoll, pinchButton, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"
import {polylineLength, stepPath} from "../Scripts/GhostHandsKnotData"
import {GhostHandsMain} from "../Scripts/GhostHandsMain"

async function pressAndTimeLoop(owner: BaseScriptComponent, main: GhostHandsMain, button: string, what: string): Promise<number> {
  const taps = main.audio.getPlayCount()
  await pinchButton(button)
  await mustPoll(() => main.ghost.isPlaying(), 1500, `${what}: ghost replaying`)
  const t0 = getTime()
  expect(main.audio.getPlayCount()).toBeGreaterThan(taps) // button tap sound
  expect(main.getPhase()).toBe("userTurn")
  expect(main.isPathVisible()).toBe(true)
  // The ghost hand visibly performs the move: track its pinch point while it replays.
  let travelled = 0
  let minGap = 99
  let last: vec3 = null
  const track = owner.createEvent("UpdateEvent")
  track.bind(() => {
    if (!main.ghost.isPlaying()) return
    const rig = main.ghost.getRightRig()
    const p = rig.pinchPoint()
    if (last) travelled += p.distance(last)
    last = p
    minGap = Math.min(minGap, rig.pinchGapCm())
  })
  await mustPoll(() => main.ghost.isHolding(), 25000, `${what}: ghost holds end pose again`)
  track.enabled = false
  const sec = getTime() - t0
  const path = stepPath(main.getCurrentStep())
  const endGap = main.ghost.getRightRig().pinchPoint().distance(ropeWorld(path[path.length - 1]))
  log(`${what}: loop took ${sec.toFixed(2)} s, ghost pinch travelled ${travelled.toFixed(1)} cm (min thumb-index gap ${minGap.toFixed(2)} cm), holds ${endGap.toFixed(2)} cm from path end`)
  expect(travelled).toBeGreaterThan(polylineLength(path)) // hand follows the whole step path (x loops)
  expect(minGap).toBeLessThan(1.0) // ...pinching the ghost tip while it moves
  expect(endGap).toBeLessThan(1.5) // and holds the end pose on the path end
  return sec
}

@component
export class GH7ReplaySlowerScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "userTurn" && main.ghost.isHolding(), 12000, "step 1 user turn, ghost holding")
    const btns = main.getVisibleButtons()
    log(`buttons during step: [${btns.join(",")}]`)
    expect(btns.indexOf("replay")).toBeGreaterThan(-1)
    expect(btns.indexOf("slower")).toBeGreaterThan(-1)

    const normal = await pressAndTimeLoop(this, main, "ReplayButtonRootButton", "Replay (normal)")
    const slow = await pressAndTimeLoop(this, main, "SlowerButtonRootButton", "Slower on")
    const slowReplay = await pressAndTimeLoop(this, main, "ReplayButtonRootButton", "Replay while slow")
    const back = await pressAndTimeLoop(this, main, "SlowerButtonRootButton", "Slower off")

    log(`ratios: slow/normal ${(slow / normal).toFixed(2)} slowReplay/normal ${(slowReplay / normal).toFixed(2)} back/normal ${(back / normal).toFixed(2)}`)
    expect(normal).toBeGreaterThan(1.5) // a 2-3 s loop played (x loopCount)
    expect(slow / normal).toBeGreaterThan(1.7)
    expect(slow / normal).toBeLessThan(2.3)
    expect(slowReplay / normal).toBeGreaterThan(1.7) // stays slow until pressed again
    expect(back / normal).toBeGreaterThan(0.8)
    expect(back / normal).toBeLessThan(1.25)
    expect(main.getCurrentStep()).toBe(1)
  }
}
