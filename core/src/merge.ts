import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { DependencyGraph } from "./graph.js";
import type { ParsedModule } from "./parse.js";

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

export interface MergeResult {
  /** The flattened, collision-resolved source, one block per file, in stage 3's order. */
  code: string;
  collisions: MergeCollision[];
  /** The local file order actually used to produce `code` — stage 3's order, external nodes already excluded. */
  fileOrder: string[];
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
 * Nothing is removed for being "unused" here — that's stage 5's job.
 * import/export statements themselves are stripped, since once every
 * file shares one scope there's nothing left for them to link.
 */
export function mergeModules(graph: DependencyGraph, order: string[]): MergeResult {
  const localOrder = order.filter((id) => graph.nodes.get(id)?.kind === "local");

  const usedNames = new Set<string>();
  const renamesByFile = new Map<string, Map<string, string>>();
  const collisions: MergeCollision[] = [];

  for (const filePath of localOrder) {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") continue;

    const fileRenames = new Map<string, string>();
    for (const name of topLevelDeclarationNames(node.module)) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        continue;
      }
      const renamedTo = allocateFreeName(name, usedNames);
      usedNames.add(renamedTo);
      fileRenames.set(name, renamedTo);
      collisions.push({ name, file: filePath, renamedTo });
    }

    if (fileRenames.size > 0) renamesByFile.set(filePath, fileRenames);
  }

  const blocks = localOrder.map((filePath) => {
    const node = graph.nodes.get(filePath);
    if (!node || node.kind !== "local") return ""; // unreachable, filtered above
    return renderFileBlock(filePath, node.module, renamesByFile.get(filePath));
  });

  return { code: blocks.join("\n\n"), collisions, fileOrder: localOrder };
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
 * Render one file's contribution to the merged output: its own AST,
 * cloned (never mutate the shared parsed module later stages still
 * need), with any collision renames applied via real scope tracking,
 * then with import/export wrappers stripped.
 */
function renderFileBlock(
  filePath: string,
  module: ParsedModule,
  fileRenames: Map<string, string> | undefined,
): string {
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
    if (t.isImportDeclaration(stmt)) continue; // module linking is moot in a shared scope

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

  const fileNode = t.file(t.program(body));
  const { code } = generate(fileNode, { comments: true });
  return `// ${filePath}\n${code}`;
}
