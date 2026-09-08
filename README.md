# JsonLens

A small JSON IDE with a really good diff viewer. Edit, validate, format and
compare JSON with an editor that behaves the way a developer expects.

Everything runs locally in the browser. There is no backend, no database, no
account, and no network request — the JSON never leaves the device.

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the parser, formatter and diff engine
npm run build      # static bundle in dist/
```

## What it does

- **Structural diff.** Comparison is by value, not by text. Reordered object
  keys and reformatted whitespace report *no structural changes*; a real edit
  reports `user.age  21 → 22`. Added, removed, modified and type-changed
  entries are listed separately, with array insertions aligned by an LCS so one
  inserted element doesn't cascade into "everything after this moved".
- **Side-by-side and unified diff**, backed by Monaco: synchronised scrolling,
  gutter markers, inline changed-token highlighting, and revert arrows.
- **A real editor** on both sides — folding, bracket matching, indent guides,
  multi-cursor, find and replace, sticky scroll, undo/redo.
- **Validation** with precise positions: `Expected ":" after property name
  (line 8, column 14)` in the status bar, clickable to jump to the line.
- **Format, minify and sort keys**, plus "Format Both Documents" to strip
  formatting noise out of the visual diff in one step.
- **Files stay local**: open, drag-and-drop (including two files at once to
  start a comparison), paste, rename, and download.
- **Command palette** (`⌘⇧A` / `Ctrl+Shift+A`) over every action in the app.

## Keyboard

Press `⌘/` (`Ctrl+/`) in the app for the full list. The essentials:

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Find action | `⌘⇧A` or `⌘⇧P` | `Ctrl+Shift+A` or `Ctrl+Shift+P` |
| Download JSON | `⌘S` | `Ctrl+S` |
| Format / Minify | `⌘⇧F` / `⌘⇧M` | `Ctrl+Shift+F` / `Ctrl+Shift+M` |
| Fold / unfold all | `⌘⌥[` / `⌘⌥]` | `Ctrl+Alt+[` / `Ctrl+Alt+]` |
| Fold / unfold at cursor | `⌘⇧[` / `⌘⇧]` | `Ctrl+Shift+[` / `Ctrl+Shift+]` |
| Next / previous difference | `⌥↓` / `⌥↑` | `Alt+↓` / `Alt+↑` |
| Compare / close comparison | `⌘⌥D` | `Ctrl+Alt+D` |
| Toggle diff layout | `⌘⌥L` | `Ctrl+Alt+L` |
| Find / Replace | `⌘F` / `⌥⌘F` | `Ctrl+F` / `Ctrl+H` |

Chords are declared once, in the action registry, and drive the menus, the
command palette, the shortcut sheet and the key handler alike — so what the
menu shows is what the keyboard does.

## Architecture

```
src/
  lib/
    json/parser.ts     Location-aware JSON parser: validation, error positions,
                       and a path → source-line index, all from one pass
    json/format.ts     Token-based pretty printer (format / minify / sort keys)
    diff/engine.ts     Structural diff with LCS array alignment
    analysis.ts        Parse + diff + line resolution; runs in the worker
    keys.ts            Chord parsing, matching and platform-aware rendering
  workers/             The analyzer, off the main thread
  editor/              Monaco bootstrap, themes, models, imperative registry
  state/               Document store, ephemeral UI state, analysis context
  actions/             The action registry — one source of truth for commands
  components/          Menu bar, panes, changes panel, palette, status bar
```

A few decisions worth knowing about:

- **Monaco models are the source of truth** for document text, and they outlive
  every editor instance. Switching between the editor and the diff view keeps
  content, undo history, folding and scroll position. React state mirrors the
  text for the status bar and the analyzer; it never writes back except for
  explicit commands, which apply as single undoable edits.
- **The formatter re-prints from JSON's own tokens** rather than round-tripping
  through `JSON.parse`/`JSON.stringify`. That preserves number literals exactly
  (`1e3`, `1.50`, integers past 2^53) and keeps key order, which a JS object
  round-trip silently rewrites for integer-like keys.
- **Parsing and diffing run in a Web Worker**, debounced, so typing in a large
  document never blocks the editor. Stale responses are dropped by comparing
  against the inputs currently on screen.
- **`src/editor/monaco.core.ts` is generated** by `scripts/gen-monaco-core.mjs`
  from Monaco's own entry point, keeping every editor feature while dropping
  the ~80 language grammars we never load. Re-run it after upgrading Monaco.

## Limits

- The change list is capped at 20,000 entries; past that the panel says the
  documents differ too widely to list in full.
- Array alignment falls back to positional pairing when an LCS table would
  exceed a million cells.
- The session (documents under 512 KB, plus settings) is kept in
  `localStorage` so a refresh doesn't lose work. It never goes anywhere else.
