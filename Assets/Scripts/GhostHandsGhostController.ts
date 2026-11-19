// GhostHandsGhostController.ts
// Owns: the light-blue semi-transparent ghost RIGHT hand (InteractionKit hand mesh in bind
// pose by default, MeshBuilder procedural hand as fallback) and the faint ghost rope-tip tube.
// Demonstrates the current bowline step in a loop (approach, pinch, drag the tip along the
// step path), freezes on the end pose after loopCount loops, and plays the Tighten pull.
// Expects: ropeRoot (the "Rope" SceneObject; paths are rope-local cm), ghostTipRoot (gets
// aligned to the rope frame in OnStart), an unlit baseMaterial (cloned, made transparent),
// optional ghostHandMesh (IK RightHandMeshFull.mesh).
// Produces: play / holdEndPose / setAlpha / fadeOut / hide / playTighten, getters, and the
// onHold(step) / onTightenDone events.
// Size reason: two hand modes (IK mesh + procedural articulated fallback) plus ghost-tip tube share one animation clock.
// Must not: disable its own SceneObject, touch other components in onAwake, or create UI/text components.

import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event";
import {
  stepPath,
  pointAtProgress,
  pathSegment,
  polylineLength,
  sampleGhostKey,
  GHOST_HAND_YAW_DEG,
  GHOST_TIP_TRAIL_CM,
  KNOT_CENTER,
  resampleByLength,
  smoothstep01,
  clamp01,
} from "./GhostHandsKnotData";
import { GhostHandRig } from "./GhostHandsRigPose";

const DEG = Math.PI / 180;
const PINCH_CURL = 0.85;
/** Rigged-hand posing (rope-local cm / degrees). Fingers away from the user, palm down. */
const RIGHT_YAW_DEG = -15;
const LEFT_YAW_DEG = 18;
const HAND_PITCH_DEG = 12;
const HAND_ROLL_DEG = 35;
/** Left hand pinches the standing part just left of the loop's crossing (holds the hole). */
export const LEFT_HOLD_LOCAL = new vec3(-3.2, 0.5, 3.1);
const VERT_LAYOUT = [
  { name: "position", components: 3 },
  { name: "normal", components: 3, normalized: true },
  { name: "texture0", components: 2 },
];

interface FingerRig {
  joints: SceneObject[];
  maxAngles: number[];
}

@component
export class GhostHandsGhostController extends BaseScriptComponent {
  @input ropeRoot: SceneObject;
  @input ghostTipRoot: SceneObject;
  @input baseMaterial: Material;
  @input @allowUndefined ghostHandMesh: RenderMesh;
  /** Skinned duplicates of the IK prefab hand models (preferred over ghostHandMesh). */
  @input @allowUndefined rightHandRig: SceneObject;
  @input @allowUndefined leftHandRig: SceneObject;
  /** Optional lit material for the rigged hands (gives knuckles/fingers form); else unlit. */
  @input @allowUndefined rigMaterial: Material;
  @input useIkHandMesh: boolean = true;
  @input ikHandRotationDeg: vec3 = new vec3(0, 0, 0);
  @input handLengthCm: number = 19;
  @input @widget(new ColorWidget()) ghostColor: vec4 = new vec4(0.561, 0.827, 1, 1);
  @input baseAlpha: number = 0.45;
  @input loopSec: number = 2.5;
  @input loopCount: number = 2;
  @input slowFactor: number = 0.5;
  @input fadeSec: number = 0.3;
  @input ghostTipDiameterCm: number = 1;

  private holdEvent = new Event<number>();
  readonly onHold: PublicApi<number> = this.holdEvent;
  private tightenEvent = new Event<void>();
  readonly onTightenDone: PublicApi<void> = this.tightenEvent;

  private handMat: Material = null;
  private rimMat: Material = null;
  private tipMat: Material = null;
  /** Rigged hands: one-sided + depth write so only the outer skin shows (no inner-face blob). */
  private rigMat: Material = null;
  private visualRoot: SceneObject = null;
  private handRoot: SceneObject = null;
  private fingers: FingerRig[] = [];
  private thumbBase: SceneObject = null;
  private thumbJoint: SceneObject = null;
  private thumbOpenDir = new vec3(-0.55, -0.35, -0.75).normalize();
  private thumbPinchDir = new vec3(0, 0, -1);
  private thumbPinchScale = 1;
  private ikMode = false;
  private rigMode = false;
  private rightRig: GhostHandRig = null;
  private leftRig: GhostHandRig = null;
  private leftShown = false;
  private tubeObj: SceneObject = null;
  private tubeVisual: RenderMeshVisual = null;
  private tubeBuilder: MeshBuilder = null;
  private tubeAssigned = false;
  private lastTubeT = -1;

  private started = false;
  private visible = false;
  private mode: "idle" | "loop" | "tighten" = "idle";
  private holding = false;
  private step = 1;
  private slow = false;
  private elapsed = 0;
  private roundAlpha = 0.45;
  private alpha = 0;
  private fading = false;
  private fadeFrom = 0;
  private fadeElapsed = 0;
  private tipShown = true;
  private tightenDur = 1;
  private tightenElapsed = 0;
  private tightenFired = false;

  onAwake(): void {
    this.roundAlpha = this.baseAlpha;
    if (!this.ropeRoot) print("[GhostHandsGhostController] ERROR: ropeRoot is not wired; using own transform as rope frame.");
    if (!this.ghostTipRoot) print("[GhostHandsGhostController] ERROR: ghostTipRoot is not wired; ghost rope tip disabled.");
    const own = this.getSceneObject();
    this.visualRoot = global.scene.createSceneObject("GhostVisualRoot");
    this.visualRoot.setParent(own);
    this.handRoot = global.scene.createSceneObject("GhostHandRoot");
    this.handRoot.setParent(this.visualRoot);

    if (!this.baseMaterial) {
      print("[GhostHandsGhostController] ERROR: baseMaterial is not wired; ghost visuals skipped (logic still runs).");
    } else {
      this.handMat = this.makeMat();
      this.rimMat = this.makeMat();
      this.tipMat = this.makeMat();
      if (this.rightHandRig && this.buildRigHands()) {
        // rigged IK hands in use
      } else if (this.useIkHandMesh && this.ghostHandMesh) {
        this.buildIkHand();
      } else {
        if (this.useIkHandMesh) print("[GhostHandsGhostController] ghostHandMesh not wired; using procedural hand.");
        this.buildProceduralHand();
      }
      this.tubeObj = global.scene.createSceneObject("GhostTipTube");
      this.tubeObj.setParent(own);
      this.tubeVisual = this.tubeObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      this.tubeVisual.mainMaterial = this.tipMat;
      this.tubeBuilder = new MeshBuilder(VERT_LAYOUT);
      this.tubeBuilder.topology = MeshTopology.Triangles;
      this.tubeBuilder.indexType = MeshIndexType.UInt16;
      this.tubeObj.enabled = false;
    }
    this.applyVisibility();
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  // ------------------------------------------------------------------ public API

  play(step: number, slow: boolean): void {
    this.onStart();
    this.step = Math.max(1, Math.min(GHOST_HAND_YAW_DEG.length, Math.floor(step) || 1));
    this.slow = !!slow;
    this.elapsed = 0;
    this.holding = false;
    this.mode = "loop";
    this.tipShown = true;
    this.lastTubeT = -1;
    this.show();
    this.poseLoop(0);
  }

  holdEndPose(): void {
    this.onStart();
    const wasHolding = this.holding && this.mode === "loop";
    if (!this.visible || this.fading) this.show();
    this.mode = "loop";
    this.tipShown = true;
    this.holding = true;
    this.lastTubeT = -1;
    this.poseLoop(1);
    if (!wasHolding) this.holdEvent.invoke(this.step);
  }

  setAlpha(alpha: number): void {
    this.roundAlpha = Math.max(0, Math.min(1, alpha));
    if (this.visible && !this.fading) {
      this.alpha = this.roundAlpha;
      this.applyAlpha();
    }
  }

  fadeOut(): void {
    if (!this.visible) return;
    if (this.fadeSec <= 0) {
      this.hide();
      return;
    }
    this.fading = true;
    this.fadeFrom = this.alpha;
    this.fadeElapsed = 0;
  }

  hide(): void {
    this.visible = false;
    this.mode = "idle";
    this.holding = false;
    this.fading = false;
    this.alpha = 0;
    this.applyAlpha();
    this.applyVisibility();
  }

  isVisible(): boolean { return this.visible; }
  isHolding(): boolean { return this.holding; }
  isPlaying(): boolean {
    return this.visible && ((this.mode === "loop" && !this.holding) || this.mode === "tighten");
  }
  getAlpha(): number { return this.visible ? this.alpha : 0; }
  getBaseAlpha(): number { return this.baseAlpha; }
  usesIkHandMesh(): boolean { return this.ikMode || this.rigMode; }
  usesRiggedHands(): boolean { return this.rigMode; }
  isLeftHandShown(): boolean { return this.rigMode && this.visible && this.leftShown; }
  getRightRig(): GhostHandRig { return this.rightRig; }
  getLeftRig(): GhostHandRig { return this.leftRig; }

  playTighten(durationSec: number): void {
    this.onStart();
    this.mode = "tighten";
    this.holding = false;
    this.tipShown = false;
    this.tightenDur = Math.max(0.05, durationSec);
    this.tightenElapsed = 0;
    this.tightenFired = false;
    this.show();
    this.poseTighten(0);
  }

  // ------------------------------------------------------------------ lifecycle

  private onStart(): void {
    if (this.started) return;
    this.started = true;
    if (this.ghostTipRoot && this.ropeRoot) {
      const src = this.ropeRoot.getTransform();
      const dst = this.ghostTipRoot.getTransform();
      dst.setWorldPosition(src.getWorldPosition());
      dst.setWorldRotation(src.getWorldRotation());
      dst.setWorldScale(src.getWorldScale());
    }
    if (this.tubeObj && this.ghostTipRoot) {
      this.tubeObj.setParent(this.ghostTipRoot);
      const t = this.tubeObj.getTransform();
      t.setLocalPosition(vec3.zero());
      t.setLocalRotation(quat.quatIdentity());
      t.setLocalScale(vec3.one());
    }
    this.applyVisibility();
  }

  private onUpdate(): void {
    const dt = getDeltaTime();
    if (this.fading) {
      this.fadeElapsed += dt;
      const f = clamp01(this.fadeElapsed / Math.max(1e-3, this.fadeSec));
      this.alpha = this.fadeFrom * (1 - f);
      this.applyAlpha();
      if (f >= 1) {
        this.hide();
        return;
      }
    }
    if (!this.visible) return;
    if (this.mode === "loop") {
      if (!this.holding) {
        this.elapsed += dt;
        const dur = this.loopDuration();
        const total = dur * Math.max(0, this.loopCount);
        if (this.elapsed >= total) {
          this.holding = true;
          this.poseLoop(1);
          this.holdEvent.invoke(this.step);
        } else {
          this.poseLoop((this.elapsed % dur) / dur);
        }
      } else {
        this.poseLoop(1);
      }
    } else if (this.mode === "tighten") {
      this.tightenElapsed += dt;
      const k = clamp01(this.tightenElapsed / this.tightenDur);
      this.poseTighten(k);
      if (k >= 1 && !this.tightenFired) {
        this.tightenFired = true;
        this.tightenEvent.invoke();
        this.fadeOut();
      }
    }
  }

  // ------------------------------------------------------------------ posing

  private loopDuration(): number {
    const f = this.slow ? Math.max(0.05, this.slowFactor) : 1;
    return Math.max(0.1, this.loopSec / f);
  }

  private ropeTransform(): Transform {
    return (this.ropeRoot || this.getSceneObject()).getTransform();
  }

  private poseLoop(u: number): void {
    const path = stepPath(this.step);
    const k = sampleGhostKey(u);
    const tip = pointAtProgress(path, k.pathT);
    if (this.rigMode) {
      // Pinch point sits on the rope tip (rope is 1 cm thick: centre ~0.5 cm up).
      this.placeRig(this.rightRig, new vec3(tip.x, tip.y + k.liftCm * 0.8 + 0.3, tip.z), RIGHT_YAW_DEG, k.curl);
      this.setLeft(this.step >= 2, LEFT_HOLD_LOCAL, 1);
    } else {
      this.placeHand(new vec3(tip.x, tip.y + k.liftCm + 0.6, tip.z), k.curl);
    }
    this.updateTube(path, k.pathT);
  }

  private poseTighten(k: number): void {
    const s = smoothstep01(k);
    if (this.rigMode) {
      // Right hand holds the fixed loop + tail together; left hand pulls the standing part left.
      this.placeRig(this.rightRig, new vec3(2.2, 0.5, 4.2), RIGHT_YAW_DEG, 1);
      const a = new vec3(-7, 0.5, -1.4);
      const b = new vec3(-15, 0.5, -1.5);
      this.setLeft(true, vec3.lerp(a, b, s), 1);
      return;
    }
    const a = KNOT_CENTER.add(new vec3(-4, 0.8, 2.5));
    const b = KNOT_CENTER.add(new vec3(-13, 0.8, 2.5));
    this.placeHand(vec3.lerp(a, b, s), PINCH_CURL);
  }

  private placeRig(rig: GhostHandRig, local: vec3, yawDeg: number, curl: number): void {
    if (!rig) return;
    const rope = this.ropeTransform();
    rig.place({ target: rope.getWorldTransform().multiplyPoint(local), yawDeg: yawDeg, pitchDeg: HAND_PITCH_DEG, curl: curl, rollDeg: HAND_ROLL_DEG });
  }

  private setLeft(on: boolean, local: vec3, curl: number): void {
    this.leftShown = on && !!this.leftRig;
    if (!this.leftRig) return;
    this.leftRig.setVisible(this.leftShown);
    if (this.leftShown) this.placeRig(this.leftRig, local, LEFT_YAW_DEG, curl);
  }

  private buildRigHands(): boolean {
    const right = new GhostHandRig(this.rightHandRig, false);
    if (!right.isValid()) return false;
    this.rigMode = true;
    this.rightRig = right;
    this.rightHandRig.setParent(this.handRoot);
    this.rigMat = this.makeMat(this.rigMaterial);
    const rp = this.rigMat.mainPass as any;
    rp.twoSided = false;
    rp.depthWrite = true;
    right.setMaterial(this.rigMat);
    if (this.leftHandRig) {
      const left = new GhostHandRig(this.leftHandRig, true);
      if (left.isValid()) {
        this.leftRig = left;
        this.leftHandRig.setParent(this.handRoot);
        left.setMaterial(this.rigMat);
        left.setVisible(false);
      }
    }
    print("[GhostHandsGhostController] rigged IK ghost hands: right" + (this.leftRig ? " + left" : ""));
    return true;
  }

  /** Put the hand root (pinch point) at a rope-local position with the step yaw. */
  private placeHand(local: vec3, curl: number): void {
    const rope = this.ropeTransform();
    const t = this.handRoot.getTransform();
    t.setWorldPosition(rope.getWorldTransform().multiplyPoint(local));
    const yaw = (GHOST_HAND_YAW_DEG[this.step - 1] || 0) * DEG;
    t.setWorldRotation(rope.getWorldRotation().multiply(quat.angleAxis(yaw, vec3.up())));
    this.setCurl(curl);
  }

  private setCurl(curl: number): void {
    if (this.ikMode) return;
    const c = clamp01(curl);
    for (const f of this.fingers) {
      for (let i = 0; i < f.joints.length; i++) {
        f.joints[i].getTransform().setLocalRotation(quat.angleAxis(-c * f.maxAngles[i], vec3.right()));
      }
    }
    if (this.thumbBase) {
      const n = clamp01(c / PINCH_CURL);
      const dir = vec3.lerp(this.thumbOpenDir, this.thumbPinchDir, n).normalize();
      const bt = this.thumbBase.getTransform();
      bt.setLocalRotation(quat.rotationFromTo(new vec3(0, 0, -1), dir));
      bt.setLocalScale(new vec3(1, 1, 1 + (this.thumbPinchScale - 1) * n));
      this.thumbJoint.getTransform().setLocalRotation(quat.angleAxis(-(1 - n) * 25 * DEG, vec3.right()));
    }
  }

  // ------------------------------------------------------------------ visibility / alpha

  private show(): void {
    this.fading = false;
    this.visible = true;
    this.alpha = this.roundAlpha;
    this.applyAlpha();
    this.applyVisibility();
  }

  private applyVisibility(): void {
    if (this.visualRoot) this.visualRoot.enabled = this.visible;
    if (this.tubeObj) this.tubeObj.enabled = this.visible && this.tipShown && this.lastTubeT >= 0;
  }

  private applyAlpha(): void {
    const c = this.ghostColor;
    this.setColor(this.handMat, new vec4(c.x, c.y, c.z, this.alpha));
    this.setColor(this.rigMat, new vec4(c.x, c.y, c.z, this.alpha));
    this.setColor(this.rimMat, new vec4(c.x, c.y, c.z, this.alpha * 0.35));
    this.setColor(this.tipMat, new vec4(c.x, c.y, c.z, this.alpha * 0.8));
  }

  private setColor(m: Material, col: vec4): void {
    if (m) (m.mainPass as any).baseColor = col;
  }

  private makeMat(src?: Material): Material {
    const m = (src || this.baseMaterial).clone();
    const pass = m.mainPass as any;
    pass.blendMode = BlendMode.Normal;
    pass.depthWrite = false;
    pass.twoSided = true;
    return m;
  }

  // ------------------------------------------------------------------ ghost tip tube

  private updateTube(path: vec3[], pathT: number): void {
    if (!this.tubeBuilder || !this.tubeObj) return;
    if (Math.abs(pathT - this.lastTubeT) < 1e-4 && this.lastTubeT >= 0) return;
    const len = Math.max(1e-3, polylineLength(path));
    const seg = pathSegment(path, Math.max(0, pathT - GHOST_TIP_TRAIL_CM / len), pathT);
    const pts = resampleByLength(seg, 0.8);
    this.lastTubeT = pathT;
    if (polylineLength(seg) < 0.1 || pts.length < 2) {
      this.lastTubeT = -1;
      this.applyVisibility();
      return;
    }
    const mb = this.tubeBuilder;
    if (mb.getIndicesCount() > 0) mb.eraseIndices(0, mb.getIndicesCount());
    if (mb.getVerticesCount() > 0) mb.eraseVertices(0, mb.getVerticesCount());
    const r = Math.max(0.05, this.ghostTipDiameterCm * 0.5);
    const sides = 8;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let t = b.sub(a);
      t = t.length > 1e-6 ? t.normalize() : new vec3(1, 0, 0);
      const ref = Math.abs(t.y) > 0.9 ? vec3.right() : vec3.up();
      const n = ref.cross(t).normalize();
      const bn = t.cross(n);
      for (let j = 0; j < sides; j++) {
        const ang = (j / sides) * Math.PI * 2;
        const d = n.uniformScale(Math.cos(ang)).add(bn.uniformScale(Math.sin(ang)));
        const p = pts[i].add(d.uniformScale(r));
        verts.push(p.x, p.y, p.z, d.x, d.y, d.z, j / sides, i / (pts.length - 1));
      }
      if (i > 0) {
        const r0 = (i - 1) * sides;
        const r1 = i * sides;
        for (let j = 0; j < sides; j++) {
          const j1 = (j + 1) % sides;
          idx.push(r0 + j, r1 + j, r1 + j1, r0 + j, r1 + j1, r0 + j1);
        }
      }
    }
    mb.appendVerticesInterleaved(verts);
    mb.appendIndices(idx);
    if (mb.isValid()) {
      mb.updateMesh();
      if (!this.tubeAssigned) {
        this.tubeVisual.mesh = mb.getMesh();
        this.tubeAssigned = true;
      }
    }
    this.applyVisibility();
  }

  // ------------------------------------------------------------------ hand construction

  private buildIkHand(): void {
    this.ikMode = true;
    const mesh = this.ghostHandMesh;
    const pivot = global.scene.createSceneObject("IkHand");
    pivot.setParent(this.handRoot);
    const mn = mesh.aabbMin;
    const mx = mesh.aabbMax;
    const center = mn.add(mx).uniformScale(0.5);
    const size = mx.sub(mn);
    const extent = Math.max(size.x, size.y, size.z, 1e-3);
    const s = extent >= 12 && extent <= 30 ? 1 : this.handLengthCm / extent;
    const e = this.ikHandRotationDeg;
    const rot = quat.fromEulerAngles(e.x * DEG, e.y * DEG, e.z * DEG);
    // Rotated, scaled bounds relative to the mesh centre -> fingertip end (min z) near origin.
    let minY = Number.MAX_VALUE;
    let minZ = Number.MAX_VALUE;
    for (let i = 0; i < 8; i++) {
      const corner = new vec3(i & 1 ? size.x : -size.x, i & 2 ? size.y : -size.y, i & 4 ? size.z : -size.z);
      const p = rot.multiplyVec3(corner.uniformScale(0.5 * s));
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
    }
    const pt = pivot.getTransform();
    pt.setLocalRotation(rot);
    pt.setLocalScale(new vec3(s, s, s));
    pt.setLocalPosition(new vec3(0, -minY * 0.6, -minZ - 1.5));
    this.addMeshVisual(pivot, "IkHandMesh", mesh, this.handMat, center.uniformScale(-1), 1);
    this.addMeshVisual(pivot, "IkHandRim", mesh, this.rimMat, center.uniformScale(-1.06), 1.06);
    print("[GhostHandsGhostController] IK hand mesh extent " + extent.toFixed(1) + " cm, scale " + s.toFixed(3));
  }

  private addMeshVisual(parent: SceneObject, name: string, mesh: RenderMesh, mat: Material, pos: vec3, scale: number): void {
    const o = global.scene.createSceneObject(name);
    o.setParent(parent);
    o.getTransform().setLocalPosition(pos);
    o.getTransform().setLocalScale(new vec3(scale, scale, scale));
    const v = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    v.mesh = mesh;
    v.mainMaterial = mat;
  }

  /** Procedural hand: palm-down, fingers toward -Z, wrist toward +Z; knuckle line at z = 0
   *  in the HandOffset frame, which is shifted so the index tip at PINCH_CURL is the origin. */
  private buildProceduralHand(): void {
    this.ikMode = false;
    const offsetObj = global.scene.createSceneObject("HandOffset");
    offsetObj.setParent(this.handRoot);
    this.addBox(offsetObj, "Palm", 8.5, 2.2, 9.5, new vec3(0, 0, 4.75));
    this.addBox(offsetObj, "Wrist", 6, 2.4, 4, new vec3(0, -0.1, 11.2));
    const fingerX = [-2.9, -0.95, 0.95, 2.8];
    const fingerScale = [1.0, 1.08, 1.0, 0.8];
    const baseLens = [4, 2.5, 2];
    const maxAngles = [35 * DEG, 45 * DEG, 30 * DEG];
    let indexTip = vec3.zero();
    for (let f = 0; f < 4; f++) {
      const lens = baseLens.map((l) => l * fingerScale[f]);
      const knuckle = new vec3(fingerX[f], -0.3, 0);
      const rig: FingerRig = { joints: [], maxAngles: maxAngles };
      let parent = offsetObj;
      for (let s = 0; s < 3; s++) {
        const j = global.scene.createSceneObject("F" + f + "J" + s);
        j.setParent(parent);
        j.getTransform().setLocalPosition(s === 0 ? knuckle : new vec3(0, 0, -lens[s - 1]));
        const w = 1.75 - s * 0.15;
        this.addBox(j, "Seg", w, 1.6 - s * 0.15, lens[s], new vec3(0, 0, -lens[s] * 0.5));
        rig.joints.push(j);
        parent = j;
      }
      this.fingers.push(rig);
      if (f === 0) {
        // Forward kinematics in the Y/Z plane at PINCH_CURL.
        let a = 0, y = 0, z = 0;
        for (let s = 0; s < 3; s++) {
          a -= PINCH_CURL * maxAngles[s];
          y += lens[s] * Math.sin(a);
          z += -lens[s] * Math.cos(a);
        }
        indexTip = knuckle.add(new vec3(0, y, z));
      }
    }
    offsetObj.getTransform().setLocalPosition(indexTip.uniformScale(-1));
    // Thumb: 2 segments from the palm's left (index) side, steered toward the pinch target.
    const thumbPos = new vec3(-4.4, -0.7, 3.4);
    this.thumbBase = global.scene.createSceneObject("ThumbBase");
    this.thumbBase.setParent(offsetObj);
    this.thumbBase.getTransform().setLocalPosition(thumbPos);
    this.addBox(this.thumbBase, "Seg", 1.9, 1.7, 3.4, new vec3(0, 0, -1.7));
    this.thumbJoint = global.scene.createSceneObject("ThumbJ1");
    this.thumbJoint.setParent(this.thumbBase);
    this.thumbJoint.getTransform().setLocalPosition(new vec3(0, 0, -3.4));
    this.addBox(this.thumbJoint, "Seg", 1.7, 1.5, 2.8, new vec3(0, 0, -1.4));
    const toTarget = indexTip.sub(thumbPos);
    this.thumbPinchDir = toTarget.normalize();
    this.thumbPinchScale = Math.max(0.6, Math.min(1.6, toTarget.length / 6.2));
    this.setCurl(0.1);
  }

  private addBox(parent: SceneObject, name: string, w: number, h: number, l: number, c: vec3): void {
    const o = global.scene.createSceneObject(name);
    o.setParent(parent);
    const v = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    v.mesh = this.boxMesh(w, h, l, c);
    v.mainMaterial = this.handMat;
    const rim = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rim.mesh = this.boxMesh(w + 0.25, h + 0.25, l + 0.25, c);
    rim.mainMaterial = this.rimMat;
  }

  private boxMesh(w: number, h: number, l: number, c: vec3): RenderMesh {
    const mb = new MeshBuilder(VERT_LAYOUT);
    mb.topology = MeshTopology.Triangles;
    mb.indexType = MeshIndexType.UInt16;
    const hx = w / 2, hy = h / 2, hz = l / 2;
    // [normal, u axis, v axis] per face
    const faces: number[][][] = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const verts: number[] = [];
    const idx: number[] = [];
    faces.forEach((f, fi) => {
      const [n, u, vv] = f;
      for (let k = 0; k < 4; k++) {
        const su = k === 1 || k === 2 ? 1 : -1;
        const sv = k >= 2 ? 1 : -1;
        const px = (n[0] + u[0] * su + vv[0] * sv) * hx + c.x;
        const py = (n[1] + u[1] * su + vv[1] * sv) * hy + c.y;
        const pz = (n[2] + u[2] * su + vv[2] * sv) * hz + c.z;
        verts.push(px, py, pz, n[0], n[1], n[2], (su + 1) / 2, (sv + 1) / 2);
      }
      const b = fi * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    mb.appendVerticesInterleaved(verts);
    mb.appendIndices(idx);
    mb.updateMesh();
    return mb.getMesh();
  }
}
