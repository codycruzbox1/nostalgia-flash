import { lerpColor } from "./color";
import {
  aabb,
  anchorsToPath,
  ease,
  lerp,
  lerpAngle,
  outlineWorld,
  pointsToPath,
  resample,
} from "./geom";
import type {
  Anchor,
  Bind,
  Bone,
  Doc,
  Fill,
  Layer,
  Scene,
  SceneElement,
  Span,
  Stroke,
  SymbolItem,
  TweenKind,
} from "./types";

let seq = 1;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

const solid = (color: string, alpha = 1): Fill => ({ type: "solid", color, alpha });

export function defaultStroke(color = "#1c1b19", width = 2): Stroke {
  return { color, alpha: 1, width, cap: "round", join: "round" };
}

export function makeElement(partial: Partial<SceneElement> & Pick<SceneElement, "kind">): SceneElement {
  return {
    id: partial.id ?? uid("e"),
    name: partial.name ?? partial.kind,
    kind: partial.kind,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    w: partial.w ?? 80,
    h: partial.h ?? 80,
    rotation: partial.rotation ?? 0,
    scaleX: partial.scaleX ?? 1,
    scaleY: partial.scaleY ?? 1,
    skewX: partial.skewX ?? 0,
    skewY: partial.skewY ?? 0,
    regX: partial.regX ?? 0.5,
    regY: partial.regY ?? 0.5,
    rotX: partial.rotX ?? 0,
    rotY: partial.rotY ?? 0,
    rotZ: partial.rotZ ?? 0,
    z: partial.z ?? 0,
    alpha: partial.alpha ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    blend: partial.blend ?? "normal",
    fill: partial.fill ? clone(partial.fill) : solid("#e09a3e"),
    stroke: partial.stroke === undefined ? defaultStroke() : partial.stroke ? clone(partial.stroke) : null,
    cornerRadius: partial.cornerRadius ?? 0,
    startAngle: partial.startAngle ?? 0,
    endAngle: partial.endAngle ?? 360,
    anchors: partial.anchors ? clone(partial.anchors) : [],
    closed: partial.closed ?? false,
    rawD: partial.rawD ?? "",
    morphD: "",
    text: partial.text ?? "Text",
    fontFamily: partial.fontFamily ?? "IBM Plex Sans",
    fontSize: partial.fontSize ?? 28,
    fontWeight: partial.fontWeight ?? 500,
    fontStyle: partial.fontStyle ?? "normal",
    underline: partial.underline ?? false,
    align: partial.align ?? "left",
    letterSpacing: partial.letterSpacing ?? 0,
    lineHeight: partial.lineHeight ?? 1.2,
    textType: partial.textType ?? "static",
    antialias: partial.antialias ?? "animation",
    sides: partial.sides ?? 5,
    star: partial.star ?? true,
    innerRatio: partial.innerRatio ?? 0.45,
    symbolId: partial.symbolId ?? null,
    children: partial.children ? clone(partial.children) : [],
    dots: partial.dots ? clone(partial.dots) : [],
    shadow: partial.shadow ?? false,
    instanceName: partial.instanceName ?? "",
    href: partial.href ?? "",
    fillLocked: partial.fillLocked ?? false,
  };
}

export function emptySpan(start = 0, end = 1, elements: SceneElement[] = []): Span {
  return {
    id: uid("sp"),
    start,
    end,
    key: true,
    tween: "none",
    ease: 0,
    elements,
    script: "",
    label: "",
    sound: "",
    hints: [],
    armature: [],
    binds: [],
  };
}

export function makeLayer(name: string, color: string, elements?: SceneElement[], end = 72): Layer {
  return {
    id: uid("ly"),
    name,
    type: "normal",
    visible: true,
    locked: false,
    outline: false,
    color,
    parentId: null,
    collapsed: false,
    spans: [emptySpan(0, end, elements ?? [])],
  };
}

function lerpFill(a: Fill, b: Fill, t: number): Fill {
  if (a.type === "solid" && b.type === "solid") {
    return { type: "solid", color: lerpColor(a.color, b.color, t), alpha: lerp(a.alpha, b.alpha, t) };
  }
  return t < 0.5 ? clone(a) : clone(b);
}

function lerpAnchor(a: Anchor, b: Anchor, t: number): Anchor {
  const lh = (v: number | null, o: number, w: number | null, p: number) =>
    v == null && w == null ? null : lerp(v ?? o, w ?? p, t);
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    inX: lh(a.inX, a.x, b.inX, b.x),
    inY: lh(a.inY, a.y, b.inY, b.y),
    outX: lh(a.outX, a.x, b.outX, b.x),
    outY: lh(a.outY, a.y, b.outY, b.y),
  };
}

function lerpElement(a: SceneElement, b: SceneElement, t: number, tween: TweenKind): SceneElement {
  const n = clone(a);
  n.x = lerp(a.x, b.x, t);
  n.y = lerp(a.y, b.y, t);
  n.w = Math.max(0.5, lerp(a.w, b.w, t));
  n.h = Math.max(0.5, lerp(a.h, b.h, t));
  n.rotation = lerpAngle(a.rotation, b.rotation, t);
  n.scaleX = lerp(a.scaleX, b.scaleX, t);
  n.scaleY = lerp(a.scaleY, b.scaleY, t);
  n.skewX = lerp(a.skewX, b.skewX, t);
  n.skewY = lerp(a.skewY, b.skewY, t);
  n.alpha = lerp(a.alpha, b.alpha, t);
  n.rotX = lerp(a.rotX, b.rotX, t);
  n.rotY = lerp(a.rotY, b.rotY, t);
  n.rotZ = lerp(a.rotZ, b.rotZ, t);
  n.z = lerp(a.z, b.z, t);
  n.cornerRadius = lerp(a.cornerRadius, b.cornerRadius, t);
  n.fill = lerpFill(a.fill, b.fill, t);
  if (a.stroke && b.stroke) n.stroke = { ...a.stroke, color: lerpColor(a.stroke.color, b.stroke.color, t), width: lerp(a.stroke.width, b.stroke.width, t), alpha: lerp(a.stroke.alpha, b.stroke.alpha, t) };
  if (tween === "shape") {
    const pa = resample(outlineWorld(a), 28);
    const pb = resample(outlineWorld(b), 28);
    const mid = pa.map((p, i) => ({ x: lerp(p.x, pb[i].x, t), y: lerp(p.y, pb[i].y, t) }));
    n.morphD = pointsToPath(mid, true);
    n.rotation = 0;
    n.rotX = 0;
    n.rotY = 0;
    n.rotZ = 0;
    n.skewX = 0;
    n.skewY = 0;
    n.scaleX = 1;
    n.scaleY = 1;
    n.z = 0;
    n.x = 0;
    n.y = 0;
  } else if (a.anchors.length > 0 && a.anchors.length === b.anchors.length) {
    n.anchors = a.anchors.map((an, i) => lerpAnchor(an, b.anchors[i], t));
  }
  return n;
}

export function spanAt(layer: Layer, frame: number): Span | null {
  return layer.spans.find((s) => frame >= s.start && frame < s.end) ?? null;
}

export function sampleLayer(layer: Layer, frame: number): SceneElement[] {
  if (layer.type === "folder" || !layer.visible) return [];
  const span = spanAt(layer, frame);
  if (!span || !span.key) return [];
  const next = layer.spans.find((s) => s.start === span.end && s.key);
  if (!next || span.tween === "none" || frame === span.start) {
    return span.elements.map((e) => ({ ...clone(e), morphD: "" }));
  }
  const t = ease((frame - span.start) / Math.max(1, span.end - span.start), span.ease);
  const bById = new Map(next.elements.map((e) => [e.id, e]));
  const used = new Set<string>();
  const out: SceneElement[] = [];
  for (const el of span.elements) {
    const other = bById.get(el.id);
    if (!other) {
      const fade = clone(el);
      fade.alpha = el.alpha * (1 - t);
      fade.morphD = "";
      out.push(fade);
      continue;
    }
    used.add(el.id);
    out.push(lerpElement(el, other, t, span.tween));
  }
  if (span.tween === "shape") {
    for (const el of next.elements) {
      if (used.has(el.id)) continue;
      const fade = clone(el);
      fade.alpha = el.alpha * t;
      fade.morphD = "";
      out.push(fade);
    }
  }
  return out;
}

export function activeScene(doc: Doc): Scene {
  return doc.scenes.find((s) => s.id === doc.activeSceneId) ?? doc.scenes[0];
}

export function replaceScene(doc: Doc, scene: Scene): Doc {
  return { ...doc, scenes: doc.scenes.map((s) => (s.id === scene.id ? scene : s)) };
}

export function normalizeSpans(spans: Span[]): Span[] {
  return spans
    .filter((s) => s.end > s.start)
    .map((s) => ({ ...s, elements: s.elements.map((e) => ({ ...e, morphD: "" })) }))
    .sort((a, b) => a.start - b.start);
}

export function ensureKey(layer: Layer, frame: number, mode: "copy" | "blank" = "copy"): Layer {
  if (layer.type === "folder") return layer;
  const sampled = mode === "blank" ? [] : sampleLayer({ ...layer, visible: true }, frame);
  const spans = layer.spans.map((s) => clone(s));
  const idx = spans.findIndex((s) => frame >= s.start && frame < s.end);
  if (idx >= 0 && spans[idx].start === frame) {
    if (mode === "blank") spans[idx] = { ...spans[idx], key: true, elements: [], tween: "none", script: "", label: "", sound: "" };
    return { ...layer, spans };
  }
  if (idx >= 0) {
    const span = spans[idx];
    const left: Span = { ...span, end: frame };
    const right: Span = {
      ...clone(span),
      id: uid("sp"),
      start: frame,
      elements: sampled,
      key: true,
      script: "",
      label: "",
      sound: "",
      hints: [],
    };
    if (mode === "blank") {
      right.elements = [];
      right.tween = "none";
      left.tween = "none";
    }
    const next = spans.slice();
    next.splice(idx, 1, ...(left.end > left.start ? [left, right] : [right]));
    return { ...layer, spans: normalizeSpans(next) };
  }
  const created = emptySpan(frame, frame + 1, []);
  return { ...layer, spans: normalizeSpans([...spans, created]) };
}

export function insertTime(layer: Layer, at: number, count = 1): Layer {
  if (layer.type === "folder" || count === 0) return layer;
  const covering = layer.spans.find((s) => at >= s.start && at < s.end);
  if (covering) {
    return {
      ...layer,
      spans: layer.spans.map((s) => {
        if (s.id === covering.id) return { ...s, end: s.end + count };
        if (s.start >= covering.end) return { ...s, start: s.start + count, end: s.end + count };
        return s;
      }),
    };
  }
  const prev = [...layer.spans].reverse().find((s) => s.end <= at);
  if (!prev) {
    return {
      ...layer,
      spans: layer.spans.map((s) => (s.start >= at ? { ...s, start: s.start + count, end: s.end + count } : s)),
    };
  }
  const newEnd = Math.max(prev.end + count, at + count);
  const delta = newEnd - prev.end;
  return {
    ...layer,
    spans: layer.spans.map((s) => {
      if (s.id === prev.id) return { ...s, end: newEnd };
      if (s.start >= prev.end) return { ...s, start: s.start + delta, end: s.end + delta };
      return s;
    }),
  };
}

export function removeTime(layer: Layer, from: number, to: number): Layer {
  const cut = to - from;
  if (layer.type === "folder" || cut <= 0) return layer;
  const next: Span[] = [];
  for (const s of layer.spans) {
    if (s.end <= from) {
      next.push(s);
      continue;
    }
    if (s.start >= to) {
      next.push({ ...s, start: s.start - cut, end: s.end - cut });
      continue;
    }
    if (s.start < from && s.end > from) {
      next.push({ ...s, end: from + Math.max(0, s.end - to) });
      continue;
    }
    if (s.end > to && s.start >= from && s.start < to) {
      const newEnd = from + (s.end - to);
      if (newEnd > from) next.push({ ...s, start: from, end: newEnd });
    }
  }
  return { ...layer, spans: normalizeSpans(next.length ? next : [emptySpan(0, 1, [])]) };
}

export function applyTween(layer: Layer, frame: number, tween: TweenKind): Layer {
  let current = ensureKey(layer, frame, "copy");
  const span = current.spans.find((s) => s.start === frame);
  if (!span) return current;
  const nextKey = current.spans.find((s) => s.key && s.start > span.start);
  if (!nextKey) {
    const end = span.start + 12;
    const follower = emptySpan(end, end + 1, span.elements.map((e) => clone(e)));
    current = {
      ...current,
      spans: normalizeSpans([
        ...current.spans.filter((s) => s.start < span.start || s.start >= end),
        { ...span, end, tween },
        follower,
      ]),
    };
    return current;
  }
  return {
    ...current,
    spans: normalizeSpans(
      current.spans
        .filter((s) => s.start < span.start || s.start >= nextKey.start || s.id === span.id)
        .map((s) => (s.id === span.id ? { ...s, end: nextKey.start, tween } : s)),
    ),
  };
}

export function elementLayer(scene: Scene, frame: number, id: string): Layer | null {
  for (const layer of scene.layers) {
    if (sampleLayer(layer, frame).some((e) => e.id === id)) return layer;
    if (layer.spans.some((s) => s.elements.some((e) => e.id === id))) return layer;
  }
  return null;
}

export function mapFrameElements(
  doc: Doc,
  frame: number,
  ids: Set<string> | null,
  fn: (el: SceneElement, layer: Layer) => SceneElement | null,
): Doc {
  const scene = activeScene(doc);
  let frameCount = scene.frameCount;
  const layers = scene.layers.map((layer) => {
    if (layer.locked || layer.type === "folder") return layer;
    const sampled = sampleLayer({ ...layer, visible: true }, frame);
    const hit = ids == null ? sampled.length > 0 : sampled.some((e) => ids.has(e.id));
    const stored = layer.spans.some((s) => s.elements.some((e) => (ids == null ? true : ids.has(e.id))));
    if (!hit && !stored) return layer;
    if (ids && !sampled.some((e) => ids.has(e.id)) && !layer.spans.some((s) => s.elements.some((e) => ids.has(e.id)))) return layer;
    const keyed = ensureKey(layer, frame, "copy");
    frameCount = Math.max(frameCount, frame + 1);
    return {
      ...keyed,
      spans: keyed.spans.map((s) => {
        if (s.start !== frame) return s;
        const elements: SceneElement[] = [];
        for (const el of s.elements) {
          if (ids && !ids.has(el.id)) {
            elements.push(el);
            continue;
          }
          if (!ids || ids.has(el.id)) {
            const next = fn(el, keyed);
            if (next) elements.push(next);
          }
        }
        return { ...s, elements };
      }),
    };
  });
  return replaceScene(doc, { ...scene, layers, frameCount: Math.max(frameCount, ...layers.flatMap((l) => l.spans.map((s) => s.end))) });
}

export function addElement(doc: Doc, layerId: string, frame: number, el: SceneElement): Doc {
  const scene = activeScene(doc);
  const layers = scene.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    const keyed = ensureKey(layer, frame, "copy");
    return {
      ...keyed,
      spans: keyed.spans.map((s) => (s.start === frame ? { ...s, key: true, elements: [...s.elements, el] } : s)),
    };
  });
  const frameCount = Math.max(scene.frameCount, frame + 1);
  return replaceScene(doc, { ...scene, layers, frameCount });
}

export function boundsOf(el: SceneElement): { x: number; y: number; w: number; h: number } {
  if (el.morphD) {
    const nums = el.morphD.match(/-?\d*\.?\d+/g)?.map(Number) ?? [0, 0];
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    return aabb(pts);
  }
  return aabb(outlineWorld(el));
}

export function selectionBounds(els: SceneElement[]) {
  if (els.length === 0) return null;
  return aabb(els.flatMap((e) => outlineWorld(e)));
}

export function fillOf(el: SceneElement): string | null {
  if (el.fill.type === "none") return null;
  if (el.fill.type === "solid") return el.fill.color;
  return el.fill.stops[0]?.color ?? null;
}

export function rebasePath(points: { x: number; y: number }[], anchors?: Anchor[]): { x: number; y: number; w: number; h: number; anchors: Anchor[] } {
  const src = anchors ?? points.map((p) => ({ x: p.x, y: p.y, inX: null, inY: null, outX: null, outY: null }));
  const box = aabb(src.map((a) => ({ x: a.x, y: a.y })));
  return {
    x: box.x,
    y: box.y,
    w: Math.max(1, box.w),
    h: Math.max(1, box.h),
    anchors: src.map((a) => ({
      ...a,
      x: a.x - box.x,
      y: a.y - box.y,
      inX: a.inX == null ? null : a.inX - box.x,
      inY: a.inY == null ? null : a.inY - box.y,
      outX: a.outX == null ? null : a.outX - box.x,
      outY: a.outY == null ? null : a.outY - box.y,
    })),
  };
}

export function pathFromAnchors(stageAnchors: Anchor[], closed: boolean, style: Pick<SceneElement, "fill" | "stroke">, name: string): SceneElement {
  const box = rebasePath([], stageAnchors);
  return makeElement({
    kind: "path",
    name,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    anchors: box.anchors,
    closed,
    fill: style.fill,
    stroke: style.stroke,
  });
}

export function collectElements(scene: Scene, frame: number): { layer: Layer; el: SceneElement }[] {
  const out: { layer: Layer; el: SceneElement }[] = [];
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const layer = scene.layers[i];
    if (!layer.visible || layer.type === "folder" || layer.type === "mask") continue;
    if (layer.type === "guide") continue;
    for (const el of sampleLayer(layer, frame)) {
      if (el.visible) out.push({ layer, el });
    }
  }
  return out;
}

export function displayList(scene: Scene, frame: number, playing: boolean): { layer: Layer; elements: SceneElement[] }[] {
  const rows: { layer: Layer; elements: SceneElement[] }[] = [];
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const layer = scene.layers[i];
    if (!layer.visible || layer.type === "folder") continue;
    if (layer.type === "mask") continue;
    if ((playing || false) && (layer.type === "guide" || layer.type === "guided")) {
      /* guides stay visible while editing; caller decides */
    }
    rows.push({ layer, elements: sampleLayer(layer, frame).filter((e) => e.visible) });
  }
  return rows;
}

export function findSymbol(doc: Doc, id: string | null): SymbolItem | null {
  if (!id) return null;
  return doc.library.find((s) => s.id === id) ?? null;
}

export function symbolBounds(elements: SceneElement[]) {
  if (elements.length === 0) return { x: 0, y: 0, w: 40, h: 40 };
  return aabb(elements.flatMap((e) => [{ x: e.x, y: e.y }, { x: e.x + e.w, y: e.y + e.h }]));
}

export function applyBinds(elements: SceneElement[], bones: Bone[], binds: Bind[]): SceneElement[] {
  if (binds.length === 0) return elements;
  return elements.map((el) => {
    const bind = binds.find((b) => b.elementId === el.id);
    if (!bind) return el;
    const bone = bones.find((b) => b.id === bind.boneId);
    if (!bone) return el;
    const ang = Math.atan2(bone.ty - bone.y, bone.tx - bone.x);
    const len = Math.hypot(bone.tx - bone.x, bone.ty - bone.y) || 1;
    const ux = (bone.tx - bone.x) / len;
    const uy = (bone.ty - bone.y) / len;
    const cx = bone.x + ux * bind.u - uy * bind.v;
    const cy = bone.y + uy * bind.u + ux * bind.v;
    return {
      ...el,
      x: cx - el.w * el.regX,
      y: cy - el.h * el.regY,
      rotation: (ang * 180) / Math.PI + bind.rot,
    };
  });
}

export function currentArmature(layer: Layer, frame: number): { bones: Bone[]; binds: Bind[]; span: Span | null } {
  const span = spanAt(layer, frame);
  if (!span) return { bones: [], binds: [], span: null };
  const owner = span.key ? span : layer.spans.find((s) => s.key && s.start < frame && s.end > frame) ?? span;
  return { bones: owner.armature, binds: owner.binds, span: owner };
}

export function withArmature(layer: Layer, frame: number, bones: Bone[], binds: Bind[]): Layer {
  const keyed = ensureKey(layer, frame, "copy");
  return {
    ...keyed,
    spans: keyed.spans.map((s) => {
      if (s.start !== frame) return s;
      return { ...s, armature: bones, binds, elements: applyBinds(s.elements, bones, binds) };
    }),
  };
}

export function layerColors(): string[] {
  return ["#d15b45", "#e09a3e", "#7f9a62", "#6d8eae", "#a078b0", "#c4844a", "#8a8378", "#2f6f62"];
}

export function freshDoc(name = "Untitled", width = 960, height = 540, fps = 24): Doc {
  const layer = makeLayer("Layer 1", layerColors()[0], [], 24);
  layer.spans[0].end = 24;
  return {
    id: uid("doc"),
    name,
    width,
    height,
    fps,
    background: "#fffcf7",
    activeSceneId: "scene1",
    scenes: [{ id: "scene1", name: "Scene 1", layers: [layer], frameCount: 24, guides: [] }],
    library: [],
    folders: [],
  };
}

export function createSampleDoc(): Doc {
  const orbId = "sym-orb";
  const chipId = "sym-chip";
  const orb = makeElement({
    kind: "oval",
    id: "orb-body",
    name: "Body",
    x: 0,
    y: 0,
    w: 128,
    h: 128,
    fill: {
      type: "radial",
      stops: [
        { offset: 0, color: "#fff4df", alpha: 1 },
        { offset: 0.45, color: "#e09a3e", alpha: 1 },
        { offset: 1, color: "#8a4e12", alpha: 1 },
      ],
      angle: 0,
      cx: 0.42,
      cy: 0.38,
      rx: 0.62,
      focal: 0.2,
    },
    stroke: null,
  });
  const gloss = makeElement({
    kind: "oval",
    id: "orb-gloss",
    name: "Gloss",
    x: 28,
    y: 18,
    w: 46,
    h: 28,
    fill: solid("#fffcf7", 0.55),
    stroke: null,
  });
  const chipBg = makeElement({
    kind: "rect",
    id: "chip-bg",
    name: "Chip",
    x: 0,
    y: 0,
    w: 92,
    h: 28,
    cornerRadius: 14,
    fill: solid("#1c1b19"),
    stroke: null,
  });
  const chipLabel = makeElement({
    kind: "text",
    id: "chip-label",
    name: "Label",
    x: 16,
    y: 4,
    w: 64,
    h: 20,
    text: "Play",
    fontSize: 14,
    fontWeight: 600,
    fill: solid("#fffcf7"),
    stroke: null,
    align: "center",
  });

  const backdrop = makeElement({
    kind: "rect",
    id: "el-back",
    name: "Stage wash",
    x: 0,
    y: 0,
    w: 960,
    h: 540,
    fill: {
      type: "linear",
      stops: [
        { offset: 0, color: "#f7f1e6", alpha: 1 },
        { offset: 1, color: "#e7dcc8", alpha: 1 },
      ],
      angle: 90,
      cx: 0.5,
      cy: 0.5,
      rx: 0.5,
      focal: 0,
    },
    stroke: null,
  });
  const band = makeElement({
    kind: "rect",
    id: "el-band",
    name: "Band",
    x: 0,
    y: 392,
    w: 960,
    h: 148,
    fill: solid("#1c1b19"),
    stroke: null,
  });
  const ring = makeElement({
    kind: "oval",
    id: "el-ring",
    name: "Ring",
    x: 620,
    y: 70,
    w: 250,
    h: 250,
    fill: { type: "none" },
    stroke: { color: "#e09a3e", alpha: 0.85, width: 3, cap: "round", join: "round" },
  });
  const star = makeElement({
    kind: "polystar",
    id: "el-star",
    name: "Star",
    x: 700,
    y: 150,
    w: 92,
    h: 92,
    sides: 5,
    star: true,
    innerRatio: 0.42,
    fill: solid("#e09a3e"),
    stroke: null,
  });
  const title = makeElement({
    kind: "text",
    id: "el-title",
    name: "Title",
    x: 64,
    y: 58,
    w: 640,
    h: 72,
    text: "Nostalgia Flash",
    fontSize: 52,
    fontWeight: 600,
    letterSpacing: -1.5,
    fill: solid("#1c1b19"),
    stroke: null,
  });
  const sub = makeElement({
    kind: "text",
    id: "el-sub",
    name: "Subtitle",
    x: 68,
    y: 132,
    w: 560,
    h: 36,
    text: "The easiest way to create fast web animations.",
    fontSize: 18,
    fontWeight: 400,
    fill: solid("#4a463f"),
    stroke: null,
  });
  const morphA = makeElement({
    kind: "rect",
    id: "el-morph",
    name: "Morph",
    x: 68,
    y: 430,
    w: 120,
    h: 56,
    cornerRadius: 4,
    fill: solid("#e09a3e"),
    stroke: null,
  });
  const morphB = makeElement({
    kind: "oval",
    id: "el-morph",
    name: "Morph",
    x: 250,
    y: 418,
    w: 78,
    h: 78,
    fill: solid("#f4f0e8"),
    stroke: null,
  });
  const orbInst = (x: number, y: number, rot: number): SceneElement =>
    makeElement({
      kind: "symbol",
      id: "el-orb",
      name: "Orb",
      instanceName: "orb",
      symbolId: orbId,
      x,
      y,
      w: 128,
      h: 128,
      rotation: rot,
      fill: { type: "none" },
      stroke: null,
    });
  const chipInst = makeElement({
    kind: "symbol",
    id: "el-chip",
    name: "Play chip",
    instanceName: "playChip",
    symbolId: chipId,
    x: 68,
    y: 188,
    w: 92,
    h: 28,
    fill: { type: "none" },
    stroke: null,
  });

  const bg = makeLayer("Backdrop", "#8a8378", [backdrop, band], 72);
  const decor = makeLayer("Decor", "#6d8eae", [ring, star], 72);
  const orbLayer = makeLayer("Orb", "#e09a3e", [orbInst(78, 210, -8)], 48);
  orbLayer.spans = [
    { ...emptySpan(0, 48, [orbInst(78, 210, -8)]), id: "sp-orb-a", tween: "motion", ease: -40 },
    emptySpan(48, 72, [orbInst(690, 168, 24)]),
  ];
  orbLayer.spans[0].label = "travel";
  const typeLayer = makeLayer("Type", "#1c1b19", [title, sub, chipInst], 72);
  const morph = makeLayer("Morph", "#d15b45", [morphA], 48);
  morph.spans = [
    { ...emptySpan(0, 48, [morphA]), id: "sp-morph-a", tween: "shape", ease: 0 },
    emptySpan(48, 72, [morphB]),
  ];

  const scene: Scene = {
    id: "scene1",
    name: "Scene 1",
    layers: [typeLayer, orbLayer, morph, decor, bg],
    frameCount: 72,
    guides: [
      { id: "g1", orientation: "v", pos: 64 },
      { id: "g2", orientation: "h", pos: 48 },
    ],
  };

  return {
    id: "doc-sample",
    name: "Arrival",
    width: 960,
    height: 540,
    fps: 24,
    background: "#fffcf7",
    activeSceneId: "scene1",
    scenes: [scene],
    library: [
      { id: orbId, name: "Orb", type: "movieclip", elements: [orb, gloss], folderId: null },
      { id: chipId, name: "Play chip", type: "button", elements: [chipBg, chipLabel], folderId: "fld-ui" },
    ],
    folders: [{ id: "fld-ui", name: "Interface" }],
  };
}

export function allText(doc: Doc): { where: string; text: string; elementId: string }[] {
  const rows: { where: string; text: string; elementId: string }[] = [];
  const walk = (els: SceneElement[], where: string) => {
    for (const el of els) {
      if (el.kind === "text") rows.push({ where, text: el.text, elementId: el.id });
      if (el.children.length) walk(el.children, where);
    }
  };
  for (const scene of doc.scenes) {
    for (const layer of scene.layers) {
      for (const span of layer.spans) walk(span.elements, `${scene.name} / ${layer.name} / f${span.start + 1}`);
    }
  }
  for (const sym of doc.library) walk(sym.elements, `Library / ${sym.name}`);
  return rows;
}

export function pathD(el: SceneElement): string {
  if (el.morphD) return el.morphD;
  if (el.rawD) return el.rawD;
  if (el.anchors.length) return anchorsToPath(el.anchors, el.closed);
  return "";
}

export { anchorsToPath };
