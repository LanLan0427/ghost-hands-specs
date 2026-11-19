// Ghost hands read as the user's own hands doing the move:
//  - rigged InteractionKit hand models (posed finger joints), not a stiff mesh;
//  - right hand pinches the ghost rope tip with thumb + index (tips touching on the tip);
//  - left hand appears only from step 2 and pinches the standing part to hold the loop;
//  - first-person orientation: fingers point away (-Z), palm down (back of hand up),
//    wrist toward the user.
// Steps advance with debug hooks; the start card is a real pinch.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {stepPath} from "../Scripts/GhostHandsKnotData"
import {LEFT_HOLD_LOCAL} from "../Scripts/GhostHandsGhostController"
import {GhostHandRig} from "../Scripts/GhostHandsRigPose"
import {fmt, getMain, log, mustPoll, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

function checkHand(name: string, rig: GhostHandRig, target: vec3): void {
  const gap = rig.pinchGapCm()
  const pinch = rig.pinchPoint()
  const f = rig.fingerDir()
  const n = rig.backNormal()
  const w = rig.wristWorld()
  log(`${name}: gap ${gap.toFixed(2)} cm, pinch ${fmt(pinch)} target ${fmt(target)} (d ${pinch.distance(target).toFixed(2)}), fingers ${fmt(f)}, back ${fmt(n)}, wrist ${fmt(w)}`)
  expect(gap).toBeLessThan(1.0) // thumb and index tips touch
  expect(pinch.distance(target)).toBeLessThan(1.5) // ...on the rope
  expect(f.z).toBeLessThan(-0.6) // fingers point away from the user
  expect(n.y).toBeGreaterThan(0.4) // back of hand up = palm down
  expect(w.z - pinch.z).toBeGreaterThan(5) // wrist toward the user
}

@component
export class GH9GhostHandsPoseScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    const ghost = main.ghost
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "userTurn" && ghost.isHolding(), 12000, "step 1 ghost holding end pose")
    expect(ghost.usesRiggedHands()).toBe(true)
    const p1 = stepPath(1)
    checkHand("step 1 right", ghost.getRightRig(), ropeWorld(p1[p1.length - 1]))
    expect(ghost.isLeftHandShown()).toBe(false) // one hand is enough to form the hole

    main.debugDragTip(1, 0)
    await mustPoll(() => main.getCurrentStep() === 2 && main.getPhase() === "demo", 3000, "step 2 demo")
    await sleep(300)
    expect(ghost.isLeftHandShown()).toBe(true)
    await mustPoll(() => ghost.isHolding(), 12000, "step 2 ghost holding end pose")
    const p2 = stepPath(2)
    checkHand("step 2 right", ghost.getRightRig(), ropeWorld(p2[p2.length - 1]))
    checkHand("step 2 left", ghost.getLeftRig(), ropeWorld(LEFT_HOLD_LOCAL))
    // Left hand stays left of the right hand (no crossed arms)
    expect(ghost.getLeftRig().wristWorld().x).toBeLessThan(ghost.getRightRig().wristWorld().x)
  }
}
