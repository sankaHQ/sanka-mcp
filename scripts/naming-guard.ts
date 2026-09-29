/**
 * Naming guard: Ferry is now Sanka and the code term is "migration", so new code may not declare
 * ferry-named identifiers or add ferry-named files.
 *
 * Only declarations are judged (variables, parameters, functions, classes, types, enums, import
 * aliases), never references, string literals or property keys: MCP tool names, API paths and
 * payload keys are published contracts renamed with their own compatibility windows, and generated
 * files are skipped.
 *
 * Counts are keyed by file in scripts/naming-guard.baseline.json and may only go down. A file above
 * its baseline fails; a file below it also fails until `--update-baseline` locks the cleanup in.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'scripts/naming-guard.baseline.json');
const RETIRED_TERM = /ferry/i;
const SOURCE = /\.[cm]?[jt]sx?$/;
const SCOPES = ['src', 'packages', 'tests', 'scripts'];
const GENERATED = ['src/generated/', 'packages/mcp-server/src/generated/'];

export interface DeclarationFinding {
  line: number;
  name: string;
}

export function pathFinding(file: string): string | null {
  return RETIRED_TERM.test(file) ? `${file}: ferry in the file path` : null;
}

export function declarationFindings(file: string, text: string): DeclarationFinding[] {
  const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const findings: DeclarationFinding[] = [];
  const report = (name: ts.Node | undefined): void => {
    if (!name || !ts.isIdentifier(name) || !RETIRED_TERM.test(name.text)) return;
    const { line } = source.getLineAndCharacterOfPosition(name.getStart(source));
    findings.push({ line: line + 1, name: name.text });
  };
  const bindings = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) return report(name);
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bindings(element.name);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      bindings(node.name);
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node) ||
      ts.isTypeParameterDeclaration(node) ||
      ts.isImportClause(node) ||
      ts.isNamespaceImport(node)
    ) {
      report(node.name);
    } else if (ts.isImportSpecifier(node) && node.propertyName) {
      // A plain import names an existing export, judged where it is declared.
      report(node.name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export function baselineVerdict(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): { grew: string[]; shrank: string[] } {
  const files = [...new Set([...Object.keys(counts), ...Object.keys(baseline)])].sort();
  return {
    grew: files.filter((file) => (counts[file] ?? 0) > (baseline[file] ?? 0)),
    shrank: files.filter((file) => (counts[file] ?? 0) < (baseline[file] ?? 0)),
  };
}

export function main(argv: string[]): number {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...SCOPES], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(
      (file) =>
        SOURCE.test(file) &&
        !file.endsWith('.d.ts') &&
        !GENERATED.some((prefix) => file.startsWith(prefix)) &&
        fs.existsSync(path.join(ROOT, file)),
    );
  const counts: Record<string, number> = {};
  const lines: string[] = [];
  for (const file of files) {
    const finding = pathFinding(file);
    const declarations = declarationFindings(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (finding) lines.push(finding);
    for (const { line, name } of declarations) lines.push(`${file}:${line}: declares ${name}`);
    const count = (finding ? 1 : 0) + declarations.length;
    if (count) counts[file] = count;
  }

  if (argv.includes('--update-baseline')) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`naming-guard: baseline updated (${lines.length} retained ferry names).`);
    return 0;
  }
  const baseline: Record<string, number> =
    fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : {};
  const { grew, shrank } = baselineVerdict(counts, baseline);
  if (grew.length) {
    for (const line of lines) {
      if (grew.some((file) => line.startsWith(`${file}:`))) console.log(line);
    }
    console.log('naming-guard: new ferry names. Ferry is now Sanka; name new code "migration".');
    return 1;
  }
  if (shrank.length) {
    console.log(shrank.join('\n'));
    console.log(
      'naming-guard: ferry names went down. Run `pnpm lint:naming --update-baseline` to lock it in.',
    );
    return 1;
  }
  console.log(`naming-guard: ${files.length} source files clean (${lines.length} retained ferry names).`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
