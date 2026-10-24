import { useEffect, useRef, useState, type PointerEvent as RPEvent, type ReactNode } from "react";
import { ContextMenu } from "@/components/studio/ui";
import { ShapeArt } from "@/components/studio/render";
import { bridge } from "@/lib/studio/bridge";
import { colorDist } from "@/lib/studio/color";
import { PASTE, applyFabrik, catmullAnchors, localToWorld, nearestJoint, pointInPoly, polyIntersects, rdp, ribbon, smoothPath, straighten, worldToLocal } from "@/lib/studio/geom";
import { activeScene, addElement, boundsOf, currentArmature, findSymbol, makeElement, mapFrameElements, pathFromAnchors, sampleLayer, uid, withArmature } from "@/lib/studio/model";
import { useStudio } from "@/lib/studio/store";
import type { Anchor, Doc, MenuEntry, Point, SceneElement, ToolId } from "@/lib/studio/types";

type Draft =
  | { kind: "move"; ids: string[]; start: Point; pos: Map<string, Point>; moved: boolean }
  | { kind: "marquee"; x: number; y: number; cx: number; cy: number; additive: boolean }
  | { kind: "draw"; tool: ToolId; a: Point; b: Point; alt: boolean; shift: boolean }
  | { kind: "stroke"; tool: "pencil" | "brush" | "spray" | "eraser" | "lasso"; points: Point[]; pressure: number[] }
  | { kind: "zoom"; a: Point; b: Point }
  | { kind: "pan"; x: number; y: number; panX: number; panY: number }
  | { kind: "free"; id: string; handle: string; start: Point; el: SceneElement }
  | { kind: "anchor"; id: string; index: number; part: "p" | "in" | "out"; el: SceneElement }
  | { kind: "grad"; id: string; handle: "c" | "e" | "f"; el: SceneElement }
  | { kind: "rot"; id: string; axis: "x" | "y" | "z"; start: number; py: number; el: SceneElement }
  | { kind: "bone"; a: Point; b: Point; effector?: string }
  | { kind: "guide"; id: string; orientation: "h" | "v" };

export function StageView() {
  const ref = useRef<HTMLDivElement>(null);
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const zoom = useStudio((s) => s.zoom);
  const panX = useStudio((s) => s.panX);
  const panY = useStudio((s) => s.panY);
  const tool = useStudio((s) => s.tool);
  const selection = useStudio((s) => s.selection);
  const rulers = useStudio((s) => s.rulers);
  const showGrid = useStudio((s) => s.grid);
  const guidesOn = useStudio((s) => s.guidesOn);
  const workArea = useStudio((s) => s.workArea);
  const preview = useStudio((s) => s.previewMode);
  const hideEdges = useStudio((s) => s.hideEdges);
  const onion = useStudio((s) => s.onion);
  const onionOutlines = useStudio((s) => s.onionOutlines);
  const before = useStudio((s) => s.onionBefore);
  const after = useStudio((s) => s.onionAfter);
  const playing = useStudio((s) => s.playing);
  const session = useStudio((s) => s.session);
  const editingSymbolId = useStudio((s) => s.editingSymbolId);
  const pen = useStudio((s) => s.pen);
  const hintsOn = useStudio((s) => s.shapeHints);
  const simpleButtons = useStudio((s) => s.simpleButtons);
  const editingTextId = useStudio((s) => s.editingTextId);
  const [hoverBtn, setHoverBtn] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const polyRef = useRef<Point[]>([]);

  const setDraft = (d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  };

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    bridge.stageSize = () => ({ w: node.clientWidth, h: node.clientHeight });
    useStudio.getState().fit(node.clientWidth, node.clientHeight);
    const wheel = (e: WheelEvent) => {
      if (!ref.current) return;
      e.preventDefault();
      const s = useStudio.getState();
      if (e.ctrlKey || e.metaKey) s.zoomAt(e.deltaY > 0 ? 1 / 1.08 : 1.08, e.clientX, e.clientY, ref.current.getBoundingClientRect());
      else s.setPan(s.panX - e.deltaX, s.panY - e.deltaY);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);

  const scene = activeScene(doc);
  const symbol = editingSymbolId ? findSymbol(doc, editingSymbolId) : null;

  function toStage(e: { clientX: number; clientY: number }): Point {
    const box = ref.current?.getBoundingClientRect();
    const s = useStudio.getState();
    if (!box) return { x: 0, y: 0 };
    return { x: (e.clientX - box.left - s.panX) / s.zoom - PASTE, y: (e.clientY - box.top - s.panY) / s.zoom - PASTE };
  }

  function layersAtFrame(f: number) {
    if (symbol) return [{ layer: scene.layers[0], elements: symbol.elements, mask: null as null }];
    const rows: { layer: (typeof scene.layers)[number]; elements: SceneElement[]; mask: (typeof scene.layers)[number] | null }[] = [];
    for (let i = scene.layers.length - 1; i >= 0; i--) {
      const layer = scene.layers[i];
      if (!layer.visible || layer.type === "folder" || layer.type === "mask") continue;
      if ((playing || session !== "edit") && layer.type === "guide") continue;
      const above = scene.layers[i - 1];
      const mask = layer.type === "masked" && above?.type === "mask" ? above : null;
      rows.push({ layer, elements: sampleLayer(layer, f).filter((el) => el.visible), mask });
    }
    return rows;
  }

  function begin(e: RPEvent | PointerEvent, hit?: { el: SceneElement; layerId: string }) {
    if (e.button === 2) return;
    const s = useStudio.getState();
    if (s.session !== "edit") return;
    const p = toStage(e);
    s.setMouse(p);
    const shift = e.shiftKey;
    const alt = e.altKey;
    if (s.tool === "hand" || e.button === 1) {
      setDraft({ kind: "pan", x: e.clientX, y: e.clientY, panX: s.panX, panY: s.panY });
      return;
    }
    if (s.tool === "zoom") {
      if (!("movementX" in e) || Math.abs((e as PointerEvent).movementX) < 0) {
        if (!shift && (e.target as HTMLElement).closest?.("[data-zoom-skip]")) return;
      }
      setDraft({ kind: "zoom", a: p, b: p });
      if (alt) s.zoomAt(1 / 1.25, e.clientX, e.clientY, ref.current!.getBoundingClientRect());
      return;
    }
    if (hit && (s.tool === "bucket" || s.tool === "ink" || s.tool === "dropper" || (s.tool === "eraser" && s.opts.eraserMode === "faucet") || (s.tool === "lasso" && s.opts.lassoMagic))) {
      actOnHit(hit.el, hit.layerId, p);
      return;
    }
    if (hit && s.tool === "bind") {
      s.setSelection([hit.el.id], hit.layerId);
      s.setBindArm(hit.el.id);
      return;
    }
    if (hit && s.tool === "text") {
      s.setSelection([hit.el.id], hit.layerId);
      s.setEditingText(hit.el.kind === "text" ? hit.el.id : null);
      if (hit.el.kind !== "text") placeText(p);
      return;
    }
    if (!hit && s.tool === "text") {
      placeText(p);
      return;
    }
    if (hit && (s.tool === "select" || s.tool === "subselect" || s.tool === "free" || s.tool === "rot3d" || s.tool === "move3d")) {
      if (s.tool === "rot3d" || s.tool === "move3d") {
        const sym = hit.el.kind === "symbol" ? findSymbol(s.doc, hit.el.symbolId) : null;
        if (!sym || sym.type !== "movieclip") {
          s.setStatus("3D tools affect movie-clip instances. Convert the artwork with F8 and choose Movie clip.");
          return;
        }
      }
      let ids = s.selection;
      if (shift && s.tool === "select") ids = ids.includes(hit.el.id) ? ids.filter((id) => id !== hit.el.id) : [...ids, hit.el.id];
      else if (!ids.includes(hit.el.id)) ids = [hit.el.id];
      s.setSelection(ids, hit.layerId);
      if (e.detail === 2 && hit.el.kind === "symbol") s.enterSymbol(hit.el.symbolId);
      if (e.detail === 2 && hit.el.kind === "text") {
        s.setEditingText(hit.el.id);
        return;
      }
      const pos = new Map(useStudio.getState().selectedElements().map((el) => [el.id, { x: el.x, y: el.y }]));
      if (s.tool === "select" || s.tool === "subselect") setDraft({ kind: "move", ids, start: p, pos, moved: false });
      return;
    }
    if (!hit && (s.tool === "select" || s.tool === "subselect")) {
      if (!shift) s.deselect();
      setDraft({ kind: "marquee", x: p.x, y: p.y, cx: p.x, cy: p.y, additive: shift });
      return;
    }
    if (s.tool === "pen") {
      penClick(p, shift);
      return;
    }
    if (["rect", "oval", "line", "polystar"].includes(s.tool)) {
      setDraft({ kind: "draw", tool: s.tool, a: p, b: p, alt, shift });
      return;
    }
    if (s.tool === "pencil" || s.tool === "brush" || s.tool === "spray" || s.tool === "eraser" || s.tool === "lasso") {
      if (s.tool === "lasso" && s.opts.lassoPoly) {
        polyRef.current = [...polyRef.current, p];
        setDraft({ kind: "stroke", tool: "lasso", points: polyRef.current, pressure: [] });
        return;
      }
      setDraft({ kind: "stroke", tool: s.tool === "eraser" ? "eraser" : s.tool, points: [p], pressure: [e.pressure || 0.5] });
      return;
    }
    if (s.tool === "deco") {
      decoAt(p, p);
      return;
    }
    if (s.tool === "bone") {
      const layer = scene.layers.find((l) => l.id === s.layerId);
      const arm = layer ? currentArmature(layer, s.frame) : { bones: [] };
      const joint = nearestJoint(arm.bones, p, 10 / s.zoom);
      if (joint?.end === "tail") setDraft({ kind: "bone", a: p, b: p, effector: joint.id });
      else setDraft({ kind: "bone", a: p, b: p });
      return;
    }
  }

  function actOnHit(el: SceneElement, layerId: string, p: Point) {
    const s = useStudio.getState();
    s.setSelection([el.id], layerId);
    if (s.tool === "dropper") {
      if (el.fill.type !== "none") s.setWell(el.fill);
      if (el.stroke) s.patchOpts({ stroke: el.stroke, activeWell: "fill" });
      s.setTool("bucket");
      s.setStatus("Sampled fill and stroke");
      return;
    }
    if (s.tool === "bucket") {
      const fill = s.opts.fill;
      s.changeSelection((item) => ({ ...item, fill, closed: item.kind === "path" && s.opts.gapSize !== "none" ? true : item.closed }), "Paint bucket");
      return;
    }
    if (s.tool === "ink") {
      s.changeSelection((item) => ({ ...item, stroke: s.opts.stroke ? { ...s.opts.stroke } : item.stroke }), "Ink bottle");
      return;
    }
    if (s.tool === "eraser") {
      s.deleteSelection();
      return;
    }
    if (s.tool === "lasso" && s.opts.lassoMagic) magic(el, p);
  }

  function magic(el: SceneElement, _p: Point) {
    const s = useStudio.getState();
    const color = el.fill.type === "solid" ? el.fill.color : el.fill.type !== "none" ? el.fill.stops[0]?.color : null;
    if (!color) return;
    const ids = [el.id];
    const all = symbol ? symbol.elements : scene.layers.flatMap((layer) => sampleLayer(layer, s.frame));
    for (const other of all) {
      const c = other.fill.type === "solid" ? other.fill.color : null;
      if (!c) continue;
      if (colorDist(color, c) <= s.opts.magicThreshold) ids.push(other.id);
    }
    if (s.opts.magicSmoothing > 0) {
      const chosen = all.filter((item) => ids.includes(item.id));
      for (const other of all) {
        if (ids.includes(other.id)) continue;
        const b = boundsOf(other);
        if (chosen.some((item) => Math.abs(boundsOf(item).x - b.x) < s.opts.magicSmoothing + boundsOf(item).w)) ids.push(other.id);
      }
    }
    s.setSelection([...new Set(ids)]);
  }

  function placeText(p: Point) {
    const s = useStudio.getState();
    const el = makeElement({
      kind: "text",
      name: "Text",
      x: p.x,
      y: p.y,
      w: 180,
      h: 36,
      text: "Text",
      textType: s.opts.textType,
      antialias: s.opts.antialias,
      fill: s.opts.fill.type === "none" ? { type: "solid", color: "#1c1b19", alpha: 1 } : s.opts.fill,
      stroke: null,
      fontSize: 28,
    });
    s.addShape(el);
    s.setEditingText(el.id);
  }

  function penClick(p: Point, shift: boolean) {
    const s = useStudio.getState();
    const mode = s.opts.penMode;
    const selected = s.selectedElements().find((el) => el.anchors.length);
    if (mode !== "pen" && selected) {
      const local = worldToLocal(selected, p);
      if (mode === "delete") {
        const index = closestAnchor(selected, local);
        if (index >= 0) {
          s.setSelection([selected.id]);
          s.changeSelection((el) => ({ ...el, anchors: el.anchors.filter((_, i) => i !== index) }), "Delete anchor");
        }
        return;
      }
      if (mode === "convert") {
        const index = closestAnchor(selected, local);
        if (index >= 0) {
          s.changeSelection((el) => ({
            ...el,
            anchors: el.anchors.map((a, i) => (i === index ? { ...a, inX: a.inX == null ? a.x - 12 : null, inY: a.inY == null ? a.y : null, outX: a.outX == null ? a.x + 12 : null, outY: a.outY == null ? a.y : null } : a)),
          }), "Convert anchor");
        }
        return;
      }
      if (mode === "add" && selected.anchors.length > 1) {
        const anchors = selected.anchors.slice();
        let best = 1;
        let bestD = Infinity;
        for (let i = 0; i < anchors.length; i++) {
          const n = anchors[(i + 1) % anchors.length];
          const d = Math.hypot((anchors[i].x + n.x) / 2 - local.x, (anchors[i].y + n.y) / 2 - local.y);
          if (d < bestD) {
            bestD = d;
            best = i + 1;
          }
        }
        anchors.splice(best, 0, { x: local.x, y: local.y, inX: null, inY: null, outX: null, outY: null });
        s.changeSelection(() => ({ ...selected, anchors }), "Add anchor");
        return;
      }
    }
    const anchors = s.pen ? s.pen.slice() : [];
    if (anchors.length > 2 && Math.hypot(anchors[0].x - p.x, anchors[0].y - p.y) < 8 / s.zoom) {
      s.setPen(anchors);
      s.finishPen(true);
      return;
    }
    const point: Anchor = { x: p.x, y: p.y, inX: null, inY: null, outX: null, outY: null };
    anchors.push(point);
    s.setPen(anchors);
    setDraft({ kind: "draw", tool: "pen", a: p, b: p, alt: false, shift: false });
  }

  function decoAt(a: Point, b: Point) {
    const s = useStudio.getState();
    const mode = s.opts.decoMode;
    const fill = s.opts.fill;
    const stroke = s.opts.stroke;
    const made: SceneElement[] = [];
    if (mode === "flower") {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        made.push(makeElement({ kind: "oval", name: "Petal", x: a.x + Math.cos(ang) * 18 - 10, y: a.y + Math.sin(ang) * 18 - 16, w: 20, h: 32, rotation: (ang * 180) / Math.PI + 90, fill, stroke: null }));
      }
      made.push(makeElement({ kind: "oval", name: "Center", x: a.x - 8, y: a.y - 8, w: 16, h: 16, fill: { type: "solid", color: "#fffcf7", alpha: 1 }, stroke: null }));
    } else if (mode === "grid") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.max(20, Math.abs(b.x - a.x));
      const h = Math.max(20, Math.abs(b.y - a.y));
      for (let gy = y; gy < y + h; gy += 28) {
        for (let gx = x; gx < x + w; gx += 28) made.push(makeElement({ kind: "oval", name: "Grid", x: gx, y: gy, w: 16, h: 16, fill, stroke }));
      }
    } else if (mode === "symmetry") {
      const pts = [a, b, { x: doc.width - b.x, y: b.y }, { x: doc.width - a.x, y: a.y }];
      made.push(pathFromAnchors(pts.map((pt) => ({ ...pt, inX: null, inY: null, outX: null, outY: null })), true, { fill, stroke }, "Symmetry"));
    } else {
      let x = a.x;
      let y = a.y;
      const anchors: Anchor[] = [{ x, y, inX: null, inY: null, outX: null, outY: null }];
      for (let i = 0; i < 7; i++) {
        x += 26;
        y += (i % 2 ? 28 : -22);
        anchors.push({ x, y, inX: x - 10, inY: y, outX: x + 10, outY: y });
        made.push(makeElement({ kind: "oval", name: "Leaf", x: x - 8, y: y - 6, w: 16, h: 10, rotation: i % 2 ? 30 : -30, fill, stroke: null }));
      }
      made.unshift(pathFromAnchors(anchors, false, { fill: { type: "none" }, stroke: stroke ?? { color: "#1c1b19", alpha: 1, width: 2, cap: "round", join: "round" } }, "Vine"));
    }
    s.update((current) => {
      if (s.editingSymbolId) {
        return { ...current, library: current.library.map((sym) => (sym.id === s.editingSymbolId ? { ...sym, elements: [...sym.elements, ...made] } : sym)) };
      }
      return made.reduce((acc, el) => addElement(acc, s.layerId, s.frame, el), current);
    }, "Deco");
    s.setSelection(made.map((el) => el.id));
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = draftRef.current;
      const s = useStudio.getState();
      const p = toStage(e);
      s.setMouse(p);
      if (!d) return;
      if (d.kind === "pan") {
        s.setPan(d.panX + (e.clientX - d.x), d.panY + (e.clientY - d.y));
        return;
      }
      if (d.kind === "marquee") {
        setDraft({ ...d, cx: p.x, cy: p.y });
        return;
      }
      if (d.kind === "draw") {
        setDraft({ ...d, b: p, shift: e.shiftKey, alt: e.altKey });
        if (d.tool === "pen" && s.pen?.length) {
          const anchors = s.pen.slice();
          const last = anchors[anchors.length - 1];
          const dx = p.x - last.x;
          const dy = p.y - last.y;
          anchors[anchors.length - 1] = { ...last, outX: p.x, outY: p.y, inX: last.x - dx, inY: last.y - dy };
          s.setPen(anchors);
        }
        return;
      }
      if (d.kind === "stroke") {
        if (d.tool === "lasso" && s.opts.lassoPoly) return;
        const points = [...d.points, p];
        setDraft({ ...d, points, pressure: [...d.pressure, e.pressure || 0.5] });
        if (d.tool === "eraser" && s.opts.eraserMode !== "faucet") eraseAt(points);
        if (d.tool === "spray") return;
        return;
      }
      if (d.kind === "zoom") {
        setDraft({ ...d, b: p });
        return;
      }
      if (d.kind === "move") {
        let dx = p.x - d.start.x;
        let dy = p.y - d.start.y;
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        if (!d.moved && Math.hypot(dx, dy) < 2) return;
        if (!d.moved) s.transactStart("Move");
        const ids = new Set(d.ids);
        if (!e.altKey) {
          const first = d.ids[0];
          const origin = d.pos.get(first);
          if (origin) {
            const snapped = s.snapPoint({ x: origin.x + dx, y: origin.y + dy }, d.ids);
            dx = snapped.x - origin.x;
            dy = snapped.y - origin.y;
          }
        }
        s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, ids, (el) => {
          const o = d.pos.get(el.id);
          return o ? { ...el, x: o.x + dx, y: o.y + dy } : el;
        }));
        setDraft({ ...d, moved: true });
        return;
      }
      if (d.kind === "free") {
        if (!s.txBase) s.transactStart("Transform");
        const next = transformElement(d.el, d.handle, d.start, p, e.shiftKey, e.altKey);
        s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, new Set([d.id]), () => next));
        return;
      }
      if (d.kind === "anchor") {
        if (!s.txBase) s.transactStart("Edit anchor");
        const local = worldToLocal(d.el, p);
        s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, new Set([d.id]), (el) => ({
          ...el,
          anchors: el.anchors.map((a, i) => {
            if (i !== d.index) return a;
            if (d.part === "p") {
              const dx = local.x - a.x;
              const dy = local.y - a.y;
              return { ...a, x: local.x, y: local.y, inX: a.inX == null ? null : a.inX + dx, inY: a.inY == null ? null : a.inY + dy, outX: a.outX == null ? null : a.outX + dx, outY: a.outY == null ? null : a.outY + dy };
            }
            if (d.part === "in") return { ...a, inX: local.x, inY: local.y, outX: a.x - (local.x - a.x), outY: a.y - (local.y - a.y) };
            return { ...a, outX: local.x, outY: local.y, inX: a.x - (local.x - a.x), inY: a.y - (local.y - a.y) };
          }),
        })));
        return;
      }
      if (d.kind === "grad") {
        if (!s.txBase) s.transactStart("Gradient");
        const local = worldToLocal(d.el, p);
        s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, new Set([d.id]), (el) => {
          if (el.fill.type !== "linear" && el.fill.type !== "radial") return el;
          const fill = { ...el.fill, stops: el.fill.stops.map((st) => ({ ...st })) };
          if (d.handle === "c") {
            fill.cx = local.x / (el.w || 1);
            fill.cy = local.y / (el.h || 1);
          } else if (d.handle === "f") fill.focal = (local.x / (el.w || 1) - fill.cx) / (fill.rx || 1);
          else {
            fill.angle = (Math.atan2(local.y / (el.h || 1) - fill.cy, local.x / (el.w || 1) - fill.cx) * 180) / Math.PI;
            fill.rx = Math.max(0.05, Math.hypot(local.x / (el.w || 1) - fill.cx, local.y / (el.h || 1) - fill.cy));
          }
          return { ...el, fill };
        }));
        return;
      }
      if (d.kind === "rot") {
        if (!s.txBase) s.transactStart("3D");
        const delta = d.axis === "z" ? e.clientX - d.py : e.clientY - d.py;
        s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, new Set([d.id]), (el) => {
          if (d.axis === "x") return { ...el, rotX: d.start + delta * 0.45 };
          if (d.axis === "y") return { ...el, rotY: d.start + delta * 0.45 };
          if (d.axis === "z" && s.tool === "move3d") return { ...el, z: d.start + delta };
          return { ...el, rotZ: d.start + delta * 0.45 };
        }));
        return;
      }
      if (d.kind === "bone") {
        setDraft({ ...d, b: p });
        if (d.effector) {
          const layer = activeScene(s.doc).layers.find((l) => l.id === s.layerId);
          if (!layer) return;
          const arm = currentArmature(layer, s.frame);
          const bones = applyFabrik(arm.bones, d.effector, p);
          if (!s.txBase) s.transactStart("Pose bone");
          s.previewDoc((current) => {
            const sc = activeScene(current);
            return {
              ...current,
              scenes: current.scenes.map((sceneItem) => sceneItem.id !== sc.id ? sceneItem : {
                ...sceneItem,
                layers: sceneItem.layers.map((layerItem) => (layerItem.id === s.layerId ? withArmature(layerItem, s.frame, bones, arm.binds) : layerItem)),
              }),
            };
          });
        }
        return;
      }
      if (d.kind === "guide") {
        s.moveGuide(d.id, d.orientation === "v" ? p.x : p.y);
      }
    };
    const up = (e: PointerEvent) => {
      const d = draftRef.current;
      if (!d) return;
      const s = useStudio.getState();
      const p = toStage(e);
      if (d.kind === "move" || d.kind === "free" || d.kind === "anchor" || d.kind === "grad" || d.kind === "rot" || (d.kind === "bone" && d.effector)) {
        if (d.kind === "move" && !d.moved) s.cancelPreview();
        else s.commitPreview(d.kind === "move" ? "Move" : "Edit");
      } else if (d.kind === "marquee") finishMarquee(d);
      else if (d.kind === "draw" && d.tool !== "pen") finishDraw(d);
      else if (d.kind === "stroke") finishStroke(d);
      else if (d.kind === "zoom") finishZoom(d, e.altKey);
      else if (d.kind === "bone" && !d.effector) finishBone(d);
      else if (d.kind === "guide") {
        const pos = d.orientation === "v" ? p.x : p.y;
        if ((d.orientation === "v" && p.y < 0) || (d.orientation === "h" && p.x < 0)) s.removeGuide(d.id);
        else s.moveGuide(d.id, pos);
        s.commitPreview("Guide");
      }
      if (d.kind !== "draw" || d.tool !== "pen") setDraft(null);
      else setDraft(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [doc.width, doc.height, zoom, panX, panY]);

  function finishMarquee(d: Extract<Draft, { kind: "marquee" }>) {
    const s = useStudio.getState();
    const box = { x: Math.min(d.x, d.cx), y: Math.min(d.y, d.cy), w: Math.abs(d.cx - d.x), h: Math.abs(d.cy - d.y) };
    if (box.w < 3 && box.h < 3) return;
    const hits: string[] = [];
    const pool = symbol ? symbol.elements : scene.layers.flatMap((layer) => (layer.locked || !layer.visible ? [] : sampleLayer(layer, s.frame)));
    for (const el of pool) {
      const b = boundsOf(el);
      if (b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y) hits.push(el.id);
    }
    s.setSelection(d.additive ? [...new Set([...s.selection, ...hits])] : hits);
  }

  function finishDraw(d: Extract<Draft, { kind: "draw" }>) {
    const s = useStudio.getState();
    let a = d.a;
    let b = d.shift ? constrain(d.a, d.b) : d.b;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 2) return;
    if (d.alt) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      a = { x: d.a.x - dx, y: d.a.y - dy };
    }
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.max(1, Math.abs(b.x - a.x));
    const h = Math.max(1, Math.abs(b.y - a.y));
    const common = { fill: s.opts.fill, stroke: s.opts.stroke };
    let el: SceneElement;
    if (d.tool === "line") {
      el = makeElement({ kind: "line", name: "Line", x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, fill: { type: "none" }, stroke: s.opts.stroke ?? { color: "#1c1b19", alpha: 1, width: 2, cap: "round", join: "round" } });
    } else if (d.tool === "oval") {
      el = makeElement({ kind: "oval", name: "Oval", x, y, w, h, ...common, endAngle: s.opts.ovalPrimitive ? 300 : 360 });
    } else if (d.tool === "polystar") {
      el = makeElement({ kind: "polystar", name: s.opts.polyStar ? "Star" : "Polygon", x, y, w, h, sides: s.opts.polySides, star: s.opts.polyStar, innerRatio: s.opts.polyInner, ...common });
    } else {
      el = makeElement({ kind: "rect", name: "Rectangle", x, y, w, h, cornerRadius: s.opts.rectPrimitive ? Math.min(w, h) * 0.2 : 0, ...common });
    }
    s.addShape(el);
  }

  function finishStroke(d: Extract<Draft, { kind: "stroke" }>) {
    const s = useStudio.getState();
    if (d.tool === "eraser") {
      s.commitPreview("Erase");
      return;
    }
    if (d.points.length < 2 && d.tool !== "spray") return;
    if (d.tool === "lasso") {
      const poly = d.points;
      if (poly.length < 3) return;
      const hits = (symbol ? symbol.elements : scene.layers.flatMap((layer) => sampleLayer(layer, s.frame))).filter((el) => {
        const b = boundsOf(el);
        return polyIntersects(poly, b) || pointInPoly({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, poly);
      });
      s.setSelection(hits.map((el) => el.id));
      polyRef.current = [];
      return;
    }
    if (d.tool === "spray") {
      const dots = d.points.flatMap((pt) => Array.from({ length: 5 }, () => ({ x: pt.x + (Math.random() - 0.5) * 36, y: pt.y + (Math.random() - 0.5) * 36, r: 1 + Math.random() * (s.opts.brushSize / 3) })));
      if (s.opts.spraySymbols && s.libraryId) {
        dots.forEach((dot) => s.placeSymbol(s.libraryId!, { x: dot.x, y: dot.y }));
        return;
      }
      const minX = Math.min(...dots.map((dot) => dot.x));
      const minY = Math.min(...dots.map((dot) => dot.y));
      s.addShape(makeElement({ kind: "spray", name: "Spray", x: minX, y: minY, w: 40, h: 40, dots: dots.map((dot) => ({ ...dot, x: dot.x - minX, y: dot.y - minY })), fill: s.opts.fill, stroke: null }));
      return;
    }
    let points = d.points;
    if (d.tool === "pencil" && s.opts.pencilMode === "straighten") points = straighten(points);
    else if (d.tool === "pencil" && s.opts.pencilMode === "smooth") points = smoothPath(points, 4);
    else if (d.tool === "pencil") points = rdp(points, 1.4);
    else points = smoothPath(points, 1);
    if (d.tool === "brush" && s.opts.pressure) {
      const widths = d.pressure.map((pr, i) => s.opts.brushSize * (0.35 + pr) * (s.opts.brushShape === "flat" ? 0.45 : 1) * (i % 1 === 0 ? 1 : 1));
      const ring = ribbon(points, widths.length === points.length ? widths : points.map(() => s.opts.brushSize));
      const el = pathFromAnchors(ring.map((pt) => ({ x: pt.x, y: pt.y, inX: null, inY: null, outX: null, outY: null })), true, { fill: s.opts.fill.type === "none" ? { type: "solid", color: s.opts.stroke?.color ?? "#1c1b19", alpha: 1 } : s.opts.fill, stroke: null }, "Brush");
      el.fillLocked = s.opts.lockFill;
      s.addShape(el);
      return;
    }
    const anchors = d.tool === "pencil" && s.opts.pencilMode === "smooth" ? catmullAnchors(points) : points.map((pt) => ({ x: pt.x, y: pt.y, inX: null, inY: null, outX: null, outY: null }));
    const stroke = s.opts.stroke ? { ...s.opts.stroke, width: d.tool === "brush" ? s.opts.brushSize : s.opts.stroke.width, cap: "round" as const } : { color: "#1c1b19", alpha: 1, width: d.tool === "brush" ? s.opts.brushSize : 2, cap: "round" as const, join: "round" as const };
    const color = s.opts.fill.type === "solid" ? s.opts.fill.color : stroke.color;
    s.addShape(pathFromAnchors(anchors, false, { fill: { type: "none" }, stroke: { ...stroke, color: d.tool === "brush" ? color : stroke.color } }, d.tool === "brush" ? "Brush" : "Pencil"));
  }

  function eraseAt(points: Point[]) {
    const s = useStudio.getState();
    const last = points[points.length - 1];
    const pool = symbol ? symbol.elements : scene.layers.filter((layer) => !layer.locked && layer.visible).flatMap((layer) => sampleLayer(layer, s.frame));
    const hit = pool.filter((el) => {
      const b = boundsOf(el);
      const near = last.x >= b.x - 8 && last.x <= b.x + b.w + 8 && last.y >= b.y - 8 && last.y <= b.y + b.h + 8;
      if (!near) return false;
      if (s.opts.eraserMode === "inside") return s.selection.includes(el.id);
      return true;
    });
    if (!hit.length) return;
    if (!s.txBase) s.transactStart("Erase");
    const ids = new Set(hit.map((el) => el.id));
    s.previewDoc((current) => editLive(current, s.frame, s.editingSymbolId, ids, (el) => {
      if (s.opts.eraserMode === "fills") return { ...el, fill: { type: "none" } };
      if (s.opts.eraserMode === "strokes") return { ...el, stroke: null };
      return null;
    }));
  }

  function finishZoom(d: Extract<Draft, { kind: "zoom" }>, alt: boolean) {
    const s = useStudio.getState();
    const w = Math.abs(d.b.x - d.a.x);
    const h = Math.abs(d.b.y - d.a.y);
    const node = ref.current;
    if (!node) return;
    if (w < 6 || h < 6) {
      const box = node.getBoundingClientRect();
      const clientX = box.left + s.panX + (d.a.x + PASTE) * s.zoom;
      const clientY = box.top + s.panY + (d.a.y + PASTE) * s.zoom;
      if (!alt) s.zoomAt(1.25, clientX, clientY, box);
      return;
    }
    const z = Math.max(0.08, Math.min(12, Math.min((node.clientWidth - 40) / w, (node.clientHeight - 40) / h)));
    const cx = (Math.min(d.a.x, d.b.x) + w / 2);
    const cy = (Math.min(d.a.y, d.b.y) + h / 2);
    s.setZoom(z);
    s.setPan(node.clientWidth / 2 - (cx + PASTE) * z, node.clientHeight / 2 - (cy + PASTE) * z);
  }

  function finishBone(d: Extract<Draft, { kind: "bone" }>) {
    const s = useStudio.getState();
    if (Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) < 8) return;
    const layer = scene.layers.find((l) => l.id === s.layerId);
    if (!layer) return;
    const arm = currentArmature(layer, s.frame);
    const parent = nearestJoint(arm.bones, d.a, 12 / s.zoom);
    const bone = { id: uid("bone"), name: `Bone ${arm.bones.length + 1}`, parentId: parent?.id ?? null, x: d.a.x, y: d.a.y, tx: d.b.x, ty: d.b.y };
    s.setArmature([...arm.bones, bone], arm.binds);
  }

  const selected = symbol ? symbol.elements.filter((el) => selection.includes(el.id)) : scene.layers.flatMap((layer) => sampleLayer(layer, frame)).filter((el) => selection.includes(el.id));
  const grid = useStudio.getState().prefs.grid;
  const interactive = session === "edit" && !playing;

  return (
    <div ref={ref} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-paste" onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: stageMenu() }); }}>
      <div className="absolute top-0 left-0" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg id="stage-print" width={doc.width + PASTE * 2} height={doc.height + PASTE * 2} className="touch-none" onPointerDown={(e) => begin(e)}>
          <defs>
            <filter id="keyline-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="2" dy="3" stdDeviation="2.2" floodOpacity="0.35" />
            </filter>
            <clipPath id="stage-clip">
              <rect x={PASTE} y={PASTE} width={doc.width} height={doc.height} />
            </clipPath>
          </defs>
          <rect width="100%" height="100%" fill="transparent" />
          <g clipPath={workArea ? undefined : "url(#stage-clip)"}>
            <g transform={`translate(${PASTE} ${PASTE})`}>
              <rect width={doc.width} height={doc.height} fill={doc.background} />
              {showGrid ? <Grid width={doc.width} height={doc.height} size={grid} /> : null}
              {onion && !symbol ? onionFrames(frame, before, after, scene.frameCount).map((f) => layersAtFrame(f).map((row) => row.elements.map((el) => <ShapeArt key={`o${f}${el.id}`} el={el} doc={doc} uid={`o${f}-${el.id}`} ghost outline={onionOutlines ? row.layer.color : null} />))) : null}
              {(symbol ? [{ layer: scene.layers[0], elements: symbol.elements, mask: null }] : layersAtFrame(frame)).map((row) => {
                const content = row.elements.map((el) => (
                  <ShapeArt
                    key={el.id}
                    el={buttonState(el, hoverBtn, simpleButtons && (playing || session !== "edit"))}
                    doc={doc}
                    uid={el.id}
                    outline={preview === "outlines" || row.layer?.outline ? row.layer?.color ?? "#e09a3e" : null}
                    interactive={interactive}
                    onDown={(e, target) => {
                      e.stopPropagation();
                      if (session !== "edit") return;
                      begin(e, { el: target, layerId: row.layer?.id ?? useStudio.getState().layerId });
                    }}
                  />
                ));
                if (!row.mask) return <g key={row.layer?.id ?? "sym"} style={{ shapeRendering: preview === "fast" ? "optimizeSpeed" : "auto" }}>{content}</g>;
                const maskId = `mask-${row.mask.id}`;
                return (
                  <g key={row.layer.id}>
                    <clipPath id={maskId}>{sampleLayer(row.mask, frame).map((el) => <ShapeArt key={el.id} el={el} doc={doc} uid={`c${el.id}`} />)}</clipPath>
                    <g clipPath={`url(#${maskId})`}>{content}</g>
                  </g>
                );
              })}
              {draft?.kind === "draw" && draft.tool !== "pen" ? <DraftShape draft={draft} /> : null}
              {draft?.kind === "stroke" ? <polyline points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#e09a3e" strokeWidth={1.25} /> : null}
              {draft?.kind === "marquee" ? <rect x={Math.min(draft.x, draft.cx)} y={Math.min(draft.y, draft.cy)} width={Math.abs(draft.cx - draft.x)} height={Math.abs(draft.cy - draft.y)} fill="color-mix(in srgb, #e09a3e 15%, transparent)" stroke="#e09a3e" strokeDasharray="3 2" /> : null}
              {draft?.kind === "zoom" ? <rect x={Math.min(draft.a.x, draft.b.x)} y={Math.min(draft.a.y, draft.b.y)} width={Math.abs(draft.b.x - draft.a.x)} height={Math.abs(draft.b.y - draft.a.y)} fill="none" stroke="#e09a3e" /> : null}
              {pen && pen.length ? <path d={penPath(pen)} fill="none" stroke="#1c1b19" strokeWidth={1.25} /> : null}
              {guidesOn ? scene.guides.map((g) => <line key={g.id} x1={g.orientation === "v" ? g.pos : -200} y1={g.orientation === "h" ? g.pos : -200} x2={g.orientation === "v" ? g.pos : doc.width + 200} y2={g.orientation === "h" ? g.pos : doc.height + 200} stroke="#6d8eae" strokeWidth={1} />) : null}
              <rect width={doc.width} height={doc.height} fill="none" stroke="#8a8378" strokeWidth={1} />
              {interactive && !hideEdges ? <Handles selected={selected} tool={tool} zoom={zoom} onHandle={(id, handle, el, e) => { e.stopPropagation(); setDraft({ kind: "free", id, handle, start: toStage(e), el }); }} onAnchor={(id, index, part, el, e) => { e.stopPropagation(); setDraft({ kind: "anchor", id, index, part, el }); }} onGrad={(id, handle, el, e) => { e.stopPropagation(); setDraft({ kind: "grad", id, handle, el }); }} onRot={(id, axis, el, e) => { e.stopPropagation(); const start = axis === "x" ? el.rotX : axis === "y" ? el.rotY : el.rotZ; setDraft({ kind: "rot", id, axis, start: tool === "move3d" && axis === "z" ? el.z : start, py: axis === "y" ? e.clientX : e.clientY, el }); }} /> : null}
              {interactive ? <Bones zoom={zoom} onPose={(id, e) => { e.stopPropagation(); setDraft({ kind: "bone", a: toStage(e), b: toStage(e), effector: id }); }} /> : null}
              {hintsOn ? <Hints /> : null}
              {editingTextId ? <TextEditor id={editingTextId} /> : null}
            </g>
          </g>
        </svg>
      </div>
      {rulers ? <Rulers viewRef={ref} onGuide={(orientation, pos) => {
        const id = uid("g");
        useStudio.getState().transactStart("Guide");
        useStudio.getState().addGuide(orientation, pos);
        const created = activeScene(useStudio.getState().doc).guides.at(-1)?.id ?? id;
        setDraft({ kind: "guide", id: created, orientation });
      }} /> : null}
      {symbol ? (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-sm border border-line bg-panel/95 px-2 py-1 text-2xs">
          <button type="button" className="text-accent" onClick={() => useStudio.getState().exitSymbol()}>{scene.name}</button>
          <span className="text-faint">/</span>
          <span>{symbol.name}</span>
        </div>
      ) : null}
      {session !== "edit" ? (
        <div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-sm border border-line bg-panel px-2 py-1 text-2xs">
          <span>{session === "debug" ? "Debug" : "Test movie"}</span>
          <button type="button" className="text-accent" onClick={() => useStudio.getState().endSession()}>Return</button>
        </div>
      ) : null}
      {menu ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} /> : null}
      <button type="button" className="hidden" onPointerEnter={() => setHoverBtn(null)} />
    </div>
  );
}

function stageMenu(): MenuEntry[] {
  return [
    { id: "edit.cut", label: "Cut", shortcut: "Ctrl+X" },
    { id: "edit.copy", label: "Copy", shortcut: "Ctrl+C" },
    { id: "edit.paste", label: "Paste", shortcut: "Ctrl+V" },
    { id: "edit.pastePlace", label: "Paste in Place" },
    { sep: true },
    { id: "modify.symbol", label: "Convert to Symbol…", shortcut: "F8" },
    { id: "modify.break", label: "Break Apart" },
    { id: "modify.group", label: "Group" },
    { id: "modify.ungroup", label: "Ungroup" },
    { sep: true },
    { id: "modify.front", label: "Bring to Front" },
    { id: "modify.back", label: "Send to Back" },
  ];
}

function buttonState(el: SceneElement, _hover: string | null, live: boolean): SceneElement {
  if (!live || el.kind !== "symbol") return el;
  return el;
}

function onionFrames(frame: number, before: number, after: number, count: number): number[] {
  const frames: number[] = [];
  for (let i = before; i >= 1; i--) if (frame - i >= 0) frames.push(frame - i);
  for (let i = 1; i <= after; i++) if (frame + i < count) frames.push(frame + i);
  return frames;
}

function constrain(a: Point, b: Point): Point {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: a.x + Math.cos(snap) * len, y: a.y + Math.sin(snap) * len };
}

function closestAnchor(el: SceneElement, local: Point): number {
  let best = -1;
  let bestD = 12;
  el.anchors.forEach((a, i) => {
    const d = Math.hypot(a.x - local.x, a.y - local.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function penPath(anchors: Anchor[]): string {
  let d = `M ${anchors[0].x} ${anchors[0].y}`;
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const cur = anchors[i];
    if (prev.outX == null) d += ` L ${cur.x} ${cur.y}`;
    else d += ` C ${prev.outX} ${prev.outY} ${cur.inX ?? cur.x} ${cur.inY ?? cur.y} ${cur.x} ${cur.y}`;
  }
  return d;
}

function transformElement(el: SceneElement, handle: string, start: Point, now: Point, shift: boolean, alt: boolean): SceneElement {
  if (handle === "rotate") {
    const reg = localToWorld(el, { x: el.w * el.regX, y: el.h * el.regY });
    const a0 = Math.atan2(start.y - reg.y, start.x - reg.x);
    const a1 = Math.atan2(now.y - reg.y, now.x - reg.x);
    return { ...el, rotation: el.rotation + ((a1 - a0) * 180) / Math.PI };
  }
  if (handle === "reg") {
    const local = worldToLocal(el, now);
    const regX = local.x / (el.w || 1);
    const regY = local.y / (el.h || 1);
    const before = localToWorld(el, { x: 0, y: 0 });
    const next = { ...el, regX, regY };
    const after = localToWorld(next, { x: 0, y: 0 });
    next.x += before.x - after.x;
    next.y += before.y - after.y;
    return next;
  }
  if (alt) {
    const localNow = worldToLocal(el, now);
    const localStart = worldToLocal(el, start);
    return { ...el, skewX: el.skewX + (localNow.x - localStart.x) * 0.4, skewY: el.skewY + (localNow.y - localStart.y) * 0.4 };
  }
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  let { x, y, w, h } = el;
  if (handle.includes("e")) w = Math.max(4, el.w + dx);
  if (handle.includes("s")) h = Math.max(4, el.h + dy);
  if (handle.includes("w")) {
    w = Math.max(4, el.w - dx);
    x = el.x + (el.w - w);
  }
  if (handle.includes("n")) {
    h = Math.max(4, el.h - dy);
    y = el.y + (el.h - h);
  }
  if (shift) {
    const aspect = el.w / (el.h || 1);
    if (handle.includes("e") || handle.includes("w")) h = w / aspect;
    else w = h * aspect;
  }
  return { ...el, x, y, w, h };
}

function editLive(doc: Doc, frame: number, symbolId: string | null, ids: Set<string>, fn: (el: SceneElement) => SceneElement | null) {
  if (symbolId) {
    return {
      ...doc,
      library: doc.library.map((sym) =>
        sym.id !== symbolId
          ? sym
          : { ...sym, elements: sym.elements.flatMap((el) => { if (!ids.has(el.id)) return [el]; const next = fn(el); return next ? [next] : []; }) },
      ),
    };
  }
  return mapFrameElements(doc, frame, ids, (el) => fn(el));
}

function DraftShape({ draft }: { draft: Extract<Draft, { kind: "draw" }> }) {
  const a = draft.a;
  const b = draft.shift ? constrain(a, draft.b) : draft.b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  if (draft.tool === "line") return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e09a3e" strokeWidth={1} />;
  if (draft.tool === "oval") return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke="#e09a3e" />;
  return <rect x={x} y={y} width={w} height={h} fill="none" stroke="#e09a3e" />;
}

function Grid({ width, height, size }: { width: number; height: number; size: number }) {
  const lines: ReactNode[] = [];
  for (let x = 0; x <= width; x += size) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#e4dccb" strokeWidth={1} />);
  for (let y = 0; y <= height; y += size) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#e4dccb" strokeWidth={1} />);
  return <g>{lines}</g>;
}

function Handles({ selected, tool, zoom, onHandle, onAnchor, onGrad, onRot }: {
  selected: SceneElement[];
  tool: ToolId;
  zoom: number;
  onHandle: (id: string, handle: string, el: SceneElement, e: RPEvent<SVGCircleElement | SVGPathElement>) => void;
  onAnchor: (id: string, index: number, part: "p" | "in" | "out", el: SceneElement, e: RPEvent<SVGCircleElement>) => void;
  onGrad: (id: string, handle: "c" | "e" | "f", el: SceneElement, e: RPEvent<SVGCircleElement>) => void;
  onRot: (id: string, axis: "x" | "y" | "z", el: SceneElement, e: RPEvent<SVGEllipseElement | SVGPathElement>) => void;
}) {
  const r = 3.5 / zoom;
  return (
    <g>
      {selected.map((el) => {
        const pts = {
          nw: localToWorld(el, { x: 0, y: 0 }),
          n: localToWorld(el, { x: el.w / 2, y: 0 }),
          ne: localToWorld(el, { x: el.w, y: 0 }),
          e: localToWorld(el, { x: el.w, y: el.h / 2 }),
          se: localToWorld(el, { x: el.w, y: el.h }),
          s: localToWorld(el, { x: el.w / 2, y: el.h }),
          sw: localToWorld(el, { x: 0, y: el.h }),
          w: localToWorld(el, { x: 0, y: el.h / 2 }),
        };
        const box = (
          <path d={`M ${pts.nw.x} ${pts.nw.y} L ${pts.ne.x} ${pts.ne.y} L ${pts.se.x} ${pts.se.y} L ${pts.sw.x} ${pts.sw.y} Z`} fill="none" stroke="#e09a3e" strokeWidth={1 / zoom} />
        );
        if (tool === "subselect" && el.anchors.length) {
          return (
            <g key={el.id}>
              {el.anchors.map((a, i) => {
                const p = localToWorld(el, a);
                const inn = a.inX != null ? localToWorld(el, { x: a.inX, y: a.inY ?? a.y }) : null;
                const out = a.outX != null ? localToWorld(el, { x: a.outX, y: a.outY ?? a.y }) : null;
                return (
                  <g key={i}>
                    {inn ? <line x1={p.x} y1={p.y} x2={inn.x} y2={inn.y} stroke="#6d8eae" strokeWidth={1 / zoom} /> : null}
                    {out ? <line x1={p.x} y1={p.y} x2={out.x} y2={out.y} stroke="#6d8eae" strokeWidth={1 / zoom} /> : null}
                    {inn ? <circle cx={inn.x} cy={inn.y} r={r} fill="#fffcf7" stroke="#6d8eae" onPointerDown={(e) => onAnchor(el.id, i, "in", el, e)} /> : null}
                    {out ? <circle cx={out.x} cy={out.y} r={r} fill="#fffcf7" stroke="#6d8eae" onPointerDown={(e) => onAnchor(el.id, i, "out", el, e)} /> : null}
                    <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill="#fffcf7" stroke="#e09a3e" onPointerDown={(e) => onAnchor(el.id, i, "p", el, e as unknown as RPEvent<SVGCircleElement>)} />
                  </g>
                );
              })}
            </g>
          );
        }
        if (tool === "gradient" && (el.fill.type === "linear" || el.fill.type === "radial")) {
          const c = localToWorld(el, { x: el.fill.cx * el.w, y: el.fill.cy * el.h });
          const ang = (el.fill.angle * Math.PI) / 180;
          const ept = localToWorld(el, { x: (el.fill.cx + Math.cos(ang) * el.fill.rx) * el.w, y: (el.fill.cy + Math.sin(ang) * el.fill.rx) * el.h });
          const fpt = localToWorld(el, { x: (el.fill.cx + Math.cos(ang) * el.fill.focal * el.fill.rx) * el.w, y: (el.fill.cy + Math.sin(ang) * el.fill.focal * el.fill.rx) * el.h });
          return (
            <g key={el.id}>
              <line x1={c.x} y1={c.y} x2={ept.x} y2={ept.y} stroke="#e09a3e" strokeWidth={1 / zoom} />
              <circle cx={c.x} cy={c.y} r={r + 1} fill="#e09a3e" onPointerDown={(e) => onGrad(el.id, "c", el, e)} />
              <circle cx={ept.x} cy={ept.y} r={r} fill="#fffcf7" stroke="#e09a3e" onPointerDown={(e) => onGrad(el.id, "e", el, e)} />
              {el.fill.type === "radial" ? <circle cx={fpt.x} cy={fpt.y} r={r} fill="#6d8eae" onPointerDown={(e) => onGrad(el.id, "f", el, e)} /> : null}
            </g>
          );
        }
        if (tool === "rot3d" || tool === "move3d") {
          const c = localToWorld(el, { x: el.w * el.regX, y: el.h * el.regY });
          if (tool === "move3d") {
            return (
              <g key={el.id}>
                <path d={`M ${c.x} ${c.y} L ${c.x + 48} ${c.y}`} stroke="#d15b45" strokeWidth={2 / zoom} onPointerDown={(e) => onRot(el.id, "x", el, e)} />
                <path d={`M ${c.x} ${c.y} L ${c.x} ${c.y + 48}`} stroke="#7f9a62" strokeWidth={2 / zoom} onPointerDown={(e) => onRot(el.id, "y", el, e)} />
                <path d={`M ${c.x} ${c.y} L ${c.x + 32} ${c.y - 32}`} stroke="#6d8eae" strokeWidth={2 / zoom} onPointerDown={(e) => onRot(el.id, "z", el, e)} />
              </g>
            );
          }
          return (
            <g key={el.id} fill="none" strokeWidth={2 / zoom}>
              <ellipse cx={c.x} cy={c.y} rx={14 / zoom} ry={36 / zoom} stroke="#d15b45" onPointerDown={(e) => onRot(el.id, "x", el, e)} />
              <ellipse cx={c.x} cy={c.y} rx={36 / zoom} ry={14 / zoom} stroke="#7f9a62" onPointerDown={(e) => onRot(el.id, "y", el, e)} />
              <circle cx={c.x} cy={c.y} r={26 / zoom} stroke="#6d8eae" onPointerDown={(e) => onRot(el.id, "z", el, e)} />
            </g>
          );
        }
        if (tool !== "free" && tool !== "select") return null;
        if (tool === "select") return <g key={el.id}>{box}</g>;
        const reg = localToWorld(el, { x: el.w * el.regX, y: el.h * el.regY });
        return (
          <g key={el.id}>
            {box}
            {Object.entries(pts).map(([name, pt]) => (
              <rect key={name} x={pt.x - r} y={pt.y - r} width={r * 2} height={r * 2} fill="#fffcf7" stroke="#e09a3e" onPointerDown={(e) => onHandle(el.id, name, el, e)} />
            ))}
            <circle cx={pts.ne.x + 10 / zoom} cy={pts.ne.y - 10 / zoom} r={r} fill="#e09a3e" onPointerDown={(e) => onHandle(el.id, "rotate", el, e)} />
            <path d={`M ${reg.x - 6 / zoom} ${reg.y} H ${reg.x + 6 / zoom} M ${reg.x} ${reg.y - 6 / zoom} V ${reg.y + 6 / zoom}`} stroke="#e09a3e" strokeWidth={1 / zoom} onPointerDown={(e) => onHandle(el.id, "reg", el, e)} />
          </g>
        );
      })}
    </g>
  );
}

function Bones({ zoom, onPose }: { zoom: number; onPose: (id: string, e: RPEvent<SVGCircleElement>) => void }) {
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const layerId = useStudio((s) => s.layerId);
  const tool = useStudio((s) => s.tool);
  const layer = activeScene(doc).layers.find((l) => l.id === layerId);
  if (!layer || (tool !== "bone" && tool !== "bind" && tool !== "select")) return null;
  const arm = currentArmature(layer, frame);
  if (!arm.bones.length) return null;
  const bindArm = useStudio.getState().bindArm;
  return (
    <g>
      {arm.bones.map((b) => (
        <g key={b.id}>
          <line x1={b.x} y1={b.y} x2={b.tx} y2={b.ty} stroke="#e09a3e" strokeWidth={2 / zoom} />
          <circle cx={b.x} cy={b.y} r={4 / zoom} fill="#fffcf7" stroke="#1c1b19" />
          <circle
            cx={b.tx}
            cy={b.ty}
            r={5 / zoom}
            fill="#e09a3e"
            onPointerDown={(e) => {
              if (tool === "bind" && bindArm) {
                e.stopPropagation();
                useStudio.getState().bindElement(bindArm, b.id);
                return;
              }
              onPose(b.id, e);
            }}
          />
        </g>
      ))}
    </g>
  );
}

function Hints() {
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const layerId = useStudio((s) => s.layerId);
  const layer = activeScene(doc).layers.find((l) => l.id === layerId);
  const span = layer?.spans.find((s) => frame >= s.start && frame < s.end);
  if (!span?.hints.length) return null;
  return (
    <g>
      {span.hints.map((h) => (
        <g key={h.id}>
          <circle cx={h.x} cy={h.y} r={7} fill="#e09a3e" />
          <text x={h.x} y={h.y + 3} textAnchor="middle" fontSize={9} fill="#2a1c08">{h.letter}</text>
        </g>
      ))}
    </g>
  );
}

function TextEditor({ id }: { id: string }) {
  const el = useStudio.getState().selectedElements().find((item) => item.id === id) ?? useStudio.getState().doc.library.flatMap((s) => s.elements).find((item) => item.id === id);
  if (!el || el.kind !== "text") return null;
  const p = localToWorld(el, { x: 0, y: 0 });
  return (
    <foreignObject x={p.x} y={p.y} width={Math.max(80, el.w)} height={Math.max(32, el.h)}>
      <textarea
        autoFocus
        value={el.text}
        onChange={(e) => useStudio.getState().previewSelected({ text: e.target.value, w: Math.max(el.w, e.target.value.length * el.fontSize * 0.55) })}
        onFocus={() => useStudio.getState().transactStart("Edit text")}
        onBlur={() => useStudio.getState().transactEnd()}
        style={{ width: "100%", height: "100%", background: "transparent", color: "#1c1b19", fontSize: el.fontSize, fontFamily: el.fontFamily, border: "1px dashed #e09a3e", resize: "none" }}
      />
    </foreignObject>
  );
}

function Rulers({ viewRef, onGuide }: { viewRef: React.RefObject<HTMLDivElement | null>; onGuide: (orientation: "h" | "v", pos: number) => void }) {
  const zoom = useStudio((s) => s.zoom);
  const panX = useStudio((s) => s.panX);
  const panY = useStudio((s) => s.panY);
  const doc = useStudio((s) => s.doc);
  const node = viewRef.current;
  const w = node?.clientWidth ?? 800;
  const h = node?.clientHeight ?? 500;
  const ticks = (length: number, vertical: boolean) => {
    const out = [];
    const start = vertical ? (-panY) / zoom - PASTE : (-panX) / zoom - PASTE;
    const end = start + (vertical ? h : w) / zoom;
    const step = zoom > 2 ? 10 : zoom > 0.6 ? 50 : 100;
    for (let v = Math.floor(start / step) * step; v < end; v += step) {
      const pos = (v + PASTE) * zoom + (vertical ? panY : panX);
      if (v < -20 || v > (vertical ? doc.height : doc.width) + 20) continue;
      out.push(<span key={v} className="absolute text-[9px] text-faint" style={vertical ? { top: pos, left: 1 } : { left: pos, top: 0 }}>{v}</span>);
    }
    return out;
  };
  return (
    <>
      <div className="absolute top-0 left-5 right-0 z-10 h-5 cursor-ns-resize border-b border-line bg-panel" onPointerDown={(e) => onGuide("h", (e.clientY - (viewRef.current?.getBoundingClientRect().top ?? 0) - panY) / zoom - PASTE)}>{ticks(w, false)}</div>
      <div className="absolute top-5 bottom-0 left-0 z-10 w-5 cursor-ew-resize border-r border-line bg-panel" onPointerDown={(e) => onGuide("v", (e.clientX - (viewRef.current?.getBoundingClientRect().left ?? 0) - panX) / zoom - PASTE)}>{ticks(h, true)}</div>
      <div className="absolute top-0 left-0 z-10 h-5 w-5 bg-chrome" />
    </>
  );
}
