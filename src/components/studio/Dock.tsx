import { useState, type PointerEvent as RPointer, type ReactNode } from "react";
import { ShapeArt } from "@/components/studio/render";
import { ScrubField } from "@/components/studio/ui";
import { SWATCHES, hexToRgb, hsbToRgb, rgbToHex, rgbToHsb } from "@/lib/studio/color";
import { PANEL_IDS, PANEL_LABEL } from "@/lib/studio/layout";
import { activeScene, boundsOf, findSymbol, symbolBounds } from "@/lib/studio/model";
import { highlightLine } from "@/lib/studio/script";
import { useStudio } from "@/lib/studio/store";
import type { Fill, PanelId, SceneElement } from "@/lib/studio/types";

const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten"];
const FONTS = ["IBM Plex Sans", "IBM Plex Mono", "Georgia", "Tahoma", "Verdana", "Times New Roman", "Courier New"];

export function Dock({ fill = false }: { fill?: boolean }) {
  const layout = useStudio((s) => s.layout);
  const [iconOpen, setIconOpen] = useState<PanelId | null>(null);
  if (!fill && layout.iconized) {
    const ids = PANEL_IDS.filter((id) => !layout.hidden.includes(id) || layout.floating.some((f) => f.id === id));
    return (
      <>
        <aside className="relative flex w-11 shrink-0 flex-col gap-1 border-l border-line bg-panel py-1">
          {ids.map((id) => (
            <button key={id} type="button" aria-label={PANEL_LABEL[id]} className="mx-1 rounded-sm px-1 py-2 text-2xs text-muted hover:bg-raised hover:text-ink" onClick={() => setIconOpen(iconOpen === id ? null : id)}>
              {PANEL_LABEL[id].slice(0, 3)}
            </button>
          ))}
          {iconOpen ? (
            <div className="absolute top-0 right-11 z-30 flex h-80 w-72 flex-col border border-line bg-panel shadow-lg">
              <PanelFrame id={iconOpen} onClose={() => setIconOpen(null)} bare />
            </div>
          ) : null}
        </aside>
        <Floats />
      </>
    );
  }
  return (
    <>
      <aside id="keyline-dock" className={`relative flex min-h-0 flex-col border-l border-line bg-chrome ${fill ? "h-full w-full" : "shrink-0"}`} style={fill ? undefined : { width: layout.dockWidth }}>
        {!fill ? <div className="absolute top-0 left-0 z-10 h-full w-1 cursor-ew-resize" onPointerDown={resizeDock} /> : null}
        {layout.groups.map((group, index) => (
          <div key={group.id} className="flex min-h-0 flex-col border-b border-line" style={group.collapsed ? undefined : { flexGrow: group.height, flexBasis: 0 }}>
            <div className="flex h-7 shrink-0 items-center bg-panel">
              <button type="button" aria-label={group.collapsed ? "Expand panel" : "Collapse panel"} className="px-1.5 text-2xs text-faint" onClick={() => useStudio.getState().setLayout((l) => ({ ...l, groups: l.groups.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)) }))}>
                {group.collapsed ? "▸" : "▾"}
              </button>
              <div className="flex min-w-0 flex-1">
                {group.tabs.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`truncate px-2 text-2xs ${group.active === id ? "text-ink" : "text-faint"}`}
                    onPointerDown={(e) => beginFloat(e, id, fill)}
                    onClick={() => useStudio.getState().setLayout((l) => ({ ...l, groups: l.groups.map((g) => (g.id === group.id ? { ...g, active: id } : g)) }))}
                  >
                    {PANEL_LABEL[id]}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Close panel" className="px-2 text-faint hover:text-ink" onClick={() => useStudio.getState().closePanel(group.active)}>
                ×
              </button>
            </div>
            {group.collapsed ? null : (
              <div className="scroll-thin min-h-0 flex-1 overflow-auto bg-panel">
                <PanelBody id={group.active} />
              </div>
            )}
            {!fill && index < layout.groups.length - 1 && !group.collapsed ? <Splitter groupId={group.id} /> : null}
          </div>
        ))}
      </aside>
      {fill ? null : <Floats />}
    </>
  );
}

function Floats() {
  const floating = useStudio((s) => s.layout.floating);
  return (
    <>
      {floating.map((win) => (
        <div key={win.id} className="fixed z-40 flex flex-col border border-line bg-panel shadow-xl" style={{ left: win.x, top: win.y, width: win.w, height: win.h }}>
          <div className="flex h-7 shrink-0 cursor-grab items-center bg-raised" onPointerDown={(e) => beginFloat(e, win.id, false)}>
            <span className="flex-1 px-2 text-2xs">{PANEL_LABEL[win.id]}</span>
            <button type="button" aria-label="Dock panel" className="px-2 text-2xs text-faint" onClick={() => useStudio.getState().dockPanel(win.id)}>
              Dock
            </button>
            <button type="button" aria-label="Close panel" className="px-2 text-faint" onClick={() => useStudio.getState().closePanel(win.id)}>
              ×
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto">
            <PanelBody id={win.id} />
          </div>
          <div
            className="absolute right-0 bottom-0 h-3 w-3 cursor-nwse-resize"
            onPointerDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const { w, h } = win;
              const move = (ev: PointerEvent) => {
                useStudio.getState().setLayout((l) => ({
                  ...l,
                  floating: l.floating.map((f) => (f.id === win.id ? { ...f, w: Math.max(200, w + ev.clientX - startX), h: Math.max(120, h + ev.clientY - startY) } : f)),
                }));
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
        </div>
      ))}
    </>
  );
}

function PanelFrame({ id, onClose, bare }: { id: PanelId; onClose: () => void; bare?: boolean }) {
  return (
    <>
      <div className="flex h-7 items-center border-b border-line">
        <span className="flex-1 px-2 text-2xs">{PANEL_LABEL[id]}</span>
        <button type="button" aria-label="Close" className="px-2 text-faint" onClick={onClose}>×</button>
      </div>
      <div className={`scroll-thin min-h-0 flex-1 overflow-auto ${bare ? "" : ""}`}>
        <PanelBody id={id} />
      </div>
    </>
  );
}

function resizeDock(e: RPointer) {
  e.preventDefault();
  const startX = e.clientX;
  const start = useStudio.getState().layout.dockWidth;
  const move = (ev: PointerEvent) => {
    useStudio.getState().setLayout((l) => ({ ...l, dockWidth: Math.max(220, Math.min(480, start + startX - ev.clientX)) }));
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function beginFloat(e: RPointer, id: PanelId, fill: boolean) {
  if (fill) return;
  if ((e.target as HTMLElement).closest("button") && !(e.currentTarget as HTMLElement).className.includes("cursor-grab")) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "BUTTON" && e.currentTarget !== e.target) return;
  }
  const startX = e.clientX;
  const startY = e.clientY;
  const existing = useStudio.getState().layout.floating.find((f) => f.id === id);
  let origin = { x: existing?.x ?? 0, y: existing?.y ?? 0 };
  let moved = false;
  let ax = startX;
  let ay = startY;
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
    if (!moved) {
      moved = true;
      if (!existing) {
        useStudio.getState().floatPanel(id, ev.clientX - 90, ev.clientY - 16);
        origin = { x: ev.clientX - 90, y: ev.clientY - 16 };
        ax = ev.clientX;
        ay = ev.clientY;
        return;
      }
    }
    const dx = ev.clientX - ax;
    const dy = ev.clientY - ay;
    useStudio.getState().setLayout((l) => ({
      ...l,
      floating: l.floating.map((f) => (f.id === id ? { ...f, x: origin.x + dx, y: origin.y + dy } : f)),
    }));
  };
  const up = (ev: PointerEvent) => {
    const dock = document.getElementById("keyline-dock")?.getBoundingClientRect();
    if (moved && dock && ev.clientX >= dock.left && ev.clientX <= dock.right && ev.clientY >= dock.top && ev.clientY <= dock.bottom) useStudio.getState().dockPanel(id);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function Splitter({ groupId }: { groupId: string }) {
  return (
    <div
      className="h-1 shrink-0 cursor-ns-resize bg-chrome"
      onPointerDown={(e) => {
        e.preventDefault();
        const startY = e.clientY;
        const groups = useStudio.getState().layout.groups;
        const index = groups.findIndex((g) => g.id === groupId);
        const a = groups[index]?.height ?? 20;
        const b = groups[index + 1]?.height ?? 20;
        const move = (ev: PointerEvent) => {
          const delta = Math.round((ev.clientY - startY) / 8);
          useStudio.getState().setLayout((l) => ({
            ...l,
            groups: l.groups.map((g, i) => {
              if (i === index) return { ...g, height: Math.max(8, a + delta) };
              if (i === index + 1) return { ...g, height: Math.max(8, b - delta) };
              return g;
            }),
          }));
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}

function PanelBody({ id }: { id: PanelId }) {
  if (id === "properties") return <PropertiesPanel />;
  if (id === "library") return <LibraryPanel />;
  if (id === "color") return <ColorPanel />;
  if (id === "swatches") return <SwatchesPanel />;
  if (id === "align") return <AlignPanel />;
  if (id === "transform") return <TransformPanel />;
  if (id === "info") return <InfoPanel />;
  return <ActionsPanel />;
}

function Num({ label, value, min, max, step = 1, patch, width = "w-16" }: { label: string; value: number; min?: number; max?: number; step?: number; patch: (n: number) => Partial<SceneElement>; width?: string }) {
  return (
    <ScrubField
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      width={width}
      onScrubStart={() => useStudio.getState().transactStart(label)}
      onScrubEnd={() => useStudio.getState().transactEnd()}
      onChange={(n) => {
        const s = useStudio.getState();
        if (s.txBase) s.previewSelected(patch(n));
        else s.patchSelected(patch(n), label);
      }}
    />
  );
}

function PropertiesPanel() {
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const layerId = useStudio((s) => s.layerId);
  const selection = useStudio((s) => s.selection);
  const editing = useStudio((s) => s.editingSymbolId);
  const els = useStudio.getState().selectedElements();
  const el = els[0];
  const scene = activeScene(doc);
  const span = scene.layers.find((l) => l.id === layerId)?.spans.find((sp) => frame >= sp.start && frame < sp.end) ?? null;
  const sym = el?.kind === "symbol" ? findSymbol(doc, el.symbolId) : null;
  return (
    <div className="space-y-3 p-2 text-2xs">
      {!el ? (
        <section className="space-y-1.5">
          <h3 className="text-muted">Document</h3>
          <label className="flex items-center gap-2 text-muted">
            Name
            <input className="min-w-0 flex-1 rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={doc.name} onChange={(e) => useStudio.getState().setDocument({ name: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            <ScrubField label="W" value={doc.width} min={16} max={4096} onChange={(n) => useStudio.getState().setDocument({ width: n })} />
            <ScrubField label="H" value={doc.height} min={16} max={4096} onChange={(n) => useStudio.getState().setDocument({ height: n })} />
            <ScrubField label="fps" value={doc.fps} min={1} max={60} onChange={(n) => useStudio.getState().setDocument({ fps: n })} />
          </div>
          <label className="flex items-center gap-2 text-muted">
            Stage
            <input aria-label="Background color" className="w-24 rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={doc.background} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && useStudio.getState().setDocument({ background: e.target.value })} />
            <span className="h-4 w-4 border border-line" style={{ background: doc.background }} />
          </label>
          <p className="text-faint">{scene.name} · {editing ? "editing symbol" : `${selection.length} selected`}</p>
        </section>
      ) : (
        <section className="space-y-1.5">
          <h3 className="text-muted">{els.length > 1 ? `${els.length} objects` : el.name}</h3>
          <div className="flex flex-wrap gap-2">
            <Num label="X" value={Math.round(el.x)} patch={(n) => ({ x: n })} />
            <Num label="Y" value={Math.round(el.y)} patch={(n) => ({ y: n })} />
            <Num label="W" value={Math.round(el.w)} min={1} patch={(n) => ({ w: n })} />
            <Num label="H" value={Math.round(el.h)} min={1} patch={(n) => ({ h: n })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Num label="°" value={Math.round(el.rotation)} patch={(n) => ({ rotation: n })} />
            <Num label="A" value={Math.round(el.alpha * 100)} min={0} max={100} patch={(n) => ({ alpha: n / 100 })} />
          </div>
          <label className="flex items-center gap-2 text-muted">
            Blend
            <select className="rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={el.blend} onChange={(e) => useStudio.getState().patchSelected({ blend: e.target.value }, "Blend")}>
              {BLENDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={el.shadow} onChange={(e) => useStudio.getState().patchSelected({ shadow: e.target.checked }, "Filter")} />
            Drop shadow
          </label>
          {el.kind === "symbol" ? (
            <label className="flex items-center gap-2 text-muted">
              Instance
              <input className="min-w-0 flex-1 rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={el.instanceName} onChange={(e) => useStudio.getState().patchSelected({ instanceName: e.target.value }, "Instance name")} />
            </label>
          ) : null}
          {sym?.type === "movieclip" ? (
            <div className="flex flex-wrap gap-2">
              <Num label="rX" value={Math.round(el.rotX)} patch={(n) => ({ rotX: n })} />
              <Num label="rY" value={Math.round(el.rotY)} patch={(n) => ({ rotY: n })} />
              <Num label="Z" value={Math.round(el.z)} patch={(n) => ({ z: n })} />
            </div>
          ) : null}
          {el.kind === "text" ? <TextFields el={el} /> : null}
          {el.kind === "rect" ? <Num label="R" value={el.cornerRadius} min={0} patch={(n) => ({ cornerRadius: n })} /> : null}
        </section>
      )}
      {span ? (
        <section className="space-y-1.5 border-t border-line pt-2">
          <h3 className="text-muted">Frame {frame + 1}</h3>
          <label className="flex items-center gap-2 text-muted">
            Tween
            <select className="rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={span.tween} onChange={(e) => useStudio.getState().setTween(e.target.value as "none" | "motion" | "shape" | "classic")}>
              <option value="none">None</option>
              <option value="motion">Motion</option>
              <option value="shape">Shape</option>
              <option value="classic">Classic</option>
            </select>
          </label>
          <ScrubField label="Ease" value={span.ease} min={-100} max={100} width="w-14" onChange={(n) => useStudio.getState().setEase(n)} />
          <label className="flex items-center gap-2 text-muted">
            Label
            <input className="min-w-0 flex-1 rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink" value={span.label} onChange={(e) => useStudio.getState().setFrameLabel(e.target.value)} />
          </label>
        </section>
      ) : null}
    </div>
  );
}

function TextFields({ el }: { el: SceneElement }) {
  return (
    <div className="space-y-1.5">
      <select className="w-full rounded-sm border border-line bg-sunken px-1 py-0.5" value={el.fontFamily} onChange={(e) => useStudio.getState().patchSelected({ fontFamily: e.target.value }, "Font")}>
        {FONTS.map((f) => <option key={f}>{f}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <Num label="pt" value={el.fontSize} min={6} max={240} patch={(n) => ({ fontSize: n })} />
        <Num label="Ls" value={el.letterSpacing} min={-10} max={40} patch={(n) => ({ letterSpacing: n })} />
      </div>
      <div className="flex gap-1">
        <Mini on={el.fontWeight >= 700} label="Bold" onClick={() => useStudio.getState().patchSelected({ fontWeight: el.fontWeight >= 700 ? 400 : 700 }, "Bold")}>B</Mini>
        <Mini on={el.fontStyle === "italic"} label="Italic" onClick={() => useStudio.getState().patchSelected({ fontStyle: el.fontStyle === "italic" ? "normal" : "italic" }, "Italic")}>I</Mini>
        {(["left", "center", "right"] as const).map((align) => (
          <Mini key={align} on={el.align === align} label={`Align ${align}`} onClick={() => useStudio.getState().patchSelected({ align }, "Align")}>{align[0].toUpperCase()}</Mini>
        ))}
      </div>
      <select className="w-full rounded-sm border border-line bg-sunken px-1 py-0.5" value={el.textType} onChange={(e) => useStudio.getState().patchSelected({ textType: e.target.value as SceneElement["textType"] }, "Text type")}>
        <option value="static">Static</option>
        <option value="dynamic">Dynamic</option>
        <option value="input">Input</option>
      </select>
    </div>
  );
}

function Mini({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} data-on={on} className="h-6 min-w-6 rounded-sm border border-line px-1 hover:bg-raised data-[on=true]:text-accent" onClick={onClick}>
      {children}
    </button>
  );
}

function LibraryPanel() {
  const doc = useStudio((s) => s.doc);
  const libraryId = useStudio((s) => s.libraryId);
  const [q, setQ] = useState("");
  const sym = doc.library.find((item) => item.id === libraryId) ?? null;
  const items = doc.library.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()));
  const box = sym ? symbolBounds(sym.elements) : { x: 0, y: 0, w: 10, h: 10 };
  return (
    <div className="flex h-full min-h-40 flex-col">
      <div className="border-b border-line bg-stage p-1">
        {sym ? (
          <svg viewBox={`${box.x} ${box.y} ${Math.max(1, box.w)} ${Math.max(1, box.h)}`} className="h-16 w-full">
            {sym.elements.map((el) => <ShapeArt key={el.id} el={el} doc={doc} uid={`lib-${el.id}`} />)}
          </svg>
        ) : <div className="grid h-16 place-items-center text-2xs text-faint">No symbol</div>}
      </div>
      <input aria-label="Search library" placeholder="Search" className="m-1 rounded-sm border border-line bg-sunken px-1.5 py-1 text-2xs" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {doc.folders.map((folder) => (
          <div key={folder.id}>
            <button type="button" className={`block w-full px-2 py-1 text-left text-2xs ${libraryId === folder.id ? "bg-raised" : ""}`} onClick={() => useStudio.getState().setLibraryId(folder.id)}>{folder.name}</button>
            {items.filter((item) => item.folderId === folder.id).map((item) => (
              <LibRow key={item.id} id={item.id} name={item.name} type={item.type} active={libraryId === item.id} />
            ))}
          </div>
        ))}
        {items.filter((item) => !item.folderId || !doc.folders.some((f) => f.id === item.folderId)).map((item) => (
          <LibRow key={item.id} id={item.id} name={item.name} type={item.type} active={libraryId === item.id} />
        ))}
      </div>
      <div className="flex gap-1 border-t border-line p-1">
        <Mini label="New symbol" onClick={() => useStudio.getState().setDialog({ type: "symbol", ids: useStudio.getState().selection })}>New</Mini>
        <Mini label="New folder" onClick={() => useStudio.getState().newFolder()}>Folder</Mini>
        <Mini label="Symbol properties" onClick={() => sym && useStudio.getState().enterSymbol(sym.id)}>Edit</Mini>
        <Mini label="Delete" onClick={() => useStudio.getState().deleteLibrary()}>Del</Mini>
      </div>
    </div>
  );
}

function LibRow({ id, name, type, active }: { id: string; name: string; type: string; active: boolean }) {
  return (
    <button
      type="button"
      data-on={active}
      className="flex w-full items-center gap-2 px-2 py-1 text-left text-2xs hover:bg-raised data-[on=true]:bg-sunken"
      onClick={() => useStudio.getState().setLibraryId(id)}
      onDoubleClick={() => useStudio.getState().placeSymbol(id)}
    >
      <span className="text-faint">{type === "movieclip" ? "MC" : type === "button" ? "Btn" : "Gfx"}</span>
      <span className="truncate">{name}</span>
    </button>
  );
}

function ColorPanel() {
  const opts = useStudio((s) => s.opts);
  const fill = opts.activeWell === "stroke"
    ? opts.stroke
      ? { type: "solid" as const, color: opts.stroke.color, alpha: opts.stroke.alpha }
      : { type: "none" as const }
    : opts.fill;
  const solid = fill.type === "solid" ? fill : fill.type !== "none" ? { color: fill.stops[0]?.color ?? "#e09a3e", alpha: fill.stops[0]?.alpha ?? 1 } : { color: "#e09a3e", alpha: 1 };
  const rgb = hexToRgb(solid.color);
  const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
  const [mode, setMode] = useState<"rgb" | "hsb">("rgb");
  const apply = (next: Fill) => useStudio.getState().setWell(next, opts.activeWell === "stroke");
  return (
    <div
      className="space-y-2 p-2 text-2xs"
      onPointerDown={() => {
        const s = useStudio.getState();
        if (!s.txBase) s.transactStart("Color");
        const up = () => {
          useStudio.getState().transactEnd();
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointerup", up);
      }}
    >
      <div className="flex gap-1">
        {(["solid", "linear", "radial", "none"] as const).map((type) => (
          <button key={type} type="button" data-on={fill.type === type} className="rounded-sm border border-line px-1.5 py-0.5 capitalize data-[on=true]:text-accent" onClick={() => apply(typedFill(type, solid.color, solid.alpha, fill))}>
            {type}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className={mode === "rgb" ? "text-accent" : "text-faint"} onClick={() => setMode("rgb")}>RGB</button>
        <button type="button" className={mode === "hsb" ? "text-accent" : "text-faint"} onClick={() => setMode("hsb")}>HSB</button>
        <span className="ml-auto text-faint">{opts.activeWell}</span>
      </div>
      {mode === "rgb" ? (
        <div className="space-y-1">
          <Channel label="R" value={rgb.r} max={255} onChange={(n) => apply(paint(rgbToHex(n, rgb.g, rgb.b), solid.alpha, fill))} />
          <Channel label="G" value={rgb.g} max={255} onChange={(n) => apply(paint(rgbToHex(rgb.r, n, rgb.b), solid.alpha, fill))} />
          <Channel label="B" value={rgb.b} max={255} onChange={(n) => apply(paint(rgbToHex(rgb.r, rgb.g, n), solid.alpha, fill))} />
        </div>
      ) : (
        <div className="space-y-1">
          <Channel label="H" value={Math.round(hsb.h)} max={360} onChange={(n) => { const c = hsbToRgb(n, hsb.s, hsb.v); apply(paint(rgbToHex(c.r, c.g, c.b), solid.alpha, fill)); }} />
          <Channel label="S" value={Math.round(hsb.s * 100)} max={100} onChange={(n) => { const c = hsbToRgb(hsb.h, n / 100, hsb.v); apply(paint(rgbToHex(c.r, c.g, c.b), solid.alpha, fill)); }} />
          <Channel label="B" value={Math.round(hsb.v * 100)} max={100} onChange={(n) => { const c = hsbToRgb(hsb.h, hsb.s, n / 100); apply(paint(rgbToHex(c.r, c.g, c.b), solid.alpha, fill)); }} />
        </div>
      )}
      <Channel label="A" value={Math.round(solid.alpha * 100)} max={100} onChange={(n) => apply(paint(solid.color, n / 100, fill))} />
      {fill.type === "linear" || fill.type === "radial" ? (
        <div className="space-y-1 border-t border-line pt-2">
          <div className="flex flex-wrap gap-2">
            <ScrubField label="∠" value={Math.round(fill.angle)} min={0} max={360} width="w-12" onChange={(n) => apply({ ...fill, angle: n })} />
            <ScrubField label="cx" value={Math.round(fill.cx * 100)} min={0} max={100} width="w-12" onChange={(n) => apply({ ...fill, cx: n / 100 })} />
            <ScrubField label="cy" value={Math.round(fill.cy * 100)} min={0} max={100} width="w-12" onChange={(n) => apply({ ...fill, cy: n / 100 })} />
          </div>
          {fill.stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="h-3 w-3 border border-line" style={{ background: stop.color }} />
              <input aria-label={`Stop ${i + 1} color`} className="w-16 rounded-sm border border-line bg-sunken px-1 py-0.5" value={stop.color} onChange={(e) => { if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) return; const stops = fill.stops.slice(); stops[i] = { ...stop, color: e.target.value }; apply({ ...fill, stops }); }} />
              <ScrubField label="%" value={Math.round(stop.offset * 100)} min={0} max={100} width="w-12" onChange={(n) => { const stops = fill.stops.slice(); stops[i] = { ...stop, offset: n / 100 }; apply({ ...fill, stops }); }} />
            </div>
          ))}
          <button type="button" className="text-muted hover:text-ink" onClick={() => apply({ ...fill, stops: [...fill.stops, { offset: 1, color: "#fffcf7", alpha: 1 }] })}>Add pointer</button>
        </div>
      ) : null}
    </div>
  );
}

function Channel({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-muted">
      <span className="w-3">{label}</span>
      <input aria-label={label} type="range" min={0} max={max} value={value} className="min-w-0 flex-1 accent-accent" onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-8 text-right text-ink">{value}</span>
    </label>
  );
}

function paint(color: string, alpha: number, fill: Fill): Fill {
  if (fill.type === "linear" || fill.type === "radial") {
    const stops = fill.stops.slice();
    if (stops[0]) stops[0] = { ...stops[0], color, alpha };
    return { ...fill, stops };
  }
  if (fill.type === "none") return { type: "solid", color, alpha };
  return { type: "solid", color, alpha };
}

function typedFill(type: "solid" | "linear" | "radial" | "none", color: string, alpha: number, current: Fill): Fill {
  if (type === "none") return { type: "none" };
  if (type === "solid") return { type: "solid", color, alpha };
  const stops = current.type === "linear" || current.type === "radial" ? current.stops : [{ offset: 0, color, alpha }, { offset: 1, color: "#fffcf7", alpha: 1 }];
  return { type, stops, angle: current.type === "linear" || current.type === "radial" ? current.angle : 0, cx: 0.5, cy: 0.5, rx: 0.5, focal: 0 };
}

function SwatchesPanel() {
  const well = useStudio((s) => s.opts.activeWell);
  return (
    <div className="grid grid-cols-8 gap-1 p-2">
      {SWATCHES.map((color) => (
        <button key={color} type="button" aria-label={color} className="h-5 w-full border border-line" style={{ background: color }} onClick={() => useStudio.getState().setWell({ type: "solid", color, alpha: 1 }, well === "stroke")} />
      ))}
    </div>
  );
}

function AlignPanel() {
  const [stage, setStage] = useState(true);
  const align = (mode: "left" | "center" | "right" | "top" | "middle" | "bottom") => useStudio.getState().align(mode, stage);
  return (
    <div className="space-y-2 p-2 text-2xs">
      <label className="flex items-center gap-2 text-muted">
        <input type="checkbox" checked={stage} onChange={(e) => setStage(e.target.checked)} />
        To stage
      </label>
      <div className="grid grid-cols-6 gap-1">
        {(["left", "center", "right", "top", "middle", "bottom"] as const).map((mode) => (
          <button key={mode} type="button" className="rounded-sm border border-line py-1 capitalize hover:bg-raised" onClick={() => align(mode)}>{mode.slice(0, 1).toUpperCase()}</button>
        ))}
      </div>
      <p className="text-faint">Distribute</p>
      <div className="grid grid-cols-6 gap-1">
        {(["left", "cx", "right", "top", "cy", "bottom"] as const).map((mode) => (
          <button key={mode} type="button" aria-label={`Distribute ${mode}`} className="rounded-sm border border-line py-1 hover:bg-raised" onClick={() => distributeEdges(mode)}>{mode === "cx" || mode === "cy" ? "C" : mode.slice(0, 1).toUpperCase()}</button>
        ))}
      </div>
      <div className="flex gap-1">
        <button type="button" className="rounded-sm border border-line px-2 py-1" onClick={() => useStudio.getState().matchSize("w")}>Width</button>
        <button type="button" className="rounded-sm border border-line px-2 py-1" onClick={() => useStudio.getState().matchSize("h")}>Height</button>
        <button type="button" className="rounded-sm border border-line px-2 py-1" onClick={() => useStudio.getState().matchSize("both")}>Both</button>
      </div>
    </div>
  );
}

function distributeEdges(mode: "left" | "cx" | "right" | "top" | "cy" | "bottom") {
  const s = useStudio.getState();
  const els = s.selectedElements();
  if (els.length < 3) return s.setStatus("Select at least three objects");
  const horiz = mode === "left" || mode === "cx" || mode === "right";
  const key = (el: SceneElement) => {
    const b = boundsOf(el);
    if (mode === "left") return b.x;
    if (mode === "right") return b.x + b.w;
    if (mode === "cx") return b.x + b.w / 2;
    if (mode === "top") return b.y;
    if (mode === "bottom") return b.y + b.h;
    return b.y + b.h / 2;
  };
  const sorted = [...els].sort((a, b) => key(a) - key(b));
  const first = key(sorted[0]);
  const last = key(sorted[sorted.length - 1]);
  const step = (last - first) / (sorted.length - 1);
  const moves = new Map<string, number>();
  sorted.forEach((el, i) => moves.set(el.id, first + step * i - key(el)));
  s.changeSelection((el) => {
    const d = moves.get(el.id) ?? 0;
    return horiz ? { ...el, x: el.x + d } : { ...el, y: el.y + d };
  }, "Distribute");
}

function TransformPanel() {
  const doc = useStudio((s) => s.doc);
  const selection = useStudio((s) => s.selection);
  void doc;
  const el = useStudio.getState().selectedElements()[0];
  if (!el) return <p className="p-2 text-2xs text-faint">Nothing selected.</p>;
  return (
    <div className="space-y-2 p-2">
      <div className="flex flex-wrap gap-2">
        <Num label="W" value={round(el.w)} min={1} patch={(n) => ({ w: n })} />
        <Num label="H" value={round(el.h)} min={1} patch={(n) => ({ h: n })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Num label="°" value={round(el.rotation)} patch={(n) => ({ rotation: n })} />
        <Num label="Skx" value={round(el.skewX)} patch={(n) => ({ skewX: n })} />
        <Num label="Sky" value={round(el.skewY)} patch={(n) => ({ skewY: n })} />
      </div>
      <div className="flex gap-1 text-2xs">
        <button type="button" className="rounded-sm border border-line px-2 py-1" onClick={() => useStudio.getState().resetTransform()}>Reset</button>
        <button type="button" className="rounded-sm border border-line px-2 py-1" disabled={!selection.length} onClick={() => useStudio.getState().duplicateTransform()}>Duplicate and transform</button>
      </div>
    </div>
  );
}

function InfoPanel() {
  const doc = useStudio((s) => s.doc);
  const selection = useStudio((s) => s.selection);
  void doc;
  void selection;
  const mouse = useStudio((s) => s.mouse);
  const history = useStudio((s) => s.history);
  const index = useStudio((s) => s.historyIndex);
  const el = useStudio.getState().selectedElements()[0];
  const box = el ? boundsOf(el) : null;
  return (
    <div className="space-y-2 p-2 text-2xs">
      <div className="grid grid-cols-2 gap-1 text-muted">
        <span>X {box ? round(box.x) : "—"}</span>
        <span>Y {box ? round(box.y) : "—"}</span>
        <span>W {box ? round(box.w) : "—"}</span>
        <span>H {box ? round(box.h) : "—"}</span>
      </div>
      <p className="text-faint">Pointer {mouse ? `${round(mouse.x)}, ${round(mouse.y)}` : "—"}</p>
      <h3 className="text-muted">History</h3>
      <div className="scroll-thin max-h-40 overflow-auto">
        {history.map((item, i) => (
          <button key={`${item.label}-${i}`} type="button" data-on={i === index} className="block w-full truncate px-1 py-0.5 text-left hover:bg-raised data-[on=true]:text-accent" onClick={() => useStudio.getState().jumpHistory(i)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionsPanel() {
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const layerId = useStudio((s) => s.layerId);
  const find = useStudio((s) => s.find);
  const scene = activeScene(doc);
  const span = scene.layers.find((l) => l.id === layerId)?.spans.find((sp) => frame >= sp.start && frame < sp.end);
  const script = span?.script ?? "";
  const scripts = scene.layers.flatMap((layer) => layer.spans.filter((sp) => sp.script.trim()).map((sp) => ({ layer, sp })));
  return (
    <div className="flex h-full min-h-48 flex-col text-2xs">
      <div className="flex flex-wrap gap-1 border-b border-line p-1">
        <Mini label="Check syntax" onClick={() => useStudio.getState().checkScript()}>Check</Mini>
        <Mini label="Auto format" onClick={() => useStudio.getState().formatScript()}>Format</Mini>
        <Mini label="Find" onClick={() => useStudio.getState().setDialog({ type: "find" })}>Find</Mini>
        <Mini label="Replace in document" onClick={() => useStudio.getState().findReplace(false)}>Replace</Mini>
        <Mini label="Toggle breakpoint" onClick={() => useStudio.getState().toggleBreakpoint()}>Debug</Mini>
      </div>
      <div className="flex min-h-0 flex-1">
        <pre className="scroll-thin w-8 overflow-hidden border-r border-line bg-sunken py-1 text-right text-faint">{script.split("\n").map((_, i) => <div key={i} className="px-1">{i + 1}</div>)}</pre>
        <div className="relative min-w-0 flex-1">
          <pre className="pointer-events-none absolute inset-0 overflow-hidden px-1 py-1 font-mono whitespace-pre-wrap" aria-hidden>
            {(script || " ").split("\n").map((line, i) => (
              <div key={i}>
                {highlightLine(line).map((part, j) => (
                  <span key={j} className={part.kind === "comment" ? "text-faint" : part.kind === "string" ? "text-accent" : part.kind === "name" ? "text-axis-z" : part.kind === "num" ? "text-axis-y" : "text-ink"}>{part.text}</span>
                ))}
              </div>
            ))}
          </pre>
          <textarea
            aria-label="Frame script"
            className="absolute inset-0 resize-none bg-transparent px-1 py-1 font-mono text-transparent caret-ink outline-none"
            spellCheck={false}
            value={script}
            placeholder={find}
            onFocus={() => {
              if (!useStudio.getState().txBase) useStudio.getState().transactStart("Script");
            }}
            onBlur={() => useStudio.getState().transactEnd()}
            onChange={(e) => useStudio.getState().setScript(e.target.value)}
          />
        </div>
      </div>
      <div className="max-h-16 overflow-auto border-t border-line">
        {scripts.length ? scripts.map(({ layer, sp }) => (
          <button key={sp.id} type="button" className="block w-full truncate px-2 py-0.5 text-left hover:bg-raised" onClick={() => { useStudio.getState().setLayer(layer.id); useStudio.getState().setFrame(sp.start); }}>
            {layer.name} · frame {sp.start + 1}
          </button>
        )) : <p className="px-2 py-1 text-faint">No frame scripts yet. stop(); play(); gotoAndPlay(1);</p>}
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
