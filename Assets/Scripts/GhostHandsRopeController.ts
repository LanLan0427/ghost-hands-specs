// GhostHandsRopeController.ts
// Owns: the procedural rope tube (MeshBuilder) built from the rope centre-line, on a
//   child "RopeVisual" SceneObject; show/hide; rebuild on demand. All geometry is
//   ROPE-LOCAL (this SceneObject's local space, cm).
// @inputs: baseMaterial (Material, lit PBR, cloned), ropeColor (vec4), ropeDiameterCm,
//   tubeSides, samplesPerSegment (catmull-rom density), ringSpacingCm (resample spacing).
// Must not: call sibling components, disable its own SceneObject, use UIKit/Text,
//   or do anything cross-component in onAwake.

import {
  catmullRom,
  composeRope,
  composeTightened,
  resampleByLength,
} from "./GhostHandsKnotData";

const MAX_VERTS = 65000;

@component
export class GhostHandsRopeController extends BaseScriptComponent {
  @input
  @hint("Lit PBR material asset; cloned at runtime and tinted with ropeColor")
  baseMaterial: Material;

  @input
  @widget(new ColorWidget())
  ropeColor: vec4 = new vec4(0.953, 0.922, 0.867, 1);

  @input
  @hint("Rope tube diameter in cm")
  ropeDiameterCm: number = 1;

  @input
  @hint("Vertices around the tube")
  tubeSides: number = 12;

  @input
  @hint("Catmull-Rom samples per control segment")
  samplesPerSegment: number = 3;

  @input
  @hint("Ring spacing (cm) after smoothing")
  ringSpacingCm: number = 0.6;

  private visualObj: SceneObject = null;
  private rmv: RenderMeshVisual = null;
  private builder: MeshBuilder = null;
  private material: Material = null;
  private visible = false;
  private pointCount = 0;
  private hasStepState = false;
  private lastStep = -1;
  private lastT = 0;
  private lastTip: vec3 | null = null;

  onAwake(): void {
    this.visualObj = global.scene.createSceneObject("RopeVisual");
    this.visualObj.setParent(this.getSceneObject());
    const tr = this.visualObj.getTransform();
    tr.setLocalPosition(vec3.zero());
    tr.setLocalRotation(quat.quatIdentity());
    tr.setLocalScale(vec3.one());

    if (!this.baseMaterial) {
      print("[GhostHandsRopeController] ERROR: baseMaterial is not wired - rope visuals disabled.");
    } else {
      this.material = this.baseMaterial.clone();
      this.material.mainPass.baseColor = this.ropeColor;

      this.builder = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
      ]);
      this.builder.topology = MeshTopology.Triangles;
      this.builder.indexType = MeshIndexType.UInt16;

      this.rmv = this.visualObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      this.rmv.mainMaterial = this.material;
      this.resetShape();
      if (this.builder.isValid()) {
        this.rmv.mesh = this.builder.getMesh();
      }
    }
    this.setVisible(false);
  }

  // ------------------------------------------------------------ public API

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.visualObj) this.visualObj.enabled = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  resetShape(): void {
    this.hasStepState = false;
    this.rebuild(composeRope(1, 0, null));
  }

  setStepProgress(step: number, t: number, tipLocal: vec3 | null): void {
    if (this.hasStepState && step === this.lastStep && Math.abs(t - this.lastT) < 0.002) {
      const a = this.lastTip;
      const b = tipLocal;
      const tipSame = (!a && !b) || (a && b && a.distance(b) < 0.02);
      if (tipSame) return;
    }
    this.hasStepState = true;
    this.lastStep = step;
    this.lastT = t;
    this.lastTip = tipLocal ? new vec3(tipLocal.x, tipLocal.y, tipLocal.z) : null;
    this.rebuild(composeRope(step, t, tipLocal));
  }

  setTightenProgress(k: number): void {
    this.hasStepState = false;
    this.rebuild(composeTightened(k));
  }

  getWorldPosition(): vec3 {
    return this.getSceneObject().getTransform().getWorldPosition();
  }

  getPointCount(): number {
    return this.pointCount;
  }

  // ------------------------------------------------------------ mesh build

  /** Rope-local control centre-line of the current shape (for tests). */
  getControlPoints(): vec3[] {
    return this.lastControl.slice();
  }

  private lastControl: vec3[] = [];

  private rebuild(control: vec3[]): void {
    if (!this.builder || !control || control.length < 2) return;
    this.lastControl = control.slice();
    const smooth = catmullRom(control, Math.max(1, this.samplesPerSegment));
    let pts = resampleByLength(smooth, Math.max(0.05, this.ringSpacingCm));
    if (pts.length < 2) return;

    const sides = Math.max(3, Math.floor(this.tubeSides));
    const ringVerts = sides + 1;
    const maxRings = Math.floor((MAX_VERTS - 2 * (sides + 2)) / ringVerts) - 2;
    if (pts.length > maxRings) pts = resampleByLength(pts, (this.ringSpacingCm * pts.length) / maxRings + 0.01);
    const n = pts.length;
    const r = Math.max(0.01, this.ropeDiameterCm * 0.5);

    // Tangents.
    const tans: vec3[] = [];
    for (let i = 0; i < n; i++) {
      const d = pts[Math.min(n - 1, i + 1)].sub(pts[Math.max(0, i - 1)]);
      tans.push(d.length > 1e-6 ? d.normalize() : i > 0 ? tans[i - 1] : new vec3(1, 0, 0));
    }

    // Parallel-transport frames.
    const normals: vec3[] = [];
    let nrm = this.perpendicular(tans[0]);
    for (let i = 0; i < n; i++) {
      const t = tans[i];
      const proj = nrm.sub(t.uniformScale(nrm.dot(t)));
      nrm = proj.length > 1e-4 ? proj.normalize() : this.perpendicular(t);
      normals.push(nrm);
    }

    const verts: number[] = [];
    const idx: number[] = [];
    let len = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) len += pts[i].distance(pts[i - 1]);
      const t = tans[i];
      const nn = normals[i];
      const bb = t.cross(nn);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const dir = new vec3(nn.x * c + bb.x * s, nn.y * c + bb.y * s, nn.z * c + bb.z * s);
        const p = pts[i];
        verts.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r, dir.x, dir.y, dir.z, j / sides, len);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const r0 = i * ringVerts;
      const r1 = (i + 1) * ringVerts;
      for (let j = 0; j < sides; j++) {
        const v00 = r0 + j, v01 = r0 + j + 1, v10 = r1 + j, v11 = r1 + j + 1;
        idx.push(v00, v01, v10, v01, v11, v10);
      }
    }
    this.appendCap(verts, idx, pts[0], tans[0], normals[0], r, sides, false, 0);
    this.appendCap(verts, idx, pts[n - 1], tans[n - 1], normals[n - 1], r, sides, true, len);

    const b = this.builder;
    if (b.getVerticesCount() > 0) b.eraseVertices(0, b.getVerticesCount());
    if (b.getIndicesCount() > 0) b.eraseIndices(0, b.getIndicesCount());
    b.appendVerticesInterleaved(verts);
    b.appendIndices(idx);
    b.updateMesh();
    this.pointCount = n;
    if (this.rmv && b.isValid() && !this.rmv.mesh) this.rmv.mesh = b.getMesh();
  }

  /** Flat fan cap; atEnd = true faces +tangent, else -tangent. */
  private appendCap(
    verts: number[], idx: number[], p: vec3, t: vec3, nn: vec3,
    r: number, sides: number, atEnd: boolean, v: number,
  ): void {
    const base = verts.length / 8;
    const fn = atEnd ? t : t.uniformScale(-1);
    const bb = t.cross(nn);
    verts.push(p.x, p.y, p.z, fn.x, fn.y, fn.z, 0.5, v);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const dx = nn.x * c + bb.x * s, dy = nn.y * c + bb.y * s, dz = nn.z * c + bb.z * s;
      verts.push(p.x + dx * r, p.y + dy * r, p.z + dz * r, fn.x, fn.y, fn.z, 0.5 + c * 0.5, v);
    }
    for (let j = 0; j < sides; j++) {
      const k0 = base + 1 + j;
      const k1 = base + 2 + j;
      if (atEnd) idx.push(base, k0, k1);
      else idx.push(base, k1, k0);
    }
  }

  /** Any unit vector perpendicular to t (robust for near-vertical tangents). */
  private perpendicular(t: vec3): vec3 {
    const ref = Math.abs(t.y) < 0.9 ? new vec3(0, 1, 0) : new vec3(1, 0, 0);
    const p = ref.cross(t);
    return p.length > 1e-6 ? p.normalize() : new vec3(0, 0, 1);
  }
}
