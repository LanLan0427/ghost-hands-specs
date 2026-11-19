// GhostHandsPathController.ts
// Owns: the dotted light-blue guide line for the current bowline step - one shared
// MeshBuilder sphere, a pool of maxDots child dots under a "Dots" container, two cloned
// materials (ahead = full alpha, behind = alpha * 0.3), and the off-path pulse animation.
// Expects: lives on the authored "DottedPath" SceneObject; ropeRoot = the "Rope"
// SceneObject (paths are rope-local cm); baseMaterial = an unlit material asset.
// Produces: showPath(step), hide(), isVisible(), setProgress(t), pulse(), getDotCount().
// Must not: call sibling components in onAwake, disable its own SceneObject, use UIKit.

import { stepPath, resampleByLength, cumulativeLengths } from "./GhostHandsKnotData";

@component
export class GhostHandsPathController extends BaseScriptComponent {
  @input ropeRoot: SceneObject;
  @input baseMaterial: Material;
  @input @widget(new ColorWidget()) dotColor: vec4 = new vec4(0.561, 0.827, 1, 0.9);
  @input dotSpacingCm: number = 1.5;
  @input dotDiameterCm: number = 0.6;
  @input yLiftCm: number = 0.25;
  @input maxDots: number = 24;
  @input pulseSec: number = 0.6;

  private container: SceneObject = null;
  private dots: SceneObject[] = [];
  private visuals: RenderMeshVisual[] = [];
  private dotProgress: number[] = [];
  private matAhead: Material = null;
  private matBehind: Material = null;
  private visible: boolean = false;
  private shownCount: number = 0;
  private progress: number = 0;
  private pulseT: number = -1;

  onAwake(): void {
    if (!this.ropeRoot) {
      print("[GhostHandsPathController] ERROR: ropeRoot is not wired - showPath will no-op.");
    }
    this.container = global.scene.createSceneObject("Dots");
    this.container.setParent(this.getSceneObject());
    this.container.enabled = false;

    const count = Math.max(0, Math.floor(this.maxDots));
    let mesh: RenderMesh = null;
    if (!this.baseMaterial) {
      print("[GhostHandsPathController] ERROR: baseMaterial is not wired - dots will be invisible.");
    } else {
      this.matAhead = this.makeMat(this.dotColor.w);
      this.matBehind = this.makeMat(this.dotColor.w * 0.3);
      mesh = this.buildSphere(Math.max(0.01, this.dotDiameterCm) * 0.5, 8, 12);
    }
    for (let i = 0; i < count; i++) {
      const so = global.scene.createSceneObject("Dot" + i);
      so.setParent(this.container);
      so.enabled = false;
      let rmv: RenderMeshVisual = null;
      if (mesh) {
        rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        rmv.mesh = mesh;
        rmv.mainMaterial = this.matAhead;
      }
      this.dots.push(so);
      this.visuals.push(rmv);
      this.dotProgress.push(0);
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  /** Place dots for step 1..4, show the container, reset progress to 0. */
  showPath(step: number): void {
    if (!this.ropeRoot) {
      print("[GhostHandsPathController] showPath ignored: ropeRoot not wired.");
      return;
    }
    const pts = resampleByLength(stepPath(step), this.dotSpacingCm);
    const cum = cumulativeLengths(pts);
    const total = Math.max(1e-6, cum[cum.length - 1]);
    const ropeW = this.ropeRoot.getTransform().getWorldTransform();
    const selfInv = this.getSceneObject().getTransform().getInvertedWorldTransform();
    const lift = new vec3(0, this.yLiftCm, 0);
    let n = 0;
    // Skip index 0: the first point sits under the rope tip.
    for (let i = 1; i < pts.length && n < this.dots.length; i++) {
      const world = ropeW.multiplyPoint(pts[i].add(lift));
      const local = selfInv.multiplyPoint(world);
      const so = this.dots[n];
      const tr = so.getTransform();
      tr.setLocalPosition(local);
      tr.setLocalScale(vec3.one());
      so.enabled = true;
      this.dotProgress[n] = cum[i] / total;
      n++;
    }
    for (let i = n; i < this.dots.length; i++) {
      this.dots[i].enabled = false;
    }
    this.shownCount = n;
    this.pulseT = -1;
    this.container.enabled = true;
    this.visible = true;
    this.setProgress(0);
  }

  hide(): void {
    this.visible = false;
    this.pulseT = -1;
    if (this.container) this.container.enabled = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Dots behind progress t use the dimmed material; the rest stay full. */
  setProgress(t: number): void {
    this.progress = Math.max(0, Math.min(1, t));
    if (!this.matAhead) return;
    for (let i = 0; i < this.shownCount; i++) {
      const rmv = this.visuals[i];
      if (!rmv) continue;
      rmv.mainMaterial = this.dotProgress[i] < this.progress ? this.matBehind : this.matAhead;
    }
  }

  /** Off-path warning: scale dots up to 1.8x and back over pulseSec. */
  pulse(): void {
    if (!this.visible) return;
    this.pulseT = 0;
  }

  getDotCount(): number {
    return this.visible ? this.shownCount : 0;
  }

  private onUpdate(): void {
    if (this.pulseT < 0) return;
    const dur = Math.max(0.05, this.pulseSec);
    this.pulseT += getDeltaTime();
    const u = Math.min(1, this.pulseT / dur);
    const s = 1 + 0.8 * Math.sin(Math.PI * u);
    const sc = new vec3(s, s, s);
    for (let i = 0; i < this.shownCount; i++) {
      this.dots[i].getTransform().setLocalScale(sc);
    }
    if (u >= 1) {
      this.pulseT = -1;
      for (let i = 0; i < this.shownCount; i++) {
        this.dots[i].getTransform().setLocalScale(vec3.one());
      }
    }
  }

  private makeMat(alpha: number): Material {
    const m = this.baseMaterial.clone();
    const c = this.dotColor;
    m.mainPass.baseColor = new vec4(c.x, c.y, c.z, alpha);
    m.mainPass.blendMode = BlendMode.Normal;
    m.mainPass.depthWrite = false;
    return m;
  }

  private buildSphere(r: number, rings: number, segs: number): RenderMesh {
    const mb = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    mb.topology = MeshTopology.Triangles;
    mb.indexType = MeshIndexType.UInt16;
    const verts: number[] = [];
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI;
      const st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j <= segs; j++) {
        const ph = (j / segs) * Math.PI * 2;
        const nx = st * Math.cos(ph), ny = ct, nz = st * Math.sin(ph);
        verts.push(nx * r, ny * r, nz * r, nx, ny, nz, j / segs, i / rings);
      }
    }
    const idx: number[] = [];
    const row = segs + 1;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * row + j, b = a + row;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    mb.appendVerticesInterleaved(verts);
    mb.appendIndices(idx);
    mb.updateMesh();
    return mb.getMesh();
  }
}
