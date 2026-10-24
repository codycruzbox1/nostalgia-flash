import type { ReactNode } from "react";
import type { ToolId } from "@/lib/studio/types";

export function Glyph({ d, children, filled = false }: { d?: string; children?: ReactNode; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      {d ? <path d={d} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {children}
    </svg>
  );
}

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function ToolGlyph({ tool }: { tool: ToolId }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      {draw(tool)}
    </svg>
  );
}

function draw(tool: ToolId): ReactNode {
  switch (tool) {
    case "select":
      return <path d="M5 3.5 5 18.5 9.2 14.6 12.4 20.2 14.6 19.2 11.4 13.6 17 13.2 Z" fill="currentColor" stroke="none" />;
    case "subselect":
      return <path d="M6 4 6 17 9.6 13.8 12.2 18.6 14 17.8 11.4 13 16.2 12.6 Z" {...S} />;
    case "free":
      return (
        <>
          <rect x="5" y="6" width="14" height="12" {...S} />
          {[5, 12, 19].map((x) => [6, 12, 18].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
        </>
      );
    case "gradient":
      return (
        <>
          <rect x="4" y="6" width="16" height="12" {...S} />
          <path d="M7 12h10" {...S} />
          <circle cx="7" cy="12" r="1.4" fill="currentColor" />
          <circle cx="17" cy="12" r="1.4" fill="currentColor" />
        </>
      );
    case "rot3d":
      return (
        <>
          <ellipse cx="12" cy="12" rx="7" ry="3.2" {...S} />
          <ellipse cx="12" cy="12" rx="3.2" ry="7" {...S} />
          <circle cx="12" cy="12" r="7" {...S} />
        </>
      );
    case "move3d":
      return (
        <>
          <path d="M12 4v16M4 12h16M12 12l5-5" {...S} />
          <path d="M12 4 10 6.5M12 4l2 2.5M20 12l-2.5-2M20 12l-2.5 2M17 7l-1.2 2.2M17 7l-2.4-.4" {...S} />
        </>
      );
    case "lasso":
      return <path d="M8 5c5-2 10 1 9 5-1 5-8 4-8 8 0 3 6 2 7-1" {...S} />;
    case "pen":
      return <path d="M14 4.5 19.5 10 9 20.5 4 21.2 4.7 16.2 Z" {...S} />;
    case "text":
      return <path d="M6 6h12M12 6v13M8 19h8" {...S} />;
    case "line":
      return <path d="M5 19 19 5" {...S} />;
    case "rect":
      return <rect x="5" y="6" width="14" height="12" {...S} />;
    case "oval":
      return <ellipse cx="12" cy="12" rx="7" ry="5.5" {...S} />;
    case "polystar":
      return <path d="M12 3.5 14.4 9l5.8.5-4.4 3.7 1.4 5.6L12 16.2 6.8 18.8 8.2 13.2 3.8 9.5 9.6 9 Z" {...S} />;
    case "pencil":
      return <path d="M14 4.2 19.8 10 8.5 21H4v-4.4Z" {...S} />;
    case "brush":
      return <path d="M14 4c2 2 3 4 2 6l-8 8c-1 1-3 .5-3.5-.5S5 15 6 14l8-8c2-1 0-2 0-2Z" {...S} />;
    case "spray":
      return (
        <>
          <circle cx="8" cy="14" r="1" fill="currentColor" />
          <circle cx="12" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
          <circle cx="11" cy="17" r="1" fill="currentColor" />
          <circle cx="16" cy="9" r="0.8" fill="currentColor" />
          <circle cx="7" cy="9" r="0.8" fill="currentColor" />
        </>
      );
    case "deco":
      return (
        <>
          <circle cx="12" cy="12" r="2" {...S} />
          <path d="M12 5v3M12 16v3M5 12h3M16 12h3M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" {...S} />
        </>
      );
    case "bone":
      return (
        <>
          <circle cx="6" cy="16" r="2" {...S} />
          <circle cx="17" cy="7" r="2" {...S} />
          <path d="M7.6 14.6 15.2 8.6" {...S} />
        </>
      );
    case "bind":
      return (
        <>
          <path d="M12 3.5v9" {...S} />
          <path d="M8 8h8l-1.2 10.5a2.8 2.8 0 0 1-5.6 0Z" {...S} />
        </>
      );
    case "bucket":
      return <path d="M8 9h8l-1 9H9ZM7 6h10M10 6V4h4v2" {...S} />;
    case "ink":
      return <path d="M10 3h4l1 4H9ZM9 7h6v3c0 5-1.2 9-3 9s-3-4-3-9Z" {...S} />;
    case "dropper":
      return <path d="M14.5 4.5 19.5 9.5 12 17l-2 3-4-1 1.2-3.8Z" {...S} />;
    case "eraser":
      return <path d="M4 14.5 12.5 6a2 2 0 0 1 2.8 0L19 9.7a2 2 0 0 1 0 2.8L12 19.5H6.5Z" {...S} />;
    case "hand":
      return <path d="M8 11V6.5a1.3 1.3 0 0 1 2.6 0V11M10.6 10.2V5.8a1.3 1.3 0 0 1 2.6 0V11M13.2 10.5V7a1.3 1.3 0 0 1 2.6 0v6.2c0 3.2-1.6 6.3-5.2 6.3-3.2 0-4.8-2-5.4-3.6L8 11" {...S} />;
    case "zoom":
      return (
        <>
          <circle cx="10.5" cy="10.5" r="5.5" {...S} />
          <path d="M14.5 14.5 20 20M10.5 8v5M8 10.5h5" {...S} />
        </>
      );
    default:
      return null;
  }
}
