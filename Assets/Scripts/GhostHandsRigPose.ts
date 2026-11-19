// GhostHandsRigPose.ts
// Owns: posing one skinned InteractionKit hand rig (a scene duplicate of the IK prefab's
// RightHandModel / LeftHandModel, Skin + <Side>HandRig + <Side>HandMeshFull) as a ghost hand.
//  - Finger flexion uses the same convention the IK hand simulator uses: joints <finger>-0..2
//    rotate about their local +X; the distal <finger>-3 joints keep their authored offset.
//  - Orientation: palm down, fingers pointing away from the user (-Z, with a small yaw and a
//    downward pitch), wrist toward the user, exactly as the user's own hand would sit.
//  - Placement: the pinch point (midpoint of thumb tip and index tip) lands on the target.
// Expects: the rig root SceneObject; joint names as in the IK rig (wrist, thumb-0..3_end, ...).
// Must not: create components other than setting the mesh material, or touch other objects.

const DEG = Math.PI / 180;

/** Flexion (deg about local +X) for joints 0,1,2 of each long finger: [open, pinch]. */
const FLEX: { [finger: string]: [number[], number[]] } = {
  index: [[12, 8, 4], [44, 34, 22]],
  mid: [[14, 10, 6], [30, 30, 20]],
  ring: [[18, 12, 8], [36, 32, 22]],
  pinky: [[22, 14, 10], [42, 34, 24]],
};
/** Thumb: thumb-1 slerps rest -> opposed (captured from the IK pinch simulation), thumb-2 flexes. */
const THUMB1_PINCH_R = new quat(0.75, 0.433, -0.433, 0.25);
/** Left rig is mirrored across its YZ plane: (w, x, -y, -z). */
const THUMB1_PINCH_L = new quat(0.75, 0.433, 0.433, -0.25);
const THUMB2_FLEX: [number, number] = [6, 22];
const PINCH_CCD_ITERS = 8;

export interface HandPlacement {
  /** World-space point where the thumb/index pinch point should sit. */
  target: vec3;
  /** Degrees the fingers turn from straight-ahead toward +X (right). */
  yawDeg: number;
  /** Degrees the fingers point down below horizontal. */
  pitchDeg: number;
  /** 0 = relaxed open hand, 1 = thumb/index pinch with other fingers curled. */
  curl: number;
  /** Degrees the thumb side is raised (hand rolled onto its pinky edge), like a real rope pinch. */
  rollDeg?: number;
}

export class GhostHandRig {
  readonly root: SceneObject;
  readonly isLeft: boolean;
  private joints: { [name: string]: SceneObject } = {};
  private rest: { [name: string]: quat } = {};
  private srcRot: quat = quat.quatIdentity();
  private valid = false;

  constructor(root: SceneObject, isLeft: boolean) {
    this.root = root;
    this.isLeft = isLeft;
    this.collect(root);
    const need = ["wrist", "mid-0", "index-0", "pinky-0", "index-3_end", "thumb-3_end", "thumb-1", "thumb-2"];
    this.valid = need.every((n) => !!this.joints[n]);
    if (!this.valid) {
      print("[GhostHandRig] ERROR: rig '" + root.name + "' is missing joints; ghost hand disabled.");
      return;
    }
    // Hand frame in root-local space (knuckle positions do not depend on finger flexion).
    const inv = root.getTransform().getInvertedWorldTransform();
    const p = (n: string) => inv.multiplyPoint(this.joints[n].getTransform().getWorldPosition());
    const f = p("mid-0").sub(p("wrist")).normalize();
    let s = p("index-0").sub(p("pinky-0"));
    s = s.sub(f.uniformScale(s.dot(f))).normalize();
    this.srcRot = quat.lookAt(f, f.cross(s));
  }

  isValid(): boolean {
    return this.valid;
  }

  /** CCD the thumb and index chains toward their shared midpoint so the tips meet (x curl). */
  private solvePinch(c: number): void {
    if (c <= 0.01) return;
    const tt = this.joints["thumb-3_end"].getTransform();
    const it = this.joints["index-3_end"].getTransform();
    for (let iter = 0; iter < PINCH_CCD_ITERS; iter++) {
      const a = tt.getWorldPosition();
      const b = it.getWorldPosition();
      const mid = a.add(b).uniformScale(0.5);
      // Each tip moves toward the midpoint by the curl weight (c = 1 -> touching).
      this.ccd(["thumb-2", "thumb-1", "thumb-0"], tt, vec3.lerp(a, mid, c));
      this.ccd(["index-2", "index-1", "index-0"], it, vec3.lerp(b, mid, c));
      if (tt.getWorldPosition().distance(it.getWorldPosition()) < 0.4) break;
    }
  }

  private ccd(chain: string[], tip: Transform, target: vec3): void {
    for (const n of chain) {
      const jt = this.joints[n].getTransform();
      const pj = jt.getWorldPosition();
      const v1 = tip.getWorldPosition().sub(pj);
      const v2 = target.sub(pj);
      if (v1.length < 1e-4 || v2.length < 1e-4) continue;
      const r = quat.rotationFromTo(v1.normalize(), v2.normalize());
      jt.setWorldRotation(r.multiply(jt.getWorldRotation()));
    }
  }


  /** Assign the ghost material to every mesh visual in the rig and drop any others. */
  setMaterial(mat: Material): void {
    const visit = (o: SceneObject) => {
      const visuals = o.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[];
      for (const v of visuals) v.mainMaterial = mat;
      for (let i = 0; i < o.getChildrenCount(); i++) visit(o.getChild(i));
    };
    visit(this.root);
  }

  setVisible(on: boolean): void {
    this.root.enabled = on;
  }

  /** Pose the fingers, orient the hand, and put the pinch point on the target. */
  place(pl: HandPlacement): void {
    if (!this.valid) return;
    this.setCurl(pl.curl);
    const t = this.root.getTransform();
    const y = pl.yawDeg * DEG;
    const pch = pl.pitchDeg * DEG;
    const F = new vec3(Math.sin(y) * Math.cos(pch), -Math.sin(pch), -Math.cos(y) * Math.cos(pch)).normalize();
    // Index side: left (-X) for a right hand, right (+X) for a left hand.
    let S = new vec3(-Math.cos(y), 0, -Math.sin(y));
    if (this.isLeft) S = S.uniformScale(-1);
    const r = (pl.rollDeg || 0) * DEG;
    S = S.uniformScale(Math.cos(r)).add(vec3.up().uniformScale(Math.sin(r)));
    S = S.sub(F.uniformScale(S.dot(F))).normalize();
    const tgtRot = quat.lookAt(F, F.cross(S));
    t.setWorldRotation(tgtRot.multiply(this.srcRot.invert()));
    t.setWorldPosition(pl.target);
    this.solvePinch(pl.curl < 0 ? 0 : pl.curl > 1 ? 1 : pl.curl);
    const pinch = this.pinchPoint();
    t.setWorldPosition(pl.target.add(pl.target.sub(pinch)));
  }

  /** World midpoint between thumb tip and index tip. */
  pinchPoint(): vec3 {
    const a = this.joints["index-3_end"].getTransform().getWorldPosition();
    const b = this.joints["thumb-3_end"].getTransform().getWorldPosition();
    return a.add(b).uniformScale(0.5);
  }

  /** World distance between thumb tip and index tip (cm). */
  pinchGapCm(): number {
    if (!this.valid) return -1;
    const a = this.joints["index-3_end"].getTransform().getWorldPosition();
    const b = this.joints["thumb-3_end"].getTransform().getWorldPosition();
    return a.distance(b);
  }

  /** Direction the fingers point (wrist -> middle knuckle), world space. */
  fingerDir(): vec3 {
    const w = this.joints["wrist"].getTransform().getWorldPosition();
    return this.joints["mid-0"].getTransform().getWorldPosition().sub(w).normalize();
  }

  /** Back-of-hand normal (palm faces the opposite way), world space. */
  backNormal(): vec3 {
    const f = this.fingerDir();
    const s = this.joints["index-0"].getTransform().getWorldPosition()
      .sub(this.joints["pinky-0"].getTransform().getWorldPosition()).normalize();
    const n = f.cross(s).normalize();
    // Index side flips between hands, so flip back the normal for the left hand.
    return this.isLeft ? n.uniformScale(-1) : n;
  }

  wristWorld(): vec3 {
    return this.joints["wrist"].getTransform().getWorldPosition();
  }

  // ------------------------------------------------------------------ internals

  private setCurl(curl: number): void {
    const c = curl < 0 ? 0 : curl > 1 ? 1 : curl;
    for (const finger in FLEX) {
      const [open, pinch] = FLEX[finger];
      for (let i = 0; i < 3; i++) {
        const j = this.joints[finger + "-" + i];
        if (!j) continue;
        const a = (open[i] + (pinch[i] - open[i]) * c) * DEG;
        j.getTransform().setLocalRotation(quat.angleAxis(a, vec3.right()));
      }
    }
    const t1 = this.joints["thumb-1"];
    if (t1) t1.getTransform().setLocalRotation(quat.slerp(this.rest["thumb-1"], this.isLeft ? THUMB1_PINCH_L : THUMB1_PINCH_R, c));
    const t2 = this.joints["thumb-2"];
    if (t2) {
      const a = (THUMB2_FLEX[0] + (THUMB2_FLEX[1] - THUMB2_FLEX[0]) * c) * DEG;
      t2.getTransform().setLocalRotation(quat.angleAxis(a, vec3.right()));
    }
  }

  private collect(o: SceneObject): void {
    if (!this.joints[o.name]) {
      this.joints[o.name] = o;
      this.rest[o.name] = o.getTransform().getLocalRotation();
    }
    for (let i = 0; i < o.getChildrenCount(); i++) this.collect(o.getChild(i));
  }
}
