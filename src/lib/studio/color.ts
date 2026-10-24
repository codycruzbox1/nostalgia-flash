export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

export function colorDist(a: string, b: string): number {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return Math.hypot(A.r - B.r, A.g - B.g, A.b - B.b);
}

export function rgbToHsb(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsbToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function fillCss(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const SWATCHES = [
  "#1c1b19", "#3a3632", "#6b655c", "#a39c92", "#d9d3c8", "#fffcf7",
  "#5c1a1a", "#8f2d2d", "#d15b45", "#e09a3e", "#f0c27a", "#f6e7c1",
  "#1e3a34", "#2f6f62", "#7f9a62", "#b7c7a1", "#d5e0c8", "#eef3e6",
  "#1d3348", "#2f5578", "#6d8eae", "#a9c0d4", "#d5e2ec", "#eef3f7",
  "#3d2a4a", "#6b4c7a", "#a078b0", "#d2b4dc", "#eadcf0", "#f7f1f8",
  "#4a3218", "#8a5a2b", "#c4844a", "#e0b07a", "#f0d7b8", "#f8eee4",
];
