import type { PointerEvent as RPEvent, ReactNode } from "react";
import { fillCss } from "@/lib/studio/color";
import { anchorsToPath, ovalPath, starPoints, svgTransform } from "@/lib/studio/geom";
import { findSymbol, symbolBounds } from "@/lib/studio/model";
import type { Doc, Fill, SceneElement, Stroke } from "@/lib/studio/types";

export function ShapeArt({
  el,
  doc,
  uid,
  outline,
  ghost,
  interactive,
  onDown,
}: {
  el: SceneElement;
  doc: Doc;
  uid: string;
  outline?: string | null;
  ghost?: boolean;
  interactive?: boolean;
  onDown?: (event: RPEvent<SVGGElement>, el: SceneElement) => void;
}) {
  const paint = colors(el, uid, outline);
  const body = geometry(el, doc, uid, paint, outline);
  if (el.morphD) {
    return (
      <g opacity={ghost ? 0.28 : el.alpha} data-id={el.id} style={{ mixBlendMode: el.blend as never, pointerEvents: interactive ? "auto" : "none" }} onPointerDown={onDown ? (e) => onDown(e, el) : undefined}>
        {body}
      </g>
    );
  }
  return (
    <g
      transform={svgTransform(el)}
      opacity={ghost ? 0.28 : el.alpha}
      data-id={el.id}
      filter={el.shadow ? "url(#keyline-shadow)" : undefined}
      style={{ mixBlendMode: el.blend as never, pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={onDown ? (e) => onDown(e, el) : undefined}
    >
      {body}
    </g>
  );
}

function colors(el: SceneElement, uid: string, outline?: string | null) {
  if (outline) {
    return { fill: "none", stroke: outline, strokeWidth: 1.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, def: null as ReactNode };
  }
  const fill = fillOf(el.fill, `${uid}-f`, el.fillLocked);
  const stroke = el.stroke;
  return {
    fill: fill.attr,
    stroke: stroke ? fillCss(stroke.color, stroke.alpha) : "none",
    strokeWidth: stroke?.width ?? 0,
    strokeLinecap: stroke?.cap ?? "round",
    strokeLinejoin: stroke?.join ?? "round",
    def: fill.def,
  };
}

function fillOf(fill: Fill, id: string, locked: boolean): { attr: string; def: ReactNode } {
  if (fill.type === "none") return { attr: "none", def: null };
  if (fill.type === "solid") return { attr: fillCss(fill.color, fill.alpha), def: null };
  const stops = fill.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.alpha} />);
  const a = (fill.angle * Math.PI) / 180;
  if (fill.type === "linear") {
    const x1 = fill.cx - Math.cos(a) * fill.rx;
    const y1 = fill.cy - Math.sin(a) * fill.rx;
    const x2 = fill.cx + Math.cos(a) * fill.rx;
    const y2 = fill.cy + Math.sin(a) * fill.rx;
    return {
      attr: `url(#${id})`,
      def: (
        <linearGradient id={id} gradientUnits={locked ? "userSpaceOnUse" : "objectBoundingBox"} x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops}
        </linearGradient>
      ),
    };
  }
  return {
    attr: `url(#${id})`,
    def: (
      <radialGradient id={id} gradientUnits={locked ? "userSpaceOnUse" : "objectBoundingBox"} cx={fill.cx} cy={fill.cy} r={fill.rx} fx={fill.cx + Math.cos(a) * fill.focal * fill.rx} fy={fill.cy + Math.sin(a) * fill.focal * fill.rx}>
        {stops}
      </radialGradient>
    ),
  };
}

function strokeOf(_: Stroke | null): { attr: string } {
  return { attr: "none" };
}

function geometry(el: SceneElement, doc: Doc, uid: string, paint: { fill: string; stroke: string; strokeWidth: number; strokeLinecap: "butt" | "round" | "square"; strokeLinejoin: "miter" | "round" | "bevel"; def: ReactNode }, outline?: string | null): ReactNode {
  const props = { fill: paint.fill, stroke: paint.stroke, strokeWidth: paint.strokeWidth, strokeLinecap: paint.strokeLinecap, strokeLinejoin: paint.strokeLinejoin };
  if (el.kind === "symbol" && el.symbolId) {
    const sym = findSymbol(doc, el.symbolId);
    if (!sym) return <rect width={el.w} height={el.h} fill="none" stroke="#e09a3e" strokeDasharray="3 2" />;
    const b = symbolBounds(sym.elements);
    const sx = el.w / (b.w || 1);
    const sy = el.h / (b.h || 1);
    return (
      <g transform={`translate(${-b.x * sx} ${-b.y * sy}) scale(${sx} ${sy})`}>
        {sym.elements.map((child) => (
          <ShapeArt key={child.id} el={child} doc={doc} uid={`${uid}-${child.id}`} outline={outline} />
        ))}
      </g>
    );
  }
  if (el.kind === "group") {
    return (
      <g>
        {el.children.map((child) => (
          <ShapeArt key={child.id} el={child} doc={doc} uid={`${uid}-${child.id}`} outline={outline} />
        ))}
      </g>
    );
  }
  let shape: ReactNode = null;
  if (el.morphD) shape = <path d={el.morphD} {...props} />;
  else if (el.kind === "rect") shape = <rect width={el.w} height={el.h} rx={el.cornerRadius} {...props} />;
  else if (el.kind === "oval") shape = <path d={ovalPath(el.w, el.h, el.startAngle, el.endAngle)} {...props} />;
  else if (el.kind === "line") shape = <line x1={0} y1={0} x2={el.w} y2={el.h} {...props} />;
  else if (el.kind === "polystar") shape = <polygon points={starPoints(el.sides, el.star, el.innerRatio, el.w, el.h)} {...props} />;
  else if (el.kind === "text") {
    shape = (
      <foreignObject width={Math.max(8, el.w)} height={Math.max(8, el.h)}>
        <div
          style={{
            width: "100%",
            height: "100%",
            color: paint.fill === "none" ? "#1c1b19" : paint.fill.startsWith("url") ? "#1c1b19" : paint.fill,
            fontFamily: el.fontFamily,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            fontStyle: el.fontStyle,
            textDecoration: el.underline ? "underline" : "none",
            letterSpacing: el.letterSpacing,
            lineHeight: el.lineHeight,
            textAlign: el.align,
            whiteSpace: "pre-wrap",
            WebkitFontSmoothing: el.antialias === "device" ? "none" : "antialiased",
          }}
        >
          {el.text}
        </div>
      </foreignObject>
    );
  } else if (el.kind === "spray") {
    shape = (
      <g {...props}>
        {el.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
    );
  } else if (el.kind === "bitmap" && el.href) {
    shape = <image href={el.href} width={el.w} height={el.h} />;
  } else if (el.rawD || el.anchors.length) {
    shape = <path d={el.rawD || anchorsToPath(el.anchors, el.closed)} {...props} />;
  } else shape = <rect width={el.w} height={el.h} {...props} />;
  return (
    <>
      {paint.def}
      {shape}
    </>
  );
}
