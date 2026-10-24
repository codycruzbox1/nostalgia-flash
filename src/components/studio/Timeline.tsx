import { useRef, useState, type MouseEvent as RMouse, type PointerEvent as RPointer } from "react";
import { Eye, EyeOff, FolderPlus, Lock, LockOpen, Pause, Play, Plus, SkipBack, StepBack, StepForward, Trash2 } from "lucide-react";
import { ContextMenu, ScrubField, Tip } from "@/components/studio/ui";
import { activeScene, replaceScene } from "@/lib/studio/model";
import { useStudio } from "@/lib/studio/store";
import type { Doc, Layer, MenuEntry, Span, TweenKind } from "@/lib/studio/types";

const CELL = 12;

export function Timeline({ fit = false }: { fit?: boolean }) {
  const doc = useStudio((s) => s.doc);
  const frame = useStudio((s) => s.frame);
  const layerId = useStudio((s) => s.layerId);
  const playing = useStudio((s) => s.playing);
  const onion = useStudio((s) => s.onion);
  const onionOutlines = useStudio((s) => s.onionOutlines);
  const before = useStudio((s) => s.onionBefore);
  const after = useStudio((s) => s.onionAfter);
  const breakpoints = useStudio((s) => s.breakpoints);
  const height = useStudio((s) => s.layout.timelineHeight);
  const scene = activeScene(doc);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const drag = useRef<{ kind: "play" | "key"; layerId?: string; spanId?: string; origin: number; startFrame: number } | null>(null);

  const frames = Math.max(scene.frameCount, frame + 1, 24);
  const elapsed = scene ? frame / Math.max(1, doc.fps) : 0;

  function resize(e: RPointer) {
    e.preventDefault();
    const startY = e.clientY;
    const start = useStudio.getState().layout.timelineHeight;
    const top = useStudio.getState().layout.timelinePlacement === "top";
    const move = (ev: PointerEvent) => {
      const delta = top ? ev.clientY - startY : startY - ev.clientY;
      useStudio.getState().setLayout((layout) => ({ ...layout, timelineHeight: Math.max(120, Math.min(420, start + delta)) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onRulerDown(e: RPointer) {
    const scroller = (e.currentTarget as HTMLElement).parentElement;
    if (!scroller) return;
    const pick = (clientX: number) => {
      const box = scroller.getBoundingClientRect();
      return Math.max(0, Math.min(frames - 1, Math.floor((clientX - box.left + scroller.scrollLeft) / CELL)));
    };
    useStudio.getState().setFrame(pick(e.clientX));
    drag.current = { kind: "play", origin: e.clientX, startFrame: pick(e.clientX) };
    const move = (ev: PointerEvent) => useStudio.getState().setFrame(pick(ev.clientX));
    const up = () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onCellDown(e: RPointer, layer: Layer, index: number, span: Span | null) {
    if (e.button === 2) return;
    const s = useStudio.getState();
    s.setLayer(layer.id);
    s.setFrame(index);
    if (e.shiftKey) s.setFrameRange({ layerId: layer.id, start: Math.min(s.frame, index), end: index + 1 });
    if (span && span.key && span.start === index) {
      const origin = e.clientX;
      const spanId = span.id;
      const start = span.start;
      const move = (ev: PointerEvent) => {
        const delta = Math.round((ev.clientX - origin) / CELL);
        const state = useStudio.getState();
        if (!state.txBase) state.transactStart("Move keyframe");
        const base = useStudio.getState().txBase;
        if (!base) return;
        useStudio.setState({ doc: slideKey(base, layer.id, spanId, start, delta), dirty: true });
      };
      const up = () => {
        useStudio.getState().commitPreview("Move keyframe");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
  }

  function layerMenu(layer: Layer): MenuEntry[] {
    return [
      { id: "insert.layer", label: "Insert Layer" },
      { id: "timeline.delete", label: "Delete Layer" },
      { id: "timeline.dup", label: "Duplicate Layer" },
      { sep: true },
      { id: "timeline.mask", label: "Mask" },
      { id: "timeline.guide", label: "Guide" },
      { id: "timeline.folder", label: "Folder" },
      { id: "timeline.props", label: "Properties…" },
      { id: "timeline.hideOthers", label: "Hide Others" },
    ];
  }

  function frameMenu(index: number): MenuEntry[] {
    useStudio.getState().setFrame(index);
    return [
      { id: "insert.frame", label: "Insert Frame", shortcut: "F5" },
      { id: "insert.key", label: "Insert Keyframe", shortcut: "F6" },
      { id: "insert.blank", label: "Insert Blank Keyframe", shortcut: "F7" },
      { id: "edit.removeFrames", label: "Remove Frames", shortcut: "Shift+F5" },
      { id: "timeline.clearKey", label: "Clear Keyframe" },
      { sep: true },
      { id: "insert.motion", label: "Create Motion Tween" },
      { id: "insert.shape", label: "Create Shape Tween" },
      { id: "insert.classic", label: "Create Classic Tween" },
      { id: "modify.reverse", label: "Reverse Frames" },
      { sep: true },
      { id: "timeline.copyFrames", label: "Copy Frames" },
      { id: "timeline.pasteFrames", label: "Paste Frames" },
    ];
  }

  return (
    <section className={`flex shrink-0 flex-col border-t border-line bg-panel ${fit ? "h-full" : ""}`} style={fit ? undefined : { height }}>
      <div className="h-1.5 shrink-0 cursor-ns-resize bg-chrome" onPointerDown={resize} />
      <header className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-1">
        <Tip label="New layer">
          <button type="button" aria-label="New layer" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().addLayer("layer")}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <Tip label="New folder">
          <button type="button" aria-label="New folder" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().addLayer("folder")}>
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <Tip label="Delete layer">
          <button type="button" aria-label="Delete layer" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().deleteLayer()}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <span className="mx-1 h-4 w-px bg-line" />
        <Tip label="Rewind">
          <button type="button" aria-label="Rewind" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().rewind()}>
            <SkipBack className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <Tip label="Step back">
          <button type="button" aria-label="Step back" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().step(-1)}>
            <StepBack className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <Tip label={playing ? "Stop" : "Play"}>
          <button type="button" aria-label={playing ? "Stop" : "Play"} className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().togglePlay()}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        </Tip>
        <Tip label="Step forward">
          <button type="button" aria-label="Step forward" className="grid h-7 w-7 place-items-center rounded-sm hover:bg-raised" onClick={() => useStudio.getState().step(1)}>
            <StepForward className="h-3.5 w-3.5" />
          </button>
        </Tip>
        <span className="mx-1 h-4 w-px bg-line" />
        <Tip label="Onion skin">
          <button type="button" aria-label="Onion skin" data-on={onion} className="rounded-sm px-1.5 py-1 text-2xs hover:bg-raised data-[on=true]:text-accent" onClick={() => useStudio.getState().setOnion({ onion: !onion })}>
            Onion
          </button>
        </Tip>
        <Tip label="Onion skin outlines">
          <button type="button" aria-label="Onion skin outlines" data-on={onionOutlines} className="rounded-sm px-1.5 py-1 text-2xs hover:bg-raised data-[on=true]:text-accent" onClick={() => useStudio.getState().setOnion({ onionOutlines: !onionOutlines, onion: true })}>
            Outlines
          </button>
        </Tip>
        <ScrubField label="−" value={before} min={0} max={12} width="w-10" onChange={(n) => useStudio.getState().setOnion({ onionBefore: n })} />
        <ScrubField label="+" value={after} min={0} max={12} width="w-10" onChange={(n) => useStudio.getState().setOnion({ onionAfter: n })} />
        <span className="ml-auto" />
        <ScrubField label="F" value={frame + 1} min={1} max={9999} width="w-12" onChange={(n) => useStudio.getState().setFrame(n - 1)} />
        <ScrubField label="fps" value={doc.fps} min={1} max={60} width="w-12" onChange={(n) => useStudio.getState().setDocument({ fps: n })} />
        <span className="px-1 text-2xs text-faint">{elapsed.toFixed(2)}s</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="scroll-thin w-layers shrink-0 overflow-y-auto border-r border-line">
          <div className="h-5 border-b border-line bg-chrome" />
          {scene.layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={layer.id === layerId}
              renaming={rename === layer.id}
              onRename={() => setRename(layer.id)}
              onCommit={(name) => {
                useStudio.getState().renameLayer(layer.id, name);
                setRename(null);
              }}
              onMenu={(e) => {
                useStudio.getState().setLayer(layer.id);
                setMenu({ x: e.clientX, y: e.clientY, items: layerMenu(layer) });
              }}
              onDrop={(dragged) => dragged && useStudio.getState().reorderLayer(dragged, layer.id)}
            />
          ))}
        </div>
        <div className="scroll-thin relative min-w-0 flex-1 overflow-auto">
          <div className="relative" style={{ width: frames * CELL }}>
            <div className="sticky top-0 z-10 flex h-5 cursor-ew-resize border-b border-line bg-chrome" onPointerDown={onRulerDown}>
              {Array.from({ length: frames }, (_, i) => (
                <div key={i} className="shrink-0 border-r border-line/70 text-center text-[9px] leading-5 text-faint" style={{ width: CELL }}>
                  {i % 5 === 0 ? i + 1 : ""}
                </div>
              ))}
            </div>
            {scene.layers.map((layer) => (
              <div key={layer.id} className="flex h-[22px] border-b border-line/60" onContextMenu={(e) => { e.preventDefault(); useStudio.getState().setLayer(layer.id); setMenu({ x: e.clientX, y: e.clientY, items: frameMenu(frame) }); }}>
                {Array.from({ length: frames }, (_, i) => {
                  const span = layer.spans.find((s) => i >= s.start && i < s.end) ?? null;
                  const key = span?.key && span.start === i;
                  const tween = span && span.tween !== "none" && !key ? span.tween : null;
                  const bp = breakpoints.includes(`${scene.id}:${i}`);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${layer.name} frame ${i + 1}`}
                      className={`relative h-full shrink-0 border-r border-line/50 ${tweenClass(tween)} ${i === frame ? "bg-raised" : ""}`}
                      style={{ width: CELL }}
                      onPointerDown={(e) => onCellDown(e, layer, i, span)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        useStudio.getState().setLayer(layer.id);
                        setMenu({ x: e.clientX, y: e.clientY, items: frameMenu(i) });
                      }}
                    >
                      {key ? <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" /> : null}
                      {span?.label && key ? <span className="absolute top-0 left-2 truncate text-[8px] text-accent">{span.label}</span> : null}
                      {bp ? <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-danger" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-danger" style={{ left: frame * CELL + CELL / 2 }} />
          </div>
        </div>
      </div>
      {menu ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} /> : null}
    </section>
  );
}

function tweenClass(tween: TweenKind | null): string {
  if (tween === "motion") return "tween-motion";
  if (tween === "shape") return "tween-shape";
  if (tween === "classic") return "tween-classic";
  return "bg-sunken";
}

function slideKey(doc: Doc, layerId: string, spanId: string, originStart: number, delta: number): Doc {
  const scene = activeScene(doc);
  return replaceScene(doc, {
    ...scene,
    layers: scene.layers.map((layer) => {
      if (layer.id !== layerId) return layer;
      const span = layer.spans.find((s) => s.id === spanId);
      if (!span) return layer;
      const prev = layer.spans.find((s) => s.id !== span.id && s.end === originStart);
      const floor = prev ? prev.start + 1 : 0;
      const start = Math.max(floor, Math.min(span.end - 1, originStart + delta));
      return {
        ...layer,
        spans: layer.spans.map((s) => {
          if (s.id === span.id) return { ...s, start };
          if (prev && s.id === prev.id) return { ...s, end: start };
          return s;
        }),
      };
    }),
    frameCount: Math.max(scene.frameCount, originStart + delta + 2),
  });
}

function LayerRow({
  layer,
  active,
  renaming,
  onRename,
  onCommit,
  onMenu,
  onDrop,
}: {
  layer: Layer;
  active: boolean;
  renaming: boolean;
  onRename: () => void;
  onCommit: (name: string) => void;
  onMenu: (e: RMouse) => void;
  onDrop: (toId: string) => void;
}) {
  const [name, setName] = useState(layer.name);
  return (
    <div
      data-on={active}
      className="flex h-[22px] items-center gap-0.5 border-b border-line/60 px-0.5 data-[on=true]:bg-raised"
      onClick={() => useStudio.getState().setLayer(layer.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.getData("text/layer") || layer.id);
      }}
    >
      <button type="button" aria-label={layer.visible ? "Hide layer" : "Show layer"} className="grid h-5 w-5 place-items-center text-muted" onClick={() => useStudio.getState().toggleLayerFlag(layer.id, "visible")}>
        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
      <button type="button" aria-label={layer.locked ? "Unlock layer" : "Lock layer"} className="grid h-5 w-5 place-items-center text-muted" onClick={() => useStudio.getState().toggleLayerFlag(layer.id, "locked")}>
        {layer.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
      </button>
      <button
        type="button"
        aria-label="Toggle outline"
        className="h-3 w-3 shrink-0 border border-line"
        style={{ background: layer.outline ? "transparent" : layer.color }}
        onClick={() => useStudio.getState().toggleLayerFlag(layer.id, "outline")}
      />
      {renaming ? (
        <input
          className="min-w-0 flex-1 bg-sunken px-1 text-2xs"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onCommit(name || layer.name)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(name || layer.name);
          }}
        />
      ) : (
        <button
          type="button"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/layer", layer.id)}
          onDoubleClick={onRename}
          className="min-w-0 flex-1 truncate text-left text-2xs"
        >
          <span className="text-faint">{layer.type === "folder" ? "▸ " : layer.type === "mask" ? "Mask " : layer.type === "guide" ? "Guide " : ""}</span>
          {layer.name}
        </button>
      )}
    </div>
  );
}
