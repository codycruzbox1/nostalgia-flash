import type { DockGroup, Layout, PanelId } from "./types";

export const PANEL_IDS: PanelId[] = [
  "properties",
  "library",
  "color",
  "swatches",
  "align",
  "transform",
  "info",
  "actions",
];

export const PANEL_LABEL: Record<PanelId, string> = {
  properties: "Properties",
  library: "Library",
  color: "Color",
  swatches: "Swatches",
  align: "Align",
  transform: "Transform",
  info: "Info",
  actions: "Actions",
};

function g(id: string, tabs: PanelId[], height: number, collapsed = false): DockGroup {
  return { id, tabs, active: tabs[0], height, collapsed };
}

export function classicLayout(): Layout {
  return {
    timelinePlacement: "bottom",
    dockWidth: 292,
    timelineHeight: 188,
    iconized: false,
    showTools: true,
    showTimeline: true,
    hidden: [],
    floating: [],
    groups: [
      g("g-props", ["properties"], 34),
      g("g-lib", ["library"], 22),
      g("g-color", ["color", "swatches"], 24),
      g("g-geom", ["align", "transform", "info"], 20),
      g("g-act", ["actions"], 28, true),
    ],
  };
}

export function presetLayout(name: string): Layout | null {
  if (name === "Classic") return classicLayout();
  if (name === "Animator") {
    const layout = classicLayout();
    layout.timelinePlacement = "top";
    layout.timelineHeight = 230;
    layout.groups = [g("g-props", ["properties"], 28), g("g-geom", ["transform", "align"], 24), g("g-lib", ["library"], 22), g("g-act", ["actions"], 26, true)];
    layout.hidden = ["color", "swatches", "info"];
    return layout;
  }
  if (name === "Designer") {
    const layout = classicLayout();
    layout.groups = [
      g("g-props", ["properties"], 26),
      g("g-color", ["color", "swatches"], 30),
      g("g-align", ["align", "transform"], 22),
      g("g-lib", ["library"], 22),
    ];
    layout.hidden = ["info", "actions"];
    return layout;
  }
  if (name === "Developer") {
    const layout = classicLayout();
    layout.groups = [g("g-act", ["actions"], 46), g("g-props", ["properties"], 28), g("g-lib", ["library"], 26)];
    layout.hidden = ["color", "swatches", "align", "transform", "info"];
    return layout;
  }
  if (name === "Essentials") {
    const layout = classicLayout();
    layout.dockWidth = 260;
    layout.groups = [g("g-props", ["properties"], 55), g("g-lib", ["library"], 45)];
    layout.hidden = ["color", "swatches", "align", "transform", "info", "actions"];
    return layout;
  }
  if (name === "Debug") {
    const layout = classicLayout();
    layout.groups = [g("g-act", ["actions"], 40), g("g-info", ["info", "properties"], 30), g("g-lib", ["library"], 30)];
    layout.hidden = ["color", "swatches", "align", "transform"];
    return layout;
  }
  return null;
}

export const PRESET_NAMES = ["Classic", "Animator", "Designer", "Developer", "Essentials", "Debug"];

export function panelLocation(layout: Layout, id: PanelId): "hidden" | "float" | "dock" {
  if (layout.hidden.includes(id)) return "hidden";
  if (layout.floating.some((f) => f.id === id)) return "float";
  if (layout.groups.some((g) => g.tabs.includes(id))) return "dock";
  return "hidden";
}

export function stripPanel(layout: Layout, id: PanelId): Layout {
  return {
    ...layout,
    hidden: layout.hidden.filter((p) => p !== id),
    floating: layout.floating.filter((f) => f.id !== id),
    groups: layout.groups
      .map((group) => {
        const tabs = group.tabs.filter((t) => t !== id);
        const active = tabs.includes(group.active) ? group.active : tabs[0];
        return { ...group, tabs, active };
      })
      .filter((group) => group.tabs.length > 0),
  };
}

export function showPanel(layout: Layout, id: PanelId): Layout {
  if (panelLocation(layout, id) === "dock" || panelLocation(layout, id) === "float") {
    return { ...layout, hidden: layout.hidden.filter((p) => p !== id) };
  }
  return {
    ...layout,
    hidden: layout.hidden.filter((p) => p !== id),
    floating: layout.floating.filter((f) => f.id !== id),
    groups: [...layout.groups, g(`g-${id}-${layout.groups.length}`, [id], 24)],
  };
}
