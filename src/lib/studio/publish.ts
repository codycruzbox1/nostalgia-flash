import { fillCss } from "./color";
import { anchorsToPath, ovalPath, starPoints, svgTransform } from "./geom";
import { findSymbol, sampleLayer, symbolBounds } from "./model";
import type { Doc, Fill, SceneElement, Stroke } from "./types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fillAttr(fill: Fill, id: string): { attr: string; def: string } {
  if (fill.type === "none") return { attr: `fill="none"`, def: "" };
  if (fill.type === "solid") return { attr: `fill="${fillCss(fill.color, fill.alpha)}"`, def: "" };
  const stops = fill.stops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.alpha}"/>`)
    .join("");
  if (fill.type === "linear") {
    const a = (fill.angle * Math.PI) / 180;
    const x1 = fill.cx - Math.cos(a) * fill.rx;
    const y1 = fill.cy - Math.sin(a) * fill.rx;
    const x2 = fill.cx + Math.cos(a) * fill.rx;
    const y2 = fill.cy + Math.sin(a) * fill.rx;
    return {
      attr: `fill="url(#${id})"`,
      def: `<linearGradient id="${id}" gradientUnits="objectBoundingBox" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`,
    };
  }
  const a = (fill.angle * Math.PI) / 180;
  const fx = fill.cx + Math.cos(a) * fill.focal * fill.rx;
  const fy = fill.cy + Math.sin(a) * fill.focal * fill.rx;
  return {
    attr: `fill="url(#${id})"`,
    def: `<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="${fill.cx}" cy="${fill.cy}" r="${fill.rx}" fx="${fx}" fy="${fy}">${stops}</radialGradient>`,
  };
}

function strokeAttr(stroke: Stroke | null): string {
  if (!stroke) return `stroke="none"`;
  return `stroke="${fillCss(stroke.color, stroke.alpha)}" stroke-width="${stroke.width}" stroke-linecap="${stroke.cap}" stroke-linejoin="${stroke.join}"`;
}

function shapeBody(el: SceneElement, prefix: string): { body: string; def: string } {
  const f = fillAttr(el.fill, `${prefix}-f`);
  const common = `${f.attr} ${strokeAttr(el.stroke)} opacity="${el.alpha}"`;
  if (el.morphD) return { body: `<path d="${esc(el.morphD)}" ${common}/>`, def: f.def };
  if (el.kind === "rect") return { body: `<rect x="0" y="0" width="${el.w}" height="${el.h}" rx="${el.cornerRadius}" ${common}/>`, def: f.def };
  if (el.kind === "oval") return { body: `<path d="${ovalPath(el.w, el.h, el.startAngle, el.endAngle)}" ${common}/>`, def: f.def };
  if (el.kind === "line") return { body: `<line x1="0" y1="0" x2="${el.w}" y2="${el.h}" ${common}/>`, def: f.def };
  if (el.kind === "polystar") return { body: `<polygon points="${starPoints(el.sides, el.star, el.innerRatio, el.w, el.h)}" ${common}/>`, def: f.def };
  if (el.kind === "text") {
    const anchor = el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
    const x = el.align === "center" ? el.w / 2 : el.align === "right" ? el.w : 0;
    return {
      body: `<text x="${x}" y="${el.fontSize}" text-anchor="${anchor}" font-family="${esc(el.fontFamily)}" font-size="${el.fontSize}" font-weight="${el.fontWeight}" font-style="${el.fontStyle}" letter-spacing="${el.letterSpacing}">${esc(el.text)}</text>`,
      def: f.def,
    };
  }
  if (el.kind === "spray") {
    const dots = el.dots.map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" ${common}/>`).join("");
    return { body: dots, def: f.def };
  }
  if (el.kind === "bitmap" && el.href) return { body: `<image href="${el.href}" width="${el.w}" height="${el.h}"/>`, def: "" };
  if (el.kind === "path" || el.rawD || el.anchors.length) {
    const d = el.rawD || anchorsToPath(el.anchors, el.closed);
    return { body: `<path d="${esc(d)}" ${common}/>`, def: f.def };
  }
  return { body: `<rect width="${el.w}" height="${el.h}" ${common}/>`, def: f.def };
}

function drawElement(el: SceneElement, doc: Doc, prefix: string): { body: string; def: string } {
  if (el.kind === "symbol" && el.symbolId) {
    const sym = findSymbol(doc, el.symbolId);
    if (!sym) return { body: "", def: "" };
    const b = symbolBounds(sym.elements);
    const sx = el.w / (b.w || 1);
    const sy = el.h / (b.h || 1);
    let body = "";
    let def = "";
    sym.elements.forEach((child, i) => {
      const drawn = drawElement(child, doc, `${prefix}-s${i}`);
      body += `<g transform="${svgTransform(child)}">${drawn.body}</g>`;
      def += drawn.def;
    });
    return {
      body: `<g transform="${svgTransform(el)}"><g transform="translate(${-b.x * sx} ${-b.y * sy}) scale(${sx} ${sy})">${body}</g></g>`,
      def,
    };
  }
  if (el.kind === "group") {
    let body = "";
    let def = "";
    el.children.forEach((child, i) => {
      const drawn = drawElement(child, doc, `${prefix}-g${i}`);
      body += `<g transform="${svgTransform(child)}">${drawn.body}</g>`;
      def += drawn.def;
    });
    return { body: `<g transform="${svgTransform(el)}">${body}</g>`, def };
  }
  const drawn = shapeBody(el, prefix);
  return { body: `<g transform="${svgTransform(el)}" ${el.shadow ? `filter="url(#shadow)"` : ""}>${drawn.body}</g>`, def: drawn.def };
}

export function frameSvg(doc: Doc, frame: number): string {
  const scene = doc.scenes.find((s) => s.id === doc.activeSceneId) ?? doc.scenes[0];
  let body = "";
  let defs = `<filter id="shadow"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.35"/></filter>`;
  const layers = [...scene.layers].reverse();
  let n = 0;
  for (const layer of layers) {
    if (!layer.visible || layer.type === "folder" || layer.type === "mask" || layer.type === "guide") continue;
    for (const el of sampleLayer(layer, frame)) {
      if (!el.visible) continue;
      const drawn = drawElement(el, doc, `p${n++}`);
      body += drawn.body;
      defs += drawn.def;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><defs>${defs}</defs><rect width="100%" height="100%" fill="${doc.background}"/>${body}</svg>`;
}

export function documentSvg(doc: Doc, frame: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${frameSvg(doc, frame)}`;
}

export function documentHtml(doc: Doc, loop: boolean): string {
  const scene = doc.scenes.find((s) => s.id === doc.activeSceneId) ?? doc.scenes[0];
  const frames: string[] = [];
  for (let f = 0; f < scene.frameCount; f++) frames.push(frameSvg(doc, f));
  const payload = JSON.stringify(frames);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(doc.name)}</title>
<style>
  html,body{margin:0;height:100%;background:#1c1b19;color:#f4f0e8;font-family:"IBM Plex Sans",sans-serif}
  main{min-height:100%;display:grid;place-items:center;gap:16px;padding:24px}
  figure{margin:0;background:${doc.background};box-shadow:0 18px 50px rgba(0,0,0,.35);line-height:0}
  figcaption{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b1aa9f}
  button{background:#e09a3e;color:#2a1c08;border:0;border-radius:2px;padding:6px 12px;font:inherit;cursor:pointer}
</style>
</head>
<body>
<main>
  <figure>
    <div id="stage"></div>
    <figcaption>${esc(doc.name)} · ${doc.width}×${doc.height} · ${doc.fps} fps</figcaption>
  </figure>
  <button id="toggle" type="button">Pause</button>
</main>
<script>
const frames = ${payload};
const fps = ${doc.fps};
const loop = ${loop ? "true" : "false"};
let i = 0, timer = 0, playing = true;
const stage = document.getElementById("stage");
const btn = document.getElementById("toggle");
function show(){ stage.innerHTML = frames[i] || ""; }
function tick(){
  i += 1;
  if (i >= frames.length) { if (!loop) { playing = false; btn.textContent = "Play"; return; } i = 0; }
  show();
}
function start(){ stop(); timer = setInterval(tick, 1000 / fps); playing = true; btn.textContent = "Pause"; }
function stop(){ clearInterval(timer); playing = false; }
btn.addEventListener("click", () => { if (playing) { stop(); btn.textContent = "Play"; } else { if (i >= frames.length - 1) i = 0; start(); } });
show();
start();
</script>
</body>
</html>`;
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
