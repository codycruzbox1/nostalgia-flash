const COMMANDS = new Set([
  "stop",
  "play",
  "gotoAndPlay",
  "gotoAndStop",
  "nextFrame",
  "prevFrame",
  "trace",
  "playSound",
]);

export type Call = { name: string; args: string; line: number };

export function parseScript(script: string): { ok: true; calls: Call[] } | { ok: false; error: string; line: number } {
  const lines = script.split("\n");
  const calls: Call[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\/\/.*$/, "").trim();
    if (!raw) continue;
    const chunks = raw.split(";").map((c) => c.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const m = chunk.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
      if (!m) return { ok: false, error: `Unrecognized statement “${chunk}”.`, line: i + 1 };
      if (!COMMANDS.has(m[1])) return { ok: false, error: `Unknown command ${m[1]}().`, line: i + 1 };
      const quotes = m[2].match(/"/g);
      if (quotes && quotes.length % 2 === 1) return { ok: false, error: "Missing a closing quote.", line: i + 1 };
      let depth = 0;
      for (const ch of m[2]) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (depth < 0) return { ok: false, error: "Unbalanced parentheses.", line: i + 1 };
      }
      if (depth !== 0) return { ok: false, error: "Unbalanced parentheses.", line: i + 1 };
      calls.push({ name: m[1], args: m[2].trim(), line: i + 1 });
    }
  }
  return { ok: true, calls };
}

export function formatScript(script: string): string {
  return script
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("//")) return trimmed;
      return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function argString(args: string): string {
  const m = args.match(/^"([\s\S]*)"$/);
  return m ? m[1] : args.replace(/^"|"$/g, "");
}

export function argNumber(args: string): number {
  const n = Number(args);
  return Number.isFinite(n) ? n : 1;
}

export function highlightLine(line: string): { text: string; kind: "plain" | "comment" | "name" | "string" | "num" }[] {
  if (line.trim().startsWith("//")) return [{ text: line, kind: "comment" }];
  const parts: { text: string; kind: "plain" | "comment" | "name" | "string" | "num" }[] = [];
  const re = /(\/\/.*$|"[^"]*"|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*(?=\s*\())/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: line.slice(last, i), kind: "plain" });
    const t = m[0];
    const kind = t.startsWith("//") ? "comment" : t.startsWith('"') ? "string" : /^\d|-/.test(t) ? "num" : "name";
    parts.push({ text: t, kind });
    last = i + t.length;
    if (t.startsWith("//")) break;
  }
  if (last < line.length) parts.push({ text: line.slice(last), kind: "plain" });
  return parts;
}
