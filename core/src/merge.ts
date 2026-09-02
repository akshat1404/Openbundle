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

/** Where a file outside this merge's own `order` actually lives — for chunking. */
export interface ExternalChunkTarget {
  /** The physical output filename that file's own chunk was written to. */
  outputFile: string;
  /** originalDeclaredName -> the real, possibly-collision-renamed identifier in that chunk. */
  finalNameOf: Map<string, string>;
}

export interface MergeOptions {
  /**
   * Files outside `order` this merge's own files may still statically
   * import from — target file -> where it really lives. Omit for a
   * normal whole-graph merge (today's behavior: every local file is in
   * `order`, so this case never comes up). Required when `order` is a
   * chunk-local subset and some of its files import something that
   * lives in a different chunk: merge emits a real cross-chunk `import`
   * statement for it instead of assuming everything shares one scope.
   */
  externalChunks?: Map<string, ExternalChunkTarget>;
}

export interface MergeResult {
  /** The flattened, collision-resolved source, one block per file, in stage 3's order. */
  code: string;
  collisions: MergeCollision[];
  /** The local file order actually used to produce `code` — stage 3's order, external nodes already excluded. */
  fileOrder: string[];
  /** Real AST statements per file — what later stages (tree-shaking, chunking) consume, not the text. */
  blocks: MergedFileBlock[];
  /** Every top-level declared name's real, final identifier, by file — unchanged names map to themselves. Lets other chunks resolve what to import from this one. */
  finalNames: Map<string, Map<string, string>>;
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
 * A second, unified pass then handles import aliasing — both the
 * ordinary kind (an import whose target is in this same merge's
 * `order`, so it gets flattened away) and, when `options.externalChunks`
 * is supplied, the cross-chunk kind (a target that lives in a different
 * chunk entirely): for every static import specifier, if the local
 * alias doesn't already match the real (possibly-renamed) name of what
 * it imports, that alias gets folded into the very same rename map and
 * rewired via the same Scope.rename call — one mechanism, not two. The
 * only difference cross-chunk makes is what happens to the import
 * *statement* itself: an in-chunk one is stripped (flattened into this
 * scope); a cross-chunk one survives as a real synthesized `import`,
 * grouped per target file, pointing at that chunk's real output file.
 *
 * Nothing is removed for being "unused" here — that's stage 5's job.
 * Local (in-chunk) import/export statements are stripped, since once
 * every file in this merge shares one scope there's nothing left for
 * them to link; an external (bare-specifier) import statement is left
 * completely untouched, per the project's scope boundary — it's never
 * opened, so merge has nothing to flatten it into.
 */
export function mergeModules(
  graph: DependencyGraph,
  order: string[],
  options: MergeOptions = {},
): MergeResult {
  const localOrder = order.filter((id) => graph.nodes.get(id)?.kind === "local");
  const localSet = new Set(localOrder);
  const externalChunks = options.externalChunks ?? new Map<string, ExternalChunkTarget>();

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

  // Every declared name's real final identifier — computed from pass 1
  // alone (import aliases below never touch a file's own declarations).
  const finalNames = new Map<string, Map<string, string>>();
  for (const filePath of localOrder) {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") continue;
    const names = new Map<string, string>();
    for (const name of topLevelDeclarationNames(node.module)) {
      names.set(name, renamesByFile.get(filePath)?.get(name) ?? name);
    }
    finalNames.set(filePath, names);
  }

  // Pass 2: rewire every static import alias to the real, final name of
  // whatever it imports. In-chunk targets get flattened as before;
  // cross-chunk targets get recorded as real demand instead.
  const crossChunkDemand = new Map<string, Map<string, Set<string>>>(); // targetOutputFile -> targetFile -> Set<finalNameInTarget>

  for (const filePath of localOrder) {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") continue;

    for (const imp of node.module.imports) {
      if (imp.kind !== "static" || isExternalSpecifier(imp.source)) continue;
      const targetFile = resolveRelativeImport(filePath, imp.source);

      if (localSet.has(targetFile)) {
        for (const spec of imp.specifiers) {
          const finalName = renamesByFile.get(targetFile)?.get(spec.imported) ?? spec.imported;
          if (spec.local !== finalName) {
            renameMapFor(renamesByFile, filePath).set(spec.local, finalName);
          }
        }
        continue;
      }

      const target = externalChunks.get(targetFile);
      if (!target) {
        throw new Error(
          `Openbundle: "${filePath}" imports "${targetFile}", which is outside this chunk, but no cross-chunk mapping was provided for it`,
        );
      }
      for (const spec of imp.specifiers) {
        const finalNameInTarget = target.finalNameOf.get(spec.imported) ?? spec.imported;
        if (spec.local !== finalNameInTarget) {
          renameMapFor(renamesByFile, filePath).set(spec.local, finalNameInTarget);
        }
        if (!crossChunkDemand.has(target.outputFile)) crossChunkDemand.set(target.outputFile, new Map());
        const byTarget = crossChunkDemand.get(target.outputFile)!;
        if (!byTarget.has(targetFile)) byTarget.set(targetFile, new Set());
        byTarget.get(targetFile)!.add(finalNameInTarget);
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

  // Prepend one synthesized `import` per distinct cross-chunk target
  // file, grouping every name this chunk actually needs from it.
  const crossChunkImportStatements: t.Statement[] = [];
  for (const [outputFile, byTargetFile] of crossChunkDemand) {
    const names = new Set<string>();
    for (const [, ns] of byTargetFile) for (const n of ns) names.add(n);
    crossChunkImportStatements.push(
      t.importDeclaration(
        [...names].map((n) => t.importSpecifier(t.identifier(n), t.identifier(n))),
        t.stringLiteral(`./${outputFile}`),
      ),
    );
  }

  const allBlocks: MergedFileBlock[] =
    crossChunkImportStatements.length > 0
      ? [{ file: "(chunk imports)", statements: crossChunkImportStatements }, ...blocks]
      : blocks;

  const code = allBlocks.map((b) => renderBlockCode(b.file, b.statements)).join("\n\n");

  return { code, collisions, fileOrder: localOrder, blocks: allBlocks, finalNames };
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
 * and any import-alias rewires (in-chunk or cross-chunk) — applied via
 * real scope tracking, then with local import/export wrappers stripped.
 * An external import statement is the only import shape that survives
 * here; a cross-chunk import is added separately, once per target file.
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
      // Every other import (in-chunk or cross-chunk) is dropped here —
      // in-chunk because it's now flattened into this scope, cross-chunk
      // because a combined replacement was already synthesized above.
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
