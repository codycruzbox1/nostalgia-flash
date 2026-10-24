export type Point = { x: number; y: number };

export type TweenKind = "none" | "motion" | "shape" | "classic";

export type Fill =
  | { type: "none" }
  | { type: "solid"; color: string; alpha: number }
  | {
      type: "linear" | "radial";
      stops: { offset: number; color: string; alpha: number }[];
      angle: number;
      cx: number;
      cy: number;
      rx: number;
      focal: number;
    };

export type Stroke = {
  color: string;
  alpha: number;
  width: number;
  cap: "butt" | "round" | "square";
  join: "miter" | "round" | "bevel";
};

export type Anchor = {
  x: number;
  y: number;
  inX: number | null;
  inY: number | null;
  outX: number | null;
  outY: number | null;
};

export type ElementKind =
  | "rect"
  | "oval"
  | "line"
  | "path"
  | "text"
  | "polystar"
  | "symbol"
  | "group"
  | "spray"
  | "bitmap";

export type SceneElement = {
  id: string;
  name: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  regX: number;
  regY: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  z: number;
  alpha: number;
  visible: boolean;
  locked: boolean;
  blend: string;
  fill: Fill;
  stroke: Stroke | null;
  cornerRadius: number;
  startAngle: number;
  endAngle: number;
  anchors: Anchor[];
  closed: boolean;
  rawD: string;
  morphD: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  underline: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  textType: "static" | "dynamic" | "input";
  antialias: "device" | "animation" | "readability" | "custom";
  sides: number;
  star: boolean;
  innerRatio: number;
  symbolId: string | null;
  children: SceneElement[];
  dots: { x: number; y: number; r: number }[];
  shadow: boolean;
  instanceName: string;
  href: string;
  fillLocked: boolean;
};

export type Bone = {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  tx: number;
  ty: number;
};

export type Bind = {
  elementId: string;
  boneId: string;
  u: number;
  v: number;
  rot: number;
};

export type ShapeHint = {
  id: string;
  letter: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
};

export type Span = {
  id: string;
  start: number;
  end: number;
  key: boolean;
  tween: TweenKind;
  ease: number;
  elements: SceneElement[];
  script: string;
  label: string;
  sound: string;
  hints: ShapeHint[];
  armature: Bone[];
  binds: Bind[];
};

export type LayerType = "normal" | "mask" | "masked" | "guide" | "guided" | "folder";

export type Layer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  outline: boolean;
  color: string;
  parentId: string | null;
  collapsed: boolean;
  spans: Span[];
};

export type Guide = { id: string; orientation: "h" | "v"; pos: number };

export type Scene = {
  id: string;
  name: string;
  layers: Layer[];
  frameCount: number;
  guides: Guide[];
};

export type SymbolType = "graphic" | "movieclip" | "button";

export type SymbolItem = {
  id: string;
  name: string;
  type: SymbolType;
  elements: SceneElement[];
  folderId: string | null;
};

export type LibFolder = { id: string; name: string };

export type Doc = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  activeSceneId: string;
  scenes: Scene[];
  library: SymbolItem[];
  folders: LibFolder[];
};

export type ToolId =
  | "select"
  | "subselect"
  | "free"
  | "gradient"
  | "rot3d"
  | "move3d"
  | "lasso"
  | "pen"
  | "text"
  | "line"
  | "rect"
  | "oval"
  | "polystar"
  | "pencil"
  | "brush"
  | "spray"
  | "deco"
  | "bone"
  | "bind"
  | "bucket"
  | "ink"
  | "dropper"
  | "eraser"
  | "hand"
  | "zoom";

export type ToolOpts = {
  activeWell: "fill" | "stroke";
  fill: Fill;
  stroke: Stroke | null;
  rectPrimitive: boolean;
  ovalPrimitive: boolean;
  polyStar: boolean;
  polySides: number;
  polyInner: number;
  pencilMode: "straighten" | "smooth" | "ink";
  brushSize: number;
  brushShape: "round" | "square" | "flat";
  pressure: boolean;
  lockFill: boolean;
  spraySymbols: boolean;
  decoMode: "vine" | "grid" | "symmetry" | "flower";
  lassoPoly: boolean;
  lassoMagic: boolean;
  magicThreshold: number;
  magicSmoothing: number;
  penMode: "pen" | "add" | "delete" | "convert";
  textType: "static" | "dynamic" | "input";
  antialias: "device" | "animation" | "readability" | "custom";
  eraserMode: "normal" | "fills" | "strokes" | "inside" | "faucet";
  gapSize: "none" | "small" | "medium" | "large";
};

export type PanelId =
  | "properties"
  | "library"
  | "color"
  | "swatches"
  | "align"
  | "transform"
  | "info"
  | "actions";

export type DockGroup = {
  id: string;
  tabs: PanelId[];
  active: PanelId;
  height: number;
  collapsed: boolean;
};

export type FloatWin = { id: PanelId; x: number; y: number; w: number; h: number };

export type Layout = {
  timelinePlacement: "bottom" | "top";
  dockWidth: number;
  timelineHeight: number;
  iconized: boolean;
  showTools: boolean;
  showTimeline: boolean;
  groups: DockGroup[];
  floating: FloatWin[];
  hidden: PanelId[];
};

export type Workspace = { name: string; layout: Layout };

export type PreviewMode = "full" | "outlines" | "fast" | "antialias";

export type DialogState =
  | { type: "new" }
  | { type: "saveAs" }
  | { type: "template" }
  | { type: "publish" }
  | { type: "page" }
  | { type: "prefs" }
  | { type: "shortcuts" }
  | { type: "find" }
  | { type: "polystar" }
  | { type: "symbol"; ids: string[] }
  | { type: "about" }
  | { type: "help" }
  | { type: "layer"; layerId: string }
  | { type: "label" }
  | { type: "spell" }
  | { type: "commands" }
  | { type: "moreCommands" }
  | { type: "pasteSpecial" }
  | { type: "grid" }
  | { type: "confirm"; message: string; continueId: string }
  | { type: "document" }
  | { type: "scene" }
  | { type: "workspace" }
  | { type: "welcome" };

export type MenuEntry = {
  id?: string;
  label?: string;
  shortcut?: string;
  sep?: boolean;
  disabled?: boolean;
  checked?: boolean;
  children?: MenuEntry[];
  danger?: boolean;
};

export type RecentFile = { id: string; name: string; savedAt: number; doc: Doc };

export type SavedCommand = { id: string; name: string; kind: "builtin" | "script"; script: string };

export type Prefs = {
  grid: number;
  autosave: boolean;
  showTooltips: boolean;
  undoLimit: number;
  pageSize: "letter" | "a4" | "stage";
  orientation: "landscape" | "portrait";
  margin: number;
  publishLoop: boolean;
  publishFormat: "html" | "svg";
};

export type FrameRange = { layerId: string; start: number; end: number } | null;

export type HistItem = { label: string; doc: Doc };
