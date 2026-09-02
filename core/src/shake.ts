import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import type { MergedFileBlock, MergeResult } from "./merge.js";

export type ShakeReason =
  | "reachable-from-entry"
  | "unreferenced"
  | "side-effect-free"
  | "possible-side-effect"
  | "external-import";

export interface ShakeItem {
  /** Declared name(s), a short label for a bare statement, or the import source. */
  label: string;
  file: string;
  kind: "declaration" | "statement" | "external-import";
  reason: ShakeReason;
}

export interface ShakeResult {
  /** The shaken source: only kept statements, same per-file grouping merge used. */
  code: string;
  kept: ShakeItem[];
  removed: ShakeItem[];
}

/**
 * Mark-and-sweep reachability over merge's real output.
 *
 * Every bare (non-declaration) statement, in any file, is judged by
 * Task 2's rule: provably side-effect-free (a pure expression, computed
 * and discarded) is removable; anything that might have a real,
 * unprovable effect is kept by default regardless of whether anything
 * references it — reference is never the test for a statement, safety
 * is. A statement seeds the reachability walk if and only if it's
 * actually kept — an impure statement that survives pulls in whatever
 * it references; a pure statement that gets removed pulls in nothing,
 * because nothing it referenced was ever really needed either. There's
 * no special case for the entry file: if every one of its statements
 * turns out pure, the correct result is that nothing survives at all —
 * that's what "no observable effect anywhere" means, not a bug.
 *
 * A named declaration (function/class/const/...) is inert by nature:
 * it survives only if something that's actually kept — a kept
 * statement, or another reachable declaration — really references it.
 * Reference discovery uses `@babel/traverse`'s own scope resolution
 * (`path.isReferencedIdentifier()` + `scope.getBinding`) against the
 * whole flattened program's real top-level scope, not text matching —
 * a shadowed inner variable, a property key, or a string literal that
 * merely spells a declaration's name is never counted.
 *
 * External imports (kept untouched by merge) are always kept here too
 * — they're never opened, so reachability doesn't apply to them.
 */
export function shakeModules(merge: MergeResult, entry: string): ShakeResult {
  // `entry` is kept in the public signature (callers already pass it, and
  // "which file is the entry point" is part of this function's documented
  // contract) but no longer changes root-selection: whether a statement
  // seeds the walk is exactly whether it's kept (see makeUnit), regardless
  // of which file it's in.
  const units = buildUnits(merge.blocks);
  const nameToUnit = new Map<string, Unit>();
  for (const unit of units) {
    for (const name of unit.declaredNames) nameToUnit.set(name, unit);
  }

  discoverReferences(units);

  const outputKept = new Set<string>();
  const visited = new Set<string>();
  const worklist: Unit[] = [];

  function visit(unit: Unit) {
    if (visited.has(unit.key)) return;
    visited.add(unit.key);
    worklist.push(unit);
  }

  for (const unit of units) {
    if (unit.selfKeep) outputKept.add(unit.key);
    if (unit.selfKeep || unit.isWalkRoot) visit(unit);
  }

  while (worklist.length > 0) {
    const unit = worklist.pop()!;
    for (const refName of unit.references) {
      const target = nameToUnit.get(refName);
      if (!target) continue;
      outputKept.add(target.key);
      visit(target);
    }
  }

  const kept: ShakeItem[] = [];
  const removed: ShakeItem[] = [];
  const keptStatementsByFile = new Map<string, t.Statement[]>();

  for (const unit of units) {
    const isKept = outputKept.has(unit.key);
    const item: ShakeItem = {
      label: unit.label,
      file: unit.file,
      kind: unit.kind,
      reason: reasonFor(unit, isKept),
    };
    (isKept ? kept : removed).push(item);
    if (isKept) {
      if (!keptStatementsByFile.has(unit.file)) keptStatementsByFile.set(unit.file, []);
      keptStatementsByFile.get(unit.file)!.push(unit.node);
    }
  }

  const code = merge.fileOrder
    .map((file) => {
      const stmts = keptStatementsByFile.get(file);
      if (!stmts || stmts.length === 0) return null;
      const fileNode = t.file(t.program(stmts));
      return `// ${file}\n${generate(fileNode, { comments: true }).code}`;
    })
    .filter((block): block is string => block !== null)
    .join("\n\n");

  return { code, kept, removed };
}

function reasonFor(unit: Unit, isKept: boolean): ShakeReason {
  if (unit.kind === "external-import") return "external-import";
  if (unit.kind === "declaration") return isKept ? "reachable-from-entry" : "unreferenced";
  return isKept ? "possible-side-effect" : "side-effect-free";
}

interface Unit {
  key: string;
  file: string;
  node: t.Statement;
  declaredNames: string[];
  label: string;
  kind: "declaration" | "statement" | "external-import";
  /** True if this unit's own text survives regardless of whether anything references it. */
  selfKeep: boolean;
  /** True if this unit seeds the reachability walk — its own references get followed. */
  isWalkRoot: boolean;
  references: Set<string>;
}

function buildUnits(blocks: MergedFileBlock[]): Unit[] {
  const units: Unit[] = [];
  for (const block of blocks) {
    block.statements.forEach((stmt, index) => {
      units.push(makeUnit(block.file, stmt, index));
    });
  }
  return units;
}

function makeUnit(file: string, stmt: t.Statement, index: number): Unit {
  if (t.isImportDeclaration(stmt)) {
    // Only external imports survive merge as ImportDeclaration nodes.
    const declaredNames = stmt.specifiers
      .filter((s): s is t.ImportDefaultSpecifier | t.ImportSpecifier | t.ImportNamespaceSpecifier =>
        t.isImportDefaultSpecifier(s) || t.isImportSpecifier(s) || t.isImportNamespaceSpecifier(s),
      )
      .map((s) => s.local.name);
    return {
      key: `${file}#import#${index}`,
      file,
      node: stmt,
      declaredNames,
      label: `import from '${stmt.source.value}'`,
      kind: "external-import",
      selfKeep: true,
      isWalkRoot: false,
      references: new Set(),
    };
  }

  const declaredNames = declarationNames(stmt);
  if (declaredNames.length > 0) {
    return {
      key: `${file}#decl#${declaredNames.join(",")}`,
      file,
      node: stmt,
      declaredNames,
      label: declaredNames.join(", "),
      kind: "declaration",
      selfKeep: false,
      isWalkRoot: false,
      references: new Set(),
    };
  }

  // A bare, non-declaration statement. A statement seeds the
  // reachability walk if and only if it's actually kept: a pure
  // statement is removed, and nothing it referenced was ever really
  // needed either — a reference that doesn't itself survive can't keep
  // anything else alive. No entry-file carve-out: if every one of
  // entry's own statements turns out pure, the correct result is that
  // nothing survives — that's what "no observable effect anywhere"
  // actually means, not a bug to work around.
  const pure = isPureStatement(stmt);
  return {
    key: `${file}#stmt#${index}`,
    file,
    node: stmt,
    declaredNames: [],
    label: summarizeStatement(stmt),
    kind: "statement",
    selfKeep: !pure,
    isWalkRoot: !pure,
    references: new Set(),
  };
}

/**
 * Populate every unit's `references`: the set of top-level names it
 * actually reads, resolved through the whole flattened program's real
 * scope — not text matching. Runs one traverse over a disposable clone
 * of the merged statements (never mutates merge's own AST).
 */
function discoverReferences(units: Unit[]): void {
  const topLevelNames = new Set(units.flatMap((u) => u.declaredNames));
  if (topLevelNames.size === 0) return;

  const originalStatements = units.map((u) => u.node);
  const clonedStatements = originalStatements.map((stmt) => t.cloneNode(stmt, true));
  const fileNode = t.file(t.program(clonedStatements));

  traverse(fileNode, {
    Program(programPath) {
      programPath.node.body.forEach((_clonedStmt, index) => {
        const unit = units[index];
        if (!unit || unit.kind === "external-import") return;

        const stmtPath = programPath.get(`body.${index}`) as NodePath;
        stmtPath.traverse({
          Identifier(idPath) {
            if (!idPath.isReferencedIdentifier()) return;
            const name = idPath.node.name;
            if (!topLevelNames.has(name)) return;
            const binding = idPath.scope.getBinding(name);
            if (binding && binding.scope === programPath.scope) {
              unit.references.add(name);
            }
          },
        });
      });
    },
  });
}

// Merge's output only ever contains bare FunctionDeclaration/
// ClassDeclaration/VariableDeclaration by this point (export wrappers
// were already unwrapped) — no Flow/TS-only pattern shapes to handle.
function declarationNames(stmt: t.Statement): string[] {
  if (t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) {
    return stmt.id ? [stmt.id.name] : [];
  }
  if (t.isVariableDeclaration(stmt)) {
    const names: string[] = [];
    for (const decl of stmt.declarations) collectBindingNames(decl.id, names);
    return names;
  }
  return [];
}

function collectBindingNames(id: t.Node, out: string[]): void {
  if (t.isIdentifier(id)) {
    out.push(id.name);
  } else if (t.isObjectPattern(id)) {
    for (const prop of id.properties) {
      if (t.isObjectProperty(prop)) collectBindingNames(prop.value, out);
      else if (t.isRestElement(prop)) collectBindingNames(prop.argument, out);
    }
  } else if (t.isArrayPattern(id)) {
    for (const el of id.elements) if (el) collectBindingNames(el, out);
  } else if (t.isAssignmentPattern(id)) {
    collectBindingNames(id.left, out);
  }
}

/**
 * Task 2's purity check: a bare statement is removable only if it's
 * provably free of any observable effect. Anything not explicitly
 * recognized as pure falls through to "impure" — the safe default is
 * keep, never remove, when it can't be proven safe.
 */
function isPureStatement(stmt: t.Statement): boolean {
  if (t.isEmptyStatement(stmt)) return true;
  if (t.isExpressionStatement(stmt)) return isPureExpression(stmt.expression);
  return false;
}

function isPureExpression(node: t.Node): boolean {
  if (
    t.isNumericLiteral(node) ||
    t.isStringLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isBigIntLiteral(node) ||
    t.isRegExpLiteral(node) ||
    t.isIdentifier(node) ||
    t.isThisExpression(node)
  ) {
    return true;
  }
  if (t.isTemplateLiteral(node)) return node.expressions.every(isPureExpression);
  if (t.isBinaryExpression(node) || t.isLogicalExpression(node)) {
    return isPureExpression(node.left) && isPureExpression(node.right);
  }
  if (t.isUnaryExpression(node)) {
    return node.operator !== "delete" && isPureExpression(node.argument);
  }
  if (t.isConditionalExpression(node)) {
    return (
      isPureExpression(node.test) &&
      isPureExpression(node.consequent) &&
      isPureExpression(node.alternate)
    );
  }
  if (t.isSequenceExpression(node)) return node.expressions.every(isPureExpression);
  if (t.isArrayExpression(node)) {
    return node.elements.every((el) => el === null || (!t.isSpreadElement(el) && isPureExpression(el)));
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every(
      (p) => t.isObjectProperty(p) && !p.computed && isPureExpression(p.value as t.Node),
    );
  }
  // CallExpression, NewExpression, AssignmentExpression, UpdateExpression,
  // AwaitExpression, YieldExpression, MemberExpression, TaggedTemplate,
  // anything else: unprovable, treated as a real effect.
  return false;
}

function summarizeStatement(stmt: t.Statement): string {
  const { code } = generate(stmt, { compact: true });
  return code.length > 60 ? `${code.slice(0, 57)}...` : code;
}
