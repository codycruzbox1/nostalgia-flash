import { create } from "zustand";
import * as clipNs from "polygon-clipping";
import { colorDist, lerpColor } from "./color";
import { PASTE, aabb, applyFabrik, dist, ease, nearestJoint, outlineWorld, rdp, resample, smoothPath, straighten } from "./geom";
import { classicLayout, panelLocation, presetLayout, showPanel, stripPanel } from "./layout";
import {
  activeScene,
  addElement,
  applyBinds,
  applyTween,
  boundsOf,
  clone,
  createSampleDoc,
  currentArmature,
  defaultStroke,
  elementLayer,
  emptySpan,
  ensureKey,
  findSymbol,
  freshDoc,
  insertTime,
  layerColors,
  makeElement,
  makeLayer,
  mapFrameElements,
  pathFromAnchors,
  removeTime,
  replaceScene,
  sampleLayer,
  selectionBounds,
  spanAt,
  symbolBounds,
  uid,
  withArmature,
} from "./model";
import { documentHtml, documentSvg, downloadText } from "./publish";
import { argNumber, argString, parseScript } from "./script";
import type {
  Anchor,
  Bind,
  Bone,
  DialogState,
  Doc,
  Fill,
  FrameRange,
  HistItem,
  Layer,
  Layout,
  PanelId,
  Point,
  Prefs,
  RecentFile,
  SavedCommand,
  SceneElement,
  Span,
  Stroke,
  SymbolType,
  ToolId,
  ToolOpts,
  TweenKind,
  Workspace,
} from "./types";

const STORAGE = "nostalgia.session.v1";

const defaultOpts = (): ToolOpts => ({
  activeWell: "fill",
  fill: { type: "solid", color: "#e09a3e", alpha: 1 },
  stroke: defaultStroke("#1c1b19", 2),
  rectPrimitive: false,
  ovalPrimitive: false,
  polyStar: true,
  polySides: 5,
  polyInner: 0.45,
  pencilMode: "smooth",
  brushSize: 8,
  brushShape: "round",
  pressure: false,
  lockFill: false,
  spraySymbols: false,
  decoMode: "vine",
  lassoPoly: false,
  lassoMagic: false,
  magicThreshold: 32,
  magicSmoothing: 0,
  penMode: "pen",
  textType: "static",
  antialias: "animation",
  eraserMode: "normal",
  gapSize: "small",
});

const defaultPrefs = (): Prefs => ({
  grid: 40,
  autosave: true,
  showTooltips: true,
  undoLimit: 60,
  pageSize: "letter",
  orientation: "landscape",
  margin: 12,
  publishLoop: true,
  publishFormat: "html",
});

const builtins = (): SavedCommand[] => [
  { id: "fade-in", name: "Fade in", kind: "builtin", script: "" },
  { id: "fade-out", name: "Fade out", kind: "builtin", script: "" },
  { id: "slide-in", name: "Slide in from left", kind: "builtin", script: "" },
  { id: "spin", name: "Spin once", kind: "builtin", script: "" },
];

function playTone(name: string, muted: boolean) {
  if (muted || typeof window === "undefined") return;
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = name === "low" ? 196 : name === "chime" ? 880 : 523;
  gain.gain.value = 0.045;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
  osc.onended = () => void ctx.close();
}

function retarget(el: SceneElement): SceneElement {
  const next = clone(el);
  next.id = uid("e");
  next.children = next.children.map(retarget);
  return next;
}

function liveElements(doc: Doc, frame: number, symbolId: string | null): SceneElement[] {
  if (symbolId) return findSymbol(doc, symbolId)?.elements ?? [];
  const scene = activeScene(doc);
  return scene.layers.flatMap((layer) => sampleLayer(layer, frame));
}

function editElements(
  doc: Doc,
  frame: number,
  symbolId: string | null,
  ids: Set<string> | null,
  fn: (el: SceneElement) => SceneElement | null,
): Doc {
  if (symbolId) {
    return {
      ...doc,
      library: doc.library.map((sym) => {
        if (sym.id !== symbolId) return sym;
        const elements: SceneElement[] = [];
        for (const el of sym.elements) {
          if (ids && !ids.has(el.id)) {
            elements.push(el);
            continue;
          }
          const next = fn(el);
          if (next) elements.push(next);
        }
        return { ...sym, elements };
      }),
    };
  }
  return mapFrameElements(doc, frame, ids, (el) => fn(el));
}

function addDrawn(doc: Doc, layerId: string, frame: number, symbolId: string | null, el: SceneElement): Doc {
  if (symbolId) {
    return {
      ...doc,
      library: doc.library.map((sym) => (sym.id === symbolId ? { ...sym, elements: [...sym.elements, el] } : sym)),
    };
  }
  const scene = activeScene(doc);
  const layer = scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.locked || layer.type === "folder") return doc;
  return addElement(doc, layerId, frame, el);
}

type State = {
  doc: Doc;
  history: HistItem[];
  historyIndex: number;
  tool: ToolId;
  handRestore: ToolId | null;
  opts: ToolOpts;
  selection: string[];
  frame: number;
  layerId: string;
  playing: boolean;
  loop: boolean;
  onion: boolean;
  onionOutlines: boolean;
  onionBefore: number;
  onionAfter: number;
  zoom: number;
  panX: number;
  panY: number;
  rulers: boolean;
  grid: boolean;
  guidesOn: boolean;
  snapObjects: boolean;
  snapGrid: boolean;
  snapGuides: boolean;
  snapPixels: boolean;
  hideEdges: boolean;
  shapeHints: boolean;
  workArea: boolean;
  previewMode: "full" | "outlines" | "fast" | "antialias";
  simpleButtons: boolean;
  mute: boolean;
  session: "edit" | "test" | "debug";
  breakpoints: string[];
  layout: Layout;
  workspaces: Workspace[];
  workspaceName: string;
  editingSymbolId: string | null;
  dialog: DialogState | null;
  status: string;
  traces: string[];
  mouse: Point | null;
  clipboard: SceneElement[] | null;
  frameClipboard: Span[] | null;
  commands: SavedCommand[];
  recent: RecentFile[];
  templates: { name: string; doc: Doc }[];
  dirty: boolean;
  prefs: Prefs;
  frameRange: FrameRange;
  pen: Anchor[] | null;
  bindArm: string | null;
  editingTextId: string | null;
  libraryId: string | null;
  find: string;
  replace: string;
  txBase: Doc | null;
  txLabel: string;
  repeatDelta: Partial<SceneElement> | null;
  closed: boolean;
  scriptFocus: number;
};

type Actions = {
  setStatus: (status: string) => void;
  setDialog: (dialog: DialogState | null) => void;
  setMouse: (mouse: Point | null) => void;
  update: (recipe: (doc: Doc) => Doc, label: string) => void;
  transactStart: (label: string) => void;
  transactApply: (recipe: (doc: Doc) => Doc) => void;
  transactEnd: () => void;
  undo: () => void;
  redo: () => void;
  jumpHistory: (index: number) => void;
  loadDoc: (doc: Doc, announce?: string) => void;
  newDocument: (partial?: Partial<Pick<Doc, "name" | "width" | "height" | "fps" | "background">>) => void;
  newFromTemplate: (name: string) => void;
  requestNew: () => void;
  requestClose: () => void;
  confirmContinue: () => void;
  save: () => void;
  saveAs: (name: string) => void;
  saveTemplate: (name: string) => void;
  openRecent: (id: string) => void;
  setTool: (tool: ToolId) => void;
  holdHand: (on: boolean) => void;
  patchOpts: (patch: Partial<ToolOpts>) => void;
  setSelection: (ids: string[], layerId?: string) => void;
  selectAll: () => void;
  deselect: () => void;
  deleteSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: (mode?: "offset" | "place") => void;
  duplicateSelection: () => void;
  duplicateTransform: () => void;
  nudge: (dx: number, dy: number) => void;
  patchSelected: (patch: Partial<SceneElement>, label?: string) => void;
  previewSelected: (patch: Partial<SceneElement>) => void;
  noteDelta: (patch: Partial<SceneElement>) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  breakApart: () => void;
  arrange: (mode: "front" | "back" | "forward" | "backward") => void;
  align: (mode: "left" | "center" | "right" | "top" | "middle" | "bottom", toStage: boolean) => void;
  distribute: (mode: "h" | "v") => void;
  matchSize: (mode: "w" | "h" | "both") => void;
  rotateSelection: (deg: number) => void;
  flipSelection: (axis: "h" | "v") => void;
  resetTransform: () => void;
  booleanOp: (op: "union" | "intersect" | "punch" | "crop") => void;
  smoothOrStraighten: (mode: "smooth" | "straighten" | "optimize") => void;
  convertToSymbol: (name: string, type: SymbolType) => void;
  enterSymbol: (id?: string | null) => void;
  exitSymbol: () => void;
  setFrame: (frame: number) => void;
  setLayer: (id: string) => void;
  toggleLayerFlag: (id: string, flag: "visible" | "locked" | "outline") => void;
  renameLayer: (id: string, name: string) => void;
  addLayer: (kind?: "layer" | "folder") => void;
  deleteLayer: (id?: string) => void;
  duplicateLayer: (id?: string) => void;
  reorderLayer: (id: string, toId: string) => void;
  setLayerType: (id: string, type: Layer["type"]) => void;
  hideOtherLayers: (id: string) => void;
  insertFrames: (count?: number) => void;
  insertKey: (blank?: boolean) => void;
  removeFrames: () => void;
  clearKey: () => void;
  setTween: (tween: TweenKind) => void;
  reverseFrames: () => void;
  copyFrames: () => void;
  pasteFrames: () => void;
  setFrameLabel: (label: string) => void;
  setEase: (ease: number) => void;
  setScript: (script: string) => void;
  formatScript: () => void;
  checkScript: () => void;
  setFrameRange: (range: FrameRange) => void;
  setOnion: (patch: Partial<{ onion: boolean; onionOutlines: boolean; onionBefore: number; onionAfter: number }>) => void;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;
  rewind: () => void;
  step: (delta: number) => void;
  advance: () => void;
  toggleLoop: () => void;
  testMovie: (sceneOnly?: boolean) => void;
  endSession: () => void;
  toggleBreakpoint: (frame?: number) => void;
  clearBreakpoints: () => void;
  continueDebug: () => void;
  setZoom: (zoom: number, view?: { w: number; h: number }) => void;
  fit: (viewW: number, viewH: number) => void;
  zoomAt: (factor: number, clientX: number, clientY: number, rect: { left: number; top: number }) => void;
  setPan: (panX: number, panY: number) => void;
  toggleFlag: (key: "rulers" | "grid" | "guidesOn" | "snapObjects" | "snapGrid" | "snapGuides" | "snapPixels" | "hideEdges" | "shapeHints" | "workArea" | "simpleButtons" | "mute" | "loop") => void;
  setPreviewMode: (mode: State["previewMode"]) => void;
  setDocument: (patch: Partial<Pick<Doc, "name" | "width" | "height" | "fps" | "background">>, scale?: boolean) => void;
  swapColors: () => void;
  defaultColors: () => void;
  noneColor: () => void;
  setWell: (fill: Fill | null, stroke?: boolean) => void;
  applyWellToSelection: () => void;
  addShape: (el: SceneElement) => string | null;
  changeSelection: (fn: (el: SceneElement) => SceneElement | null, label: string) => void;
  previewDoc: (recipe: (doc: Doc) => Doc) => void;
  commitPreview: (label: string) => void;
  cancelPreview: () => void;
  setPen: (pen: Anchor[] | null) => void;
  finishPen: (closed: boolean) => void;
  setBindArm: (id: string | null) => void;
  setEditingText: (id: string | null) => void;
  setLibraryId: (id: string | null) => void;
  placeSymbol: (id: string, at?: Point) => void;
  newFolder: () => void;
  deleteLibrary: () => void;
  renameLibrary: (id: string, name: string) => void;
  setSymbolType: (id: string, type: SymbolType) => void;
  updateSymbolElements: (fn: (els: SceneElement[]) => SceneElement[]) => void;
  setLayout: (recipe: (layout: Layout) => Layout) => void;
  applyWorkspace: (name: string) => void;
  saveWorkspace: (name: string) => void;
  deleteWorkspace: (name: string) => void;
  togglePanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
  floatPanel: (id: PanelId, x: number, y: number) => void;
  dockPanel: (id: PanelId, groupId?: string) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  addGuide: (orientation: "h" | "v", pos: number) => void;
  moveGuide: (id: string, pos: number) => void;
  removeGuide: (id: string) => void;
  runBuiltin: (id: string) => void;
  saveCommand: (name: string, script: string) => void;
  deleteCommand: (id: string) => void;
  runCommand: (id: string) => void;
  findReplace: (replaceAll: boolean) => void;
  addHint: () => void;
  setArmature: (bones: Bone[], binds?: Bind[]) => void;
  bindElement: (elementId: string, boneId: string) => void;
  publish: () => void;
  exportSvg: () => void;
  exportJson: () => void;
  importJson: (text: string) => void;
  importElements: (els: SceneElement[]) => void;
  traceBitmap: () => Promise<void>;
  spellcheck: () => { word: string; where: string }[];
  hydrate: (raw: string | null) => void;
  persist: () => void;
  selectedElements: () => SceneElement[];
  currentSpan: () => Span | null;
  snapPoint: (p: Point, ignoreIds?: string[]) => Point;
  setFind: (find: string, replace?: string) => void;
  addScene: (name: string) => void;
  switchScene: (id: string) => void;
  renameScene: (name: string) => void;
  deleteScene: () => void;
};

export type StudioStore = State & Actions;

function initialDoc() {
  return createSampleDoc();
}

function boot(): State {
  const doc = initialDoc();
  const z = 0.72;
  return {
    doc,
    history: [{ label: "Open Arrival", doc: clone(doc) }],
    historyIndex: 0,
    tool: "select",
    handRestore: null,
    opts: defaultOpts(),
    selection: [],
    frame: 0,
    layerId: doc.scenes[0].layers[0].id,
    playing: false,
    loop: true,
    onion: false,
    onionOutlines: false,
    onionBefore: 2,
    onionAfter: 2,
    zoom: z,
    panX: 40,
    panY: 24,
    rulers: true,
    grid: false,
    guidesOn: true,
    snapObjects: true,
    snapGrid: false,
    snapGuides: true,
    snapPixels: false,
    hideEdges: false,
    shapeHints: true,
    workArea: true,
    previewMode: "full",
    simpleButtons: true,
    mute: false,
    session: "edit",
    breakpoints: [],
    layout: classicLayout(),
    workspaces: [],
    workspaceName: "Classic",
    editingSymbolId: null,
    dialog: null,
    status: "Arrival is ready. Press Enter to play the timeline.",
    traces: [],
    mouse: null,
    clipboard: null,
    frameClipboard: null,
    commands: builtins(),
    recent: [],
    templates: [],
    dirty: false,
    prefs: defaultPrefs(),
    frameRange: null,
    pen: null,
    bindArm: null,
    editingTextId: null,
    libraryId: doc.library[0]?.id ?? null,
    find: "",
    replace: "",
    txBase: null,
    txLabel: "",
    repeatDelta: null,
    closed: false,
    scriptFocus: 0,
  };
}

export const useStudio = create<StudioStore>((set, get) => ({
  ...boot(),

  setStatus: (status) => set({ status }),
  setDialog: (dialog) => set({ dialog }),
  setMouse: (mouse) => set({ mouse }),
  setFind: (find, replace) => set({ find, replace: replace ?? get().replace }),

  selectedElements: () => {
    const s = get();
    return liveElements(s.doc, s.frame, s.editingSymbolId).filter((el) => s.selection.includes(el.id));
  },

  currentSpan: () => {
    const s = get();
    if (s.editingSymbolId) return null;
    const scene = activeScene(s.doc);
    const layer = scene.layers.find((l) => l.id === s.layerId);
    return layer ? spanAt(layer, s.frame) : null;
  },

  update: (recipe, label) => {
    const s = get();
    if (s.txBase) {
      set({ doc: recipe(clone(s.doc)), dirty: true });
      return;
    }
    const next = recipe(clone(s.doc));
    const history = s.history.slice(0, s.historyIndex + 1);
    history.push({ label, doc: clone(next) });
    while (history.length > s.prefs.undoLimit) history.shift();
    set({ doc: next, history, historyIndex: history.length - 1, dirty: true, status: label });
  },

  transactStart: (label) => {
    const s = get();
    if (s.txBase) return;
    set({ txBase: clone(s.doc), txLabel: label });
  },
  transactApply: (recipe) => set({ doc: recipe(clone(get().doc)), dirty: true }),
  transactEnd: () => {
    const s = get();
    if (!s.txBase) return;
    const same = JSON.stringify(s.txBase) === JSON.stringify(s.doc);
    if (same) {
      set({ doc: s.txBase, txBase: null, txLabel: "", dirty: s.historyIndex > 0 });
      return;
    }
    const history = s.history.slice(0, s.historyIndex + 1);
    history.push({ label: s.txLabel || "Edit", doc: clone(s.doc) });
    while (history.length > s.prefs.undoLimit) history.shift();
    set({ history, historyIndex: history.length - 1, txBase: null, txLabel: "", dirty: true, status: s.txLabel || "Edit" });
  },

  undo: () => {
    const s = get();
    if (s.txBase) {
      set({ doc: s.txBase, txBase: null, txLabel: "", status: "Canceled edit" });
      return;
    }
    if (s.historyIndex <= 0) return;
    const historyIndex = s.historyIndex - 1;
    const doc = clone(s.history[historyIndex].doc);
    set({
      doc,
      historyIndex,
      dirty: historyIndex > 0,
      status: `Undo ${s.history[s.historyIndex].label}`,
      selection: s.selection.filter((id) => liveElements(doc, s.frame, s.editingSymbolId).some((e) => e.id === id) || docHas(doc, id)),
    });
  },
  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const historyIndex = s.historyIndex + 1;
    const doc = clone(s.history[historyIndex].doc);
    set({ doc, historyIndex, dirty: true, status: `Redo ${s.history[historyIndex].label}` });
  },
  jumpHistory: (index) => {
    const s = get();
    const item = s.history[index];
    if (!item) return;
    set({ doc: clone(item.doc), historyIndex: index, dirty: index > 0, status: item.label });
  },

  loadDoc: (doc, announce) => {
    const next = clone(doc);
    const layerId = activeScene(next).layers[0]?.id ?? "";
    set({
      doc: next,
      history: [{ label: announce || "Open", doc: clone(next) }],
      historyIndex: 0,
      selection: [],
      frame: 0,
      layerId,
      playing: false,
      editingSymbolId: null,
      dirty: false,
      closed: false,
      dialog: null,
      status: announce || `Opened ${next.name}`,
      session: "edit",
    });
  },

  newDocument: (partial) => {
    const doc = freshDoc(partial?.name ?? "Untitled", partial?.width ?? 960, partial?.height ?? 540, partial?.fps ?? 24);
    if (partial?.background) doc.background = partial.background;
    get().loadDoc(doc, "New document");
    set({ dirty: true });
  },
  newFromTemplate: (name) => {
    const found = get().templates.find((t) => t.name === name);
    if (!found) return;
    get().loadDoc(clone(found.doc), `New from ${name}`);
  },
  requestNew: () => {
    if (get().dirty) set({ dialog: { type: "confirm", message: "Save changes to the current document before creating a new one?", continueId: "new" } });
    else set({ dialog: { type: "new" } });
  },
  requestClose: () => {
    if (get().dirty) set({ dialog: { type: "confirm", message: "Save changes before closing Nostalgia Flash?", continueId: "close" } });
    else set({ closed: true, playing: false, dialog: { type: "welcome" }, status: "Nostalgia Flash is idle." });
  },
  confirmContinue: () => {
    const dialog = get().dialog;
    if (!dialog || dialog.type !== "confirm") return;
    if (dialog.continueId === "new") set({ dialog: { type: "new" } });
    if (dialog.continueId === "close") set({ closed: true, playing: false, dialog: { type: "welcome" }, dirty: false });
  },

  save: () => {
    const doc = clone(get().doc);
    const recent = pushRecent(get().recent, doc);
    set({ recent, dirty: false, status: `Saved ${doc.name}` });
    get().persist();
    downloadText(`${slug(doc.name)}.nostalgia.json`, JSON.stringify(doc), "application/json");
  },
  saveAs: (name) => {
    get().update((doc) => ({ ...doc, name }), "Save As");
    set({ dirty: false });
    const doc = get().doc;
    set({ recent: pushRecent(get().recent, doc), status: `Saved as ${name}` });
    get().persist();
    downloadText(`${slug(name)}.nostalgia.json`, JSON.stringify(doc), "application/json");
  },
  saveTemplate: (name) => {
    const templates = [...get().templates.filter((t) => t.name !== name), { name, doc: clone(get().doc) }];
    set({ templates, dialog: null, status: `Template “${name}” saved` });
    get().persist();
  },
  openRecent: (id) => {
    const item = get().recent.find((r) => r.id === id);
    if (item) get().loadDoc(item.doc, `Opened ${item.name}`);
  },

  setTool: (tool) => {
    const patch: Partial<State> = { tool, pen: tool === "pen" ? get().pen : null, status: toolHint(tool) };
    if (tool === "polystar") patch.dialog = { type: "polystar" };
    if (tool === "gradient") {
      const sel = get().selectedElements();
      if (sel.length && sel.every((el) => el.fill.type === "solid" || el.fill.type === "none")) {
        get().changeSelection((el) => ({
          ...el,
          fill: {
            type: "linear",
            stops: [
              { offset: 0, color: el.fill.type === "solid" ? el.fill.color : "#fffcf7", alpha: 1 },
              { offset: 1, color: "#e09a3e", alpha: 1 },
            ],
            angle: 0,
            cx: 0.5,
            cy: 0.5,
            rx: 0.5,
            focal: 0,
          },
        }), "Gradient fill");
      }
    }
    set(patch);
  },
  holdHand: (on) => {
    if (on && get().tool !== "hand") set({ handRestore: get().tool, tool: "hand" });
    if (!on && get().handRestore) set({ tool: get().handRestore!, handRestore: null });
  },
  patchOpts: (patch) => set({ opts: { ...get().opts, ...patch } }),

  setSelection: (ids, layerId) => set({ selection: ids, layerId: layerId ?? get().layerId, editingTextId: null }),
  selectAll: () => {
    const s = get();
    const ids = liveElements(s.doc, s.frame, s.editingSymbolId).filter((e) => !e.locked).map((e) => e.id);
    set({ selection: ids, status: `${ids.length} selected` });
  },
  deselect: () => set({ selection: [], editingTextId: null }),

  deleteSelection: () => {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
    get().changeSelection(() => null, "Delete");
    set({ selection: [] });
  },
  copySelection: () => {
    const els = get().selectedElements();
    if (!els.length) return set({ status: "Nothing to copy" });
    set({ clipboard: els.map((e) => clone(e)), status: `Copied ${els.length}` });
  },
  cutSelection: () => {
    get().copySelection();
    get().deleteSelection();
    set({ status: "Cut" });
  },
  pasteSelection: (mode = "offset") => {
    const clip = get().clipboard;
    if (!clip?.length) return set({ status: "Clipboard is empty" });
    const copies = clip.map((el) => {
      const next = retarget(el);
      if (mode === "offset") {
        next.x += 12;
        next.y += 12;
      }
      return next;
    });
    const s = get();
    if (mode === "offset") set({ clipboard: copies.map((e) => clone(e)) });
    get().update((doc) => copies.reduce((acc, el) => addDrawn(acc, s.layerId, s.frame, s.editingSymbolId, el), doc), "Paste");
    set({ selection: copies.map((e) => e.id) });
  },
  duplicateSelection: () => {
    const els = get().selectedElements();
    if (!els.length) return;
    const copies = els.map((el) => {
      const next = retarget(el);
      next.x += 12;
      next.y += 12;
      return next;
    });
    const s = get();
    get().update((doc) => {
      let next = doc;
      for (const el of copies) next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, el);
      return next;
    }, "Duplicate");
    set({ selection: copies.map((e) => e.id) });
  },
  duplicateTransform: () => {
    const delta = get().repeatDelta;
    const els = get().selectedElements();
    if (!els.length) return set({ status: "Nothing selected" });
    const copies = els.map((el) => {
      const next = retarget(el);
      if (delta) {
        if (typeof delta.x === "number") next.x += delta.x;
        if (typeof delta.y === "number") next.y += delta.y;
        if (typeof delta.rotation === "number") next.rotation += delta.rotation;
        if (typeof delta.w === "number") next.w += delta.w;
        if (typeof delta.h === "number") next.h += delta.h;
      } else {
        next.x += next.w + 8;
      }
      return next;
    });
    const s = get();
    get().update((doc) => copies.reduce((acc, el) => addDrawn(acc, s.layerId, s.frame, s.editingSymbolId, el), doc), "Duplicate and transform");
    set({ selection: copies.map((e) => e.id) });
  },
  nudge: (dx, dy) => {
    if (!get().selection.length) return;
    get().changeSelection((el) => ({ ...el, x: el.x + dx, y: el.y + dy }), "Nudge");
  },
  patchSelected: (patch, label = "Edit properties") => {
    if (!get().selection.length) return;
    get().changeSelection((el) => ({ ...el, ...clone(patch) }), label);
  },
  previewSelected: (patch) => {
    const ids = new Set(get().selection);
    if (!ids.size) return;
    if (!get().txBase) get().transactStart("Edit properties");
    const s = get();
    set({ doc: editElements(s.doc, s.frame, s.editingSymbolId, ids, (el) => ({ ...el, ...patch })) });
  },
  noteDelta: (patch) => set({ repeatDelta: { ...get().repeatDelta, ...patch } }),

  groupSelection: () => {
    const els = get().selectedElements();
    if (els.length < 2) return set({ status: "Select two or more objects to group" });
    const box = selectionBounds(els);
    if (!box) return;
    const ids = new Set(els.map((e) => e.id));
    const group = makeElement({
      kind: "group",
      name: "Group",
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      regX: 0,
      regY: 0,
      fill: { type: "none" },
      stroke: null,
      children: els.map((el) => ({ ...clone(el), x: el.x - box.x, y: el.y - box.y })),
    });
    const s = get();
    get().update((doc) => addDrawn(editElements(doc, s.frame, s.editingSymbolId, ids, () => null), s.layerId, s.frame, s.editingSymbolId, group), "Group");
    set({ selection: [group.id] });
  },
  ungroupSelection: () => {
    const groups = get().selectedElements().filter((e) => e.kind === "group");
    if (!groups.length) return set({ status: "Select a group" });
    const s = get();
    const created: string[] = [];
    get().update((doc) => {
      let next = editElements(doc, s.frame, s.editingSymbolId, new Set(groups.map((g) => g.id)), () => null);
      for (const group of groups) {
        for (const child of group.children) {
          const baked = { ...clone(child), id: child.id, x: group.x + child.x, y: group.y + child.y, rotation: child.rotation + group.rotation };
          created.push(baked.id);
          next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, baked);
        }
      }
      return next;
    }, "Ungroup");
    set({ selection: created });
  },
  breakApart: () => {
    const els = get().selectedElements();
    if (!els.length) return;
    const s = get();
    const created: string[] = [];
    get().update((doc) => {
      let next = doc;
      for (const el of els) {
        if (el.kind === "group") {
          next = editElements(next, s.frame, s.editingSymbolId, new Set([el.id]), () => null);
          for (const child of el.children) {
            const baked = { ...clone(child), x: el.x + child.x, y: el.y + child.y, rotation: child.rotation + el.rotation };
            created.push(baked.id);
            next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, baked);
          }
        } else if (el.kind === "symbol" && el.symbolId) {
          const sym = findSymbol(next, el.symbolId);
          next = editElements(next, s.frame, s.editingSymbolId, new Set([el.id]), () => null);
          if (!sym) continue;
          const b = symbolBounds(sym.elements);
          const sx = el.w / (b.w || 1);
          const sy = el.h / (b.h || 1);
          for (const child of sym.elements) {
            const copy = retarget(child);
            copy.x = el.x + (child.x - b.x) * sx;
            copy.y = el.y + (child.y - b.y) * sy;
            copy.w *= sx;
            copy.h *= sy;
            copy.rotation += el.rotation;
            created.push(copy.id);
            next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, copy);
          }
        } else if (el.kind === "text") {
          next = editElements(next, s.frame, s.editingSymbolId, new Set([el.id]), () => null);
          const letters = [...el.text];
          const w = el.w / Math.max(1, letters.length);
          letters.forEach((ch, i) => {
            const copy = makeElement({ ...el, id: uid("e"), kind: "text", text: ch, x: el.x + i * w, w, name: ch });
            created.push(copy.id);
            next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, copy);
          });
        } else {
          set({ status: "Break Apart works on groups, symbols, and text" });
        }
      }
      return next;
    }, "Break apart");
    if (created.length) set({ selection: created });
  },
  arrange: (mode) => {
    const ids = new Set(get().selection);
    if (!ids.size) return;
    const s = get();
    get().update((doc) => {
      if (s.editingSymbolId) {
        return {
          ...doc,
          library: doc.library.map((sym) => (sym.id === s.editingSymbolId ? { ...sym, elements: arrange(sym.elements, ids, mode) } : sym)),
        };
      }
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          const keyed = ensureKey(layer, s.frame, "copy");
          return { ...keyed, spans: keyed.spans.map((span) => (span.start === s.frame ? { ...span, elements: arrange(span.elements, ids, mode) } : span)) };
        }),
      });
    }, "Arrange");
  },
  align: (mode, toStage) => {
    const els = get().selectedElements();
    if (!els.length) return;
    const s = get();
    const target = toStage ? { x: 0, y: 0, w: s.doc.width, h: s.doc.height } : selectionBounds(els);
    if (!target) return;
    const ids = new Set(els.map((e) => e.id));
    get().changeSelection((el) => {
      if (!ids.has(el.id)) return el;
      const b = boundsOf(el);
      let dx = 0;
      let dy = 0;
      if (mode === "left") dx = target.x - b.x;
      if (mode === "center") dx = target.x + target.w / 2 - (b.x + b.w / 2);
      if (mode === "right") dx = target.x + target.w - (b.x + b.w);
      if (mode === "top") dy = target.y - b.y;
      if (mode === "middle") dy = target.y + target.h / 2 - (b.y + b.h / 2);
      if (mode === "bottom") dy = target.y + target.h - (b.y + b.h);
      return { ...el, x: el.x + dx, y: el.y + dy };
    }, "Align");
  },
  distribute: (mode) => {
    const els = get().selectedElements();
    if (els.length < 3) return set({ status: "Select at least three objects" });
    const sorted = [...els].sort((a, b) => (mode === "h" ? boundsOf(a).x - boundsOf(b).x : boundsOf(a).y - boundsOf(b).y));
    const first = boundsOf(sorted[0]);
    const last = boundsOf(sorted[sorted.length - 1]);
    const span = mode === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
    const total = sorted.reduce((sum, el) => sum + (mode === "h" ? boundsOf(el).w : boundsOf(el).h), 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = mode === "h" ? first.x : first.y;
    const moves = new Map<string, number>();
    for (const el of sorted) {
      const b = boundsOf(el);
      moves.set(el.id, cursor - (mode === "h" ? b.x : b.y));
      cursor += (mode === "h" ? b.w : b.h) + gap;
    }
    get().changeSelection((el) => {
      const d = moves.get(el.id) ?? 0;
      return mode === "h" ? { ...el, x: el.x + d } : { ...el, y: el.y + d };
    }, "Distribute");
  },
  matchSize: (mode) => {
    const els = get().selectedElements();
    if (els.length < 2) return set({ status: "Select two or more objects" });
    const b = boundsOf(els[0]);
    get().changeSelection((el) => {
      if (el.id === els[0].id) return el;
      return { ...el, w: mode !== "h" ? b.w : el.w, h: mode !== "w" ? b.h : el.h };
    }, "Match size");
  },
  rotateSelection: (amount) => get().changeSelection((el) => ({ ...el, rotation: el.rotation + amount }), "Rotate"),
  flipSelection: (axis) =>
    get().changeSelection((el) => (axis === "h" ? { ...el, scaleX: el.scaleX * -1 } : { ...el, scaleY: el.scaleY * -1 }), "Flip"),
  resetTransform: () =>
    get().changeSelection(
      (el) => ({ ...el, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, rotX: 0, rotY: 0, rotZ: 0, z: 0 }),
      "Remove transform",
    ),

  booleanOp: (op) => {
    const els = get().selectedElements();
    if (els.length < 2) return set({ status: "Select two shapes to combine" });
    const rings = els.map(toRing).filter((r): r is [number, number][] => !!r && r.length > 3);
    if (rings.length < 2) return set({ status: "These shapes need a closed outline to combine" });
    const fn = clipFn(op === "union" ? "union" : op === "intersect" || op === "crop" ? "intersection" : op === "punch" ? "difference" : "xor");
    let acc = fn([[rings[0]]], [[rings[0]]]);
    for (let i = 1; i < rings.length; i++) acc = fn(acc, [[rings[i]]]);
    const ring = acc[0]?.[0];
    if (!ring || ring.length < 3) return set({ status: "The combination is empty" });
    const anchors: Anchor[] = ring.slice(0, -1).map((pair) => ({ x: pair[0], y: pair[1], inX: null, inY: null, outX: null, outY: null }));
    const style = op === "crop" ? els[0] : els[els.length - 1];
    const shape = pathFromAnchors(anchors, true, { fill: style.fill, stroke: style.stroke }, "Combined");
    const s = get();
    const ids = new Set(els.map((e) => e.id));
    get().update((doc) => addDrawn(editElements(doc, s.frame, s.editingSymbolId, ids, () => null), s.layerId, s.frame, s.editingSymbolId, shape), "Combine objects");
    set({ selection: [shape.id] });
  },

  smoothOrStraighten: (mode) => {
    get().changeSelection((el) => {
      const pts = outlineWorld(el);
      const nextPts = mode === "smooth" ? smoothPath(pts, 3) : mode === "optimize" ? rdp(pts, 4) : straighten(pts);
      if (nextPts.length < 2) return el;
      const shape = pathFromAnchors(
        nextPts.map((p) => ({ x: p.x, y: p.y, inX: null, inY: null, outX: null, outY: null })),
        el.kind !== "line",
        { fill: el.fill, stroke: el.stroke },
        el.name,
      );
      shape.id = el.id;
      return shape;
    }, mode === "smooth" ? "Smooth" : mode === "optimize" ? "Optimize" : "Straighten");
  },

  convertToSymbol: (name, type) => {
    const els = get().selectedElements();
    if (!els.length) return set({ status: "Select artwork to convert" });
    const box = selectionBounds(els)!;
    const id = uid("sym");
    const local = els.map((el) => ({ ...clone(el), x: el.x - box.x, y: el.y - box.y }));
    const instance = makeElement({
      kind: "symbol",
      name,
      instanceName: name.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase()),
      symbolId: id,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fill: { type: "none" },
      stroke: null,
    });
    const s = get();
    const ids = new Set(els.map((e) => e.id));
    get().update((doc) => {
      const stripped = editElements(doc, s.frame, s.editingSymbolId, ids, () => null);
      const withSym: Doc = { ...stripped, library: [...stripped.library, { id, name, type, elements: local, folderId: null }] };
      return addDrawn(withSym, s.layerId, s.frame, s.editingSymbolId, instance);
    }, "Convert to symbol");
    set({ selection: [instance.id], libraryId: id, dialog: null });
  },
  enterSymbol: (id) => {
    const chosen = id ?? get().selectedElements().find((e) => e.kind === "symbol")?.symbolId ?? null;
    if (!chosen) return set({ status: "Select a symbol instance to edit" });
    const sym = findSymbol(get().doc, chosen);
    if (!sym) return;
    set({ editingSymbolId: chosen, selection: [], playing: false, status: `Editing symbol “${sym.name}”` });
  },
  exitSymbol: () => set({ editingSymbolId: null, selection: [], status: "Back on the scene" }),

  setFrame: (frame) => {
    const s = get();
    const scene = activeScene(s.doc);
    const next = Math.max(0, Math.round(frame));
    if (next >= scene.frameCount) {
      get().update((doc) => replaceScene(doc, { ...activeScene(doc), frameCount: next + 1 }), "Extend timeline");
    }
    set({ frame: Math.min(next, activeScene(get().doc).frameCount - 1), playing: s.session === "edit" ? false : s.playing });
    if (s.session === "debug" && s.breakpoints.includes(`${activeScene(get().doc).id}:${next}`)) {
      set({ playing: false, status: `Breakpoint · frame ${next + 1}` });
    }
  },
  setLayer: (id) => set({ layerId: id }),
  toggleLayerFlag: (id, flag) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, { ...scene, layers: scene.layers.map((l) => (l.id === id ? { ...l, [flag]: !l[flag] } : l)) });
    }, flag === "visible" ? "Visibility" : flag === "locked" ? "Lock" : "Outline");
  },
  renameLayer: (id, name) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, { ...scene, layers: scene.layers.map((l) => (l.id === id ? { ...l, name } : l)) });
    }, "Rename layer");
  },
  addLayer: (kind = "layer") => {
    const s = get();
    const scene = activeScene(s.doc);
    const index = Math.max(0, scene.layers.findIndex((l) => l.id === s.layerId));
    const color = layerColors()[scene.layers.length % layerColors().length];
    const layer = makeLayer(kind === "folder" ? "Folder" : `Layer ${scene.layers.length + 1}`, color, [], scene.frameCount);
    if (kind === "folder") layer.type = "folder";
    get().update((doc) => {
      const current = activeScene(doc);
      const layers = current.layers.slice();
      layers.splice(index, 0, layer);
      return replaceScene(doc, { ...current, layers });
    }, kind === "folder" ? "New folder" : "New layer");
    set({ layerId: layer.id });
  },
  deleteLayer: (id) => {
    const s = get();
    const scene = activeScene(s.doc);
    const layerId = id ?? s.layerId;
    if (scene.layers.length <= 1) return set({ status: "A scene needs at least one layer" });
    get().update((doc) => {
      const current = activeScene(doc);
      return replaceScene(doc, { ...current, layers: current.layers.filter((l) => l.id !== layerId).map((l) => (l.parentId === layerId ? { ...l, parentId: null } : l)) });
    }, "Delete layer");
    const layers = activeScene(get().doc).layers;
    if (!layers.some((l) => l.id === get().layerId)) set({ layerId: layers[0].id });
  },
  duplicateLayer: (id) => {
    const s = get();
    const scene = activeScene(s.doc);
    const source = scene.layers.find((l) => l.id === (id ?? s.layerId));
    if (!source) return;
    const copy = clone(source);
    copy.id = uid("ly");
    copy.name = `${source.name} copy`;
    copy.spans = copy.spans.map((span) => ({ ...span, id: uid("sp"), elements: span.elements.map(retarget) }));
    const index = scene.layers.findIndex((l) => l.id === source.id);
    get().update((doc) => {
      const current = activeScene(doc);
      const layers = current.layers.slice();
      layers.splice(index, 0, copy);
      return replaceScene(doc, { ...current, layers });
    }, "Duplicate layer");
    set({ layerId: copy.id });
  },
  reorderLayer: (id, toId) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      const layers = scene.layers.slice();
      const from = layers.findIndex((l) => l.id === id);
      const to = layers.findIndex((l) => l.id === toId);
      if (from < 0 || to < 0 || from === to) return doc;
      const [item] = layers.splice(from, 1);
      layers.splice(to, 0, item);
      return replaceScene(doc, { ...scene, layers });
    }, "Reorder layer");
  },
  setLayerType: (id, type) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      const layers = scene.layers.map((l) => ({ ...l }));
      const index = layers.findIndex((l) => l.id === id);
      if (index < 0) return doc;
      layers[index].type = type;
      if ((type === "mask" || type === "guide") && layers[index + 1]) {
        layers[index + 1].type = type === "mask" ? "masked" : "guided";
      }
      return replaceScene(doc, { ...scene, layers });
    }, "Layer type");
  },
  hideOtherLayers: (id) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, { ...scene, layers: scene.layers.map((l) => ({ ...l, visible: l.id === id })) });
    }, "Hide others");
  },

  insertFrames: (count = 1) => {
    const s = get();
    const range = s.frameRange;
    const at = range?.start ?? s.frame;
    const n = range ? Math.max(1, range.end - range.start) : count;
    get().update((doc) => {
      const scene = activeScene(doc);
      const layers = scene.layers.map((layer) => {
        if (range && layer.id !== range.layerId) return layer;
        if (!range && layer.id !== s.layerId) return layer;
        return insertTime(layer, at, n);
      });
      const frameCount = Math.max(scene.frameCount + (range ? 0 : n), ...layers.flatMap((l) => l.spans.map((sp) => sp.end)));
      return replaceScene(doc, { ...scene, layers, frameCount });
    }, "Insert frame");
  },
  insertKey: (blank = false) => {
    const s = get();
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => (layer.id === s.layerId ? ensureKey(layer, s.frame, blank ? "blank" : "copy") : layer)),
        frameCount: Math.max(scene.frameCount, s.frame + 1),
      });
    }, blank ? "Blank keyframe" : "Keyframe");
  },
  removeFrames: () => {
    const s = get();
    const start = s.frameRange?.start ?? s.frame;
    const end = s.frameRange?.end ?? s.frame + 1;
    const layerId = s.frameRange?.layerId ?? s.layerId;
    get().update((doc) => {
      const scene = activeScene(doc);
      const layers = scene.layers.map((layer) => (layer.id === layerId ? removeTime(layer, start, end) : layer));
      return replaceScene(doc, { ...scene, layers, frameCount: Math.max(1, scene.frameCount - (end - start)) });
    }, "Remove frames");
  },
  clearKey: () => {
    const s = get();
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          if (layer.id !== s.layerId) return layer;
          return { ...layer, spans: layer.spans.map((span) => (span.start === s.frame ? { ...span, elements: [], key: true, tween: "none" } : span)) };
        }),
      });
    }, "Clear keyframe");
  },
  setTween: (tween) => {
    const s = get();
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        frameCount: Math.max(scene.frameCount, s.frame + 13),
        layers: scene.layers.map((layer) => (layer.id === s.layerId ? applyTween(layer, s.frame, tween) : layer)),
      });
    }, tween === "none" ? "Remove tween" : `${tween} tween`);
  },
  reverseFrames: () => {
    const s = get();
    const start = s.frameRange?.start ?? 0;
    const end = s.frameRange?.end ?? activeScene(s.doc).frameCount;
    const layerId = s.frameRange?.layerId ?? s.layerId;
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          if (layer.id !== layerId) return layer;
          const spans = layer.spans.map((span) => {
            if (span.start < start || span.start >= end) return span;
            const ns = end - (span.end - start);
            const ne = end - (span.start - start);
            return { ...span, start: ns, end: ne };
          });
          return { ...layer, spans: spans.sort((a, b) => a.start - b.start) };
        }),
      });
    }, "Reverse frames");
  },
  copyFrames: () => {
    const s = get();
    const layer = activeScene(s.doc).layers.find((l) => l.id === (s.frameRange?.layerId ?? s.layerId));
    if (!layer) return;
    const start = s.frameRange?.start ?? s.frame;
    const end = s.frameRange?.end ?? s.frame + 1;
    const spans = layer.spans.filter((span) => span.start < end && span.end > start).map((span) => clone(span));
    set({ frameClipboard: spans, status: "Copied frames" });
  },
  pasteFrames: () => {
    const clip = get().frameClipboard;
    if (!clip?.length) return set({ status: "No frames on the clipboard" });
    const s = get();
    const origin = Math.min(...clip.map((span) => span.start));
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          if (layer.id !== s.layerId) return layer;
          const spans = [
            ...layer.spans,
            ...clip.map((span) => ({
              ...clone(span),
              id: uid("sp"),
              start: s.frame + (span.start - origin),
              end: s.frame + (span.end - origin),
              elements: span.elements.map(retarget),
            })),
          ];
          return { ...layer, spans };
        }),
      });
    }, "Paste frames");
  },
  setFrameLabel: (label) => {
    const s = get();
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          if (layer.id !== s.layerId) return layer;
          const keyed = ensureKey(layer, s.frame, "copy");
          return { ...keyed, spans: keyed.spans.map((span) => (span.start === s.frame ? { ...span, label } : span)) };
        }),
      });
    }, "Frame label");
    set({ dialog: null });
  },
  setEase: (value) => {
    const s = get();
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => ({
          ...layer,
          spans: layer.spans.map((span) => (layer.id === s.layerId && span.start === (spanAt(layer, s.frame)?.start ?? -1) ? { ...span, ease: value } : span)),
        })),
      });
    }, "Ease");
  },
  setScript: (script) => {
    const s = get();
    if (!get().txBase) {
      /* direct write, one history step per blur handled by caller via update */
    }
    set({
      doc: (() => {
        const scene = activeScene(s.doc);
        return replaceScene(s.doc, {
          ...scene,
          layers: scene.layers.map((layer) => {
            if (layer.id !== s.layerId) return layer;
            const keyed = ensureKey(layer, s.frame, "copy");
            return { ...keyed, spans: keyed.spans.map((span) => (span.start === s.frame ? { ...span, script } : span)) };
          }),
        });
      })(),
    });
  },
  formatScript: () => {
    const span = get().currentSpan();
    if (!span) return;
    const formatted = span.script
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//") || trimmed.endsWith(";")) return trimmed;
        return `${trimmed};`;
      })
      .join("\n");
    get().update((doc) => {
      const s = get();
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) =>
          layer.id === s.layerId ? { ...layer, spans: layer.spans.map((sp) => (sp.id === span.id ? { ...sp, script: formatted } : sp)) } : layer,
        ),
      });
    }, "Auto format");
  },
  checkScript: () => {
    const span = get().currentSpan();
    const parsed = parseScript(span?.script ?? "");
    set({ status: parsed.ok ? "Syntax is valid" : `Line ${parsed.line}: ${parsed.error}` });
  },
  setFrameRange: (frameRange) => set({ frameRange }),
  setOnion: (patch) => set(patch),

  play: () => set({ playing: true, status: "Playing" }),
  stop: () => set({ playing: false, status: "Stopped" }),
  togglePlay: () => {
    if (get().playing) get().stop();
    else get().play();
  },
  rewind: () => set({ frame: 0, playing: false, status: "Rewound" }),
  step: (delta) => {
    const scene = activeScene(get().doc);
    const frame = Math.max(0, Math.min(scene.frameCount - 1, get().frame + delta));
    set({ frame, playing: false });
  },
  advance: () => {
    const s = get();
    if (!s.playing || s.editingSymbolId) return;
    const scene = activeScene(s.doc);
    let next = s.frame + 1;
    if (next >= scene.frameCount) {
      if (s.loop || s.session !== "edit") next = 0;
      else {
        set({ playing: false, status: "End of timeline" });
        return;
      }
    }
    if (s.session === "debug" && s.breakpoints.includes(`${scene.id}:${next}`)) {
      set({ frame: next, playing: false, status: `Breakpoint · frame ${next + 1}` });
      return;
    }
    set({ frame: next });
    runFrameScripts(get, set);
  },
  toggleLoop: () => set({ loop: !get().loop, status: get().loop ? "Loop off" : "Loop on" }),
  testMovie: (sceneOnly = false) => {
    set({
      session: "test",
      playing: true,
      frame: sceneOnly ? get().frame : 0,
      selection: [],
      editingTextId: null,
      status: sceneOnly ? "Testing scene" : "Testing movie",
    });
  },
  endSession: () => set({ session: "edit", playing: false, status: "Back in editing" }),
  toggleBreakpoint: (frame) => {
    const s = get();
    const key = `${activeScene(s.doc).id}:${frame ?? s.frame}`;
    const has = s.breakpoints.includes(key);
    set({ breakpoints: has ? s.breakpoints.filter((b) => b !== key) : [...s.breakpoints, key], status: has ? "Breakpoint removed" : "Breakpoint set" });
  },
  clearBreakpoints: () => set({ breakpoints: [], status: "Breakpoints cleared" }),
  continueDebug: () => set({ playing: true, session: get().session === "edit" ? "debug" : get().session }),

  setZoom: (zoom, view) => {
    const z = Math.max(0.08, Math.min(12, zoom));
    const s = get();
    if (!view) {
      set({ zoom: z });
      return;
    }
    const cx = view.w / 2;
    const cy = view.h / 2;
    const sx = (cx - s.panX) / s.zoom - PASTE;
    const sy = (cy - s.panY) / s.zoom - PASTE;
    set({ zoom: z, panX: cx - (sx + PASTE) * z, panY: cy - (sy + PASTE) * z });
  },
  fit: (viewW, viewH) => {
    const doc = get().doc;
    const margin = 64;
    const z = Math.max(0.08, Math.min(4, Math.min((viewW - margin) / doc.width, (viewH - margin) / doc.height)));
    set({
      zoom: z,
      panX: viewW / 2 - (doc.width / 2 + PASTE) * z,
      panY: viewH / 2 - (doc.height / 2 + PASTE) * z,
    });
  },
  zoomAt: (factor, clientX, clientY, rect) => {
    const s = get();
    const z = Math.max(0.08, Math.min(12, s.zoom * factor));
    const sx = (clientX - rect.left - s.panX) / s.zoom - PASTE;
    const sy = (clientY - rect.top - s.panY) / s.zoom - PASTE;
    set({ zoom: z, panX: clientX - rect.left - (sx + PASTE) * z, panY: clientY - rect.top - (sy + PASTE) * z });
  },
  setPan: (panX, panY) => set({ panX, panY }),
  toggleFlag: (key) => {
    const value = !get()[key];
    const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
    set({ [key]: value, status: `${label} ${value ? "on" : "off"}` } as Partial<StudioStore>);
  },
  setPreviewMode: (previewMode) => set({ previewMode, status: `Preview: ${previewMode}` }),
  setDocument: (patch, scale) => {
    get().update((doc) => {
      const next = { ...doc, ...patch };
      if (!scale || !patch.width || !patch.height) return next;
      const sx = patch.width / doc.width;
      const sy = patch.height / doc.height;
      return {
        ...next,
        scenes: doc.scenes.map((scene) => ({
          ...scene,
          layers: scene.layers.map((layer) => ({
            ...layer,
            spans: layer.spans.map((span) => ({
              ...span,
              elements: span.elements.map((el) => ({ ...el, x: el.x * sx, y: el.y * sy, w: el.w * sx, h: el.h * sy })),
            })),
          })),
        })),
      };
    }, "Document");
  },

  swapColors: () => {
    const { fill, stroke } = get().opts;
    const nextStroke = fill.type === "none" ? null : defaultStroke(fill.type === "solid" ? fill.color : fill.stops[0]?.color ?? "#000", stroke?.width ?? 2);
    const nextFill: Fill = stroke ? { type: "solid", color: stroke.color, alpha: stroke.alpha } : { type: "none" };
    set({ opts: { ...get().opts, fill: nextFill, stroke: nextStroke } });
  },
  defaultColors: () => set({ opts: { ...get().opts, fill: { type: "solid", color: "#fffcf7", alpha: 1 }, stroke: defaultStroke("#1c1b19", 2) } }),
  noneColor: () => {
    const well = get().opts.activeWell;
    if (well === "fill") set({ opts: { ...get().opts, fill: { type: "none" } } });
    else set({ opts: { ...get().opts, stroke: null } });
  },
  setWell: (fill, asStroke) => {
    const well = asStroke ? "stroke" : get().opts.activeWell;
    if (well === "stroke") {
      if (!fill || fill.type === "none") set({ opts: { ...get().opts, stroke: null, activeWell: "stroke" } });
      else if (fill.type === "solid") set({ opts: { ...get().opts, activeWell: "stroke", stroke: { ...(get().opts.stroke ?? defaultStroke()), color: fill.color, alpha: fill.alpha } } });
    } else if (fill) set({ opts: { ...get().opts, activeWell: "fill", fill } });
    get().applyWellToSelection();
  },
  applyWellToSelection: () => {
    const ids = get().selection;
    if (!ids.length) return;
    const { opts } = get();
    if (!get().txBase) {
      get().changeSelection((el) => {
        if (opts.activeWell === "fill") return { ...el, fill: clone(opts.fill) };
        return { ...el, stroke: opts.stroke ? clone(opts.stroke) : null };
      }, "Color");
    } else {
      const s = get();
      set({
        doc: editElements(s.doc, s.frame, s.editingSymbolId, new Set(ids), (el) =>
          opts.activeWell === "fill" ? { ...el, fill: clone(opts.fill) } : { ...el, stroke: opts.stroke ? clone(opts.stroke) : null },
        ),
      });
    }
  },

  addShape: (el) => {
    const s = get();
    const layer = activeScene(s.doc).layers.find((l) => l.id === s.layerId);
    if (!s.editingSymbolId && (!layer || layer.locked || layer.type === "folder")) {
      set({ status: "The current layer is locked or is a folder" });
      return null;
    }
    get().update((doc) => addDrawn(doc, s.layerId, s.frame, s.editingSymbolId, el), `Draw ${el.name}`);
    set({ selection: [el.id] });
    return el.id;
  },
  changeSelection: (fn, label) => {
    const ids = new Set(get().selection);
    if (!ids.size) return;
    const s = get();
    get().update((doc) => editElements(doc, s.frame, s.editingSymbolId, ids, fn), label);
  },
  previewDoc: (recipe) => {
    if (!get().txBase) get().transactStart("Edit");
    set({ doc: recipe(clone(get().doc)) });
  },
  commitPreview: (label) => {
    if (get().txBase) {
      set({ txLabel: label });
      get().transactEnd();
    }
  },
  cancelPreview: () => {
    if (get().txBase) set({ doc: get().txBase!, txBase: null, txLabel: "" });
  },
  setPen: (pen) => set({ pen }),
  finishPen: (closed) => {
    const pen = get().pen;
    if (!pen || pen.length < 2) {
      set({ pen: null, status: "Pen path needs two points" });
      return;
    }
    const { opts } = get();
    const el = pathFromAnchors(pen, closed, { fill: closed ? opts.fill : { type: "none" }, stroke: opts.stroke }, "Path");
    get().addShape(el);
    set({ pen: null });
  },
  setBindArm: (bindArm) => set({ bindArm, status: bindArm ? "Click a bone to bind the shape" : "Bind canceled" }),
  setEditingText: (editingTextId) => set({ editingTextId }),
  setLibraryId: (libraryId) => set({ libraryId }),
  placeSymbol: (id, at) => {
    const sym = findSymbol(get().doc, id);
    if (!sym) return;
    const b = symbolBounds(sym.elements);
    const doc = get().doc;
    const el = makeElement({
      kind: "symbol",
      name: sym.name,
      instanceName: sym.name.replace(/\s+/g, ""),
      symbolId: id,
      x: at?.x ?? doc.width / 2 - b.w / 2,
      y: at?.y ?? doc.height / 2 - b.h / 2,
      w: Math.max(20, b.w),
      h: Math.max(20, b.h),
      fill: { type: "none" },
      stroke: null,
    });
    get().addShape(el);
    set({ libraryId: id });
  },
  newFolder: () => {
    const folder = { id: uid("fld"), name: "Folder" };
    get().update((doc) => ({ ...doc, folders: [...doc.folders, folder] }), "Library folder");
  },
  deleteLibrary: () => {
    const id = get().libraryId;
    if (!id) return;
    get().update((doc) => ({
      ...doc,
      library: doc.library.filter((s) => s.id !== id),
      folders: doc.folders.filter((f) => f.id !== id),
    }), "Delete library item");
    set({ libraryId: get().doc.library[0]?.id ?? null, editingSymbolId: get().editingSymbolId === id ? null : get().editingSymbolId });
  },
  renameLibrary: (id, name) => {
    get().update((doc) => ({
      ...doc,
      library: doc.library.map((s) => (s.id === id ? { ...s, name } : s)),
      folders: doc.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }), "Rename");
  },
  setSymbolType: (id, type) => {
    get().update((doc) => ({ ...doc, library: doc.library.map((s) => (s.id === id ? { ...s, type } : s)) }), "Symbol type");
  },
  updateSymbolElements: (fn) => {
    const id = get().editingSymbolId;
    if (!id) return;
    get().update((doc) => ({ ...doc, library: doc.library.map((s) => (s.id === id ? { ...s, elements: fn(s.elements) } : s)) }), "Edit symbol");
  },

  setLayout: (recipe) => set({ layout: recipe(get().layout) }),
  applyWorkspace: (name) => {
    const preset = presetLayout(name);
    const custom = get().workspaces.find((w) => w.name === name);
    const layout = custom ? clone(custom.layout) : preset;
    if (!layout) return;
    set({ layout, workspaceName: name, status: `Workspace “${name}”` });
    get().persist();
  },
  saveWorkspace: (name) => {
    const workspaces = [...get().workspaces.filter((w) => w.name !== name), { name, layout: clone(get().layout) }];
    set({ workspaces, workspaceName: name, dialog: null, status: `Saved workspace “${name}”` });
    get().persist();
  },
  deleteWorkspace: (name) => {
    set({ workspaces: get().workspaces.filter((w) => w.name !== name) });
    get().persist();
  },
  togglePanel: (id) => {
    const layout = get().layout;
    const where = panelLocation(layout, id);
    if (where === "hidden") get().setLayout(() => showPanel(layout, id));
    else get().setLayout(() => ({ ...stripPanel(layout, id), hidden: [...stripPanel(layout, id).hidden, id] }));
  },
  closePanel: (id) => {
    const stripped = stripPanel(get().layout, id);
    set({ layout: { ...stripped, hidden: [...stripped.hidden, id] } });
  },
  floatPanel: (id, x, y) => {
    const stripped = stripPanel(get().layout, id);
    set({ layout: { ...stripped, floating: [...stripped.floating, { id, x, y, w: 280, h: 320 }] } });
  },
  dockPanel: (id, groupId) => {
    const stripped = stripPanel(get().layout, id);
    if (!groupId) {
      set({ layout: { ...stripped, groups: [...stripped.groups, { id: uid("g"), tabs: [id], active: id, height: 24, collapsed: false }] } });
      return;
    }
    set({
      layout: {
        ...stripped,
        groups: stripped.groups.map((group) => (group.id === groupId ? { ...group, tabs: [...group.tabs, id], active: id } : group)),
      },
    });
  },
  setPrefs: (patch) => {
    set({ prefs: { ...get().prefs, ...patch } });
    get().persist();
  },
  addGuide: (orientation, pos) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, { ...scene, guides: [...scene.guides, { id: uid("g"), orientation, pos }] });
    }, "Add guide");
  },
  moveGuide: (id, pos) => {
    const s = get();
    const scene = activeScene(s.doc);
    set({
      doc: replaceScene(s.doc, { ...scene, guides: scene.guides.map((g) => (g.id === id ? { ...g, pos } : g)) }),
    });
  },
  removeGuide: (id) => {
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, { ...scene, guides: scene.guides.filter((g) => g.id !== id) });
    }, "Remove guide");
  },

  runBuiltin: (id) => {
    const els = get().selectedElements();
    if (!els.length) return set({ status: "Select an object first" });
    const frame = get().frame;
    const ids = new Set(els.map((e) => e.id));
    const originals = new Map(els.map((e) => [e.id, e]));
    get().update((doc) => {
      let next = doc;
      if (id === "fade-in" || id === "fade-out") {
        next = mapFrameElements(next, frame + 12, ids, (el) => ({ ...el, alpha: id === "fade-in" ? 1 : 0 }));
        next = mapFrameElements(next, frame, ids, (el) => ({ ...el, alpha: id === "fade-in" ? 0 : 1 }));
      } else if (id === "slide-in") {
        next = mapFrameElements(next, frame + 12, ids, (el) => ({ ...el }));
        next = mapFrameElements(next, frame, ids, (el) => ({ ...el, x: (originals.get(el.id)?.x ?? el.x) - 140 }));
      } else if (id === "spin") {
        next = mapFrameElements(next, frame + 12, ids, (el) => ({ ...el, rotation: el.rotation + 360 }));
      }
      const scene = activeScene(next);
      return replaceScene(next, {
        ...scene,
        frameCount: Math.max(scene.frameCount, frame + 13),
        layers: scene.layers.map((layer) => (layer.spans.some((sp) => sp.elements.some((e) => ids.has(e.id))) ? applyTween(layer, frame, "motion") : layer)),
      });
    }, id);
  },
  saveCommand: (name, script) => {
    const commands = [...get().commands, { id: uid("cmd"), name, kind: "script" as const, script }];
    set({ commands, dialog: null, status: `Saved command “${name}”` });
    get().persist();
  },
  deleteCommand: (id) => {
    set({ commands: get().commands.filter((c) => c.id !== id) });
    get().persist();
  },
  runCommand: (id) => {
    const cmd = get().commands.find((c) => c.id === id);
    if (!cmd) return;
    if (cmd.kind === "builtin") {
      const map: Record<string, string> = { "Fade in": "fade-in", "Fade out": "fade-out", "Slide in from left": "slide-in", "Spin once": "spin" };
      get().runBuiltin(map[cmd.name] ?? cmd.id);
      return;
    }
    runCalls(get, set, cmd.script);
  },
  findReplace: (replaceAll) => {
    const { find, replace } = get();
    if (!find) return;
    let count = 0;
    get().update((doc) => {
      const walk = (el: SceneElement): SceneElement => {
        let next = el;
        if (el.kind === "text" && el.text.includes(find)) {
          const text = replaceAll ? el.text.split(find).join(replace) : el.text.replace(find, replace);
          if (text !== el.text) count += 1;
          next = { ...el, text };
        }
        if (el.children.length) next = { ...next, children: el.children.map(walk) };
        return next;
      };
      return {
        ...doc,
        scenes: doc.scenes.map((scene) => ({
          ...scene,
          layers: scene.layers.map((layer) => ({
            ...layer,
            spans: layer.spans.map((span) => ({
              ...span,
              script: span.script.includes(find) ? (count++, replaceAll ? span.script.split(find).join(replace) : span.script.replace(find, replace)) : span.script,
              elements: span.elements.map(walk),
            })),
          })),
        })),
      };
    }, "Find and replace");
    set({ status: `${count} replacement${count === 1 ? "" : "s"}`, dialog: null });
  },
  addHint: () => {
    const s = get();
    const el = s.selectedElements()[0];
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((layer) => {
          if (layer.id !== s.layerId) return layer;
          const keyed = ensureKey(layer, s.frame, "copy");
          return {
            ...keyed,
            spans: keyed.spans.map((span) => {
              if (span.start !== s.frame) return span;
              const letter = String.fromCharCode(97 + span.hints.length);
              const x = el ? el.x + el.w / 2 : 40;
              const y = el ? el.y + el.h / 2 : 40;
              return { ...span, hints: [...span.hints, { id: uid("h"), letter, x, y, x2: x + 40, y2: y }] };
            }),
          };
        }),
      });
    }, "Shape hint");
  },
  setArmature: (bones, binds) => {
    const s = get();
    const layer = activeScene(s.doc).layers.find((l) => l.id === s.layerId);
    if (!layer) return;
    const existing = currentArmature(layer, s.frame);
    get().update((doc) => {
      const scene = activeScene(doc);
      return replaceScene(doc, {
        ...scene,
        layers: scene.layers.map((l) => (l.id === s.layerId ? withArmature(l, s.frame, bones, binds ?? existing.binds) : l)),
      });
    }, "Armature");
  },
  bindElement: (elementId, boneId) => {
    const s = get();
    const layer = activeScene(s.doc).layers.find((l) => l.id === s.layerId);
    if (!layer) return;
    const { bones, binds } = currentArmature(layer, s.frame);
    const bone = bones.find((b) => b.id === boneId);
    const el = liveElements(s.doc, s.frame, s.editingSymbolId).find((e) => e.id === elementId);
    if (!bone || !el) return;
    const ang = Math.atan2(bone.ty - bone.y, bone.tx - bone.x);
    const len = Math.hypot(bone.tx - bone.x, bone.ty - bone.y) || 1;
    const ux = (bone.tx - bone.x) / len;
    const uy = (bone.ty - bone.y) / len;
    const cx = el.x + el.w * el.regX;
    const cy = el.y + el.h * el.regY;
    const dx = cx - bone.x;
    const dy = cy - bone.y;
    const bind = { elementId, boneId, u: dx * ux + dy * uy, v: dx * -uy + dy * ux, rot: el.rotation - (ang * 180) / Math.PI };
    const nextBinds = [...binds.filter((b) => b.elementId !== elementId), bind];
    get().setArmature(bones, nextBinds);
    set({ bindArm: null, status: "Shape bound to bone" });
  },

  publish: () => {
    const doc = get().doc;
    const prefs = get().prefs;
    if (prefs.publishFormat === "svg") downloadText(`${slug(doc.name)}.svg`, documentSvg(doc, get().frame), "image/svg+xml");
    else downloadText(`${slug(doc.name)}.html`, documentHtml(doc, prefs.publishLoop), "text/html");
    set({ status: `Published ${doc.name}` });
  },
  exportSvg: () => {
    const doc = get().doc;
    downloadText(`${slug(doc.name)}-f${get().frame + 1}.svg`, documentSvg(doc, get().frame), "image/svg+xml");
    set({ status: "Exported SVG" });
  },
  exportJson: () => {
    const doc = get().doc;
    downloadText(`${slug(doc.name)}.nostalgia.json`, JSON.stringify(doc), "application/json");
  },
  importJson: (text) => {
    try {
      const doc = JSON.parse(text) as Doc;
      if (!doc.scenes || !doc.width) throw new Error("not a document");
      get().loadDoc(doc, `Imported ${doc.name}`);
    } catch {
      set({ status: "That file is not a Nostalgia Flash document" });
    }
  },
  importElements: (els) => {
    const s = get();
    get().update((doc) => els.reduce((acc, el) => addDrawn(acc, s.layerId, s.frame, s.editingSymbolId, el), doc), "Import");
    set({ selection: els.map((e) => e.id), status: `Imported ${els.length} shape${els.length === 1 ? "" : "s"}` });
  },
  traceBitmap: async () => {
    const el = get().selectedElements().find((e) => e.kind === "bitmap" && e.href);
    if (!el) return set({ status: "Select a bitmap to trace" });
    const pieces = await traceImage(el.href, el.w, el.h);
    const s = get();
    get().update((doc) => {
      let next = editElements(doc, s.frame, s.editingSymbolId, new Set([el.id]), () => null);
      for (const piece of pieces) {
        piece.x += el.x;
        piece.y += el.y;
        next = addDrawn(next, s.layerId, s.frame, s.editingSymbolId, piece);
      }
      return next;
    }, "Trace bitmap");
    set({ status: `Traced into ${pieces.length} shapes` });
  },
  spellcheck: () => {
    const suspects: { word: string; where: string }[] = [];
    const walk = (text: string, where: string) => {
      for (const word of text.match(/[A-Za-z']+/g) ?? []) {
        const lower = word.toLowerCase();
        if (lower.length < 3) continue;
        if (TYPOS[lower] || (!WORDS.has(lower) && !/^[A-Z]/.test(word))) suspects.push({ word, where });
      }
    };
    for (const scene of get().doc.scenes) {
      for (const layer of scene.layers) {
        for (const span of layer.spans) {
          for (const el of span.elements) if (el.kind === "text") walk(el.text, `${layer.name} · f${span.start + 1}`);
        }
      }
    }
    return suspects.slice(0, 40);
  },

  snapPoint: (p, ignoreIds = []) => {
    const s = get();
    let x = p.x;
    let y = p.y;
    const tol = 6 / s.zoom;
    if (s.snapPixels) {
      x = Math.round(x);
      y = Math.round(y);
    }
    const xs: number[] = [];
    const ys: number[] = [];
    if (s.snapGrid) {
      const g = s.prefs.grid;
      xs.push(Math.round(x / g) * g);
      ys.push(Math.round(y / g) * g);
    }
    if (s.snapGuides && s.guidesOn) {
      for (const guide of activeScene(s.doc).guides) {
        if (guide.orientation === "v") xs.push(guide.pos);
        else ys.push(guide.pos);
      }
    }
    xs.push(0, s.doc.width, s.doc.width / 2);
    ys.push(0, s.doc.height, s.doc.height / 2);
    if (s.snapObjects) {
      for (const el of liveElements(s.doc, s.frame, s.editingSymbolId)) {
        if (ignoreIds.includes(el.id)) continue;
        const b = boundsOf(el);
        xs.push(b.x, b.x + b.w / 2, b.x + b.w);
        ys.push(b.y, b.y + b.h / 2, b.y + b.h);
      }
    }
    const pick = (v: number, list: number[]) => {
      let best = v;
      let bestD = tol;
      for (const t of list) {
        const d = Math.abs(v - t);
        if (d <= bestD) {
          best = t;
          bestD = d;
        }
      }
      return best;
    };
    if (s.snapObjects || s.snapGrid || s.snapGuides) {
      x = pick(x, xs);
      y = pick(y, ys);
    }
    return { x, y };
  },

  hydrate: (raw) => {
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as Partial<State> & { doc?: Doc };
      if (!data.doc || !data.doc.scenes) return;
      const doc = renameLegacy(data.doc);
      set({
        doc,
        layout: data.layout ?? get().layout,
        workspaces: data.workspaces ?? [],
        workspaceName: data.workspaceName ?? "Classic",
        recent: data.recent ?? [],
        templates: data.templates ?? [],
        prefs: { ...defaultPrefs(), ...data.prefs },
        commands: data.commands?.length ? data.commands : builtins(),
        layerId: activeScene(doc).layers[0]?.id ?? get().layerId,
        history: [{ label: "Restore", doc: clone(doc) }],
        historyIndex: 0,
        dirty: false,
      });
    } catch {
      /* keep the sample */
    }
  },
  persist: () => {
    if (typeof localStorage === "undefined") return;
    const s = get();
    const payload = {
      doc: s.doc,
      layout: s.layout,
      workspaces: s.workspaces,
      workspaceName: s.workspaceName,
      recent: s.recent.slice(0, 8),
      templates: s.templates,
      prefs: s.prefs,
      commands: s.commands,
    };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  },

  addScene: (name) => {
    const scene = { id: uid("sc"), name, layers: [makeLayer("Layer 1", layerColors()[0], [], 24)], frameCount: 24, guides: [] };
    get().update((doc) => ({ ...doc, scenes: [...doc.scenes, scene], activeSceneId: scene.id }), "New scene");
    set({ layerId: scene.layers[0].id, frame: 0, selection: [], dialog: null });
  },
  switchScene: (id) => {
    const scene = get().doc.scenes.find((s) => s.id === id);
    if (!scene) return;
    set({ doc: { ...get().doc, activeSceneId: id }, layerId: scene.layers[0]?.id ?? "", frame: 0, selection: [], editingSymbolId: null });
  },
  renameScene: (name) => {
    get().update((doc) => ({ ...doc, scenes: doc.scenes.map((s) => (s.id === doc.activeSceneId ? { ...s, name } : s)) }), "Rename scene");
    set({ dialog: null });
  },
  deleteScene: () => {
    if (get().doc.scenes.length <= 1) return set({ status: "Keep at least one scene" });
    const id = get().doc.activeSceneId;
    get().update((doc) => {
      const scenes = doc.scenes.filter((s) => s.id !== id);
      return { ...doc, scenes, activeSceneId: scenes[0].id };
    }, "Delete scene");
    set({ layerId: activeScene(get().doc).layers[0]?.id ?? "", frame: 0, selection: [] });
  },
}));

function clipFn(name: "union" | "intersection" | "difference" | "xor"): (a: unknown, b: unknown) => number[][][][] {
  const bag = clipNs as unknown as { default?: Record<string, (a: unknown, b: unknown) => number[][][][]> };
  const src = bag.default && typeof bag.default.union === "function" ? bag.default : (clipNs as unknown as Record<string, (a: unknown, b: unknown) => number[][][][]>);
  const fn = src[name];
  if (typeof fn !== "function") throw new Error(`Boolean ${name} is unavailable`);
  return fn;
}

function renameLegacy(doc: Doc): Doc {
  const fix = (value: string) => value.replaceAll("Keyline", "Nostalgia Flash").replaceAll("Vector motion", "The easiest way to create fast web animations.");
  const walk = (el: SceneElement): SceneElement => ({
    ...el,
    name: fix(el.name),
    text: el.kind === "text" ? fix(el.text) : el.text,
    children: el.children.map(walk),
  });
  return {
    ...doc,
    name: fix(doc.name),
    scenes: doc.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => ({
        ...layer,
        spans: layer.spans.map((span) => ({ ...span, elements: span.elements.map(walk) })),
      })),
    })),
    library: doc.library.map((item) => ({ ...item, name: fix(item.name), elements: item.elements.map(walk) })),
  };
}

function docHas(doc: Doc, id: string): boolean {
  for (const scene of doc.scenes) {
    for (const layer of scene.layers) for (const span of layer.spans) for (const el of span.elements) if (el.id === id) return true;
  }
  return false;
}

function pushRecent(recent: RecentFile[], doc: Doc): RecentFile[] {
  return [{ id: doc.id, name: doc.name, savedAt: Date.now(), doc: clone(doc) }, ...recent.filter((r) => r.id !== doc.id)].slice(0, 8);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "nostalgia";
}

function arrange(elements: SceneElement[], ids: Set<string>, mode: "front" | "back" | "forward" | "backward"): SceneElement[] {
  if (mode === "front") return [...elements.filter((e) => !ids.has(e.id)), ...elements.filter((e) => ids.has(e.id))];
  if (mode === "back") return [...elements.filter((e) => ids.has(e.id)), ...elements.filter((e) => !ids.has(e.id))];
  const next = elements.slice();
  if (mode === "forward") {
    for (let i = next.length - 2; i >= 0; i--) if (ids.has(next[i].id) && !ids.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
  } else {
    for (let i = 1; i < next.length; i++) if (ids.has(next[i].id) && !ids.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]];
  }
  return next;
}

function toRing(el: SceneElement): [number, number][] | null {
  const pts = outlineWorld(el);
  if (pts.length < 3) return null;
  const ring = pts.map((p) => [p.x, p.y] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return ring;
}

function runFrameScripts(get: () => StudioStore, set: (partial: Partial<StudioStore>) => void) {
  const s = get();
  const scene = activeScene(s.doc);
  for (const layer of scene.layers) {
    const span = spanAt(layer, s.frame);
    if (!span || span.start !== s.frame) continue;
    if (span.sound) playTone(span.sound, s.mute);
    if (span.script.trim()) runCalls(get, set, span.script);
  }
}

function runCalls(get: () => StudioStore, set: (partial: Partial<StudioStore>) => void, script: string) {
  const parsed = parseScript(script);
  if (!parsed.ok) {
    set({ status: `Script · line ${parsed.line}: ${parsed.error}`, playing: false });
    return;
  }
  for (const call of parsed.calls) {
    const s = get();
    const scene = activeScene(s.doc);
    if (call.name === "stop") set({ playing: false, status: "stop()" });
    if (call.name === "play") set({ playing: true });
    if (call.name === "gotoAndPlay" || call.name === "gotoAndStop") {
      const frame = Math.max(0, Math.min(scene.frameCount - 1, argNumber(call.args) - 1));
      set({ frame, playing: call.name === "gotoAndPlay" });
    }
    if (call.name === "nextFrame") set({ frame: Math.min(scene.frameCount - 1, s.frame + 1) });
    if (call.name === "prevFrame") set({ frame: Math.max(0, s.frame - 1) });
    if (call.name === "trace") set({ traces: [...get().traces.slice(-40), argString(call.args)] });
    if (call.name === "playSound") playTone(argString(call.args), get().mute);
  }
}

function toolHint(tool: ToolId): string {
  const hints: Record<ToolId, string> = {
    select: "Selection — click, shift-click, or drag a marquee. Drag to move.",
    subselect: "Subselection — drag anchors and Bézier handles.",
    free: "Free Transform — scale from the handles, rotate outside the corners, Alt-drag an edge to skew.",
    gradient: "Gradient Transform — drag the center, width, rotation, and focal point.",
    rot3d: "3D Rotation — drag a colored ring on a movie clip.",
    move3d: "3D Translation — drag a colored arrow. Z pushes the clip toward you.",
    lasso: "Lasso — draw a region. Polygon mode clicks corners. Magic Wand selects similar fills.",
    pen: "Pen — click for corners, drag for curves. Enter finishes the path.",
    text: "Text — click to place a block. Choose Static, Dynamic, or Input below.",
    line: "Line — drag. Hold Shift for 45° steps.",
    rect: "Rectangle — drag. Shift constrains to a square. Alt draws from the center.",
    oval: "Oval — drag. Shift draws a circle.",
    polystar: "PolyStar — set star or polygon, then drag on the stage.",
    pencil: "Pencil — draw freehand. Straighten, Smooth, or Ink in the options.",
    brush: "Brush — paint a thick stroke. Size, shape, and pressure sit in the options.",
    spray: "Spray Brush — drag to scatter dots or the selected symbol.",
    deco: "Deco — vine, grid, symmetry, or flower.",
    bone: "Bone — drag from one joint or symbol to another to build an IK chain.",
    bind: "Bind — click a shape, then a bone.",
    bucket: "Paint Bucket — click a shape to fill it.",
    ink: "Ink Bottle — click a shape to apply the stroke.",
    dropper: "Eyedropper — sample fill and stroke.",
    eraser: "Eraser — drag to remove artwork. Faucet deletes a whole shape.",
    hand: "Hand — drag to pan. Space temporarily switches here.",
    zoom: "Zoom — click to enlarge, Alt-click to reduce, or drag a zoom rectangle.",
  };
  return hints[tool];
}

async function traceImage(href: string, w: number, h: number): Promise<SceneElement[]> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const cols = 28;
  const rows = Math.max(8, Math.round((h / w) * cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const cw = w / cols;
  const ch = h / rows;
  const pieces: SceneElement[] = [];
  for (let y = 0; y < rows; y++) {
    let run = -1;
    let color = "";
    const flush = (end: number) => {
      if (run < 0) return;
      pieces.push(makeElement({ kind: "rect", x: run * cw, y: y * ch, w: (end - run) * cw + 0.4, h: ch + 0.4, fill: { type: "solid", color, alpha: 1 }, stroke: null, name: "Trace" }));
      run = -1;
    };
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (data[i + 3] < 24) {
        flush(x);
        continue;
      }
      const next = `#${[data[i], data[i + 1], data[i + 2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      if (run < 0) {
        run = x;
        color = next;
      } else if (colorDist(color, next) > 28) {
        flush(x);
        run = x;
        color = next;
      }
    }
    flush(cols);
  }
  return pieces;
}

const WORDS = new Set("the and for with that this from your into stage frame layer shape motion design vector animation color text click drag play stop scene symbol group align left right center please ready keyline draw tween publish window object path line oval star brush pencil about their have will just into over when what with from they them than then into upon each both same into make made like into time line into into".split(/\s+/));
const TYPOS: Record<string, string> = { teh: "the", recieve: "receive", seperate: "separate", occured: "occurred", definate: "definite", wierd: "weird" };

export function storageKey() {
  return STORAGE;
}

export { resample, ease, nearestJoint, applyBinds, elementLayer, dist, aabb, lerpColor };
