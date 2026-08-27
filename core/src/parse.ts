import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import type { File } from "@babel/types";

/**
 * One `import`/dynamic-`import()` statement found in a module.
 * `source` is the raw specifier text, unresolved.
 */
export interface ImportRecord {
  source: string;
  kind: "static" | "dynamic";
}

/**
 * One top-level (Program-body) declaration. Not restricted to
 * function/const — covers every declaration shape a real project uses:
 * function, class, var/let/const (including destructured), and their
 * exported forms.
 */
export interface TopLevelDeclarationRecord {
  name: string;
  type: string;
  exported: boolean;
}

export interface ParsedModule {
  path: string;
  ast: File;
  imports: ImportRecord[];
  topLevelDeclarations: TopLevelDeclarationRecord[];
  /** Names bound directly in the module's top-level scope, per @babel/traverse. */
  boundNames: string[];
}

/**
 * Parse one file's source into an AST plus the facts later stages need:
 * its imports (static and dynamic, kept distinct), its top-level
 * declarations, and its top-level scope bindings.
 */
export function parseModule(source: string, path: string): ParsedModule {
  const ast = parse(source, {
    sourceType: "module",
    sourceFilename: path,
  });

  const imports: ImportRecord[] = [];
  let boundNames: string[] = [];

  traverse(ast, {
    Program(nodePath) {
      boundNames = Object.keys(nodePath.scope.bindings);
    },
    ImportDeclaration(nodePath) {
      imports.push({ source: nodePath.node.source.value, kind: "static" });
    },
    // Dynamic import() parses as its own node type, not a CallExpression
    // with an Import callee (that was the pre-ES2020 shape).
    ImportExpression(nodePath) {
      const arg = nodePath.node.source;
      if (arg.type === "StringLiteral") {
        imports.push({ source: arg.value, kind: "dynamic" });
      }
    },
  });

  const topLevelDeclarations: TopLevelDeclarationRecord[] = [];
  for (const stmt of ast.program.body) {
    collectTopLevelDeclarations(stmt, topLevelDeclarations);
  }

  return { path, ast, imports, topLevelDeclarations, boundNames };
}

function collectTopLevelDeclarations(stmt: t.Statement, out: TopLevelDeclarationRecord[]): void {
  if (t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt) || t.isVariableDeclaration(stmt)) {
    collectFromDeclaration(stmt, false, out);
  } else if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
    const decl = stmt.declaration;
    if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl) || t.isVariableDeclaration(decl)) {
      collectFromDeclaration(decl, true, out);
    }
  } else if (t.isExportDefaultDeclaration(stmt)) {
    const decl = stmt.declaration;
    if ((t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) && decl.id) {
      out.push({ name: decl.id.name, type: decl.type, exported: true });
    }
  }
}

function collectFromDeclaration(
  node: t.FunctionDeclaration | t.ClassDeclaration | t.VariableDeclaration,
  exported: boolean,
  out: TopLevelDeclarationRecord[],
): void {
  if (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) {
    if (node.id) out.push({ name: node.id.name, type: node.type, exported });
    return;
  }
  for (const declarator of node.declarations) {
    collectBindingNames(declarator.id, "VariableDeclarator", exported, out);
  }
}

// Real ESM source only (this project's scope boundary), so we only ever
// need to recognize plain identifier/object/array/default-value binding
// patterns here — not Flow/TS-only pattern shapes.
function collectBindingNames(
  id: t.Node,
  type: string,
  exported: boolean,
  out: TopLevelDeclarationRecord[],
): void {
  if (t.isIdentifier(id)) {
    out.push({ name: id.name, type, exported });
  } else if (t.isObjectPattern(id)) {
    for (const prop of id.properties) {
      if (t.isObjectProperty(prop)) {
        collectBindingNames(prop.value, type, exported, out);
      } else if (t.isRestElement(prop)) {
        collectBindingNames(prop.argument, type, exported, out);
      }
    }
  } else if (t.isArrayPattern(id)) {
    for (const el of id.elements) {
      if (el) collectBindingNames(el, type, exported, out);
    }
  } else if (t.isAssignmentPattern(id)) {
    collectBindingNames(id.left, type, exported, out);
  }
}
