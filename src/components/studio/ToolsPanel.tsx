import { useState } from "react";
import { ToolGlyph } from "@/components/studio/icons";
import { Btn, ColorPicker, Pop, Tip } from "@/components/studio/ui";
import { fillCss } from "@/lib/studio/color";
import { useStudio } from "@/lib/studio/store";
import type { Fill, ToolId } from "@/lib/studio/types";

const TOOLS: { id: ToolId; label: string; key?: string }[] = [
  { id: "select", label: "Selection", key: "V" },
  { id: "subselect", label: "Subselection", key: "A" },
  { id: "free", label: "Free Transform", key: "Q" },
  { id: "rot3d", label: "3D Rotation", key: "W" },
  { id: "move3d", label: "3D Translation", key: "G" },
  { id: "lasso", label: "Lasso", key: "L" },
  { id: "pen", label: "Pen", key: "P" },
  { id: "text", label: "Text", key: "T" },
  { id: "line", label: "Line", key: "N" },
  { id: "rect", label: "Rectangle", key: "R" },
  { id: "oval", label: "Oval", key: "O" },
  { id: "polystar", label: "PolyStar" },
  { id: "pencil", label: "Pencil", key: "Y" },
  { id: "brush", label: "Brush", key: "B" },
  { id: "spray", label: "Spray Brush" },
  { id: "deco", label: "Deco Tool" },
  { id: "bone", label: "Bone", key: "M" },
  { id: "bind", label: "Bind", key: "U" },
  { id: "bucket", label: "Paint Bucket", key: "K" },
  { id: "ink", label: "Ink Bottle", key: "S" },
  { id: "dropper", label: "Eyedropper", key: "I" },
  { id: "eraser", label: "Eraser", key: "E" },
  { id: "hand", label: "Hand", key: "H" },
  { id: "zoom", label: "Zoom", key: "Z" },
];

export function ToolsPanel({ horizontal = false }: { horizontal?: boolean }) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const freeActive = tool === "free" || tool === "gradient";
  return (
    <div className={horizontal ? "flex items-stretch gap-1 overflow-x-auto border-b border-line bg-panel px-1 py-1" : "flex h-full w-tools shrink-0 flex-col border-r border-line bg-panel"}>
      <div className={horizontal ? "flex gap-0.5" : "scroll-thin flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1"}>
        {TOOLS.map((item) => {
          if (item.id === "free") {
            return (
              <FreeSlot key="free" active={freeActive} tool={tool} onPick={setTool} horizontal={horizontal} />
            );
          }
          return (
            <Tip key={item.id} label={item.label} delay={500} side={horizontal ? "top" : "right"}>
              <button
                type="button"
                aria-label={item.label}
                data-on={tool === item.id}
                onClick={() => setTool(item.id)}
                className={`grid place-items-center rounded-sm text-ink hover:bg-raised data-[on=true]:bg-sunken data-[on=true]:text-accent ${horizontal ? "h-11 w-11" : "h-7 w-7"}`}
              >
                <ToolGlyph tool={item.id} />
              </button>
            </Tip>
          );
        })}
      </div>
      <Colors />
      <Options horizontal={horizontal} />
    </div>
  );
}

function FreeSlot({ active, tool, onPick, horizontal }: { active: boolean; tool: ToolId; onPick: (tool: ToolId) => void; horizontal: boolean }) {
  const [open, setOpen] = useState(false);
  const shown: ToolId = tool === "gradient" ? "gradient" : "free";
  return (
    <div className="relative">
      <Tip label={shown === "gradient" ? "Gradient Transform" : "Free Transform"} delay={500} side={horizontal ? "top" : "right"}>
        <button
          type="button"
          aria-label="Free Transform"
          data-on={active}
          onClick={() => onPick(shown)}
          className={`grid place-items-center rounded-sm text-ink hover:bg-raised data-[on=true]:bg-sunken data-[on=true]:text-accent ${horizontal ? "h-11 w-11" : "h-7 w-7"}`}
        >
          <ToolGlyph tool={shown} />
        </button>
      </Tip>
      <button type="button" aria-label="Transform tools" className="absolute right-0 bottom-0 text-[8px] leading-none text-faint" onClick={() => setOpen((v) => !v)}>▾</button>
      {open ? (
        <div className="absolute top-0 left-full z-40 ml-1 border border-line bg-panel p-1 shadow-lg">
          <Btn label="Free Transform" on={tool === "free"} onClick={() => { onPick("free"); setOpen(false); }}><ToolGlyph tool="free" /></Btn>
          <Btn label="Gradient Transform" on={tool === "gradient"} onClick={() => { onPick("gradient"); setOpen(false); }}><ToolGlyph tool="gradient" /></Btn>
        </div>
      ) : null}
    </div>
  );
}

function Colors() {
  const opts = useStudio((s) => s.opts);
  const patchOpts = useStudio((s) => s.patchOpts);
  const swap = useStudio((s) => s.swapColors);
  const defaults = useStudio((s) => s.defaultColors);
  const none = useStudio((s) => s.noneColor);
  const setWell = useStudio((s) => s.setWell);
  const [open, setOpen] = useState<"fill" | "stroke" | null>(null);
  const fillNone = opts.fill.type === "none";
  const fillColor = opts.fill.type === "solid" ? opts.fill.color : opts.fill.type === "none" ? "transparent" : opts.fill.stops[0]?.color ?? "#e09a3e";
  const fillAlpha = opts.fill.type === "solid" ? opts.fill.alpha : 1;
  return (
    <div className="relative grid grid-cols-2 gap-1 border-t border-line p-1.5">
      <Well label="Stroke color" color={opts.stroke?.color ?? "transparent"} none={!opts.stroke} active={opts.activeWell === "stroke"} onSelect={() => patchOpts({ activeWell: "stroke" })} onOpen={() => { patchOpts({ activeWell: "stroke" }); setOpen("stroke"); }} />
      <div className="flex flex-col gap-0.5">
        <Tip label="Swap colors" side="right"><button type="button" aria-label="Swap colors" className="h-4 text-2xs text-muted hover:text-ink" onClick={swap}>⇅</button></Tip>
        <Tip label="Default colors" side="right"><button type="button" aria-label="Default colors" className="h-4 text-2xs text-muted hover:text-ink" onClick={defaults}>■□</button></Tip>
        <Tip label="No color" side="right"><button type="button" aria-label="No color" className="h-4 text-2xs text-danger hover:text-ink" onClick={none}>Ø</button></Tip>
      </div>
      <Well label="Fill color" color={fillColor} none={fillNone} active={opts.activeWell === "fill"} onSelect={() => patchOpts({ activeWell: "fill" })} onOpen={() => { patchOpts({ activeWell: "fill" }); setOpen("fill"); }} />
      <span />
      <Pop open={open != null} onClose={() => setOpen(null)} className="bottom-0 left-full">
        <ColorPicker
          color={open === "stroke" ? opts.stroke?.color ?? "#1c1b19" : fillColor === "transparent" ? "#e09a3e" : fillColor}
          alpha={open === "stroke" ? opts.stroke?.alpha ?? 1 : fillAlpha}
          onChange={(color, alpha) => {
            if (open === "stroke") setWell({ type: "solid", color, alpha }, true);
            else setWell({ type: "solid", color, alpha });
          }}
        />
      </Pop>
    </div>
  );
}

function Well({ label, color, none, active, onSelect, onOpen }: { label: string; color: string; none: boolean; active: boolean; onSelect: () => void; onOpen: () => void }) {
  return (
    <div className={`flex items-center gap-0.5 rounded-sm p-0.5 ${active ? "ring-1 ring-accent" : ""}`}>
      <Tip label={label} side="right">
        <button type="button" aria-label={label} onClick={onSelect} className="h-5 w-5 border border-line" style={{ background: none ? "repeating-linear-gradient(45deg,#3a3632 0 3px,#161513 3px 6px)" : color }} />
      </Tip>
      <button type="button" aria-label={`Open ${label} picker`} className="text-[8px] text-faint" onClick={onOpen}>▾</button>
    </div>
  );
}

function Options({ horizontal }: { horizontal: boolean }) {
  const tool = useStudio((s) => s.tool);
  const opts = useStudio((s) => s.opts);
  const patch = useStudio((s) => s.patchOpts);
  const body = (
    <div className={`flex gap-0.5 ${horizontal ? "items-center" : "flex-col items-center"} text-ink`}>
      {tool === "rect" ? <Toggle on={opts.rectPrimitive} label="Primitive rectangle" onClick={() => patch({ rectPrimitive: !opts.rectPrimitive })}>R+</Toggle> : null}
      {tool === "oval" ? <Toggle on={opts.ovalPrimitive} label="Primitive oval" onClick={() => patch({ ovalPrimitive: !opts.ovalPrimitive })}>O+</Toggle> : null}
      {tool === "polystar" ? <Toggle on label="PolyStar settings" onClick={() => useStudio.getState().setDialog({ type: "polystar" })}>Ps</Toggle> : null}
      {tool === "pencil" ? (
        <>
          <Toggle on={opts.pencilMode === "straighten"} label="Straighten" onClick={() => patch({ pencilMode: "straighten" })}>S</Toggle>
          <Toggle on={opts.pencilMode === "smooth"} label="Smooth" onClick={() => patch({ pencilMode: "smooth" })}>~</Toggle>
          <Toggle on={opts.pencilMode === "ink"} label="Ink" onClick={() => patch({ pencilMode: "ink" })}>I</Toggle>
        </>
      ) : null}
      {tool === "brush" ? (
        <>
          <Mini label="Brush size" value={opts.brushSize} min={1} max={64} onChange={(brushSize) => patch({ brushSize })} />
          <Toggle on={opts.brushShape === "round"} label="Round brush" onClick={() => patch({ brushShape: "round" })}>●</Toggle>
          <Toggle on={opts.brushShape === "square"} label="Square brush" onClick={() => patch({ brushShape: "square" })}>■</Toggle>
          <Toggle on={opts.pressure} label="Pressure" onClick={() => patch({ pressure: !opts.pressure })}>P</Toggle>
          <Toggle on={opts.lockFill} label="Lock fill" onClick={() => patch({ lockFill: !opts.lockFill })}>L</Toggle>
        </>
      ) : null}
      {tool === "spray" ? <Toggle on={opts.spraySymbols} label="Spray selected symbol" onClick={() => patch({ spraySymbols: !opts.spraySymbols })}>Sy</Toggle> : null}
      {tool === "deco" ? (
        <select aria-label="Deco mode" className="w-full bg-sunken text-2xs" value={opts.decoMode} onChange={(e) => patch({ decoMode: e.target.value as typeof opts.decoMode })}>
          <option value="vine">Vine</option>
          <option value="grid">Grid</option>
          <option value="symmetry">Symmetry</option>
          <option value="flower">Flower</option>
        </select>
      ) : null}
      {tool === "lasso" ? (
        <>
          <Toggle on={opts.lassoPoly} label="Polygon mode" onClick={() => patch({ lassoPoly: !opts.lassoPoly, lassoMagic: false })}>Pg</Toggle>
          <Toggle on={opts.lassoMagic} label="Magic wand" onClick={() => patch({ lassoMagic: !opts.lassoMagic, lassoPoly: false })}>Mw</Toggle>
          {opts.lassoMagic ? (
            <>
              <Mini label="Magic wand threshold" value={opts.magicThreshold} min={1} max={200} onChange={(magicThreshold) => patch({ magicThreshold })} />
              <Mini label="Magic wand smoothing" value={opts.magicSmoothing} min={0} max={80} onChange={(magicSmoothing) => patch({ magicSmoothing })} />
            </>
          ) : null}
        </>
      ) : null}
      {tool === "pen" ? (
        <>
          <Toggle on={opts.penMode === "pen"} label="Pen" onClick={() => patch({ penMode: "pen" })}>P</Toggle>
          <Toggle on={opts.penMode === "add"} label="Add anchor point" onClick={() => patch({ penMode: "add" })}>+</Toggle>
          <Toggle on={opts.penMode === "delete"} label="Delete anchor point" onClick={() => patch({ penMode: "delete" })}>−</Toggle>
          <Toggle on={opts.penMode === "convert"} label="Convert anchor point" onClick={() => patch({ penMode: "convert" })}>∠</Toggle>
        </>
      ) : null}
      {tool === "text" ? (
        <>
          <select aria-label="Text type" className="w-full bg-sunken text-2xs" value={opts.textType} onChange={(e) => patch({ textType: e.target.value as typeof opts.textType })}>
            <option value="static">Static</option>
            <option value="dynamic">Dynamic</option>
            <option value="input">Input</option>
          </select>
          <select aria-label="Anti-alias" className="w-full bg-sunken text-2xs" value={opts.antialias} onChange={(e) => patch({ antialias: e.target.value as typeof opts.antialias })}>
            <option value="device">Device</option>
            <option value="animation">Animation</option>
            <option value="readability">Readability</option>
            <option value="custom">Custom</option>
          </select>
        </>
      ) : null}
      {tool === "bucket" ? (
        <select aria-label="Gap size" className="w-full bg-sunken text-2xs" value={opts.gapSize} onChange={(e) => patch({ gapSize: e.target.value as typeof opts.gapSize })}>
          <option value="none">Don’t close</option>
          <option value="small">Small gaps</option>
          <option value="medium">Medium gaps</option>
          <option value="large">Large gaps</option>
        </select>
      ) : null}
      {tool === "eraser" ? (
        <>
          <Toggle on={opts.eraserMode === "normal"} label="Erase normal" onClick={() => patch({ eraserMode: "normal" })}>N</Toggle>
          <Toggle on={opts.eraserMode === "fills"} label="Erase fills" onClick={() => patch({ eraserMode: "fills" })}>F</Toggle>
          <Toggle on={opts.eraserMode === "strokes"} label="Erase strokes" onClick={() => patch({ eraserMode: "strokes" })}>S</Toggle>
          <Toggle on={opts.eraserMode === "inside"} label="Erase inside" onClick={() => patch({ eraserMode: "inside" })}>In</Toggle>
          <Toggle on={opts.eraserMode === "faucet"} label="Faucet" onClick={() => patch({ eraserMode: "faucet" })}>Fx</Toggle>
        </>
      ) : null}
      {tool === "zoom" ? <span className="px-0.5 text-center text-[9px] text-faint">Alt reduces</span> : null}
    </div>
  );
  return <div className={`border-t border-line p-1 ${horizontal ? "" : ""}`}>{body}</div>;
}

function Toggle({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: string }) {
  return (
    <Tip label={label} side="right">
      <button type="button" aria-label={label} data-on={on} onClick={onClick} className="grid h-5 min-w-5 place-items-center rounded-sm px-0.5 text-[10px] hover:bg-raised data-[on=true]:bg-sunken data-[on=true]:text-accent">
        {children}
      </button>
    </Tip>
  );
}

function Mini({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <Tip label={label} side="right">
      <input aria-label={label} className="w-10 bg-sunken text-center text-[10px]" type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Tip>
  );
}

export function swatchStyle(fill: Fill): string {
  if (fill.type === "none") return "transparent";
  if (fill.type === "solid") return fillCss(fill.color, fill.alpha);
  return fill.stops[0]?.color ?? "#e09a3e";
}
