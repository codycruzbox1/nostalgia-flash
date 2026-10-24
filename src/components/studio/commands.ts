import { bridge } from "@/lib/studio/bridge";
import { PRESET_NAMES } from "@/lib/studio/layout";
import { useStudio } from "@/lib/studio/store";
import type { MenuEntry, PanelId, ToolId } from "@/lib/studio/types";

const FONTS = ["IBM Plex Sans", "IBM Plex Mono", "Georgia", "Palatino Linotype", "Tahoma", "Verdana", "Times New Roman", "Courier New"];

export function runCommand(id: string) {
  if (handleTextSize(id)) return;
  const s = useStudio.getState();
  const box = bridge.stageSize();
  const zoom = (z: number) => s.setZoom(z, box ?? undefined);
  if (id.startsWith("file.recent:")) return s.openRecent(id.slice(12));
  if (id.startsWith("commands.run:")) return s.runCommand(id.slice(13));
  if (id.startsWith("window.panel:")) return s.togglePanel(id.slice(13) as PanelId);
  if (id.startsWith("window.workspace:")) return s.applyWorkspace(id.slice(17));
  if (id.startsWith("text.font:")) return s.patchSelected({ fontFamily: id.slice(10) }, "Font");
  switch (id) {
    case "file.new":
      return s.requestNew();
    case "file.open":
      return bridge.openFile(".json,.nostalgia.json,.keyline.json,application/json");
    case "file.close":
      return s.requestClose();
    case "file.save":
      return s.save();
    case "file.saveAs":
      return s.setDialog({ type: "saveAs" });
    case "file.template":
      return s.setDialog({ type: "template" });
    case "file.import":
      return bridge.openFile(".svg,.json,.png,.jpg,.jpeg,.webp,image/*,application/json");
    case "file.export":
      return s.exportSvg();
    case "file.exportJson":
      return s.exportJson();
    case "file.publishSettings":
      return s.setDialog({ type: "publish" });
    case "file.publish":
      return s.publish();
    case "file.page":
      return s.setDialog({ type: "page" });
    case "file.print":
      return window.print();
    case "file.exit":
      return s.requestClose();
    case "edit.undo":
      return s.undo();
    case "edit.redo":
      return s.redo();
    case "edit.cut":
      return s.cutSelection();
    case "edit.copy":
      return s.copySelection();
    case "edit.paste":
      return s.pasteSelection("offset");
    case "edit.pastePlace":
      return s.pasteSelection("place");
    case "edit.pasteSpecial":
      return s.setDialog({ type: "pasteSpecial" });
    case "edit.clear":
      return s.deleteSelection();
    case "edit.duplicate":
      return s.duplicateSelection();
    case "edit.selectAll":
      return s.selectAll();
    case "edit.deselect":
      return s.deselect();
    case "edit.find":
      return s.setDialog({ type: "find" });
    case "edit.frame":
      return s.insertFrames(1);
    case "edit.key":
    case "insert.key":
      return s.insertKey(false);
    case "edit.blank":
    case "insert.blank":
      return s.insertKey(true);
    case "edit.removeFrames":
      return s.removeFrames();
    case "edit.symbol":
      return s.enterSymbol();
    case "edit.prefs":
      return s.setDialog({ type: "prefs" });
    case "edit.keys":
    case "help.keys":
      return s.setDialog({ type: "shortcuts" });
    case "view.zoomIn":
      return zoom(s.zoom * 1.25);
    case "view.zoomOut":
      return zoom(s.zoom / 1.25);
    case "view.m25":
      return zoom(0.25);
    case "view.m50":
      return zoom(0.5);
    case "view.m100":
      return zoom(1);
    case "view.m200":
      return zoom(2);
    case "view.m400":
      return zoom(4);
    case "view.m800":
      return zoom(8);
    case "view.fit":
      return box && s.fit(box.w, box.h);
    case "view.outlines":
      return s.setPreviewMode("outlines");
    case "view.fast":
      return s.setPreviewMode("fast");
    case "view.antialias":
      return s.setPreviewMode("antialias");
    case "view.full":
      return s.setPreviewMode("full");
    case "view.rulers":
      return s.toggleFlag("rulers");
    case "view.grid":
      return s.toggleFlag("grid");
    case "view.guides":
      return s.toggleFlag("guidesOn");
    case "view.snapObjects":
      return s.toggleFlag("snapObjects");
    case "view.snapGrid":
      return s.toggleFlag("snapGrid");
    case "view.snapGuides":
      return s.toggleFlag("snapGuides");
    case "view.snapPixels":
      return s.toggleFlag("snapPixels");
    case "view.editGrid":
      return s.setDialog({ type: "grid" });
    case "view.hideEdges":
      return s.toggleFlag("hideEdges");
    case "view.hints":
      return s.toggleFlag("shapeHints");
    case "view.work":
      return s.toggleFlag("workArea");
    case "insert.scene":
      return s.setDialog({ type: "scene" });
    case "insert.layer":
      return s.addLayer("layer");
    case "insert.folder":
      return s.addLayer("folder");
    case "insert.frame":
      return s.insertFrames(1);
    case "insert.motion":
      return s.setTween("motion");
    case "insert.shape":
      return s.setTween("shape");
    case "insert.classic":
      return s.setTween("classic");
    case "insert.symbol":
    case "modify.symbol":
      return s.setDialog({ type: "symbol", ids: s.selection });
    case "insert.label":
      return s.setDialog({ type: "label" });
    case "modify.document":
      return s.setDialog({ type: "document" });
    case "modify.break":
      return s.breakApart();
    case "modify.trace":
      return void s.traceBitmap();
    case "modify.smooth":
      return s.smoothOrStraighten("smooth");
    case "modify.straighten":
      return s.smoothOrStraighten("straighten");
    case "modify.optimize":
      return s.smoothOrStraighten("optimize");
    case "modify.union":
      return s.booleanOp("union");
    case "modify.intersect":
      return s.booleanOp("intersect");
    case "modify.punch":
      return s.booleanOp("punch");
    case "modify.crop":
      return s.booleanOp("crop");
    case "modify.reverse":
      return s.reverseFrames();
    case "modify.clearTween":
      return s.setTween("none");
    case "modify.rotCW":
      return s.rotateSelection(90);
    case "modify.rotCCW":
      return s.rotateSelection(-90);
    case "modify.flipH":
      return s.flipSelection("h");
    case "modify.flipV":
      return s.flipSelection("v");
    case "modify.reset":
      return s.resetTransform();
    case "modify.front":
      return s.arrange("front");
    case "modify.forward":
      return s.arrange("forward");
    case "modify.back":
      return s.arrange("back");
    case "modify.backward":
      return s.arrange("backward");
    case "modify.group":
      return s.groupSelection();
    case "modify.ungroup":
      return s.ungroupSelection();
    case "modify.hint":
      return s.addHint();
    case "text.bold":
      return s.patchSelected({ fontWeight: s.selectedElements()[0]?.fontWeight === 700 ? 400 : 700 }, "Bold");
    case "text.italic":
      return s.patchSelected({ fontStyle: s.selectedElements()[0]?.fontStyle === "italic" ? "normal" : "italic" }, "Italic");
    case "text.underline":
      return s.patchSelected({ underline: !s.selectedElements()[0]?.underline }, "Underline");
    case "text.alignLeft":
      return s.patchSelected({ align: "left" }, "Align left");
    case "text.alignCenter":
      return s.patchSelected({ align: "center" }, "Align center");
    case "text.alignRight":
      return s.patchSelected({ align: "right" }, "Align right");
    case "text.spacing":
      return s.patchSelected({ letterSpacing: (s.selectedElements()[0]?.letterSpacing ?? 0) + 1 }, "Letter spacing");
    case "text.static":
      return s.patchSelected({ textType: "static" }, "Static text");
    case "text.dynamic":
      return s.patchSelected({ textType: "dynamic" }, "Dynamic text");
    case "text.input":
      return s.patchSelected({ textType: "input" }, "Input text");
    case "text.spell":
      return s.setDialog({ type: "spell" });
    case "text.character":
    case "text.paragraph":
      return s.togglePanel("properties");
    case "commands.manage":
      return s.setDialog({ type: "commands" });
    case "commands.more":
      return s.setDialog({ type: "moreCommands" });
    case "control.play":
      return s.togglePlay();
    case "control.rewind":
      return s.rewind();
    case "control.forward":
      return s.step(1);
    case "control.back":
      return s.step(-1);
    case "control.test":
      return s.testMovie(false);
    case "control.testScene":
      return s.testMovie(true);
    case "control.loop":
      return s.toggleFlag("loop");
    case "control.buttons":
      return s.toggleFlag("simpleButtons");
    case "control.mute":
      return s.toggleFlag("mute");
    case "control.debug":
    case "debug.debug":
      return s.session === "debug" ? s.endSession() : (s.setDialog(null), setDebug());
    case "debug.continue":
      return s.continueDebug();
    case "debug.end":
      return s.endSession();
    case "debug.stepIn":
      if (s.selectedElements().some((el) => el.kind === "symbol")) return s.enterSymbol();
      return s.step(1);
    case "debug.stepOver":
      return s.step(1);
    case "debug.stepOut":
      return s.editingSymbolId ? s.exitSymbol() : s.step(-1);
    case "debug.clearBp":
      return s.clearBreakpoints();
    case "debug.bp":
      return s.toggleBreakpoint();
    case "window.tools":
      return s.setLayout((layout) => ({ ...layout, showTools: !layout.showTools }));
    case "window.timeline":
      return s.setLayout((layout) => ({ ...layout, showTimeline: !layout.showTimeline }));
    case "window.timelineTop":
      return s.setLayout((layout) => ({ ...layout, timelinePlacement: layout.timelinePlacement === "top" ? "bottom" : "top" }));
    case "window.iconize":
      return s.setLayout((layout) => ({ ...layout, iconized: !layout.iconized }));
    case "window.saveWorkspace":
      return s.setDialog({ type: "workspace" });
    case "window.hide":
      return s.setLayout((layout) => ({ ...layout, showTools: !layout.showTools, showTimeline: !layout.showTimeline, iconized: !layout.iconized }));
    case "help.help":
      return s.setDialog({ type: "help" });
    case "help.about":
      return s.setDialog({ type: "about" });
    case "timeline.delete":
      return s.deleteLayer();
    case "timeline.dup":
      return s.duplicateLayer();
    case "timeline.mask":
      return s.setLayerType(s.layerId, "mask");
    case "timeline.guide":
      return s.setLayerType(s.layerId, "guide");
    case "timeline.folder":
      return s.setLayerType(s.layerId, "folder");
    case "timeline.props":
      return s.setDialog({ type: "layer", layerId: s.layerId });
    case "timeline.hideOthers":
      return s.hideOtherLayers(s.layerId);
    case "timeline.clearKey":
      return s.clearKey();
    case "timeline.copyFrames":
      return s.copyFrames();
    case "timeline.pasteFrames":
      return s.pasteFrames();
    default:
      if (id.startsWith("tool.")) return s.setTool(id.slice(5) as ToolId);
      return undefined;
  }
}

function setDebug() {
  const s = useStudio.getState();
  s.setStatus("Debug session — breakpoints pause playback");
  useStudio.setState({ session: "debug", playing: true, frame: 0, selection: [] });
}

export function menuModel(): { label: string; items: MenuEntry[] }[] {
  const s = useStudio.getState();
  const recent: MenuEntry[] = s.recent.length
    ? s.recent.map((r) => ({ id: `file.recent:${r.id}`, label: r.name }))
    : [{ label: "No recent documents", disabled: true }];
  const workspaces: MenuEntry[] = [
    ...PRESET_NAMES.map((name) => ({ id: `window.workspace:${name}`, label: name, checked: s.workspaceName === name })),
    { sep: true },
    ...s.workspaces.map((w) => ({ id: `window.workspace:${w.name}`, label: w.name, checked: s.workspaceName === w.name })),
    { sep: true },
    { id: "window.saveWorkspace", label: "Save Current…" },
  ];
  const panels: MenuEntry[] = (["properties", "library", "color", "swatches", "align", "transform", "info", "actions"] as PanelId[]).map((id) => ({
    id: `window.panel:${id}`,
    label: id[0].toUpperCase() + id.slice(1),
    checked: !s.layout.hidden.includes(id),
    shortcut: id === "properties" ? "Ctrl+F3" : id === "library" ? "Ctrl+L" : id === "actions" ? "F9" : id === "align" ? "Ctrl+K" : id === "transform" ? "Ctrl+T" : id === "info" ? "Ctrl+I" : undefined,
  }));
  return [
    {
      label: "File",
      items: [
        { id: "file.new", label: "New", shortcut: "Ctrl+N" },
        { id: "file.open", label: "Open…", shortcut: "Ctrl+O" },
        { label: "Open Recent", children: recent },
        { id: "file.close", label: "Close", shortcut: "Ctrl+W" },
        { sep: true },
        { id: "file.save", label: "Save", shortcut: "Ctrl+S" },
        { id: "file.saveAs", label: "Save As…", shortcut: "Ctrl+Shift+S" },
        { id: "file.template", label: "Save As Template…" },
        { sep: true },
        { id: "file.import", label: "Import", shortcut: "Ctrl+R" },
        { label: "Export", children: [
          { id: "file.export", label: "Export SVG…", shortcut: "Ctrl+Shift+E" },
          { id: "file.exportJson", label: "Export Document…" },
        ] },
        { id: "file.publishSettings", label: "Publish Settings…", shortcut: "Ctrl+Shift+F12" },
        { id: "file.publish", label: "Publish", shortcut: "Ctrl+F12" },
        { sep: true },
        { id: "file.page", label: "Page Setup…" },
        { id: "file.print", label: "Print…", shortcut: "Ctrl+P" },
        { sep: true },
        { id: "file.exit", label: "Exit", shortcut: "Ctrl+Q" },
      ],
    },
    {
      label: "Edit",
      items: [
        { id: "edit.undo", label: "Undo", shortcut: "Ctrl+Z" },
        { id: "edit.redo", label: "Redo", shortcut: "Ctrl+Y" },
        { sep: true },
        { id: "edit.cut", label: "Cut", shortcut: "Ctrl+X" },
        { id: "edit.copy", label: "Copy", shortcut: "Ctrl+C" },
        { id: "edit.paste", label: "Paste", shortcut: "Ctrl+V" },
        { id: "edit.pastePlace", label: "Paste in Place", shortcut: "Ctrl+Shift+V" },
        { id: "edit.pasteSpecial", label: "Paste Special…", shortcut: "Ctrl+Alt+V" },
        { id: "edit.clear", label: "Clear", shortcut: "Del" },
        { id: "edit.duplicate", label: "Duplicate", shortcut: "Ctrl+D" },
        { sep: true },
        { id: "edit.selectAll", label: "Select All", shortcut: "Ctrl+A" },
        { id: "edit.deselect", label: "Deselect All", shortcut: "Ctrl+Shift+A" },
        { id: "edit.find", label: "Find and Replace…", shortcut: "Ctrl+F" },
        { sep: true },
        { label: "Timeline", children: [
          { id: "edit.frame", label: "Insert Frame", shortcut: "F5" },
          { id: "edit.key", label: "Insert Keyframe", shortcut: "F6" },
          { id: "edit.blank", label: "Insert Blank Keyframe", shortcut: "F7" },
          { id: "edit.removeFrames", label: "Remove Frames", shortcut: "Shift+F5" },
        ] },
        { id: "edit.symbol", label: "Edit Symbols", shortcut: "Ctrl+E" },
        { sep: true },
        { id: "edit.prefs", label: "Preferences…", shortcut: "Ctrl+U" },
        { id: "edit.keys", label: "Keyboard Shortcuts…", shortcut: "Ctrl+Alt+K" },
      ],
    },
    {
      label: "View",
      items: [
        { id: "view.zoomIn", label: "Zoom In", shortcut: "Ctrl+=" },
        { id: "view.zoomOut", label: "Zoom Out", shortcut: "Ctrl+-" },
        { label: "Magnification", children: [
          { id: "view.m25", label: "25%" },
          { id: "view.m50", label: "50%" },
          { id: "view.m100", label: "100%", shortcut: "Ctrl+1", checked: Math.abs(s.zoom - 1) < 0.01 },
          { id: "view.m200", label: "200%", shortcut: "Ctrl+2" },
          { id: "view.m400", label: "400%" },
          { id: "view.m800", label: "800%" },
          { sep: true },
          { id: "view.fit", label: "Fit in Window", shortcut: "Ctrl+0" },
        ] },
        { label: "Preview Mode", children: [
          { id: "view.outlines", label: "Outlines", checked: s.previewMode === "outlines" },
          { id: "view.fast", label: "Fast", checked: s.previewMode === "fast" },
          { id: "view.antialias", label: "Antialias", checked: s.previewMode === "antialias" },
          { id: "view.full", label: "Full", checked: s.previewMode === "full" },
        ] },
        { sep: true },
        { id: "view.rulers", label: "Rulers", shortcut: "Ctrl+Alt+Shift+R", checked: s.rulers },
        { id: "view.grid", label: "Grid", shortcut: "Ctrl+'", checked: s.grid },
        { id: "view.guides", label: "Guides", shortcut: "Ctrl+;", checked: s.guidesOn },
        { label: "Snapping", children: [
          { id: "view.snapObjects", label: "Snap to Objects", checked: s.snapObjects },
          { id: "view.snapGrid", label: "Snap to Grid", checked: s.snapGrid },
          { id: "view.snapGuides", label: "Snap to Guides", checked: s.snapGuides },
          { id: "view.snapPixels", label: "Snap to Pixels", checked: s.snapPixels },
          { sep: true },
          { id: "view.editGrid", label: "Edit Grid…" },
        ] },
        { id: "view.hideEdges", label: "Hide Edges", shortcut: "Ctrl+H", checked: s.hideEdges },
        { id: "view.hints", label: "Show Shape Hints", shortcut: "Ctrl+Alt+H", checked: s.shapeHints },
        { id: "view.work", label: "Work Area", shortcut: "Ctrl+Shift+W", checked: s.workArea },
      ],
    },
    {
      label: "Insert",
      items: [
        { label: "Timeline", children: [
          { id: "insert.layer", label: "Layer" },
          { id: "insert.folder", label: "Layer Folder" },
          { id: "insert.frame", label: "Frame", shortcut: "F5" },
          { id: "insert.key", label: "Keyframe", shortcut: "F6" },
          { id: "insert.blank", label: "Blank Keyframe", shortcut: "F7" },
          { id: "insert.label", label: "Frame Label…" },
        ] },
        { id: "insert.scene", label: "Scene" },
        { sep: true },
        { id: "insert.motion", label: "Motion Tween" },
        { id: "insert.shape", label: "Shape Tween" },
        { id: "insert.classic", label: "Classic Tween" },
        { sep: true },
        { id: "insert.symbol", label: "New Symbol…", shortcut: "Ctrl+F8" },
      ],
    },
    {
      label: "Modify",
      items: [
        { id: "modify.document", label: "Document…", shortcut: "Ctrl+J" },
        { id: "modify.symbol", label: "Convert to Symbol…", shortcut: "F8" },
        { id: "modify.break", label: "Break Apart", shortcut: "Ctrl+B" },
        { label: "Bitmap", children: [{ id: "modify.trace", label: "Trace Bitmap…" }] },
        { label: "Shape", children: [
          { id: "modify.smooth", label: "Smooth" },
          { id: "modify.straighten", label: "Straighten" },
          { id: "modify.optimize", label: "Optimize" },
        ] },
        { label: "Combine Objects", children: [
          { id: "modify.union", label: "Union" },
          { id: "modify.intersect", label: "Intersect" },
          { id: "modify.punch", label: "Punch" },
          { id: "modify.crop", label: "Crop" },
        ] },
        { label: "Timeline", children: [
          { id: "modify.reverse", label: "Reverse Frames" },
          { id: "modify.clearTween", label: "Remove Tween" },
          { id: "insert.key", label: "Convert to Keyframes", shortcut: "F6" },
          { id: "edit.removeFrames", label: "Clear Frames", shortcut: "Shift+F5" },
        ] },
        { label: "Transform", children: [
          { id: "tool.free", label: "Free Transform", shortcut: "Q" },
          { id: "modify.rotCW", label: "Rotate 90° CW" },
          { id: "modify.rotCCW", label: "Rotate 90° CCW" },
          { id: "modify.flipH", label: "Flip Horizontal" },
          { id: "modify.flipV", label: "Flip Vertical" },
          { id: "modify.reset", label: "Remove Transform" },
        ] },
        { label: "Arrange", children: [
          { id: "modify.front", label: "Bring to Front" },
          { id: "modify.forward", label: "Bring Forward" },
          { id: "modify.backward", label: "Send Backward" },
          { id: "modify.back", label: "Send to Back" },
        ] },
        { label: "Align", children: [
          { id: "window.panel:align", label: "Open Align Panel", shortcut: "Ctrl+K" },
        ] },
        { id: "modify.group", label: "Group", shortcut: "Ctrl+G" },
        { id: "modify.ungroup", label: "Ungroup", shortcut: "Ctrl+Shift+G" },
        { id: "modify.hint", label: "Add Shape Hint" },
      ],
    },
    {
      label: "Text",
      items: [
        { label: "Font", children: FONTS.map((font) => ({ id: `text.font:${font}`, label: font, checked: s.selectedElements().some((e) => e.fontFamily === font) })) },
        { label: "Size", children: [12, 14, 18, 24, 32, 48, 64, 96].map((size) => ({ id: `text.size:${size}`, label: `${size}` })) },
        { label: "Style", children: [
          { id: "text.bold", label: "Bold", shortcut: "Ctrl+Shift+B" },
          { id: "text.italic", label: "Italic" },
          { id: "text.underline", label: "Underline" },
        ] },
        { label: "Align", children: [
          { id: "text.alignLeft", label: "Align Left" },
          { id: "text.alignCenter", label: "Align Center" },
          { id: "text.alignRight", label: "Align Right" },
        ] },
        { id: "text.spacing", label: "Letter Spacing +" },
        { sep: true },
        { id: "text.character", label: "Character…" },
        { id: "text.paragraph", label: "Paragraph…" },
        { label: "Type", children: [
          { id: "text.static", label: "Static" },
          { id: "text.dynamic", label: "Dynamic" },
          { id: "text.input", label: "Input" },
        ] },
        { id: "text.spell", label: "Check Spelling…" },
      ],
    },
    {
      label: "Commands",
      items: [
        { id: "commands.manage", label: "Manage Saved Commands…" },
        { id: "commands.more", label: "Get More Commands…" },
        { sep: true },
        { label: "Run Command", children: s.commands.map((c) => ({ id: `commands.run:${c.id}`, label: c.name })) },
      ],
    },
    {
      label: "Control",
      items: [
        { id: "control.play", label: s.playing ? "Stop" : "Play", shortcut: "Enter" },
        { id: "control.rewind", label: "Rewind", shortcut: "Ctrl+Alt+R" },
        { id: "control.back", label: "Step Backward", shortcut: "," },
        { id: "control.forward", label: "Step Forward", shortcut: "." },
        { sep: true },
        { id: "control.test", label: "Test Movie", shortcut: "Ctrl+Enter" },
        { id: "control.testScene", label: "Test Scene", shortcut: "Ctrl+Alt+Enter" },
        { id: "control.loop", label: "Loop Playback", checked: s.loop },
        { sep: true },
        { id: "control.buttons", label: "Enable Simple Buttons", shortcut: "Ctrl+Alt+B", checked: s.simpleButtons },
        { id: "control.mute", label: "Mute Sounds", shortcut: "Ctrl+Alt+M", checked: s.mute },
        { id: "control.debug", label: "Debug", checked: s.session === "debug" },
      ],
    },
    {
      label: "Debug",
      items: [
        { id: "debug.debug", label: "Debug Movie", shortcut: "Ctrl+Shift+Enter" },
        { id: "debug.continue", label: "Continue", shortcut: "F9" },
        { id: "debug.end", label: "End Debug Session", shortcut: "Alt+F9" },
        { sep: true },
        { id: "debug.stepIn", label: "Step In", shortcut: "F11" },
        { id: "debug.stepOver", label: "Step Over", shortcut: "F10" },
        { id: "debug.stepOut", label: "Step Out", shortcut: "Shift+F11" },
        { id: "debug.clearBp", label: "Remove All Breakpoints" },
        { id: "debug.bp", label: "Toggle Breakpoint" },
      ],
    },
    {
      label: "Window",
      items: [
        { id: "window.tools", label: "Tools", shortcut: "Ctrl+F2", checked: s.layout.showTools },
        { id: "window.timeline", label: "Timeline", shortcut: "Ctrl+Alt+T", checked: s.layout.showTimeline },
        ...panels,
        { sep: true },
        { label: "Workspace", children: workspaces },
        { id: "window.timelineTop", label: "Timeline Above Stage", checked: s.layout.timelinePlacement === "top" },
        { id: "window.iconize", label: "Iconize Panels", checked: s.layout.iconized },
        { id: "window.hide", label: "Hide Panels", shortcut: "F4" },
      ],
    },
    {
      label: "Help",
      items: [
        { id: "help.help", label: "Nostalgia Flash Help", shortcut: "F1" },
        { id: "help.keys", label: "Keyboard Shortcuts" },
        { sep: true },
        { id: "help.about", label: "About Nostalgia Flash" },
      ],
    },
  ];
}

export function handleTextSize(id: string): boolean {
  if (!id.startsWith("text.size:")) return false;
  const size = Number(id.slice(10));
  useStudio.getState().patchSelected({ fontSize: size }, "Font size");
  return true;
}

export const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  a: "subselect",
  q: "free",
  f: "gradient",
  w: "rot3d",
  g: "move3d",
  l: "lasso",
  p: "pen",
  t: "text",
  n: "line",
  r: "rect",
  o: "oval",
  y: "pencil",
  b: "brush",
  k: "bucket",
  s: "ink",
  i: "dropper",
  e: "eraser",
  h: "hand",
  z: "zoom",
  m: "bone",
  u: "bind",
};
