import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { DependencyGraph } from "./graph.js";
import type { ParsedModule } from "./parse.js";
import { isExternalSpecifier, resolveRelativeImport } from "./resolvePath.js";

/**
 * One resolved top-level naming collision: `file`'s own declaration of
 * `name` collided with an earlier file's declaration of the same name,
 * so it was renamed to `renamedTo` everywhere it's actually referenced
 * inside `file`.
 */
export interface MergeCollision {
  name: string;
  file: string;
  renamedTo: string;
}

/** One file's real, already-renamed, import/export-unwrapped statements. */
export interface MergedFileBlock {
  file: string;
  statements: t.Statement[];
}

export interface MergeResult {
  /** The flattened, collision-resolved source, one block per file, in stage 3's order. */
  code: string;
  collisions: MergeCollision[];
  /** The local file order actually used to produce `code` — stage 3's order, external nodes already excluded. */
  fileOrder: string[];
  /** Real AST statements per file — what later stages (tree-shaking, chunking) consume, not the text. */
  blocks: MergedFileBlock[];
}

/**
 * Flatten every local file's top-level code into one shared scope, in
 * the order stage 3 already produced.
 *
 * Collision detection (Task 1) is scope-based: only a file's real
 * top-level declarations (`ParsedModule.topLevelDeclarations`, which
 * already excludes anything nested in a function/block and excludes
 * import bindings) are collision candidates. Renaming (Task 2) uses
 * @babel/traverse's `Scope.rename`, which walks the same real binding
 * graph stage 2 built — it updates the declaration and every actual
 * reference to it, and by construction never touches an unrelated
 * binding, a shadowed inner variable, an object property key, or a
 * string literal that merely shares the spelling.
 *
 * A second, unified pass then handles import aliasing: for every static,
 * local import specifier, if the importing file's own local alias name
 * doesn't already match the real (possibly-just-renamed) name of the
 * thing it imports, that alias gets folded into the very same rename
 * map and rewired via the same Scope.rename call. A non-aliased import
 * (`local === imported`) resolves to a no-op through this exact path —
 * there's no separate "aliased" vs "non-aliased" branch.
 *
 * Nothing is removed for being "unused" here — that's stage 5's job.
 * Local import/export statements are stripped, since once every file
 * shares one scope there's nothing left for them to link; an external
 * (bare-specifier) import statement is left completely untouched, per
 * the project's scope boundary — it's never opened, so merge has
 * nothing to flatten it into.
 */
export function mergeModules(graph: DependencyGraph, order: string[]): MergeResult {
  const localOrder = order.filter((id) => graph.nodes.get(id)?.kind === "local");

  const usedNames = new Set<string>();
  const renamesByFile = new Map<string, Map<string, string>>();
  const collisions: MergeCollision[] = [];

  // Pass 1: collision detection among each file's own top-level declarations.
  for (const filePath of localOrder) {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") continue;

    for (const name of topLevelDeclarationNames(node.module)) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        continue;
      }
      const renamedTo = allocateFreeName(name, usedNames);
      usedNames.add(renamedTo);
      renameMapFor(renamesByFile, filePath).set(name, renamedTo);
      collisions.push({ name, file: filePath, renamedTo });
    }
  }

  // Pass 2: rewire every static, local import alias to the real, final
  // name of whatever it imports — computed from pass 1's renames, which
  // are already complete for every file by this point regardless of
  // processing order.
  for (const filePath of localOrder) {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") continue;

    for (const imp of node.module.imports) {
      if (imp.kind !== "static" || isExternalSpecifier(imp.source)) continue;
      const targetFile = resolveRelativeImport(filePath, imp.source);

      for (const spec of imp.specifiers) {
        const finalName = renamesByFile.get(targetFile)?.get(spec.imported) ?? spec.imported;
        if (spec.local !== finalName) {
          renameMapFor(renamesByFile, filePath).set(spec.local, finalName);
        }
      }
    }
  }

  const blocks: MergedFileBlock[] = localOrder.map((filePath) => {
    const node = graph.nodes.get(filePath);
    const statements =
      node && node.kind === "local"
        ? buildFileStatements(node.module, renamesByFile.get(filePath))
        : [];
    return { file: filePath, statements };
  });

  const code = blocks.map((b) => renderBlockCode(b.file, b.statements)).join("\n\n");

  return { code, collisions, fileOrder: localOrder, blocks };
}

function renameMapFor(byFile: Map<string, Map<string, string>>, file: string): Map<string, string> {
  let map = byFile.get(file);
  if (!map) {
    map = new Map();
    byFile.set(file, map);
  }
  return map;
}

function topLevelDeclarationNames(module: ParsedModule): string[] {
  return [...new Set(module.topLevelDeclarations.map((d) => d.name))];
}

function allocateFreeName(baseName: string, usedNames: Set<string>): string {
  let suffix = 1;
  let candidate = `${baseName}$${suffix}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName}$${suffix}`;
  }
  return candidate;
}

/**
 * Build one file's contribution as real statement nodes: its own AST,
 * cloned (never mutate the shared parsed module later stages still
 * need), with every rename for this file — its own collision renames
 * and any import-alias rewires — applied via real scope tracking, then
 * with local import/export wrappers stripped.
 */
function buildFileStatements(
  module: ParsedModule,
  fileRenames: Map<string, string> | undefined,
): t.Statement[] {
  const ast = t.cloneNode(module.ast, true);

  if (fileRenames && fileRenames.size > 0) {
    traverse(ast, {
      Program(path) {
        for (const [oldName, newName] of fileRenames) {
          path.scope.rename(oldName, newName);
        }
      },
    });
  }

  const body: t.Statement[] = [];
  for (const stmt of ast.program.body) {
    if (t.isImportDeclaration(stmt)) {
      // External imports keep the import statement untouched — they're
      // never opened, so there's nothing for merge to flatten it into.
      if (isExternalSpecifier(stmt.source.value)) body.push(stmt);
      continue;
    }

    if (t.isExportNamedDeclaration(stmt)) {
      if (stmt.declaration) body.push(stmt.declaration);
      continue; // bare `export { a, b }`: the bindings already exist, nothing to keep
    }

    if (t.isExportDefaultDeclaration(stmt)) {
      const decl = stmt.declaration;
      if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
        body.push(decl);
      } else {
        body.push(
          t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier("default_export"), decl as t.Expression),
          ]),
        );
      }
      continue;
    }

    body.push(stmt);
  }

  return body;
}

function renderBlockCode(file: string, statements: t.Statement[]): string {
  const fileNode = t.file(t.program(statements));
  const { code } = generate(fileNode, { comments: true });
  return `// ${file}\n${code}`;
}
