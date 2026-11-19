// Done criterion 4: dragging the tip off the line turns it orange, and letting go slides it
// back to the last checkpoint.
// Input: real InteractionKit pinch on CardButton + ONE continuous real InteractionKit drag on
// RopeTip (DefaultLeafInteractor): along the path past checkpoint 2, then perpendicular off
// the line, hold, release (= end of the LEAF drag).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {checkpointProgress, pointAtProgress, stepPath, tangentAtProgress} from "../Scripts/GhostHandsKnotData"
import {fmt, getMain, log, makePathSteer, mustPoll, pinchStartCard, ropeWorld, steeredTipDrag} from "./GhostHandsLeafHelpers"

@component
export class GH4OffPathScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await pinchStartCard()
    await mustPoll(() => main.getPhase() === "userTurn", 9000, "step 1 user turn after demo")

    const pts = stepPath(1)
    const cps = checkpointProgress(1)
    const target = cps[1] + 0.06
    const pathSteer = makePathSteer(1, target)
    const audio = main.audio
    const coreObj = findSceneObjectByName("TipCore")
    const coreRmv = coreObj ? (coreObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual) : null

    let mode: "path" | "off" | "hold" = "path"
    let offStart: vec3 = vec3.zero()
    let offDir: vec3 = vec3.zero()
    let offProgress = 0
    let cpAtOff = 0
    let playsBefore = 0
    let maxOffCm = 0
    let holdFrames = 0
    let warnHeldFrames = 0
    let warn: {color: string; core: vec4 | null; sfx: string} | null = null
    let colorBeforeRelease = ""

    const unsub = main.tip.onOffPath.add(() => {
      if (warn) return
      warn = {
        color: main.getTipColorState(),
        core: coreRmv ? coreRmv.mainMaterial.mainPass.baseColor : null,
        sfx: main.getLastSfx(),
      }
    })

    const steer = (out: vec3) => {
      if (mode === "path") {
        if (pathSteer(out)) return
        // reached target progress: compute an outward perpendicular and veer off
        offProgress = main.getTipProgress()
        cpAtOff = main.getLastCheckpointProgress()
        playsBefore = audio.getPlayCount()
        const tan = tangentAtProgress(pts, offProgress)
        let perp = new vec3(-tan.z, 0, tan.x).normalize()
        let c = vec3.zero()
        for (const p of pts) c = c.add(p)
        c = c.uniformScale(1 / pts.length)
        const here = pointAtProgress(pts, offProgress)
        if (here.add(perp).distance(c) < here.distance(c)) perp = perp.uniformScale(-1)
        offDir = ropeWorld(perp).sub(ropeWorld(vec3.zero())).normalize()
        offStart = main.getTipWorldPosition()
        mode = "off"
        log(`veer off at progress ${offProgress.toFixed(3)} checkpoint ${cpAtOff.toFixed(3)} tip ${fmt(offStart)}`)
      }
      if (mode === "off") {
        const d = main.getTipWorldPosition().distance(offStart)
        if (d > maxOffCm) maxOffCm = d
        if (d >= 7) { mode = "hold" } else {
          out.x = offDir.x * 0.3; out.y = 0; out.z = offDir.z * 0.3
          return
        }
      }
      // hold still off the line until release
      out.x = 0; out.y = 0; out.z = 0
      holdFrames++
      if (main.getTipColorState() === "warning") warnHeldFrames++
      colorBeforeRelease = main.getTipColorState()
    }

    await steeredTipDrag(this, steer, 14000, () => false)
    // drag over == pinch released
    const slidingAtRelease = main.tip.isSliding()
    const colorAtRelease = main.getTipColorState()
    if (typeof unsub === "function") unsub()

    log(`mode ${mode} maxOff ${maxOffCm.toFixed(2)} holdFrames ${holdFrames} warnHeld ${warnHeldFrames} colorBeforeRelease ${colorBeforeRelease} colorAtRelease ${colorAtRelease} sliding ${slidingAtRelease}`)
    expect(mode).toBe("hold")
    expect(Math.abs(cpAtOff - cps[1])).toBeLessThan(0.001)
    expect(warn !== null).toBe(true)
    const w = warn!
    log(`warning: color ${w.color} core ${w.core ? w.core.toString() : "n/a"} sfx ${w.sfx} plays ${playsBefore}->${audio.getPlayCount()}`)
    expect(w.color).toBe("warning")
    if (w.core) {
      // orange (1.0, 0.604, 0.235)
      expect(Math.abs(w.core.r - 1.0)).toBeLessThan(0.02)
      expect(Math.abs(w.core.g - 0.604)).toBeLessThan(0.02)
      expect(Math.abs(w.core.b - 0.235)).toBeLessThan(0.02)
    }
    expect(w.sfx).toBe("OffPathWarning")
    expect(audio.getPlayCount()).toBe(playsBefore + 1)
    expect(maxOffCm).toBeGreaterThan(3)
    expect(holdFrames).toBeGreaterThan(5)
    expect(warnHeldFrames).toBe(holdFrames) // stays orange while held off the line
    expect(colorAtRelease).toBe("warning")
    expect(slidingAtRelease).toBe(true)

    await sleep(700)
    const expected = ropeWorld(pointAtProgress(pts, cpAtOff))
    const finalPos = main.getTipWorldPosition()
    log(`after slide: tip ${fmt(finalPos)} expected checkpoint ${fmt(expected)} progress ${main.getTipProgress().toFixed(3)} color ${main.getTipColorState()}`)
    expect(main.tip.isSliding()).toBe(false)
    expect(finalPos.distance(expected)).toBeLessThan(0.2)
    expect(Math.abs(main.getTipProgress() - cpAtOff)).toBeLessThan(0.001)
    expect(main.getTipColorState()).toBe("glow")
    expect(main.getPhase()).toBe("userTurn")
    expect(main.getCurrentStep()).toBe(1)
  }
}
