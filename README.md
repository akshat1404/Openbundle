# Openbundle

**Live site: https://akshat1404.github.io/Openbundle/**

Openbundle is a real, working JavaScript bundler paired with a website that visualizes
its own internal analysis — the exact dependency graph, ordering, merge, tree-shaking,
and chunking data the engine actually produced for whatever project it just ran on, not
a simplified stand-in built to look visible. Not a toy demo wired to fake output, and
not a production-grade bundler either: correct on real code within a deliberately scoped
boundary, honest about what falls outside that boundary.

Everything runs client-side, entirely in the browser. Uploaded code is never sent
anywhere — parsing, resolution, and the full pipeline all execute locally.

## What it does

Given an entry point, Openbundle:

1. **Resolves** — walks every static and dynamic import from the entry point outward
   into a real dependency graph. A file reachable more than once is only ever parsed
   once.
2. **Orders** — topologically sorts that graph so no file's code can run before
   something it depends on.
3. **Merges** — scope-hoists everything into one shared scope. Real naming collisions
   between independently-written top-level declarations are detected via actual scope
   analysis (not text matching) and renamed automatically.
4. **Tree-shakes** — mark-and-sweep reachability from the entry point's own root
   statements, walking real references. Anything never reached is physically removed;
   anything with a real, unprovable side effect is kept by default.
5. **Chunks** — any file reached only through a dynamic `import()` becomes its own
   chunk. Anything needed by more than one chunk is extracted into a shared chunk
   instead of duplicated.

The site's illustrator isn't a separate, simplified version of this logic — it renders
the same graph, order, merge, tree-shake, and chunk data the engine itself computed.

## Scope boundaries

Deliberate, not accidental:

- ESM only — no CommonJS `require()` interop.
- Relative imports only (`./`, `../`) are resolved and followed. Bare specifiers
  (`import x from 'lodash'`) are classified as **external**, kept as a real node in the
  graph, but never opened, inlined, or tree-shaken into.
- No `node_modules` resolution, no `package.json` main/exports field logic.
- No minification, no source maps — both out of scope entirely.
- The entry point is auto-detected (`package.json` main field, then conventional names
  like `index.js`) but always shown to the user for confirmation before anything runs.

See [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) for the full architecture and design
rationale.

## Architecture

- **`core/`** — the bundling engine (parse, resolve, order, merge, tree-shake, chunk).
  Plain, framework-free JS/TS. No UI code, no DOM. Fully unit-testable on its own, using
  `@babel/parser` and `@babel/traverse` for real parsing and scope tracking.
- **`web/`** — the site. Handles file upload, entry-point confirmation, and rendering
  whatever `core/` computed. It never reimplements or duplicates any bundling logic
  itself — `web/` depends on `core/`, never the reverse.

A built-in sample project ships with the site; users can also upload their own folder.

## Development

Requires Node 20+.

```sh
npm install

# run core's test suite
npm test

# run the web dev server
npm run dev
```

## Deployment

Deploys to GitHub Pages automatically via GitHub Actions on every push to `master`
(`.github/workflows/deploy.yml`).
