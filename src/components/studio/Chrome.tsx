import { useEffect, useState } from "react";
import { Clipboard, Copy, FilePlus, FolderOpen, Grid3x3, Magnet, Redo2, Ruler, Save, Scissors, Undo2, Upload } from "lucide-react";
import { menuModel, runCommand } from "@/components/studio/commands";
import { Btn, MenuList, Tip } from "@/components/studio/ui";
import { PRESET_NAMES } from "@/lib/studio/layout";
import { useStudio } from "@/lib/studio/store";

export function MenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const revision = useStudio((s) => s.historyIndex + s.frame + (s.playing ? 1 : 0) + s.zoom);
  void revision;
  const menus = menuModel();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="flex h-7 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-chrome px-1 text-xs" onPointerDown={(e) => e.stopPropagation()}>
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            className={`rounded-sm px-2 py-0.5 ${open === menu.label ? "bg-raised text-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onPointerEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>
          {open === menu.label ? <MenuList items={menu.items} onClose={() => setOpen(null)} /> : null}
        </div>
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-2">
        <img src="/favicon.svg" alt="" className="h-5 w-5" />
        <span className="hidden text-2xs tracking-wide text-ink sm:inline">Nostalgia Flash</span>
      </div>
    </div>
  );
}

export function Toolbar() {
  const doc = useStudio((s) => s.doc);
  const zoom = useStudio((s) => s.zoom);
  const name = useStudio((s) => s.workspaceName);
  const rulers = useStudio((s) => s.rulers);
  const grid = useStudio((s) => s.grid);
  const guides = useStudio((s) => s.guidesOn);
  const snapO = useStudio((s) => s.snapObjects);
  const snapG = useStudio((s) => s.snapGrid);
  const snapGuides = useStudio((s) => s.snapGuides);
  const snapP = useStudio((s) => s.snapPixels);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [zoomText, setZoomText] = useState(String(Math.round(zoom * 100)));
  useEffect(() => setZoomText(String(Math.round(zoom * 100))), [zoom]);
  const presets = [25, 50, 100, 200, 400, 800];
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-panel px-1.5">
      <div className="relative">
        <Tip label="Workspace layout">
          <button type="button" className="flex h-7 items-center gap-1 rounded-sm border border-line bg-sunken px-2 text-xs" onClick={() => setWsOpen((v) => !v)}>
            {name}
            <span className="text-faint">▾</span>
          </button>
        </Tip>
        {wsOpen ? (
          <div className="absolute top-full left-0 z-40 mt-1 min-w-44 border border-line bg-panel py-1 text-xs shadow-lg">
            {PRESET_NAMES.map((preset) => (
              <button key={preset} type="button" className="block w-full px-3 py-1 text-left hover:bg-raised" onClick={() => { runCommand(`window.workspace:${preset}`); setWsOpen(false); }}>
                {preset}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button type="button" className="block w-full px-3 py-1 text-left hover:bg-raised" onClick={() => { runCommand("window.saveWorkspace"); setWsOpen(false); }}>
              Save workspace…
            </button>
          </div>
        ) : null}
      </div>
      <div className="mx-1 h-5 w-px bg-line" />
      <Btn label="New document" onClick={() => runCommand("file.new")}><FilePlus className="h-4 w-4" /></Btn>
      <Btn label="Open" onClick={() => runCommand("file.open")}><FolderOpen className="h-4 w-4" /></Btn>
      <Btn label="Save" onClick={() => runCommand("file.save")}><Save className="h-4 w-4" /></Btn>
      <Btn label="Publish" onClick={() => runCommand("file.publish")}><Upload className="h-4 w-4" /></Btn>
      <div className="mx-1 h-5 w-px bg-line" />
      <Btn label="Undo" onClick={() => runCommand("edit.undo")}><Undo2 className="h-4 w-4" /></Btn>
      <Btn label="Redo" onClick={() => runCommand("edit.redo")}><Redo2 className="h-4 w-4" /></Btn>
      <div className="mx-1 h-5 w-px bg-line" />
      <Btn label="Cut" onClick={() => runCommand("edit.cut")}><Scissors className="h-4 w-4" /></Btn>
      <Btn label="Copy" onClick={() => runCommand("edit.copy")}><Copy className="h-4 w-4" /></Btn>
      <Btn label="Paste" onClick={() => runCommand("edit.paste")}><Clipboard className="h-4 w-4" /></Btn>
      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <div className="hidden items-center sm:flex">
        <Btn label="Show rulers" on={rulers} onClick={() => runCommand("view.rulers")}><Ruler className="h-4 w-4" /></Btn>
        <Btn label="Show grid" on={grid} onClick={() => runCommand("view.grid")}><Grid3x3 className="h-4 w-4" /></Btn>
        <Btn label="Show guides" on={guides} onClick={() => runCommand("view.guides")}><GuideIcon /></Btn>
        <Btn label="Snap to objects" on={snapO} onClick={() => runCommand("view.snapObjects")}><Magnet className="h-4 w-4" /></Btn>
        <Btn label="Snap to grid" on={snapG} onClick={() => runCommand("view.snapGrid")}><GridSnap /></Btn>
        <Btn label="Snap to guides" on={snapGuides} onClick={() => runCommand("view.snapGuides")}><GuideSnap /></Btn>
        <Btn label="Snap to pixels" on={snapP} onClick={() => runCommand("view.snapPixels")}><PixelSnap /></Btn>
      </div>
      <div className="ml-auto flex items-center gap-2 pr-1">
        <span className="hidden max-w-40 truncate text-xs text-muted md:inline">{doc.name}</span>
        <div className="relative">
          <input
            aria-label="Zoom percentage"
            className="h-7 w-16 rounded-sm border border-line bg-sunken px-1 text-center text-xs"
            value={zoomText}
            onChange={(e) => setZoomText(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={() => {
              const n = Number(zoomText);
              if (Number.isFinite(n) && n > 0) runCommandZoom(n / 100);
              else setZoomText(String(Math.round(zoom * 100)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <button type="button" aria-label="Zoom presets" className="absolute top-0 right-0 h-7 w-4 text-2xs text-faint" onClick={() => setZoomOpen((v) => !v)}>▾</button>
          {zoomOpen ? (
            <div className="absolute top-full right-0 z-40 mt-1 w-24 border border-line bg-panel py-1 text-xs shadow-lg">
              {presets.map((p) => (
                <button key={p} type="button" className="block w-full px-2 py-1 text-left hover:bg-raised" onClick={() => { runCommandZoom(p / 100); setZoomOpen(false); }}>
                  {p}%
                </button>
              ))}
              <button type="button" className="block w-full px-2 py-1 text-left hover:bg-raised" onClick={() => { runCommand("view.fit"); setZoomOpen(false); }}>Fit</button>
            </div>
          ) : null}
        </div>
        <Btn label="Publish settings" onClick={() => runCommand("file.publishSettings")}><Upload className="h-4 w-4" /></Btn>
      </div>
    </div>
  );
}

function runCommandZoom(zoom: number) {
  const id = Math.round(zoom * 100);
  const map: Record<number, string> = { 25: "view.m25", 50: "view.m50", 100: "view.m100", 200: "view.m200", 400: "view.m400", 800: "view.m800" };
  if (map[id]) runCommand(map[id]);
  else useStudio.getState().setZoom(zoom, undefined);
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5 5h14v14H5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
}
function GridSnap() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5 5h6v6H5zM13 13h6v6h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" />
    </svg>
  );
}
function GuideSnap() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M12 4v16" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
      <path d="M6 12h8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function PixelSnap() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M7 7h4v4H7zM13 13h4v4h-4z" fill="currentColor" />
    </svg>
  );
}

export function StatusBar() {
  const status = useStudio((s) => s.status);
  const mouse = useStudio((s) => s.mouse);
  const selection = useStudio((s) => s.selection.length);
  const frame = useStudio((s) => s.frame);
  const fps = useStudio((s) => s.doc.fps);
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-chrome px-2 text-2xs text-faint">
      <span className="min-w-0 flex-1 truncate text-muted">{status}</span>
      <span>{selection} selected</span>
      <span>f {frame + 1}</span>
      <span>{mouse ? `${mouse.x.toFixed(0)}, ${mouse.y.toFixed(0)}` : "—, —"}</span>
      <span>{fps} fps</span>
    </div>
  );
}
