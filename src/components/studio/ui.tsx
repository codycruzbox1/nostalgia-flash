import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as RPEvent } from "react";
import { createPortal } from "react-dom";
import { hexToRgb, hsbToRgb, rgbToHex, rgbToHsb } from "@/lib/studio/color";
import { useStudio } from "@/lib/studio/store";
import type { MenuEntry } from "@/lib/studio/types";

export function Tip({ label, side = "top", delay = 1000, children }: { label: string; side?: "top" | "right" | "bottom"; delay?: number; children: ReactNode }) {
  const showTips = useStudio((s) => s.prefs.showTooltips);
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const anchor = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    if (side === "right") setBox({ top: r.top + r.height / 2, left: r.right + 8 });
    else if (side === "bottom") setBox({ top: r.bottom + 6, left: r.left + r.width / 2 });
    else setBox({ top: r.top - 6, left: r.left + r.width / 2 });
  }, [open, side]);

  if (!showTips) return <>{children}</>;
  const bubble =
    open && label && box && typeof document !== "undefined"
      ? createPortal(
          <span
            role="tooltip"
            className={
              "pointer-events-none fixed z-[90] w-max max-w-56 rounded-sm bg-ink px-2 py-1 text-center text-2xs text-chrome shadow " +
              (side === "right" ? "-translate-y-1/2" : side === "bottom" ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-full")
            }
            style={{ top: box.top, left: box.left }}
          >
            {label}
          </span>,
          document.body,
        )
      : null;
  return (
    <span
      ref={anchor}
      className="relative inline-flex max-w-full"
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(true), delay);
      }}
      onPointerLeave={() => {
        window.clearTimeout(timer.current);
        setOpen(false);
        setBox(null);
      }}
    >
      {children}
      {bubble}
    </span>
  );
}

export function Btn({
  label,
  onClick,
  on,
  disabled,
  children,
  className = "",
  side = "bottom",
}: {
  label: string;
  onClick?: () => void;
  on?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom";
}) {
  return (
    <Tip label={label} side={side}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        data-on={on ? "true" : "false"}
        onClick={onClick}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm text-ink hover:bg-raised disabled:opacity-40 data-[on=true]:bg-sunken data-[on=true]:text-accent ${className}`}
      >
        {children}
      </button>
    </Tip>
  );
}

export function ScrubField({
  label,
  value,
  onChange,
  onScrubStart,
  onScrubEnd,
  min,
  max,
  step = 1,
  width = "w-16",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  min?: number;
  max?: number;
  step?: number;
  width?: string;
}) {
  const [text, setText] = useState(formatNum(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(formatNum(value));
  }, [value]);
  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(formatNum(value));
      return;
    }
    const clamped = clamp(roundTo(n, step), min, max);
    onChange(clamped);
    setText(formatNum(clamped));
  };
  return (
    <label className="flex min-w-0 items-center gap-1 text-2xs text-muted">
      <span
        className="w-5 shrink-0 cursor-ew-resize select-none text-faint"
        onPointerDown={(e) => {
          e.preventDefault();
          onScrubStart?.();
          const startX = e.clientX;
          const start = value;
          const move = (ev: PointerEvent) => {
            const next = clamp(roundTo(start + (ev.clientX - startX) * step, step), min, max);
            onChange(next);
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            onScrubEnd?.();
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        {label}
      </span>
      <input
        className={`${width} rounded-sm border border-line bg-sunken px-1 py-0.5 text-ink outline-none`}
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          focused.current = false;
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  return String(r);
}
function roundTo(n: number, step: number): number {
  const p = step < 1 ? 100 : 1;
  return Math.round(n * p) / p;
}
function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
}

export function MenuList({ items, onClose, align = "left" }: { items: MenuEntry[]; onClose: () => void; align?: "left" | "right" }) {
  const marker = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = marker.current?.parentElement;
    if (!anchor) return;
    const place = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const r = anchor.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      let left = align === "right" ? r.right - mw : r.left;
      let top = r.bottom;
      if (left + mw > window.innerWidth - 4) left = Math.max(4, window.innerWidth - mw - 4);
      if (left < 4) left = 4;
      if (mh > 0 && top + mh > window.innerHeight - 4) top = Math.max(4, window.innerHeight - mh - 4);
      setPos({ top, left });
    };
    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [align, items]);

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[80] min-w-56 border border-line bg-panel py-1 text-xs shadow-lg"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.sep ? (
          <div key={`s-${i}`} className="my-1 h-px bg-line" />
        ) : (
          <MenuRow key={item.label ?? i} item={item} onClose={onClose} />
        ),
      )}
    </div>
  );

  return (
    <>
      <span ref={marker} className="sr-only" />
      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </>
  );
}

function MenuRow({ item, onClose }: { item: MenuEntry; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState({ flip: false, top: 0 });

  useLayoutEffect(() => {
    if (!open || !rowRef.current || !subRef.current) return;
    const row = rowRef.current.getBoundingClientRect();
    const box = subRef.current;
    const flip = row.right + box.offsetWidth > window.innerWidth - 4;
    let top = 0;
    if (row.top + box.offsetHeight > window.innerHeight - 4) top = window.innerHeight - 4 - box.offsetHeight - row.top;
    if (row.top + top < 4) top = 4 - row.top;
    setSub({ flip, top });
  }, [open, item.children]);

  return (
    <div ref={rowRef} className="relative" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        className="flex w-full items-center gap-3 px-3 py-1 text-left hover:bg-raised disabled:opacity-40"
        onClick={() => {
          if (item.children || item.disabled || !item.id) return;
          onClose();
          item.id && window.dispatchEvent(new CustomEvent("keyline-command", { detail: item.id }));
        }}
      >
        <span className="w-3 text-accent">{item.checked ? "✓" : ""}</span>
        <span className="flex-1 text-ink">{item.label}</span>
        {item.children ? <span className="text-faint">▸</span> : <span className="text-faint">{item.shortcut}</span>}
      </button>
      {open && item.children ? (
        <div
          ref={subRef}
          className={`absolute z-[81] min-w-52 border border-line bg-panel py-1 shadow-lg ${sub.flip ? "right-full" : "left-full"}`}
          style={{ top: sub.top }}
        >
          {item.children.map((child, i) =>
            child.sep ? <div key={i} className="my-1 h-px bg-line" /> : <MenuRow key={child.label ?? i} item={child} onClose={onClose} />,
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [onClose]);
  return (
    <div className="fixed z-50 min-w-48 border border-line bg-panel py-1 text-xs shadow-lg" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((item, i) =>
        item.sep ? (
          <div key={i} className="my-1 h-px bg-line" />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className="flex w-full items-center px-3 py-1 text-left hover:bg-raised disabled:opacity-40"
            onClick={() => {
              onClose();
              if (item.id) window.dispatchEvent(new CustomEvent("keyline-command", { detail: item.id }));
            }}
          >
            <span className="flex-1">{item.label}</span>
            <span className="ml-4 text-faint">{item.shortcut}</span>
          </button>
        ),
      )}
    </div>
  );
}

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-2xs text-muted">
      <span className="w-16 shrink-0">{label}</span>
      <input className="min-w-0 flex-1 rounded-sm border border-line bg-sunken px-1.5 py-1 text-ink" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ColorPicker({ color, alpha, onChange }: { color: string; alpha: number; onChange: (color: string, alpha: number) => void }) {
  const rgb = hexToRgb(color);
  const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
  const [h, setH] = useState(hsb.h);
  const [s, setS] = useState(hsb.s);
  const [v, setV] = useState(hsb.v);
  useEffect(() => {
    const next = rgbToHsb(rgb.r, rgb.g, rgb.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);
  const apply = (hh: number, ss: number, vv: number, a = alpha) => {
    setH(hh);
    setS(ss);
    setV(vv);
    const n = hsbToRgb(hh, ss, vv);
    onChange(rgbToHex(n.r, n.g, n.b), a);
  };
  const sat = (e: RPEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const ss = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width));
      const vv = Math.min(1, Math.max(0, 1 - (ev.clientY - box.top) / box.height));
      apply(h, ss, vv);
    };
    move(e.nativeEvent);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", move), { once: true });
  };
  return (
    <div className="w-52 space-y-2 p-2">
      <div
        className="relative h-28 w-full cursor-crosshair rounded-sm"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
        onPointerDown={sat}
      >
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <input aria-label="Hue" type="range" min={0} max={360} value={h} onChange={(e) => apply(Number(e.target.value), s, v)} className="w-full accent-accent" />
      <label className="flex items-center gap-2 text-2xs text-muted">
        A
        <input aria-label="Alpha" type="range" min={0} max={100} value={Math.round(alpha * 100)} onChange={(e) => onChange(color, Number(e.target.value) / 100)} className="w-full accent-accent" />
      </label>
      <input
        aria-label="Hex color"
        className="w-full rounded-sm border border-line bg-sunken px-1.5 py-1 text-xs"
        value={color}
        onChange={(e) => {
          const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next, alpha);
        }}
      />
    </div>
  );
}

export function Pop({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={onClose} />
      <div className={`absolute z-40 border border-line bg-panel shadow-lg ${className}`}>{children}</div>
    </>
  );
}
