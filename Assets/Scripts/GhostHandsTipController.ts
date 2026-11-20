// GhostHandsTipController.ts
// Owns: the pinchable glowing rope tip on "RopeTip" — per-step path following (rope-local
// cm), checkpoint ratchet, off-path warning + slide-back, snap-to-end success, the TipGlow
// visuals (core + pulsing halo), and debugDrag/debugRelease for headless tests.
// Expects: ropeRoot (the "Rope" SceneObject; path space), baseMaterial (unlit, cloned per
// visual). Creates its own sphere collider + Interactable if missing.
// Must not: disable its own SceneObject, touch sibling components, or subscribe to IK
// events in onAwake (IK subscriptions bind in OnStartEvent).
// Produces: prepareStep/activate/deactivate, state getters, onStepComplete(step),
// onOffPath, onBackOnPath.

import { Interactable } from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractorEvent } from "InteractionKit.lspkg/Core/Interactor/InteractorEvent";
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event";
import {
  stepPath,
  checkpointProgress,
  pointAtProgress,
  tangentAtProgress,
  nearestOnPolyline,
  clamp01,
  lerpVec3,
} from "./GhostHandsKnotData";
import { TipColorState } from "./GhostHandsSceneContracts";

@component
export class GhostHandsTipController extends BaseScriptComponent {
  @input ropeRoot: SceneObject;
  @input baseMaterial: Material;
  @input offPathThresholdCm: number = 3;
  @input snapProgress: number = 0.97;
  @input @widget(new ColorWidget()) tipGlowColor: vec4 = new vec4(1, 1, 1, 1);
  @input @widget(new ColorWidget()) warningColor: vec4 = new vec4(1.0, 0.604, 0.235, 1);
  @input @widget(new ColorWidget()) successColor: vec4 = new vec4(0.357, 0.89, 0.49, 1);
  @input slideBackSec: number = 0.3;
  @input colliderRadiusCm: number = 2;
  @input glowDiameterCm: number = 1.6;
  @input forwardWindow: number = 0.25;

  private stepCompleteEvent = new Event<number>();
  readonly onStepComplete: PublicApi<number> = this.stepCompleteEvent;
  private offPathEvent = new Event<void>();
  readonly onOffPath: PublicApi<void> = this.offPathEvent;
  private backOnPathEvent = new Event<void>();
  readonly onBackOnPath: PublicApi<void> = this.backOnPathEvent;

  private step = 1;
  private path: vec3[] = stepPath(1);
  private checkpoints: number[] = checkpointProgress(1);
  private progress = 0;
  private lastCheckpoint = 0;
  private colorState: TipColorState = "none";
  private active = false;
  private dragging = false;
  private sliding = false;
  private offPathNotified = false;
  private prepared = false;
  private localPos: vec3 = vec3.zero();

  private slideFrom: vec3 = vec3.zero();
  private slideTo: vec3 = vec3.zero();
  private slideT = 0;

  private collider: ColliderComponent | null = null;
  private interactable: Interactable | null = null;
  private glowRoot: SceneObject | null = null;
  private coreMat: Material | null = null;
  private haloMat: Material | null = null;

  onAwake(): void {
    if (!this.ropeRoot) {
      print("[GhostHandsTipController] ERROR: ropeRoot is not wired — tip positions use own parent space fallback (identity).");
    }
    let col = this.sceneObject.getComponent("Physics.ColliderComponent") as ColliderComponent;
    if (!col) {
      col = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent;
      const shape = Shape.createSphereShape();
      shape.radius = this.colliderRadiusCm;
      col.shape = shape;
      col.fitVisual = false;
    }
    this.collider = col;
    let ia = this.sceneObject.getComponent(Interactable.getTypeName()) as unknown as Interactable;
    if (!ia) {
      ia = this.sceneObject.createComponent(Interactable.getTypeName()) as unknown as Interactable;
    }
    this.interactable = ia;
    this.buildVisuals();
    this.setInteraction(false);
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  private onStart(): void {
    const ia = this.interactable;
    if (ia) {
      ia.onTriggerStart.add((_e: InteractorEvent) => this.handleTriggerStart());
      ia.onTriggerUpdate.add((e: InteractorEvent) => this.handleTriggerUpdate(e));
      ia.onTriggerEnd.add((_e: InteractorEvent) => this.handleRelease());
      ia.onTriggerEndOutside.add((_e: InteractorEvent) => this.handleRelease());
      ia.onTriggerCanceled.add((_e: InteractorEvent) => this.handleRelease());
    }
    if (!this.prepared) this.prepareStep(1);
  }

  // ------------------------------------------------------------ public API

  prepareStep(step: number): void {
    this.prepared = true;
    this.step = Math.max(1, Math.floor(step));
    this.path = stepPath(this.step);
    this.checkpoints = checkpointProgress(this.step);
    this.progress = 0;
    this.lastCheckpoint = 0;
    this.localPos = this.path[0];
    this.dragging = false;
    this.sliding = false;
    this.offPathNotified = false;
    this.active = false;
    this.setInteraction(false);
    this.setColorState("none");
    this.placeTip();
  }

  activate(): void {
    this.active = true;
    this.setColorState("glow");
    this.setInteraction(true);
  }

  deactivate(): void {
    this.active = false;
    this.dragging = false;
    this.sliding = false;
    this.setColorState("none");
    this.setInteraction(false);
  }

  getColorState(): TipColorState { return this.colorState; }
  isGlowing(): boolean { return this.colorState !== "none"; }
  isActive(): boolean { return this.active; }
  isDragging(): boolean { return this.dragging; }
  isSliding(): boolean { return this.sliding; }
  getProgress(): number { return this.progress; }
  getLastCheckpointProgress(): number { return this.lastCheckpoint; }
  getLocalPosition(): vec3 { return this.localPos; }
  getWorldPosition(): vec3 { return this.localToWorld(this.localPos); }
  getStep(): number { return this.step; }

  debugDrag(progress: number, offPathCm: number): void {
    if (!this.active) {
      print("[GhostHandsTipController] debugDrag ignored: tip is not active.");
      return;
    }
    if (this.sliding) this.sliding = false;
    this.dragging = true;
    const t = clamp01(progress);
    if (offPathCm > this.offPathThresholdCm) {
      const tan = tangentAtProgress(this.path, t);
      let perp = new vec3(-tan.z, 0, tan.x);
      perp = perp.length > 1e-6 ? perp.normalize() : new vec3(1, 0, 0);
      this.localPos = pointAtProgress(this.path, t).add(perp.uniformScale(offPathCm));
      this.goOffPath();
      this.placeTip();
    } else {
      this.applyOnPath(t);
    }
  }

  debugRelease(): void {
    this.handleRelease();
  }

  // ------------------------------------------------------------ drag logic

  private handleTriggerStart(): void {
    if (!this.active || this.sliding) return;
    this.dragging = true;
  }

  private handleTriggerUpdate(e: InteractorEvent): void {
    if (!this.active || this.sliding || !this.dragging) return;
    const it = e && e.interactor;
    if (!it || !it.startPoint || !it.direction) return;
    const o = it.startPoint;
    const d = it.direction;
    if (Math.abs(d.y) < 1e-4) return;
    const planeY = this.ropeRoot ? this.ropeRoot.getTransform().getWorldPosition().y : o.y;
    const s = (planeY - o.y) / d.y;
    if (s < 0) return;
    const local = this.worldToLocal(o.add(d.uniformScale(s)));
    const tMin = Math.max(this.lastCheckpoint, this.progress - 0.3);
    const tMax = Math.min(1, this.progress + this.forwardWindow);
    const n = nearestOnPolyline(this.path, local, true, tMin, Math.max(tMin, tMax));
    if (n.distance > this.offPathThresholdCm) {
      this.localPos = new vec3(local.x, n.point.y, local.z);
      this.goOffPath();
      this.placeTip();
    } else {
      this.applyOnPath(n.t);
    }
  }

  private goOffPath(): void {
    this.setColorState("warning");
    if (!this.offPathNotified) {
      this.offPathNotified = true;
      this.offPathEvent.invoke();
    }
  }

  private applyOnPath(t: number): void {
    if (this.colorState === "warning") {
      this.offPathNotified = false;
      this.backOnPathEvent.invoke();
    }
    this.setColorState("glow");
    this.progress = Math.max(this.lastCheckpoint, t);
    this.localPos = pointAtProgress(this.path, this.progress);
    for (const c of this.checkpoints) {
      if (c <= this.progress && c > this.lastCheckpoint) this.lastCheckpoint = c;
    }
    if (this.progress >= this.snapProgress) {
      this.progress = 1;
      this.localPos = this.path[this.path.length - 1];
      this.dragging = false;
      this.active = false;
      this.setInteraction(false);
      this.setColorState("success");
      this.placeTip();
      this.stepCompleteEvent.invoke(this.step);
      return;
    }
    this.placeTip();
  }

  private handleRelease(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.colorState === "warning") {
      this.progress = this.lastCheckpoint;
      this.slideFrom = this.localPos;
      this.slideTo = pointAtProgress(this.path, this.lastCheckpoint);
      this.slideT = 0;
      this.sliding = true;
    }
  }

  private onUpdate(): void {
    if (this.sliding) {
      this.slideT += getDeltaTime() / Math.max(0.01, this.slideBackSec);
      const k = clamp01(this.slideT);
      const eased = 1 - (1 - k) * (1 - k) * (1 - k);
      this.localPos = lerpVec3(this.slideFrom, this.slideTo, eased);
      this.placeTip();
      if (k >= 1) {
        this.sliding = false;
        this.offPathNotified = false;
        if (this.active) this.setColorState("glow");
      }
    }
    if (this.haloMat && this.colorState !== "none") {
      const c = this.colorFor(this.colorState);
      const a = this.colorState === "glow"
        ? 0.3 * (0.7 + 0.3 * Math.sin(getTime() * Math.PI * 2 * 1.5))
        : 0.3;
      this.haloMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, a);
    }
  }

  // ------------------------------------------------------------ helpers

  private setInteraction(on: boolean): void {
    if (this.interactable) this.interactable.enabled = on;
    if (this.collider) this.collider.enabled = on;
  }

  private setColorState(s: TipColorState): void {
    this.colorState = s;
    if (this.glowRoot) this.glowRoot.enabled = s !== "none";
    if (s === "none") return;
    const c = this.colorFor(s);
    if (this.coreMat) this.coreMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, 0.95);
    if (this.haloMat) this.haloMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, 0.3);
  }

  /** Live colour of the user's glowing tip core (for tests). */
  getCoreColor(): vec4 {
    return this.coreMat ? this.coreMat.mainPass.baseColor : new vec4(0, 0, 0, 0);
  }

  private colorFor(s: TipColorState): vec4 {
    if (s === "warning") return this.warningColor;
    if (s === "success") return this.successColor;
    return this.tipGlowColor;
  }

  private localToWorld(p: vec3): vec3 {
    return this.ropeRoot ? this.ropeRoot.getTransform().getWorldTransform().multiplyPoint(p) : p;
  }

  private worldToLocal(p: vec3): vec3 {
    return this.ropeRoot ? this.ropeRoot.getTransform().getInvertedWorldTransform().multiplyPoint(p) : p;
  }

  private placeTip(): void {
    this.getTransform().setWorldPosition(this.localToWorld(this.localPos));
  }

  private buildVisuals(): void {
    const root = global.scene.createSceneObject("TipGlow");
    root.setParent(this.sceneObject);
    root.getTransform().setLocalPosition(vec3.zero());
    this.glowRoot = root;
    if (!this.baseMaterial) {
      print("[GhostHandsTipController] ERROR: baseMaterial not wired — tip visuals skipped (logic still runs).");
      return;
    }
    const r = this.glowDiameterCm * 0.5;
    this.coreMat = this.makeSphere(root, "TipCore", r);
    this.haloMat = this.makeSphere(root, "TipHalo", r * 1.7);
  }

  private makeSphere(parent: SceneObject, name: string, radius: number): Material {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const mat = this.baseMaterial.clone();
    mat.mainPass.blendMode = BlendMode.Normal;
    mat.mainPass.depthWrite = false;
    rmv.mainMaterial = mat;
    const mb = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    mb.topology = MeshTopology.Triangles;
    mb.indexType = MeshIndexType.UInt16;
    const lat = 10;
    const lon = 14;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const ph = (j / lon) * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph);
        const ny = Math.cos(th);
        const nz = Math.sin(th) * Math.sin(ph);
        verts.push(nx * radius, ny * radius, nz * radius, nx, ny, nz, j / lon, i / lat);
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = i * (lon + 1) + j;
        const b = a + lon + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    mb.appendVerticesInterleaved(verts);
    mb.appendIndices(idx);
    if (mb.isValid()) {
      rmv.mesh = mb.getMesh();
      mb.updateMesh();
    } else {
      print("[GhostHandsTipController] ERROR: sphere mesh invalid for " + name);
    }
    return mat;
  }
}
