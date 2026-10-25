# Nostalgia Flash

A browser-based vector animation studio modeled on the classic Macromedia/Adobe Flash authoring tool. Draw on a stage, animate on a layered timeline, script frames with simple ActionScript-style commands, and publish the result as a standalone HTML page or SVG.

Everything runs client-side: there is no backend, no account, and no database. Your work autosaves to the browser's `localStorage`.

## Features

- **Drawing tools**: Selection, Subselection, Free/Gradient Transform, 3D Rotation/Translation, Lasso, Pen, Text, Line, Rectangle, Oval, PolyStar, Pencil, Brush, Spray Brush, Deco, Bone, Bind, Paint Bucket, Ink Bottle, Eyedropper, Eraser, Hand and Zoom, each with a classic single-key shortcut (V, A, Q, P, T, R, O, B, …).
- **Fills and strokes**: solid colors and linear/radial gradients, with swatches and a color panel.
- **Timeline**: layers (normal, mask/masked, guide/guided, folders), keyframes, and motion, shape and classic tweens with easing, shape hints, frame labels and sounds. Supports multiple scenes.
- **Symbols and library**: graphic, movie clip and button symbols, organized in library folders.
- **Frame scripts**: an Actions panel (F9) that accepts a small ActionScript-like language: `stop()`, `play()`, `gotoAndPlay()`, `gotoAndStop()`, `nextFrame()`, `prevFrame()`, `trace()` and `playSound()`.
- **Bones / IK**: armatures with element binding.
- **Workspace**: dockable, tabbed and floating panels (Properties, Library, Color, Swatches, Align, Transform, Info, Actions), saved workspace layouts, a full menu bar, and a command palette.
- **Files**:
  - Save/Open documents as `.nostalgia.json` (Ctrl+S / Ctrl+O)
  - Import SVG, images (PNG/JPG/WebP) or JSON documents (Ctrl+R)
  - Export the current frame as SVG (Ctrl+Shift+E)
  - Publish the animation as a self-contained HTML player or as SVG (Ctrl+F12)
  - Save documents as templates and reopen recent files

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router) on [Vite](https://vite.dev)
- [zustand](https://github.com/pmndrs/zustand) for editor state (`src/lib/studio/store.ts`)
- Tailwind CSS v4 and Radix UI primitives
- TypeScript throughout

## Project layout

```text
src/
  routes/index.tsx         # Single route; renders <Studio />
  components/studio/       # Editor UI: Studio shell, stage, timeline, tools, dock panels, dialogs, menus
  lib/studio/              # Editor core: document model, geometry, color, tweening,
                           # frame-script parser, publish/export, zustand store
public/                    # Favicon and share-card images
```

The rest of the repo (`scripts/`, `server/`, `src/lib/auth`, `src/lib/app-data`, `public/__grok/`, `AGENTS.md`) is scaffolding from the Grok App Builder template the project was generated with. Auth and database support exist in that template but are not used by this app.

## Running locally

Requires **Node.js 22+** and npm.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:8080>. The dev server binds to `0.0.0.0:8080`, so other devices on your network can reach it too.

### Other scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run build`     | Production build (output in `.output/`)              |
| `npm run preview`   | Serve the production build locally                   |
| `npm run typecheck` | Run the TypeScript compiler without emitting files   |
| `npm run lint`      | Run ESLint                                           |
| `npm run format`    | Format the codebase with Prettier                    |
| `npm test`          | Run the template's Node test suites                  |

Always start the app through these npm scripts rather than calling `vite` directly: they go through `scripts/with-app-env.mjs`, which loads the template's build flags.

`startup.sh` is used only by the Grok sandbox (it assumes a `/workspace` directory); you don't need it to run the app locally.

## Deployment

The project is configured for Vercel (`vercel.json`). `npm run build` also runs `npm run db:migrate`. That step is skipped when `DATABASE_URL` isn't set, which is the normal case locally; the app itself never touches a database.
