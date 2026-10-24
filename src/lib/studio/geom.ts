import type { Anchor, Bone, Point, SceneElement } from "./types";

export const PASTE = 480;

export function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function deg(r: number): number {
  return (r * 180) / Math.PI;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function perspScale(el: SceneElement): { sx: number; sy: number } {
  const p = 800 / (800 + el.z);
  return {
    sx: el.scaleX * Math.cos(rad(el.rotY)) * p,
    sy: el.scaleY * Math.cos(rad(el.rotX)) * p,
  };
}

export function localToWorld(el: SceneElement, p: Point): Point {
  let x = p.x - el.w * el.regX;
  let y = p.y - el.h * el.regY;
  const { sx, sy } = perspScale(el);
  x *= sx || 1e-6;
  y *= sy || 1e-6;
  const ty = Math.tan(rad(el.skewY));
  const tx = Math.tan(rad(el.skewX));
  y = y + x * ty;
  x = x + y * tx;
  const rot = rad(el.rotation + el.rotZ);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const xr = x * c - y * s;
  const yr = x * s + y * c;
  return { x: xr + el.x + el.w * el.regX, y: yr + el.y + el.h * el.regY };
}

export function worldToLocal(el: SceneElement, p: Point): Point {
  let x = p.x - (el.x + el.w * el.regX);
  let y = p.y - (el.y + el.h * el.regY);
  const rot = rad(el.rotation + el.rotZ);
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const xr = x * c - y * s;
  const yr = x * s + y * c;
  const tx = Math.tan(rad(el.skewX));
  const ty = Math.tan(rad(el.skewY));
  x = xr - yr * tx;
  y = yr - x * ty;
  const { sx, sy } = perspScale(el);
  x /= sx || 1e-6;
  y /= sy || 1e-6;
  return { x: x + el.w * el.regX, y: y + el.h * el.regY };
}

export function svgTransform(el: SceneElement): string {
  const rx = el.x + el.w * el.regX;
  const ry = el.y + el.h * el.regY;
  const { sx, sy } = perspScale(el);
  const rot = el.rotation + el.rotZ;
  return `translate(${rx} ${ry}) rotate(${rot}) skewX(${el.skewX}) skewY(${el.skewY}) scale(${sx} ${sy}) translate(${-el.w * el.regX} ${-el.h * el.regY})`;
}

export function worldCorners(el: SceneElement): Point[] {
  return [
    localToWorld(el, { x: 0, y: 0 }),
    localToWorld(el, { x: el.w, y: 0 }),
    localToWorld(el, { x: el.w, y: el.h }),
    localToWorld(el, { x: 0, y: el.h }),
  ];
}

export function aabb(points: Point[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: Math.max(0.001, maxX - minX), h: Math.max(0.001, maxY - minY) };
}

export function unionAabb(boxes: { x: number; y: number; w: number; h: number }[]) {
  return aabb(boxes.flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]));
}

export function pointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const hit = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-9) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function polyIntersects(a: Point[], b: { x: number; y: number; w: number; h: number }): boolean {
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
  if (corners.some((c) => pointInPoly(c, a))) return true;
  if (a.some((p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)) return true;
  return false;
}

function bez(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export function sampleCubic(a: Point, c1: Point, c2: Point, b: Point, steps = 8): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push({ x: bez(a.x, c1.x, c2.x, b.x, t), y: bez(a.y, c1.y, c2.y, b.y, t) });
  }
  return pts;
}

export function anchorsToPath(anchors: Anchor[], closed: boolean): string {
  if (anchors.length === 0) return "";
  let d = `M ${anchors[0].x} ${anchors[0].y}`;
  const seg = (prev: Anchor, cur: Anchor) => {
    if (prev.outX == null && cur.inX == null) d += ` L ${cur.x} ${cur.y}`;
    else {
      const c1x = prev.outX ?? prev.x;
      const c1y = prev.outY ?? prev.y;
      const c2x = cur.inX ?? cur.x;
      const c2y = cur.inY ?? cur.y;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${cur.x} ${cur.y}`;
    }
  };
  for (let i = 1; i < anchors.length; i++) seg(anchors[i - 1], anchors[i]);
  if (closed && anchors.length > 1) {
    seg(anchors[anchors.length - 1], anchors[0]);
    d += " Z";
  }
  return d;
}

export function starPoints(sides: number, star: boolean, inner: number, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const n = Math.max(3, sides);
  const pts: string[] = [];
  const count = star ? n * 2 : n;
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const k = star && i % 2 === 1 ? inner : 1;
    pts.push(`${cx + Math.cos(ang) * rx * k},${cy + Math.sin(ang) * ry * k}`);
  }
  return pts.join(" ");
}

export function ovalPath(w: number, h: number, start: number, end: number): string {
  const sweep = ((end - start) % 360 + 360) % 360;
  if (sweep < 0.5 || sweep > 359.5) {
    return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.01} 0 Z`;
  }
  const cx = w / 2;
  const cy = h / 2;
  const a0 = rad(start - 90);
  const a1 = rad(start + sweep - 90);
  const x0 = cx + Math.cos(a0) * cx;
  const y0 = cy + Math.sin(a0) * cy;
  const x1 = cx + Math.cos(a1) * cx;
  const y1 = cy + Math.sin(a1) * cy;
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${cx} ${cy} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function outlineLocal(el: SceneElement, steps = 16): Point[] {
  if (el.kind === "oval") {
    const pts: Point[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: el.w / 2 + Math.cos(a) * el.w / 2, y: el.h / 2 + Math.sin(a) * el.h / 2 });
    }
    return pts;
  }
  if (el.kind === "polystar") {
    return starPoints(el.sides, el.star, el.innerRatio, el.w, el.h)
      .split(" ")
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });
  }
  if (el.kind === "line") return [{ x: 0, y: 0 }, { x: el.w, y: el.h }];
  if ((el.kind === "path" || el.kind === "group") && el.anchors.length > 1) {
    const pts: Point[] = [{ x: el.anchors[0].x, y: el.anchors[0].y }];
    const walk = (prev: Anchor, cur: Anchor) => {
      if (prev.outX == null && cur.inX == null) pts.push({ x: cur.x, y: cur.y });
      else {
        pts.push(
          ...sampleCubic(
            { x: prev.x, y: prev.y },
            { x: prev.outX ?? prev.x, y: prev.outY ?? prev.y },
            { x: cur.inX ?? cur.x, y: cur.inY ?? cur.y },
            { x: cur.x, y: cur.y },
            4,
          ),
        );
      }
    };
    for (let i = 1; i < el.anchors.length; i++) walk(el.anchors[i - 1], el.anchors[i]);
    if (el.closed) walk(el.anchors[el.anchors.length - 1], el.anchors[0]);
    return pts;
  }
  return [
    { x: 0, y: 0 },
    { x: el.w, y: 0 },
    { x: el.w, y: el.h },
    { x: 0, y: el.h },
  ];
}

export function outlineWorld(el: SceneElement): Point[] {
  return outlineLocal(el).map((p) => localToWorld(el, p));
}

export function resample(pts: Point[], n: number): Point[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + dist(pts[i - 1], pts[i]));
  const total = seg[seg.length - 1] || 1;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    let j = 1;
    while (j < seg.length - 1 && seg[j] < d) j++;
    const span = seg[j] - seg[j - 1] || 1;
    const t = (d - seg[j - 1]) / span;
    out.push({ x: lerp(pts[j - 1].x, pts[j].x, t), y: lerp(pts[j - 1].y, pts[j].y, t) });
  }
  return out;
}

export function pointsToPath(pts: Point[], closed: boolean): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  if (closed) d += " Z";
  return d;
}

export function smoothPath(pts: Point[], times: number): Point[] {
  let cur = pts.slice();
  for (let k = 0; k < times; k++) {
    if (cur.length < 3) break;
    const next = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      next.push({
        x: cur[i].x * 0.5 + cur[i - 1].x * 0.25 + cur[i + 1].x * 0.25,
        y: cur[i].y * 0.5 + cur[i - 1].y * 0.25 + cur[i + 1].y * 0.25,
      });
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

export function rdp(pts: Point[], epsilon: number): Point[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = dist(a, b) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const t = ((pts[i].x - a.x) * (b.x - a.x) + (pts[i].y - a.y) * (b.y - a.y)) / (len * len);
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    const d = Math.hypot(pts[i].x - px, pts[i].y - py);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = rdp(pts.slice(0, idx + 1), epsilon);
    const right = rdp(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

export function straighten(pts: Point[]): Point[] {
  const simplified = rdp(pts, 6);
  if (simplified.length < 2) return simplified;
  const out = [simplified[0]];
  for (let i = 1; i < simplified.length; i++) {
    const prev = out[out.length - 1];
    let x = simplified[i].x;
    let y = simplified[i].y;
    const ang = Math.atan2(y - prev.y, x - prev.x);
    const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(snap - ang) < 0.28) {
      const len = Math.hypot(x - prev.x, y - prev.y);
      x = prev.x + Math.cos(snap) * len;
      y = prev.y + Math.sin(snap) * len;
    }
    out.push({ x, y });
  }
  return out;
}

export function catmullAnchors(pts: Point[]): Anchor[] {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = (next.x - prev.x) / 6;
    const dy = (next.y - prev.y) / 6;
    return { x: p.x, y: p.y, inX: p.x - dx, inY: p.y - dy, outX: p.x + dx, outY: p.y + dy };
  });
}

export function ribbon(pts: Point[], widths: number[]): Point[] {
  if (pts.length < 2) return pts.slice();
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    const w = (widths[i] ?? widths[widths.length - 1] ?? 4) / 2;
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
    right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  return left.concat(right.reverse());
}

export function ease(t: number, amount: number): number {
  const e = clamp(amount, -100, 100) / 100;
  if (Math.abs(e) < 0.001) return t;
  if (e > 0) return Math.pow(t, 1 + e * 2);
  return 1 - Math.pow(1 - t, 1 + Math.abs(e) * 2);
}

export function fabrik(joints: Point[], target: Point, lengths: number[]): Point[] {
  const pos = joints.map((p) => ({ ...p }));
  if (pos.length === 0) return pos;
  pos[pos.length - 1] = { ...target };
  for (let i = pos.length - 2; i >= 0; i--) {
    const dir = dist(pos[i], pos[i + 1]) || 1;
    const ux = (pos[i].x - pos[i + 1].x) / dir;
    const uy = (pos[i].y - pos[i + 1].y) / dir;
    pos[i] = { x: pos[i + 1].x + ux * lengths[i], y: pos[i + 1].y + uy * lengths[i] };
  }
  pos[0] = { ...joints[0] };
  for (let i = 0; i < pos.length - 1; i++) {
    const dir = dist(pos[i + 1], pos[i]) || 1;
    const ux = (pos[i + 1].x - pos[i].x) / dir;
    const uy = (pos[i + 1].y - pos[i].y) / dir;
    pos[i + 1] = { x: pos[i].x + ux * lengths[i], y: pos[i].y + uy * lengths[i] };
  }
  return pos;
}

export function chainOf(bones: Bone[], id: string): Bone[] {
  const byId = new Map(bones.map((b) => [b.id, b]));
  const chain: Bone[] = [];
  let cur: Bone | undefined = byId.get(id);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export function applyFabrik(bones: Bone[], effectorId: string, target: Point): Bone[] {
  const chain = chainOf(bones, effectorId);
  if (chain.length === 0) return bones;
  const joints: Point[] = [{ x: chain[0].x, y: chain[0].y }];
  const lengths: number[] = [];
  for (const b of chain) {
    lengths.push(Math.max(4, Math.hypot(b.tx - b.x, b.ty - b.y)));
    joints.push({ x: b.tx, y: b.ty });
  }
  const solved = fabrik(joints, target, lengths);
  const next = bones.map((b) => ({ ...b }));
  chain.forEach((b, i) => {
    const item = next.find((n) => n.id === b.id);
    if (!item) return;
    item.x = solved[i].x;
    item.y = solved[i].y;
    item.tx = solved[i + 1].x;
    item.ty = solved[i + 1].y;
  });
  for (const b of next) {
    if (!b.parentId) continue;
    const parent = next.find((p) => p.id === b.parentId);
    if (!parent) continue;
    if (chain.some((c) => c.id === b.id)) {
      b.x = parent.tx;
      b.y = parent.ty;
    }
  }
  return next;
}

export function nearestJoint(bones: Bone[], p: Point, tol: number): { id: string; end: "head" | "tail" } | null {
  let best: { id: string; end: "head" | "tail"; d: number } | null = null;
  for (const b of bones) {
    const dh = dist(p, { x: b.x, y: b.y });
    const dt = dist(p, { x: b.tx, y: b.ty });
    if (dh < tol && (!best || dh < best.d)) best = { id: b.id, end: "head", d: dh };
    if (dt < tol && (!best || dt < best.d)) best = { id: b.id, end: "tail", d: dt };
  }
  return best ? { id: best.id, end: best.end } : null;
}
