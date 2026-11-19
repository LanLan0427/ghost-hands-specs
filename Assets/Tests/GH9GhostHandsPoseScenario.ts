// Ghost hands read as the user's own hands doing the move:
//  - rigged InteractionKit hand models (posed finger joints), not a stiff mesh;
//  - right hand pinches the ghost rope tip with thumb + index (tips touching on the tip);
//  - left hand appears from step 2 and pinches the standing part to hold the loop (steps 2-4);
//  - the other fingers are curled and never sink into the table;
//  - world orientation: fingers point away (-Z), palm down (back of hand up), wrist toward the user;
//  - FIRST-PERSON orientation, measured from the actual camera (the user's eyes): the back of
//    each hand faces the eye, the fingers point away along the user's view direction, and the
//    wrist is nearer the eye than the pinch, as if they were the user's own hands.
// Steps advance with debug hooks (real drags are covered by gh6); the start card is a real pinch.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {stepPath} from "../Scripts/GhostHandsKnotData"
import {LEFT_HOLD_LOCAL, TABLE_TOP_LOCAL_Y} from "../Scripts/GhostHandsGhostController"
import {GhostHandRig} from "../Scripts/GhostHandsRigPose"
import {fmt, getMain, log, mustPoll, pinchStartCard, ropeWorld} from "./GhostHandsLeafHelpers"

function eyePosition(): vec3 {
  const cam = findSceneObjectByName("Camera Object")
  if (!cam) throw new Error("Camera Object not found")
  return cam.getTransform().getWorldPosition()
}

function checkHand(name: string, rig: GhostHandRig, target: vec3): void {
  const gap = rig.pinchGapCm()
  const pinch = rig.pinchPoint()
  const f = rig.fingerDir()
  const n = rig.backNormal()
  const w = rig.wristWorld()
  const tableY = ropeWorld(new vec3(0, TABLE_TOP_LOCAL_Y, 0)).y
  const lowTip = rig.lowestCurledTipY()
  // First-person: from the eye, looking at the pinch.
  const eye = eyePosition()
  const toHand = pinch.sub(eye).normalize()
  const viewFlat = new vec3(toHand.x, 0, toHand.z).normalize()
  const fingersFlat = new vec3(f.x, 0, f.z).normalize()
  const backFacesEye = n.dot(eye.sub(rig.wristWorld().add(pinch).uniformScale(0.5)).normalize())
  const fingersAlongView = fingersFlat.dot(viewFlat)
  log(`${name}: gap ${gap.toFixed(2)} cm, pinch ${fmt(pinch)} target ${fmt(target)} (d ${pinch.distance(target).toFixed(2)}), fingers ${fmt(f)}, back ${fmt(n)}, wrist ${fmt(w)}, lowest curled tip ${(lowTip - tableY).toFixed(2)} cm above table`)
  log(`${name} first-person: back-of-hand.toEye ${backFacesEye.toFixed(2)}, fingers.alongView ${fingersAlongView.toFixed(2)}, wrist ${w.distance(eye).toFixed(1)} cm vs pinch ${pinch.distance(eye).toFixed(1)} cm from eye`)
  expect(gap).toBeLessThan(1.0) // thumb and index tips touch
  expect(pinch.distance(target)).toBeLessThan(1.5) // ...on the rope
  expect(f.z).toBeLessThan(-0.6) // fingers point away from the user
  expect(n.y).toBeGreaterThan(0.6) // back of hand up = palm down
  expect(w.z - pinch.z).toBeGreaterThan(5) // wrist toward the user
  expect(lowTip).toBeGreaterThan(tableY) // curled fingers stay above the table top
  expect(backFacesEye).toBeGreaterThan(0.3) // user sees the back of the hand, like their own
  expect(fingersAlongView).toBeGreaterThan(0.8) // fingers point away along the user's view
  expect(w.distance(eye)).toBeLessThan(pinch.distance(eye)) // wrist nearer the user than the fingers
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

    for (let step = 2; step <= 4; step++) {
      main.debugDragTip(1, 0)
      await mustPoll(() => main.getCurrentStep() === step && main.getPhase() === "demo", 3000, `step ${step} demo`)
      await sleep(300)
      expect(ghost.isLeftHandShown()).toBe(true) // left hand holds the loop during the demo
      await mustPoll(() => ghost.isHolding(), 12000, `step ${step} ghost holding end pose`)
      expect(ghost.isLeftHandShown()).toBe(true) // ...and in the held end pose
      const p = stepPath(step)
      checkHand(`step ${step} right`, ghost.getRightRig(), ropeWorld(p[p.length - 1]))
      checkHand(`step ${step} left`, ghost.getLeftRig(), ropeWorld(LEFT_HOLD_LOCAL))
      // Left hand stays left of the right hand (no crossed arms)
      expect(ghost.getLeftRig().wristWorld().x).toBeLessThan(ghost.getRightRig().wristWorld().x)
    }
  }
}
