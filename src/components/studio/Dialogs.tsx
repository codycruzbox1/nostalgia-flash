import { useState, type ReactNode } from "react";
import { Field } from "@/components/studio/ui";
import { activeScene, createSampleDoc } from "@/lib/studio/model";
import { useStudio } from "@/lib/studio/store";
import type { DialogState, SymbolType } from "@/lib/studio/types";

export function Dialogs() {
  const dialog = useStudio((s) => s.dialog);
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-chrome/70 p-3" onMouseDown={() => dismiss(dialog)}>
      <div className="max-h-[86vh] w-full max-w-md overflow-auto border border-line bg-panel p-3 text-sm shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <Body dialog={dialog} />
      </div>
    </div>
  );
}

function dismiss(dialog: DialogState) {
  const s = useStudio.getState();
  if (dialog.type === "welcome") s.setDialog(null);
  else s.setDialog(null);
  if (s.closed && dialog.type === "welcome") useStudio.setState({ closed: false });
}

function Body({ dialog }: { dialog: DialogState }) {
  switch (dialog.type) {
    case "new":
      return <NewDoc />;
    case "saveAs":
      return <NameDialog title="Save as" label="Document name" initial={useStudio.getState().doc.name} onOk={(name) => { useStudio.getState().saveAs(name); useStudio.getState().setDialog(null); }} />;
    case "template":
      return <NameDialog title="Save as template" label="Template name" initial={useStudio.getState().doc.name} onOk={(name) => useStudio.getState().saveTemplate(name)} />;
    case "publish":
      return <PublishDialog />;
    case "page":
      return <PageDialog />;
    case "prefs":
      return <PrefsDialog />;
    case "shortcuts":
      return <Shortcuts />;
    case "find":
      return <FindDialog />;
    case "polystar":
      return <PolyDialog />;
    case "symbol":
      return <SymbolDialog ids={dialog.ids} />;
    case "about":
      return <About />;
    case "help":
      return <Help />;
    case "layer":
      return <LayerDialog id={dialog.layerId} />;
    case "label":
      return <NameDialog title="Frame label" label="Label" initial={useStudio.getState().currentSpan()?.label ?? ""} onOk={(name) => { useStudio.getState().setFrameLabel(name); useStudio.getState().setDialog(null); }} />;
    case "spell":
      return <SpellDialog />;
    case "commands":
      return <CommandsDialog />;
    case "moreCommands":
      return <MoreCommands />;
    case "pasteSpecial":
      return <PasteDialog />;
    case "grid":
      return <GridDialog />;
    case "confirm":
      return <Confirm message={dialog.message} />;
    case "document":
      return <DocumentDialog />;
    case "scene":
      return <NameDialog title="New scene" label="Scene name" initial="Scene" onOk={(name) => useStudio.getState().addScene(name)} />;
    case "workspace":
      return <NameDialog title="Save workspace" label="Workspace name" initial="My workspace" onOk={(name) => useStudio.getState().saveWorkspace(name)} />;
    case "welcome":
      return <Welcome />;
    default:
      return null;
  }
}

function Title({ children }: { children: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm text-ink">{children}</h2>
      <button type="button" aria-label="Close dialog" className="text-faint hover:text-ink" onClick={() => useStudio.getState().setDialog(null)}>×</button>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex justify-end gap-2">{children}</div>;
}

function Ok({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" className="rounded-sm bg-accent px-3 py-1 text-xs text-accent-ink" onClick={onClick}>{children}</button>;
}

function Ghost({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" className="rounded-sm border border-line px-3 py-1 text-xs" onClick={onClick}>{children}</button>;
}

function NameDialog({ title, label, initial, onOk }: { title: string; label: string; initial: string; onOk: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <>
      <Title>{title}</Title>
      <Field label={label} value={name} onChange={setName} />
      <Row>
        <Ghost onClick={() => useStudio.getState().setDialog(null)}>Cancel</Ghost>
        <Ok onClick={() => onOk(name.trim() || initial)}>OK</Ok>
      </Row>
    </>
  );
}

function NewDoc() {
  const templates = useStudio((s) => s.templates);
  const presets = [
    { name: "Stage 960 × 540", w: 960, h: 540 },
    { name: "HD 1280 × 720", w: 1280, h: 720 },
    { name: "Full HD 1920 × 1080", w: 1920, h: 1080 },
    { name: "Square 1080 × 1080", w: 1080, h: 1080 },
  ];
  return (
    <>
      <Title>New document</Title>
      <div className="grid gap-1">
        {presets.map((p) => (
          <button key={p.name} type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => useStudio.getState().newDocument({ name: "Untitled", width: p.w, height: p.h, fps: 24 })}>
            {p.name}
          </button>
        ))}
        {templates.map((t) => (
          <button key={t.name} type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => useStudio.getState().newFromTemplate(t.name)}>
            Template · {t.name}
          </button>
        ))}
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.getState().loadDoc(createSampleDoc(), "Opened Arrival"); useStudio.getState().setDialog(null); }}>
          Sample · Arrival
        </button>
      </div>
    </>
  );
}

function PublishDialog() {
  const prefs = useStudio((s) => s.prefs);
  return (
    <>
      <Title>Publish settings</Title>
      <label className="flex items-center gap-2 text-xs text-muted">
        Format
        <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={prefs.publishFormat} onChange={(e) => useStudio.getState().setPrefs({ publishFormat: e.target.value as "html" | "svg" })}>
          <option value="html">HTML player</option>
          <option value="svg">Current frame SVG</option>
        </select>
      </label>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={prefs.publishLoop} onChange={(e) => useStudio.getState().setPrefs({ publishLoop: e.target.checked })} />
        Loop playback
      </label>
      <Row>
        <Ghost onClick={() => useStudio.getState().setDialog(null)}>Close</Ghost>
        <Ok onClick={() => { useStudio.getState().publish(); useStudio.getState().setDialog(null); }}>Publish</Ok>
      </Row>
    </>
  );
}

function PageDialog() {
  const prefs = useStudio((s) => s.prefs);
  return (
    <>
      <Title>Page setup</Title>
      <div className="grid gap-2 text-xs text-muted">
        <label className="flex items-center gap-2">
          Paper
          <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={prefs.pageSize} onChange={(e) => useStudio.getState().setPrefs({ pageSize: e.target.value as "letter" | "a4" | "stage" })}>
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
            <option value="stage">Stage</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Orientation
          <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={prefs.orientation} onChange={(e) => useStudio.getState().setPrefs({ orientation: e.target.value as "landscape" | "portrait" })}>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>
        <Field label="Margin" value={String(prefs.margin)} onChange={(v) => useStudio.getState().setPrefs({ margin: Number(v) || 0 })} />
      </div>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function PrefsDialog() {
  const prefs = useStudio((s) => s.prefs);
  return (
    <>
      <Title>Preferences</Title>
      <div className="grid gap-2 text-xs text-muted">
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.autosave} onChange={(e) => useStudio.getState().setPrefs({ autosave: e.target.checked })} /> Autosave in this browser</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.showTooltips} onChange={(e) => useStudio.getState().setPrefs({ showTooltips: e.target.checked })} /> Show tooltips</label>
        <Field label="Undo steps" value={String(prefs.undoLimit)} onChange={(v) => useStudio.getState().setPrefs({ undoLimit: Math.max(10, Number(v) || 60) })} />
        <Field label="Grid" value={String(prefs.grid)} onChange={(v) => useStudio.getState().setPrefs({ grid: Math.max(2, Number(v) || 40) })} />
      </div>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function Shortcuts() {
  const rows = [
    ["V A Q F", "Selection, subselect, free, gradient"],
    ["W G L P", "3D rotate, 3D move, lasso, pen"],
    ["T N R O Y B", "Text, line, rectangle, oval, pencil, brush"],
    ["K S I E H Z", "Bucket, ink, dropper, eraser, hand, zoom"],
    ["M U", "Bone, bind"],
    ["Enter", "Play or stop"],
    ["Ctrl+Enter", "Test movie"],
    ["F5 F6 F7", "Frame, keyframe, blank keyframe"],
    ["F8", "Convert to symbol"],
    ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
    ["Space", "Hold to pan"],
    ["Arrows", "Nudge selection"],
  ];
  return (
    <>
      <Title>Keyboard shortcuts</Title>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line/60">
              <td className="py-1 pr-3 text-faint">{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function FindDialog() {
  const find = useStudio((s) => s.find);
  const replace = useStudio((s) => s.replace);
  return (
    <>
      <Title>Find and replace</Title>
      <div className="grid gap-2">
        <Field label="Find" value={find} onChange={(v) => useStudio.getState().setFind(v)} />
        <Field label="Replace" value={replace} onChange={(v) => useStudio.getState().setFind(find, v)} />
      </div>
      <Row>
        <Ghost onClick={() => useStudio.getState().findReplace(false)}>Replace</Ghost>
        <Ok onClick={() => useStudio.getState().findReplace(true)}>Replace all</Ok>
      </Row>
    </>
  );
}

function PolyDialog() {
  const opts = useStudio((s) => s.opts);
  return (
    <>
      <Title>PolyStar settings</Title>
      <div className="grid gap-2 text-xs text-muted">
        <label className="flex items-center gap-2">
          Style
          <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={opts.polyStar ? "star" : "polygon"} onChange={(e) => useStudio.getState().patchOpts({ polyStar: e.target.value === "star" })}>
            <option value="star">Star</option>
            <option value="polygon">Polygon</option>
          </select>
        </label>
        <Field label="Sides" value={String(opts.polySides)} onChange={(v) => useStudio.getState().patchOpts({ polySides: Math.max(3, Math.min(32, Number(v) || 5)) })} />
        <Field label="Point size" value={String(opts.polyInner)} onChange={(v) => useStudio.getState().patchOpts({ polyInner: Math.max(0.05, Math.min(0.95, Number(v) || 0.45)) })} />
      </div>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function SymbolDialog({ ids }: { ids: string[] }) {
  const [name, setName] = useState("Symbol");
  const [type, setType] = useState<SymbolType>("movieclip");
  return (
    <>
      <Title>Convert to symbol</Title>
      <div className="grid gap-2">
        <Field label="Name" value={name} onChange={setName} />
        <label className="flex items-center gap-2 text-2xs text-muted">
          Type
          <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={type} onChange={(e) => setType(e.target.value as SymbolType)}>
            <option value="movieclip">Movie clip</option>
            <option value="graphic">Graphic</option>
            <option value="button">Button</option>
          </select>
        </label>
        <p className="text-2xs text-faint">{ids.length ? `${ids.length} selected` : "An empty symbol is added to the library."}</p>
      </div>
      <Row>
        <Ghost onClick={() => useStudio.getState().setDialog(null)}>Cancel</Ghost>
        <Ok onClick={() => useStudio.getState().convertToSymbol(name || "Symbol", type)}>OK</Ok>
      </Row>
    </>
  );
}

function About() {
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-10 w-10" />
        <div>
          <Title>About Nostalgia Flash</Title>
          <p className="text-2xs text-faint">1.0</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">Nostalgia Flash draws, tweens, and publishes in one window. The easiest way to create fast web animations.</p>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Close</Ok></Row>
    </>
  );
}

function Help() {
  return (
    <>
      <Title>Nostalgia Flash help</Title>
      <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted">
        <li>The stage is the white rectangle. Artwork can sit on the gray pasteboard.</li>
        <li>Press Enter to play. Motion and shape tweens in Arrival are already on the timeline.</li>
        <li>F6 inserts a keyframe. F8 converts the selection into a symbol.</li>
        <li>Frame scripts understand stop, play, gotoAndPlay, gotoAndStop, nextFrame, prevFrame, trace, and playSound.</li>
        <li>Drag a panel’s name out of the dock to float it, then drop it back on the dock to redock.</li>
        <li>Window → Workspace recalls Classic, Animator, Designer, Developer, Essentials, and Debug.</li>
      </ul>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Close</Ok></Row>
    </>
  );
}

function LayerDialog({ id }: { id: string }) {
  const doc = useStudio((s) => s.doc);
  const layer = activeScene(doc).layers.find((l) => l.id === id);
  const [name, setName] = useState(layer?.name ?? "");
  if (!layer) return <p className="text-xs">That layer is gone.</p>;
  return (
    <>
      <Title>Layer properties</Title>
      <Field label="Name" value={name} onChange={setName} />
      <label className="mt-2 flex items-center gap-2 text-2xs text-muted">
        Type
        <select className="rounded-sm border border-line bg-sunken px-2 py-1 text-ink" value={layer.type} onChange={(e) => useStudio.getState().setLayerType(id, e.target.value as typeof layer.type)}>
          <option value="normal">Normal</option>
          <option value="mask">Mask</option>
          <option value="masked">Masked</option>
          <option value="guide">Guide</option>
          <option value="guided">Guided</option>
          <option value="folder">Folder</option>
        </select>
      </label>
      <Row><Ok onClick={() => { useStudio.getState().renameLayer(id, name || layer.name); useStudio.getState().setDialog(null); }}>Done</Ok></Row>
    </>
  );
}

function SpellDialog() {
  const [hits] = useState(() => useStudio.getState().spellcheck());
  return (
    <>
      <Title>Check spelling</Title>
      {hits.length ? (
        <ul className="max-h-64 space-y-1 overflow-auto text-xs">
          {hits.map((hit, i) => (
            <li key={`${hit.word}-${i}`} className="flex justify-between gap-3 border-b border-line/50 py-1">
              <span>{hit.word}</span>
              <span className="text-faint">{hit.where}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">No likely misspellings in the text on stage.</p>}
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function CommandsDialog() {
  const commands = useStudio((s) => s.commands);
  const [name, setName] = useState("Custom");
  const [script, setScript] = useState('trace("hello");');
  return (
    <>
      <Title>Saved commands</Title>
      <ul className="mb-2 max-h-36 space-y-1 overflow-auto text-xs">
        {commands.map((cmd) => (
          <li key={cmd.id} className="flex items-center justify-between gap-2">
            <button type="button" className="truncate text-left hover:text-accent" onClick={() => useStudio.getState().runCommand(cmd.id)}>{cmd.name}</button>
            <button type="button" className="text-faint" onClick={() => useStudio.getState().deleteCommand(cmd.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <Field label="Name" value={name} onChange={setName} />
      <textarea aria-label="Command script" className="mt-2 h-20 w-full rounded-sm border border-line bg-sunken p-1 font-mono text-xs" value={script} onChange={(e) => setScript(e.target.value)} />
      <Row><Ok onClick={() => useStudio.getState().saveCommand(name || "Custom", script)}>Save command</Ok></Row>
    </>
  );
}

function MoreCommands() {
  const items = [
    ["Fade in", "Raises the selection from transparent across twelve frames."],
    ["Fade out", "Fades the selection out and leaves a keyframe."],
    ["Slide in from left", "Slides the selection in from offstage."],
    ["Spin once", "Rotates the selection a full turn."],
  ];
  return (
    <>
      <Title>More commands</Title>
      <ul className="space-y-2 text-xs text-muted">
        {items.map(([name, blurb]) => <li key={name}><span className="text-ink">{name}.</span> {blurb}</li>)}
      </ul>
      <p className="mt-2 text-2xs text-faint">Run them from Commands → Run Command. They are already installed.</p>
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Close</Ok></Row>
    </>
  );
}

function PasteDialog() {
  return (
    <>
      <Title>Paste special</Title>
      <div className="grid gap-1">
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.getState().pasteSelection("place"); useStudio.getState().setDialog(null); }}>Paste in place</button>
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.getState().pasteSelection("offset"); useStudio.getState().setDialog(null); }}>Paste with offset</button>
      </div>
    </>
  );
}

function GridDialog() {
  const grid = useStudio((s) => s.prefs.grid);
  return (
    <>
      <Title>Grid</Title>
      <Field label="Spacing" value={String(grid)} onChange={(v) => useStudio.getState().setPrefs({ grid: Math.max(2, Number(v) || 40) })} />
      <Row><Ok onClick={() => useStudio.getState().setDialog(null)}>Done</Ok></Row>
    </>
  );
}

function Confirm({ message }: { message: string }) {
  return (
    <>
      <Title>Nostalgia Flash</Title>
      <p className="text-xs text-muted">{message}</p>
      <Row>
        <Ghost onClick={() => useStudio.getState().setDialog(null)}>Cancel</Ghost>
        <Ghost onClick={() => { useStudio.getState().save(); useStudio.getState().confirmContinue(); }}>Save</Ghost>
        <Ok onClick={() => useStudio.getState().confirmContinue()}>Continue</Ok>
      </Row>
    </>
  );
}

function DocumentDialog() {
  const doc = useStudio((s) => s.doc);
  const [name, setName] = useState(doc.name);
  const [w, setW] = useState(String(doc.width));
  const [h, setH] = useState(String(doc.height));
  const [fps, setFps] = useState(String(doc.fps));
  const [bg, setBg] = useState(doc.background);
  const [scale, setScale] = useState(false);
  return (
    <>
      <Title>Document</Title>
      <div className="grid gap-2">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Width" value={w} onChange={setW} />
        <Field label="Height" value={h} onChange={setH} />
        <Field label="Frame rate" value={fps} onChange={setFps} />
        <Field label="Background" value={bg} onChange={setBg} />
        <label className="flex items-center gap-2 text-2xs text-muted"><input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} /> Scale content with the stage</label>
      </div>
      <Row>
        <Ok onClick={() => {
          useStudio.getState().setDocument({ name, width: Math.max(16, Number(w) || doc.width), height: Math.max(16, Number(h) || doc.height), fps: Math.max(1, Number(fps) || doc.fps), background: /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : doc.background }, scale);
          useStudio.getState().setDialog(null);
        }}>OK</Ok>
      </Row>
    </>
  );
}

function Welcome() {
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <Title>Nostalgia Flash</Title>
      </div>
      <p className="mb-2 text-xs text-muted">No document is open. Start a stage or return to the one you just closed.</p>
      <div className="grid gap-1">
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.setState({ closed: false }); useStudio.getState().setDialog({ type: "new" }); }}>New document</button>
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.setState({ closed: false }); useStudio.getState().setDialog(null); }}>Return to document</button>
        <button type="button" className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised" onClick={() => { useStudio.setState({ closed: false, dialog: null }); useStudio.getState().loadDoc(createSampleDoc(), "Opened Arrival"); }}>Open the Arrival sample</button>
      </div>
    </>
  );
}
