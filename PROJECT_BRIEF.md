# Project Brief — Openbundle

## What This Is

**Openbundle** is a real, working JavaScript bundler, plus an interactive website that visualizes its own real internal analysis, five stages, one shared engine. The name is literal, not a slogan, the bundling is real, and the internals are actually visible, not simulated for the sake of looking visible. Not a toy demo wired to fake output, and not a production-grade bundler either. The target is: correct on real code within a deliberately scoped boundary, honest about what falls outside that boundary.

The illustrator is not a separate simplified version of the logic. It renders the exact same graph, order, merge, tree-shake, and chunk data the bundler itself produced for whatever project it just ran on.

## Non-Negotiable Architecture

Two clean halves, kept genuinely separate:

- **`core/`** — the engine. Parser integration, resolver, orderer, merger, tree-shaker, chunker. Plain, framework-free JS/TS modules. No UI code. No DOM. Fully unit-testable on their own.
- **`web/`** — the site. Calls into `core/` for everything. Never reimplements or duplicates any bundling logic itself. Its only jobs are file upload, entry-point confirmation, and rendering what `core/` already computed.

This separation is required, not a style preference. It's what makes each stage reviewable in isolation.

## Tech Decisions Already Made

- **Parser: `@babel/parser` + `@babel/traverse`.** Not chosen for being lightweight, chosen because `@babel/traverse`'s built-in scope tracking is the actual primitive this project needs, knowing which identifier is bound where, what shadows what, what references what. Building that ourselves on top of a bare AST would just reintroduce the same risk this project exists to avoid.
- **Client-side only, no server.** Uploaded folders are never sent anywhere. Everything, parsing, resolution, the full pipeline, runs in the browser. This is a stated design goal, not an implementation detail, and should be visible to the end user somewhere in the UI.
- **Website, not a CLI.** A sample project ships built in. Users can also upload their own folder.

## Scope Boundaries (Explicit, Not Accidental)

- ESM only. No CommonJS `require()` interop.
- Relative imports only (`./`, `../`) get resolved and followed into the graph.
- Bare specifiers (`import x from 'lodash'`) are classified as **external** at resolution time, kept as a real node in the graph, but never opened, never inlined, never tree-shaken into. The file that imports one keeps that import statement untouched in the output. This is a real, intentional category, not an error state, and should be visually distinct in the graph view.
- No `node_modules` resolution, no `package.json` main/exports field logic.
- No minification. No source maps. Both are separate concerns, out of scope entirely.
- Entry point is auto-detected (`package.json` main field, then conventional names like `index.js`, `src/index.js`), but always shown to the user for confirmation before anything runs. Never silently assumed.

## The Five Algorithms (Already Verified Correct Against Real Rollup Output)

Each of these was tested against real Rollup behavior earlier in this project's design process. The core engine's output must match this behavior on equivalent input:

1. **Resolution** — walk from the entry point, follow every static and dynamic import, build a real dependency graph. A file reachable more than once is only ever visited/parsed once (deduplication).
2. **Ordering** — topological sort of that graph. No file's code may be placed anywhere that would run before something it depends on.
3. **Merge** — scope-hoisted, flattened into one shared scope. Real naming collisions between independently-written top-level declarations get detected via actual scope analysis (not text matching) and renamed automatically (`format`, `format$1`, etc.).
4. **Tree-shaking** — mark-and-sweep reachability from the entry point's own root statements, walking real references, not string matches. Anything never reached is physically removed from output, not just flagged. Applies to both unreferenced declarations and provably side-effect-free bare statements; anything with a real, unprovable side effect is kept by default.
5. **Chunking** — any file reached only through a dynamic `import()` becomes its own chunk. Anything needed by more than one chunk gets extracted into a shared chunk instead of duplicated.

## Known Failure Modes From The First (Regex-Based) Attempt

Do not repeat these. They are exactly why this project uses a real parser instead of pattern matching:

- Import statements with destructuring (`import { x } from './y.js'`) got mis-split because a naive brace-depth counter couldn't tell an import's `{ }` apart from a function body's `{ }`.
- Renaming logic leaked across unrelated files, a collision in one file could incorrectly trigger a rename in a completely different, non-colliding file, because the rename step matched raw text globally instead of respecting file/scope boundaries.
- Tree-shaking briefly checked references against a declaration's original, un-renamed source text instead of its final code, losing track of which same-named identifier was which.
- A regex built from an identifier containing `$` (e.g. `format$1`) silently broke, since `$` is a regex metacharacter and wasn't escaped.

All four were caused by treating source code as text to pattern-match instead of structure to parse. A real AST with real scope tracking makes every one of these categorically impossible, not just less likely.

## Pipeline UI

The illustrator's pipeline view must resemble a real CI/CD pipeline (GitLab's pipeline view is the reference), not a row of plain labeled boxes. This is a durable structural requirement, every future stage that adds a new detail panel (merge, tree-shaking, chunking) must follow it, not just stage two's resolution view.

**Structure**: five labeled stage columns, `RESOLVE`, `ORDER`, `MERGE`, `SHAKE`, `CHUNK`, uppercase muted headers. One job card per column (the pipeline is strictly sequential, no parallel jobs). Cards connect to their neighbors with soft curved connector lines, not straight lines or arrows.

**Each job card** shows a status icon, the job's name, and a status line beneath it, duration and outcome once run, `not started` in muted gray before then.

**Three visual states, consistently applied everywhere a job card appears**:
- Passed — green filled circle with a check icon, plain border, normal text weight
- Failed — red filled circle with an X icon, red border, pale red background tint on the whole card
- Not started — hollow gray ring icon, muted gray text throughout, no border emphasis

**Interaction**: clicking a passed job card opens a detail panel below the row showing that job's real, actual computed output, never placeholder or fake data. Clicking a not-started card honestly shows it hasn't run. Only one detail panel open at a time.

**Detail panel content is stage-specific and must be designed deliberately, not defaulted to the same generic layout for every stage**: resolution renders the dependency graph as an actual node-and-edge diagram, real nodes positioned in space (by depth from the entry point is the established approach), real connecting lines between a file and what it imports, solid for static edges and dashed for dynamic ones, not a text summary of node/edge counts with a flat list of filename badges standing in for it, that undersells the word "graph" and was a real gap the first time this got built. Ordering shows the sorted sequence, merge shows the actual merged code with collisions highlighted, tree-shaking shows kept versus removed declarations, chunking shows the real output chunk cards. Each of these gets designed when its own stage is built, this section only fixes the surrounding shell, the columns, cards, states, and click behavior, so every stage's detail panel lives inside a consistent pipeline instead of five independently-styled sections.

## Deployment

Openbundle deploys to GitHub Pages, no backend, matching the project's own client-side-only architecture. Served from a project-repo subpath (`/Openbundle/`), not a domain root, `vite.config.ts` must set `base` accordingly or every built asset reference breaks silently. Deployed automatically via GitHub Actions on every push to `master`, using GitHub's own Pages deployment actions, not a third-party `gh-pages` branch action.

## Test Fixtures — Single Source Of Truth

The sample project must exist as real, on-disk files, not duplicated as a hardcoded string array anywhere. One canonical location:

```
fixtures/
  sample-project/
    index.js
    config.js
    utilsA.js
    utilsB.js
    sharedHelper.js
    featureA.js
    featureB.js
  external-import/
    index.js
    localHelper.js
  merge-collisions/
    index.js
    a.js
    b.js
    c.js
  tree-shaking/
    index.js
    chain.js
    stepB.js
    stepC.js
```

`core`'s test suite reads `fixtures/sample-project/` directly off disk (via Node's `fs`) to test resolution, ordering, merge, tree-shaking, and chunking against real files, the same files whose expected behavior was already verified against real Rollup output during design.

`web`'s built-in sample project must load from this same folder at build time (Vite's `import.meta.glob` with raw string imports is the natural fit), not from a separately maintained TypeScript array. If stage one already created a hardcoded `sampleProject.ts` array, migrate it to read from `fixtures/sample-project/` instead, one canonical copy, never two.

`fixtures/external-import/` is a second, small, dedicated fixture solely for testing bare-specifier classification, it should contain a genuine `import` of something that isn't a real installed package (e.g. `import axios from 'axios'`) purely as a string the resolver must recognize as external and refuse to follow, alongside one real local file it does follow. Do not add external imports to `sample-project/`, that fixture's exact contents are already verified against real Rollup output and should stay untouched.

`fixtures/merge-collisions/` is a third, small, dedicated fixture solely for testing merge's collision-renaming: `a.js` and `b.js` each declare their own top-level `shared` (a real collision), `c.js` is deliberately unrelated — its own local variable named `shared` inside a function, plus an object property key and a string literal that both happen to spell `shared` — none of which are collision candidates and none of which may ever be touched by a rename happening in `a.js`/`b.js`.

`fixtures/tree-shaking/` is a fourth, small, dedicated fixture for testing reachability: `index.js` calls `runA()` (chain.js), which calls `stepB()` (stepB.js), which calls `stepC()` (stepC.js) — a real three-level transitive chain, only `runA` directly visible from the entry's own root statement. `index.js` also declares `unusedHelper` (never called, must be removed), a bare `5 + 3;` (provably side-effect-free, must be removed), and a bare `sideEffect();` call (provably not side-effect-free, must be kept by default).

## Testing Discipline

Every stage ships with real, automated tests before being considered done. At minimum, tests must assert:

- A genuine naming collision between two independently-declared top-level identifiers gets renamed correctly, and unrelated identically-named-but-unrelated declarations in other files are left untouched.
- An unreferenced declaration is removed from output; a declaration referenced only transitively (A calls B calls C) is kept.
- A bare, side-effect-free expression statement is removed; a bare statement with a real side effect (e.g. a function call) is kept by default.
- Two files, each dynamically imported, that both statically import the same third file, produce three physical output chunks, not two, with the shared file extracted rather than duplicated.
- A bare specifier import is classified as external, appears in the graph, and is never opened or inlined.

## Build Plan — Staged, One Commit/PR Per Stage

Do not attempt multiple stages in one pass. Each stage should be small enough to actually review as a diff.

1. **Scaffolding** — repo structure, `core/` and `web/` split, site shell, folder upload handling. No real bundling logic yet.
2. **Parsing + Resolution** — Babel integration, dependency graph construction, external-package classification, entry-point detection and confirmation UI.
3. **Ordering** — topological sort.
4. **Merge** — real scope-based collision detection and renaming. Slow down here specifically, this is where the first attempt broke three separate times.
5. **Tree-shaking** — real reachability analysis against the AST/scope data.
6. **Chunking** — dynamic import boundaries, shared-chunk extraction, output file generation.
7. **Illustrator wiring** — connect the UI to each stage's real, already-computed output. No new bundling logic should be written in this stage.