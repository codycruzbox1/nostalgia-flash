import { useEffect, useRef, useState } from "react";
import { Dialogs } from "@/components/studio/Dialogs";
import { Dock } from "@/components/studio/Dock";
import { MenuBar, StatusBar, Toolbar } from "@/components/studio/Chrome";
import { StageView } from "@/components/studio/StageView";
import { Timeline } from "@/components/studio/Timeline";
import { ToolsPanel } from "@/components/studio/ToolsPanel";
import { TOOL_KEYS, runCommand } from "@/components/studio/commands";
import { bridge } from "@/lib/studio/bridge";
import { defaultStroke, makeElement } from "@/lib/studio/model";
import { storageKey, useStudio } from "@/lib/studio/store";
import type { Fill, SceneElement, Stroke } from "@/lib/studio/types";

function enterStudio(setAtDoor: (open: boolean) => void) {
  setAtDoor(false);
  const s = useStudio.getState();
  if (s.closed || s.dialog?.type === "welcome") {
    useStudio.setState({ closed: false, dialog: s.dialog?.type === "welcome" ? null : s.dialog });
  }
}

export function Studio() {
  const closed = useStudio((s) => s.closed);
  const showTools = useStudio((s) => s.layout.showTools);
  const showTimeline = useStudio((s) => s.layout.showTimeline);
  const placement = useStudio((s) => s.layout.timelinePlacement);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<"none" | "timeline" | "inspect">("none");
  const [atDoor, setAtDoor] = useState(true);

  useEffect(() => {
    useStudio.getState().hydrate(localStorage.getItem(storageKey()));
    const unsub = useStudio.subscribe((state, prev) => {
      if (!state.prefs.autosave) return;
      if (state.doc !== prev.doc || state.layout !== prev.layout || state.prefs !== prev.prefs || state.workspaces !== prev.workspaces || state.commands !== prev.commands || state.recent !== prev.recent || state.templates !== prev.templates) {
        state.persist();
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const s = useStudio.getState();
      if (s.playing) {
        const step = 1000 / Math.max(1, s.doc.fps);
        if (now - last >= step) {
          last = now;
          s.advance();
        }
      } else last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    bridge.openFile = (accept) => {
      const input = fileRef.current;
      if (!input) return;
      input.accept = accept || "";
      input.value = "";
      input.click();
    };
    const onCmd = (event: Event) => runCommand(String((event as CustomEvent<string>).detail));
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") useStudio.getState().holdHand(false);
    };
    window.addEventListener("keyline-command", onCmd);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keyline-command", onCmd);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const timeline = showTimeline ? <Timeline /> : null;
  const showFace = atDoor || closed;

  if (showFace) {
    return (
      <div className="relative h-dvh w-full overflow-hidden bg-chrome text-ink">
        <img
          src="/nostalgia-face.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-chrome/60" />
        <div className="relative flex h-full w-full items-center justify-center px-4 py-5 sm:px-8 sm:py-6">
          <div className="flex max-h-full max-w-full flex-col items-center gap-5">
            <button type="button" className="min-h-0 min-w-0 cursor-pointer" onClick={() => enterStudio(setAtDoor)} aria-label="Enter Nostalgia Flash">
              <img
                src="/nostalgia-face.jpg"
                alt="Nostalgia Flash 1.0. The easiest way to create fast web animations."
                className="h-auto w-auto max-h-[calc(100dvh-6.5rem)] max-w-[calc(100vw-2rem)] object-contain shadow-2xl sm:max-h-[calc(100dvh-7rem)] sm:max-w-[calc(100vw-4rem)]"
              />
            </button>
            <button type="button" className="min-h-11 shrink-0 rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink" onClick={() => enterStudio(setAtDoor)}>
              Enter the studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-chrome text-ink">
      <MenuBar />
      {closed ? null : <Toolbar />}
      {closed ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-muted">Nostalgia Flash is idle.</p>
            <button type="button" className="mt-3 rounded-sm bg-accent px-3 py-2 text-xs text-accent-ink" onClick={() => useStudio.setState({ closed: false, dialog: { type: "new" } })}>
              New document
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1">
            {showTools ? <div className="hidden lg:block"><ToolsPanel /></div> : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="hidden min-h-0 lg:contents">{placement === "top" ? timeline : null}</div>
              <StageView />
              <div className="hidden lg:contents">{placement === "bottom" ? timeline : null}</div>
              <div className="lg:hidden">
                {sheet === "timeline" ? <div className="h-[46vh] overflow-hidden border-t border-line"><Timeline fit /></div> : null}
                {sheet === "inspect" ? <div className="h-[52vh] border-t border-line"><Dock fill /></div> : null}
                <div className="flex h-11 shrink-0 border-t border-line bg-panel">
                  <button type="button" className="flex-1 text-xs" onClick={() => setSheet(sheet === "timeline" ? "none" : "timeline")}>Timeline</button>
                  <button type="button" className="flex-1 text-xs" onClick={() => setSheet(sheet === "inspect" ? "none" : "inspect")}>Inspect</button>
                </div>
                {showTools ? <ToolsPanel horizontal /> : null}
              </div>
            </div>
            <div className="hidden lg:flex">{showTools || true ? <Dock /> : null}</div>
          </div>
        </div>
      )}
      <StatusBar />
      <Dialogs />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void ingest(file);
        }}
      />
    </div>
  );
}

function onKey(event: KeyboardEvent, down: boolean) {
  if (!down) return;
  const target = event.target as HTMLElement | null;
  const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  const s = useStudio.getState();
  if (event.code === "Space" && !typing) {
    event.preventDefault();
    if (!event.repeat) s.holdHand(true);
    return;
  }
  if (event.key === "Escape") {
    if (s.dialog) {
      s.setDialog(null);
      if (s.closed) useStudio.setState({ closed: false });
      return;
    }
    if (s.pen) {
      s.setPen(null);
      return;
    }
    if (s.editingTextId) {
      s.setEditingText(null);
      return;
    }
    s.deselect();
    return;
  }
  if (typing) return;
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (!mod && !event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    const d = event.shiftKey ? 10 : 1;
    s.nudge(event.key === "ArrowLeft" ? -d : event.key === "ArrowRight" ? d : 0, event.key === "ArrowUp" ? -d : event.key === "ArrowDown" ? d : 0);
    return;
  }
  const cmd = shortcut(event, mod, key, s.session);
  if (cmd) {
    event.preventDefault();
    runCommand(cmd);
    return;
  }
  if (!mod && !event.altKey && !event.repeat && TOOL_KEYS[key]) {
    event.preventDefault();
    s.setTool(TOOL_KEYS[key]);
  }
}

function shortcut(event: KeyboardEvent, mod: boolean, key: string, session: string): string | null {
  if (event.key === "F1") return "help.help";
  if (event.key === "F2" && mod) return "window.tools";
  if (event.key === "F3" && mod) return "window.panel:properties";
  if (event.key === "F4") return "window.hide";
  if (event.key === "F5") return event.shiftKey ? "edit.removeFrames" : "insert.frame";
  if (event.key === "F6") return "insert.key";
  if (event.key === "F7") return "insert.blank";
  if (event.key === "F8") return "modify.symbol";
  if (event.key === "F9" && event.altKey) return "debug.end";
  if (event.key === "F9") return session === "debug" ? "debug.continue" : "window.panel:actions";
  if (event.key === "F10") return "debug.stepOver";
  if (event.key === "F11") return event.shiftKey ? "debug.stepOut" : "debug.stepIn";
  if (event.key === "F12" && mod && event.shiftKey) return "file.publishSettings";
  if (event.key === "F12" && mod) return "file.publish";
  if (event.key === "Enter") {
    if (mod && event.shiftKey) return "debug.debug";
    if (mod && event.altKey) return "control.testScene";
    if (mod) return "control.test";
    return "control.play";
  }
  if (event.key === "Delete" || event.key === "Backspace") return "edit.clear";
  if (!mod && key === ",") return "control.back";
  if (!mod && key === ".") return "control.forward";
  if (!mod) return null;
  if (event.altKey && event.shiftKey && key === "r") return "view.rulers";
  if (event.altKey && key === "r") return "control.rewind";
  if (event.altKey && key === "k") return "edit.keys";
  if (event.altKey && key === "h") return "view.hints";
  if (event.altKey && key === "b") return "control.buttons";
  if (event.altKey && key === "m") return "control.mute";
  if (event.altKey && key === "t") return "window.timeline";
  if (event.altKey && key === "v") return "edit.pasteSpecial";
  if (event.shiftKey && key === "s") return "file.saveAs";
  if (event.shiftKey && key === "v") return "edit.pastePlace";
  if (event.shiftKey && key === "e") return "file.export";
  if (event.shiftKey && key === "a") return "edit.deselect";
  if (event.shiftKey && key === "w") return "view.work";
  if (event.shiftKey && key === "b") return "text.bold";
  if (event.shiftKey && key === "g") return "modify.ungroup";
  if (event.shiftKey && (key === "z" || key === "y")) return "edit.redo";
  if (key === "z") return "edit.undo";
  if (key === "y") return "edit.redo";
  if (key === "n") return "file.new";
  if (key === "o") return "file.open";
  if (key === "w") return "file.close";
  if (key === "s") return "file.save";
  if (key === "r") return "file.import";
  if (key === "p") return "file.print";
  if (key === "q") return "file.exit";
  if (key === "x") return "edit.cut";
  if (key === "c") return "edit.copy";
  if (key === "v") return "edit.paste";
  if (key === "d") return "edit.duplicate";
  if (key === "a") return "edit.selectAll";
  if (key === "f") return "edit.find";
  if (key === "e") return "edit.symbol";
  if (key === "u") return "edit.prefs";
  if (key === "b") return "modify.break";
  if (key === "g") return "modify.group";
  if (key === "j") return "modify.document";
  if (key === "l") return "window.panel:library";
  if (key === "k") return "window.panel:align";
  if (key === "t") return "window.panel:transform";
  if (key === "i") return "window.panel:info";
  if (key === "h") return "view.hideEdges";
  if (key === "0") return "view.fit";
  if (key === "1") return "view.m100";
  if (key === "2") return "view.m200";
  if (event.key === "=" || event.key === "+") return "view.zoomIn";
  if (event.key === "-") return "view.zoomOut";
  if (event.key === "'") return "view.grid";
  if (event.key === ";") return "view.guides";
  return null;
}

async function ingest(file: File) {
  const s = useStudio.getState();
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    s.importJson(await file.text());
    return;
  }
  if (name.endsWith(".svg")) {
    const els = elementsFromSvg(await file.text());
    if (els.length) s.importElements(els);
    else s.setStatus("No drawable shapes in that SVG");
    return;
  }
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    const data = await readData(file);
    const img = new Image();
    img.src = data;
    try {
      await img.decode();
    } catch {
      /* keep the fallback size */
    }
    s.importElements([
      makeElement({
        kind: "bitmap",
        name: file.name,
        href: data,
        x: 48,
        y: 48,
        w: img.width || 320,
        h: img.height || 180,
        fill: { type: "none" },
        stroke: null,
        regX: 0,
        regY: 0,
      }),
    ]);
    return;
  }
  s.setStatus("Open a Nostalgia Flash document, SVG, or image");
}

function readData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function elementsFromSvg(text: string): SceneElement[] {
  const xml = new DOMParser().parseFromString(text, "image/svg+xml");
  const out: SceneElement[] = [];
  xml.querySelectorAll("path,rect,ellipse,circle,line,polygon").forEach((node, index) => {
    const fillAttr = node.getAttribute("fill");
    const strokeAttr = node.getAttribute("stroke");
    const fill: Fill = !fillAttr || fillAttr === "none" ? { type: "none" } : { type: "solid", color: cssColor(fillAttr), alpha: 1 };
    const stroke: Stroke | null = strokeAttr && strokeAttr !== "none" ? defaultStroke(cssColor(strokeAttr), Number(node.getAttribute("stroke-width") || 2)) : node.tagName === "line" || node.tagName === "path" ? defaultStroke("#1c1b19", 2) : null;
    const tag = node.tagName.toLowerCase();
    const label = `SVG ${index + 1}`;
    if (tag === "rect") {
      out.push(makeElement({ kind: "rect", name: label, x: num(node, "x"), y: num(node, "y"), w: num(node, "width") || 40, h: num(node, "height") || 40, fill, stroke, regX: 0, regY: 0 }));
    } else if (tag === "ellipse" || tag === "circle") {
      const rx = tag === "circle" ? num(node, "r") : num(node, "rx");
      const ry = tag === "circle" ? rx : num(node, "ry");
      out.push(makeElement({ kind: "oval", name: label, x: num(node, "cx") - rx, y: num(node, "cy") - ry, w: rx * 2 || 40, h: ry * 2 || 40, fill, stroke, regX: 0, regY: 0 }));
    } else if (tag === "line") {
      const x1 = num(node, "x1");
      const y1 = num(node, "y1");
      out.push(makeElement({ kind: "line", name: label, x: x1, y: y1, w: num(node, "x2") - x1, h: num(node, "y2") - y1, fill: { type: "none" }, stroke: stroke ?? defaultStroke(), regX: 0, regY: 0 }));
    } else if (tag === "polygon") {
      const pts = (node.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      const anchors = [];
      for (let i = 0; i + 1 < pts.length; i += 2) anchors.push({ x: pts[i], y: pts[i + 1], inX: null, inY: null, outX: null, outY: null });
      if (anchors.length > 2) out.push(makeElement({ kind: "path", name: label, anchors, closed: true, fill, stroke, regX: 0, regY: 0, x: 0, y: 0 }));
    } else {
      const d = node.getAttribute("d") || "";
      if (d) out.push(makeElement({ kind: "path", name: label, rawD: d, closed: /z/i.test(d), x: 0, y: 0, w: 10, h: 10, fill, stroke, regX: 0, regY: 0 }));
    }
  });
  return out.slice(0, 80);
}

function num(node: Element, attr: string): number {
  const n = Number(node.getAttribute(attr) || 0);
  return Number.isFinite(n) ? n : 0;
}

function cssColor(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  if (value === "black") return "#1c1b19";
  if (value === "white") return "#fffcf7";
  return "#e09a3e";
}
