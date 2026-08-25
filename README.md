# Openbundle

Openbundle is a real, working JavaScript bundler with a website that shows its own
internal analysis while it runs — the same dependency graph, ordering, merge,
tree-shaking, and chunking data the engine actually produced, not a simplified
stand-in for it.

- **`core/`** — the bundling engine (parse, resolve, order, merge, tree-shake, chunk).
  Framework-free, fully unit-testable on its own.
- **`web/`** — the site. Uploads a project, confirms the entry point, and renders
  whatever `core/` computed. It never reimplements bundling logic itself.

Everything runs client-side, in the browser. Uploaded code is never sent anywhere.

Scope is deliberately limited (ESM only, relative imports only, no `node_modules`
resolution, no minification/source maps). See [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)
for the full architecture, scope boundaries, and staged build plan.

## Status

Stage 1 of 7: scaffolding only. No parsing, resolution, or bundling logic yet.

## Development

Requires Node 20+.

```sh
npm install

# run core's test suite
npm test

# run the web dev server
npm run dev
```
