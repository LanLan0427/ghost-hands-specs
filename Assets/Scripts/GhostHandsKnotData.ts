// GhostHandsKnotData.ts
// Owns: authored bowline geometry (all points are ROPE-LOCAL cm: origin = the Rope
// SceneObject, +X right, +Y up off the table, +Z toward the user; table top is y = -0.5),
// per-step tip paths + checkpoints, ghost-hand keyframes, the tightened-knot mapping,
// and pure polyline/spline helpers shared by Rope/Tip/Path/Ghost controllers.
// Expects: nothing (pure data + math, no @inputs).
// Must not: touch the scene, import UIKit, or keep mutable state.

// ---------------------------------------------------------------- raw shapes

function v(x: number, y: number, z: number): vec3 {
  return new vec3(x, y, z);
}

/** Rope before step 1: lying left -> right, working end at the front right. 12 pts. */
export const ROPE_START_SHAPE: vec3[] = [
  v(-30, 0, 2), v(-23, 0, 2), v(-17, 0, 2.1), v(-12, 0, 2.3), v(-8, 0, 2.5), v(-5, 0, 2.8),
  v(-2, 0, 3), v(1, 0, 3.2), v(4, 0, 3.6), v(6, 0, 4), v(8, 0, 4.5), v(10, 0, 5),
];

/** Rope after step 1: standing part from the left, 8 cm loop ("the hole") centred
 *  near (0, 0, -1), tail exiting front-right. Same 12-point count as ROPE_START_SHAPE
 *  so the two can be blended index-by-index. Last point == STEP_PATHS[0] end. */
export const ROPE_LOOP_SHAPE: vec3[] = [
  v(-30, 0, 2), v(-18, 0, 2), v(-8, 0, 2.5), v(-3, 0, 3), v(0, 0.5, 3), v(3.5, 0, 1),
  v(3.5, 0, -3), v(0, 0, -5), v(-3.5, 0, -3), v(-2, 0, 1.5), v(1, -0.2, 3), v(5, 0, 5),
];

/** Tip path per step (index 0 = step 1). Each starts where the previous ends. */
export const STEP_PATHS: vec3[][] = [
  // 1 "Make the hole": tail sweeps round to form the loop and crosses over.
  [v(10, 0, 5), v(8.5, 0, 0.5), v(5, 0, -4), v(0, 0, -6), v(-4.5, 0, -3), v(-4, 0, 1),
   v(-1, 0.6, 3.3), v(2.5, 0.3, 4.3), v(5, 0, 5)],
  // 2 "Up through the hole": dips under the loop (y -0.3) and rises up through it (y +2).
  [v(5, 0, 5), v(3.5, -0.2, 3.2), v(1.8, -0.3, 1.2), v(0.5, -0.3, -0.3), v(0, 0.6, -1),
   v(0, 2, -1.5), v(-1, 1.8, -3)],
  // 3 "Around the tree": goes left, under the standing part, back to the front.
  [v(-1, 1.8, -3), v(-4, 1.5, -2.5), v(-6.5, 1, -0.5), v(-8, -0.3, 2.5), v(-7, 0.4, 5.5),
   v(-4, 1, 5.8), v(-1, 1.5, 4.5)],
  // 4 "Back down the hole": over the front, down through the loop, out beside the tail.
  [v(-1, 1.5, 4.5), v(-0.5, 1.6, 2.5), v(0, 1.4, 0), v(0.3, 0.4, -1), v(0.8, -0.3, -0.4),
   v(2.2, -0.2, 2), v(3.5, 0, 4)],
];

/** Checkpoint vertex indices into STEP_PATHS[i] (always includes 0). */
export const STEP_CHECKPOINT_INDICES: number[][] = [
  [0, 3, 6],
  [0, 3, 5],
  [0, 3, 5],
  [0, 2, 4],
];

/** Centre of the finished knot (rope-local) and how hard Tighten pulls toward it. */
export const KNOT_CENTER: vec3 = v(0, 0.4, 0.5);
export const TIGHTEN_RADIUS_CM = 14;
export const TIGHTEN_PULL = 0.5;

// ---------------------------------------------------------------- ghost keyframes

/** One ghost keyframe over a normalised loop time u in [0,1].
 *  pathT  = progress along the current step path where the ghost tip/pinch is.
 *  liftCm = how high above the ghost tip the pinch point floats (approach/hold).
 *  curl   = finger curl 0 (open) .. 1 (pinched). */
export interface GhostKey {
  u: number;
  pathT: number;
  liftCm: number;
  curl: number;
}

/** Shared loop: approach from above, pinch, drag the tip along the path, hold. */
export const GHOST_KEYS: GhostKey[] = [
  { u: 0.0, pathT: 0, liftCm: 4, curl: 0.1 },
  { u: 0.15, pathT: 0, liftCm: 0.5, curl: 0.85 },
  { u: 0.85, pathT: 1, liftCm: 0.5, curl: 0.85 },
  { u: 1.0, pathT: 1, liftCm: 0.8, curl: 0.85 },
];

/** Per-step hand yaw (degrees about +Y, 0 = fingers toward -Z). */
export const GHOST_HAND_YAW_DEG: number[] = [-20, 10, 35, -10];

/** Length of the faint ghost rope segment trailing the ghost tip. */
export const GHOST_TIP_TRAIL_CM = 12;

/** Sample the keyframes at loop time u (linear between keys, smoothstep-eased). */
export function sampleGhostKey(u: number): GhostKey {
  const k = GHOST_KEYS;
  const uu = clamp01(u);
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i];
    const b = k[i + 1];
    if (uu <= b.u) {
      const span = Math.max(1e-6, b.u - a.u);
      const s = smoothstep01((uu - a.u) / span);
      return {
        u: uu,
        pathT: a.pathT + (b.pathT - a.pathT) * s,
        liftCm: a.liftCm + (b.liftCm - a.liftCm) * s,
        curl: a.curl + (b.curl - a.curl) * s,
      };
    }
  }
  const last = k[k.length - 1];
  return { u: uu, pathT: last.pathT, liftCm: last.liftCm, curl: last.curl };
}

// ---------------------------------------------------------------- math helpers

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export function lerpVec3(a: vec3, b: vec3, t: number): vec3 {
  return new vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

export function cumulativeLengths(pts: vec3[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    out.push(out[i - 1] + pts[i].distance(pts[i - 1]));
  }
  return out;
}

export function polylineLength(pts: vec3[]): number {
  const c = cumulativeLengths(pts);
  return c[c.length - 1];
}

/** Point at arc-length progress t in [0,1]. */
export function pointAtProgress(pts: vec3[], t: number): vec3 {
  if (pts.length === 0) return vec3.zero();
  if (pts.length === 1) return pts[0];
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1];
  const target = clamp01(t) * total;
  for (let i = 1; i < pts.length; i++) {
    if (target <= cum[i]) {
      const seg = Math.max(1e-6, cum[i] - cum[i - 1]);
      return lerpVec3(pts[i - 1], pts[i], (target - cum[i - 1]) / seg);
    }
  }
  return pts[pts.length - 1];
}

/** Unit tangent at progress t (direction of travel). */
export function tangentAtProgress(pts: vec3[], t: number): vec3 {
  const a = pointAtProgress(pts, Math.max(0, t - 0.02));
  const b = pointAtProgress(pts, Math.min(1, t + 0.02));
  const d = b.sub(a);
  return d.length > 1e-6 ? d.normalize() : new vec3(1, 0, 0);
}

/** Vertices from the start of pts up to progress t (last point interpolated). */
export function pathPrefix(pts: vec3[], t: number): vec3[] {
  if (pts.length === 0) return [];
  const cum = cumulativeLengths(pts);
  const target = clamp01(t) * cum[cum.length - 1];
  const out: vec3[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < target) {
      out.push(pts[i]);
    } else {
      out.push(pointAtProgress(pts, t));
      break;
    }
  }
  return out;
}

/** Sub-polyline between progress t0 and t1 (t0 <= t1). */
export function pathSegment(pts: vec3[], t0: number, t1: number): vec3[] {
  const a = clamp01(Math.min(t0, t1));
  const b = clamp01(Math.max(t0, t1));
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1];
  const out: vec3[] = [pointAtProgress(pts, a)];
  for (let i = 1; i < pts.length - 1; i++) {
    const ti = total > 0 ? cum[i] / total : 0;
    if (ti > a && ti < b) out.push(pts[i]);
  }
  out.push(pointAtProgress(pts, b));
  return out;
}

export interface NearestResult {
  /** arc-length progress of the nearest point, 0..1 */
  t: number;
  /** distance from the query to that point (planar XZ when planar = true) */
  distance: number;
  /** nearest point on the polyline (full 3D, rope-local) */
  point: vec3;
}

/** Nearest point on pts to p, restricted to progress range [tMin, tMax].
 *  planar = true measures distance in the XZ (table) plane only, ignoring Y. */
export function nearestOnPolyline(
  pts: vec3[],
  p: vec3,
  planar: boolean = true,
  tMin: number = 0,
  tMax: number = 1,
): NearestResult {
  const cum = cumulativeLengths(pts);
  const total = Math.max(1e-6, cum[cum.length - 1]);
  let best: NearestResult = { t: tMin, distance: Number.MAX_VALUE, point: pointAtProgress(pts, tMin) };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ax = a.x, az = a.z, bx = b.x, bz = b.z;
    const ay = planar ? 0 : a.y;
    const by = planar ? 0 : b.y;
    const py = planar ? 0 : p.y;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    let s = len2 > 1e-9 ? ((p.x - ax) * dx + (py - ay) * dy + (p.z - az) * dz) / len2 : 0;
    s = clamp01(s);
    let t = (cum[i - 1] + s * (cum[i] - cum[i - 1])) / total;
    if (t < tMin || t > tMax) {
      t = t < tMin ? tMin : tMax;
      const q = pointAtProgress(pts, t);
      const ex = p.x - q.x, ey = planar ? 0 : p.y - q.y, ez = p.z - q.z;
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d < best.distance) best = { t: t, distance: d, point: q };
      continue;
    }
    const qx = ax + dx * s, qy = ay + dy * s, qz = az + dz * s;
    const ex = p.x - qx, ey = py - qy, ez = p.z - qz;
    const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (d < best.distance) best = { t: t, distance: d, point: lerpVec3(a, b, s) };
  }
  return best;
}

/** Checkpoint progress values (0..1, ascending, first = 0) for step 1..4. */
export function checkpointProgress(step: number): number[] {
  const idx = Math.max(0, Math.min(STEP_PATHS.length - 1, step - 1));
  const pts = STEP_PATHS[idx];
  const cum = cumulativeLengths(pts);
  const total = Math.max(1e-6, cum[cum.length - 1]);
  return STEP_CHECKPOINT_INDICES[idx].map((i) => cum[Math.min(i, cum.length - 1)] / total);
}

/** Path for step 1..4 (clamped). */
export function stepPath(step: number): vec3[] {
  const idx = Math.max(0, Math.min(STEP_PATHS.length - 1, step - 1));
  return STEP_PATHS[idx];
}

/** Re-sample a polyline at (approximately) uniform spacing; keeps both ends. */
export function resampleByLength(pts: vec3[], spacingCm: number): vec3[] {
  if (pts.length < 2) return pts.slice();
  const total = polylineLength(pts);
  const n = Math.max(2, Math.ceil(total / Math.max(0.05, spacingCm)) + 1);
  return resampleCount(pts, n);
}

/** Re-sample a polyline to exactly n points, uniformly by arc length. */
export function resampleCount(pts: vec3[], n: number): vec3[] {
  const out: vec3[] = [];
  if (pts.length === 0) return out;
  const count = Math.max(2, n);
  for (let i = 0; i < count; i++) {
    out.push(pointAtProgress(pts, i / (count - 1)));
  }
  return out;
}

/** Centripetal-ish uniform Catmull-Rom through pts; samplesPerSegment >= 1. */
export function catmullRom(pts: vec3[], samplesPerSegment: number): vec3[] {
  if (pts.length < 3) return pts.slice();
  const out: vec3[] = [];
  const n = pts.length;
  const sps = Math.max(1, Math.floor(samplesPerSegment));
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < sps; s++) {
      const t = s / sps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new vec3(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z)));
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// ---------------------------------------------------------------- rope composition

/** Drop consecutive points closer than eps (avoids degenerate tube rings). */
function dedupe(pts: vec3[], eps: number = 0.05): vec3[] {
  const out: vec3[] = [];
  for (const p of pts) {
    if (out.length === 0 || out[out.length - 1].distance(p) > eps) out.push(p);
  }
  return out;
}

/**
 * Rope centre-line (rope-local control polyline, NOT yet smoothed) for the lesson at
 * `step` (1..4) with tip progress `t` (0..1). `tipLocal`, when given, replaces the
 * final point so the rope end always follows the real tip (incl. off-path drags).
 *  - step 1: index-wise blend ROPE_START_SHAPE -> ROPE_LOOP_SHAPE by t.
 *  - step k>=2: ROPE_LOOP_SHAPE + full paths of steps 2..k-1 + prefix of path k to t.
 *    The standing part's far-left end is pulled right by the added tail length
 *    (capped at 12 cm) so the rope reads as being drawn through, not growing.
 */
export function composeRope(step: number, t: number, tipLocal: vec3 | null): vec3[] {
  const s = Math.max(1, Math.min(STEP_PATHS.length, Math.floor(step)));
  let pts: vec3[];
  if (s === 1) {
    pts = ROPE_START_SHAPE.map((p, i) => lerpVec3(p, ROPE_LOOP_SHAPE[i], smoothstep01(t)));
  } else {
    pts = ROPE_LOOP_SHAPE.slice();
    let added = 0;
    for (let k = 2; k < s; k++) {
      const path = STEP_PATHS[k - 1];
      added += polylineLength(path);
      pts = pts.concat(path.slice(1));
    }
    const cur = pathPrefix(STEP_PATHS[s - 1], t);
    added += polylineLength(cur);
    pts = pts.concat(cur.slice(1));
    const shift = Math.min(12, added);
    pts[0] = new vec3(pts[0].x + shift, pts[0].y, pts[0].z);
  }
  if (tipLocal) {
    pts[pts.length - 1] = tipLocal;
  }
  return dedupe(pts);
}

/** The fully tied (loose) bowline: all four steps complete. */
export function composeFullKnot(): vec3[] {
  return composeRope(STEP_PATHS.length, 1, null);
}

/** Map a rope-local point toward the knot centre by tighten progress k (0..1). */
export function tightenPoint(p: vec3, k: number): vec3 {
  const d = p.distance(KNOT_CENTER);
  if (d >= TIGHTEN_RADIUS_CM) return p;
  const w = 1 - smoothstep01(d / TIGHTEN_RADIUS_CM);
  const pull = smoothstep01(k) * TIGHTEN_PULL * w;
  const q = lerpVec3(p, KNOT_CENTER, pull);
  // Flatten height toward the table as it tightens (knot settles).
  return new vec3(q.x, q.y * (1 - 0.5 * smoothstep01(k) * w), q.z);
}

/** Rope centre-line for the Tighten animation at progress k (0 = loose, 1 = finished). */
export function composeTightened(k: number): vec3[] {
  return dedupe(composeFullKnot().map((p) => tightenPoint(p, k)));
}
