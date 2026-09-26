/**
 * Generates the search_docs method index from the maintained TypeScript client.
 *
 * Each entry pairs a client method's TypeScript signature, read with the compiler API, with the
 * request the method really sends, recorded by calling it against a fake fetch. Nothing is sent
 * over the network.
 *
 * Run `pnpm generate:sdk-method-docs` after changing src/resources.
 * tests/mcp-server/sdk-method-docs.test.ts fails when the committed index is stale.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { Sanka } from '../src/client';
import type { SdkMethodDoc } from '../packages/mcp-server/src/generated/sdk-method-docs';

const ROOT = path.resolve(__dirname, '..');
// TypeScript reports resolved source file names as real paths with forward slashes.
const CLIENT_SOURCE_DIR = `${fs.realpathSync(path.join(ROOT, 'src')).split(path.sep).join('/')}/`;

export const SDK_METHOD_DOCS_PATH = path.join(ROOT, 'packages/mcp-server/src/generated/sdk-method-docs.ts');

const HTTP_METHODS: ReadonlySet<string> = new Set(['get', 'post', 'put', 'patch', 'delete']);

// Object-argument fields for methods that validate input before sending the request.
const SAMPLE_FIELDS: Record<string, Record<string, unknown>> = {
  'client.public.associations.list': { source_object: 'companies', source_id: 'company-1' },
  'client.public.reports.create': { reportMetadata: { name: 'Pipeline report' } },
};

// Legacy base URLs can prefix the path of /v1/ requests; they must not change the index.
const PATH_CHANGING_ENV = ['SANKA_LEGACY_PUBLIC_BASE_URL', 'SANKA_LEGACY_BASE_URL'];

const NUMBER_PLACEHOLDER_BASE = 900_000_001;

type ArgumentKind = 'string' | 'number' | 'object' | 'other';

interface ClientMethod {
  qualified: string;
  symbol: ts.Symbol;
  declaration: ts.MethodDeclaration;
}

interface RecordedRequest {
  method: string;
  pathname: string;
}

export async function generateSdkMethodDocs(): Promise<SdkMethodDoc[]> {
  const program = createClientProgram();
  const checker = program.getTypeChecker();
  const savedEnv = PATH_CHANGING_ENV.map((name) => [name, process.env[name]] as const);
  PATH_CHANGING_ENV.forEach((name) => delete process.env[name]);
  try {
    const docs: SdkMethodDoc[] = [];
    for (const method of collectClientMethods(program, checker)) {
      docs.push(await describeMethod(method, checker));
    }
    return docs.sort((a, b) => a.qualified.localeCompare(b.qualified));
  } finally {
    for (const [name, value] of savedEnv) {
      if (value !== undefined) process.env[name] = value;
    }
  }
}

export function renderSdkMethodDocsModule(docs: SdkMethodDoc[]): string {
  return `// Generated from the TypeScript client in src/resources by scripts/generate-sdk-method-docs.ts.
// Run \`pnpm generate:sdk-method-docs\` after changing the client; do not edit by hand.

export interface SdkMethodDoc {
  /** Client call path, for example \`client.public.items.update\`. */
  qualified: string;
  /** Method name in snake_case. */
  name: string;
  httpMethod: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Path the method requests. \`{name}\` marks the argument that fills a path segment. */
  endpoint: string;
  summary: string;
  description: string;
  signature: string;
  /** Scalar path arguments, then the fields of the object argument. */
  params: string[];
  response: string;
}

export const sdkMethodDocs: SdkMethodDoc[] = ${JSON.stringify(docs, null, 2)};
`;
}

function createClientProgram(): ts.Program {
  const configPath = path.join(ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  return ts.createProgram([path.join(ROOT, 'src/index.ts')], parsed.options);
}

function collectClientMethods(program: ts.Program, checker: ts.TypeChecker): ClientMethod[] {
  const clientFile = program.getSourceFile(path.join(ROOT, 'src/client.ts'));
  const clientClass = clientFile?.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === 'Sanka',
  );
  if (!clientClass) {
    throw new Error('Could not find the Sanka client class in src/client.ts');
  }

  const methods: ClientMethod[] = [];
  const visit = (type: ts.Type, prefix: string, includeMethods: boolean) => {
    for (const member of checker.getPropertiesOfType(type)) {
      const declaration = member.valueDeclaration;
      if (!declaration || !isPublicMember(member, declaration)) continue;
      if (ts.isPropertyDeclaration(declaration)) {
        const memberType = checker.getTypeOfSymbolAtLocation(member, declaration);
        if (memberType.getProperty('_client')) {
          visit(memberType, `${prefix}.${member.name}`, true);
        }
      } else if (includeMethods && ts.isMethodDeclaration(declaration)) {
        methods.push({ qualified: `${prefix}.${member.name}`, symbol: member, declaration });
      }
    }
  };
  // The client's own members are transport helpers; only its resources are documented.
  visit(checker.getTypeAtLocation(clientClass), 'client', false);
  return methods;
}

function isPublicMember(member: ts.Symbol, declaration: ts.Declaration): boolean {
  if (member.name.startsWith('_') || member.name.startsWith('#')) return false;
  const modifiers = ts.canHaveModifiers(declaration) ? ts.getModifiers(declaration) ?? [] : [];
  return !modifiers.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword,
  );
}

async function describeMethod(method: ClientMethod, checker: ts.TypeChecker): Promise<SdkMethodDoc> {
  const { qualified, declaration } = method;
  const signature = checker.getSignatureFromDeclaration(declaration);
  if (!signature) {
    throw new Error(`${qualified}: could not resolve the method signature`);
  }

  const parameters = declaration.parameters.filter(
    (parameter) => typeNodeText(parameter.type) !== 'RequestOptions',
  );
  const objectParameters = parameters.filter(
    (parameter) => argumentKind(checker, checker.getTypeAtLocation(parameter)) === 'object',
  );
  const placeholders = new Map<string, string>();
  const sampleArguments: unknown[] = [];
  const params: string[] = [];

  parameters.forEach((parameter, index) => {
    const name = parameter.name.getText();
    const parameterType = checker.getTypeAtLocation(parameter);
    const kind = argumentKind(checker, parameterType);
    const optional = !!parameter.questionToken || !!parameter.initializer;
    if (kind === 'object') {
      const fields: Record<string, unknown> = {};
      for (const property of objectProperties(checker, parameterType)) {
        const propertyName = objectParameters.length > 1 ? `${name}.${property.name}` : property.name;
        params.push(`${propertyLabel(propertyName)}${property.optional ? '?' : ''}: ${property.type};`);
        if (!property.optional) {
          fields[property.name] = sampleValue(checker, property.valueType, property.name, placeholders);
        }
      }
      sampleArguments.push({ ...fields, ...SAMPLE_FIELDS[qualified] });
      return;
    }
    params.push(
      `${name}${optional ? '?' : ''}: ${
        typeNodeText(parameter.type) ?? checker.typeToString(parameterType)
      };`,
    );
    if (kind === 'string' && !checker.getNonNullableType(parameterType).isUnion()) {
      sampleArguments.push(stringPlaceholder(name, placeholders));
    } else if (kind === 'number') {
      const placeholder = NUMBER_PLACEHOLDER_BASE + index;
      placeholders.set(String(placeholder), name);
      sampleArguments.push(placeholder);
    } else {
      sampleArguments.push(sampleValue(checker, parameterType, name, placeholders));
    }
  });

  const requests = await recordRequests(qualified, sampleArguments);
  const request = requests[0];
  if (requests.length !== 1 || !request) {
    throw new Error(
      `${qualified} sent ${requests.length} requests instead of 1. ` +
        'If it rejects the sample arguments, add the fields it needs to SAMPLE_FIELDS in ' +
        'scripts/generate-sdk-method-docs.ts.',
    );
  }
  if (!HTTP_METHODS.has(request.method)) {
    throw new Error(`${qualified} sent unsupported HTTP method ${request.method}`);
  }
  const endpoint = endpointTemplate(request.pathname, placeholders);
  if (/\/(undefined|null)(\/|$)/.test(endpoint)) {
    throw new Error(
      `${qualified} requested ${endpoint}; an unset argument fills a path segment. ` +
        'Add the field to SAMPLE_FIELDS in scripts/generate-sdk-method-docs.ts.',
    );
  }

  const methodName = qualified.slice(qualified.lastIndexOf('.') + 1);
  const documentation = collapseWhitespace(
    ts.displayPartsToString(method.symbol.getDocumentationComment(checker)),
  );
  const summary = documentation.match(/^.+?\.(?=\s|$)/)?.[0] ?? (documentation || fallbackSummary(qualified));
  const returnType = typeNodeText(declaration.type) ?? checker.typeToString(signature.getReturnType());
  const signatureParams = declaration.parameters.map(
    (parameter) =>
      `${parameter.name.getText()}${parameter.questionToken || parameter.initializer ? '?' : ''}: ${
        typeNodeText(parameter.type) ?? checker.typeToString(checker.getTypeAtLocation(parameter))
      }`,
  );

  return {
    qualified,
    name: snakeCase(methodName),
    httpMethod: request.method as SdkMethodDoc['httpMethod'],
    endpoint,
    summary,
    description: documentation || summary,
    signature: `${qualified}(${signatureParams.join(', ')}): ${returnType}`,
    params,
    response: describeResponse(checker, signature.getReturnType()),
  };
}

async function recordRequests(qualified: string, args: unknown[]): Promise<RecordedRequest[]> {
  const requests: RecordedRequest[] = [];
  const client = new Sanka({
    apiKey: 'sdk-method-docs',
    baseURL: 'http://sdk-method-docs.invalid',
    apiVersion: 'any',
    workspaceCode: null,
    maxRetries: 0,
    logLevel: 'off',
    fetch: async (url, init) => {
      const href = String(url);
      // The multipart helper probes fetch with a data: URL before an upload.
      if (href.startsWith('data:')) return new Response('');
      requests.push({ method: (init?.method ?? 'get').toLowerCase(), pathname: new URL(href).pathname });
      return new Response(JSON.stringify({ success: true, data: {}, meta: {} }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  let owner: unknown = client;
  const segments = qualified.split('.').slice(1);
  const methodName = segments.pop()!;
  for (const segment of segments) {
    owner = (owner as Record<string, unknown>)[segment];
  }
  const method = (owner as Record<string, unknown>)[methodName];
  if (typeof method !== 'function') {
    throw new Error(`${qualified} is not a function on the client`);
  }

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Error(`${qualified} did not settle within 5 seconds`);
  try {
    await Promise.race([
      Promise.resolve().then(() => method.apply(owner, args)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timedOut), 5_000);
      }),
    ]);
  } catch (error) {
    // The fake response rarely satisfies the method's response parsing; only the request matters.
    if (error === timedOut && requests.length === 0) throw error;
  } finally {
    clearTimeout(timer);
  }
  return requests;
}

function argumentKind(checker: ts.TypeChecker, type: ts.Type): ArgumentKind {
  const nonNullable = checker.getNonNullableType(type);
  const members = nonNullable.isUnion() ? nonNullable.types : [nonNullable];
  if (members.every((member) => member.flags & ts.TypeFlags.StringLike)) return 'string';
  if (members.every((member) => member.flags & ts.TypeFlags.NumberLike)) return 'number';
  if (members.some((member) => member.flags & ts.TypeFlags.Object || member.isIntersection()))
    return 'object';
  return 'other';
}

interface ObjectProperty {
  name: string;
  optional: boolean;
  type: string;
  valueType: ts.Type;
}

function objectProperties(checker: ts.TypeChecker, type: ts.Type): ObjectProperty[] {
  const nonNullable = checker.getNonNullableType(type);
  const members = nonNullable.isUnion() ? nonNullable.types : [nonNullable];
  const properties = new Map<string, ObjectProperty & { seen: number }>();
  for (const member of members) {
    for (const property of checker.getPropertiesOfType(member)) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const valueType =
        declaration ? checker.getTypeOfSymbolAtLocation(property, declaration) : checker.getAnyType();
      const existing = properties.get(property.name);
      if (existing) {
        existing.seen += 1;
        continue;
      }
      const declaredType =
        declaration && (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) ?
          typeNodeText(declaration.type)
        : undefined;
      properties.set(property.name, {
        name: property.name,
        optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
        type: declaredType ?? checker.typeToString(valueType),
        valueType,
        seen: 1,
      });
    }
  }
  return [...properties.values()].map(({ seen, ...property }) => ({
    ...property,
    // A field that only some union members declare is optional for the caller.
    optional: property.optional || seen < members.length,
  }));
}

function sampleValue(
  checker: ts.TypeChecker,
  type: ts.Type,
  name: string,
  placeholders: Map<string, string>,
): unknown {
  const nonNullable = checker.getNonNullableType(type);
  const members = nonNullable.isUnion() ? nonNullable.types : [nonNullable];
  const first = members[0];
  if (first?.isStringLiteral()) return first.value;
  if (first?.isNumberLiteral()) return first.value;
  if (members.every((member) => member.flags & ts.TypeFlags.StringLike)) {
    return stringPlaceholder(name, placeholders);
  }
  if (members.every((member) => member.flags & ts.TypeFlags.NumberLike)) return 1;
  if (members.every((member) => member.flags & ts.TypeFlags.BooleanLike)) return true;
  if (members.some((member) => checker.isArrayType(member) || checker.isTupleType(member))) return [];
  return {};
}

function stringPlaceholder(name: string, placeholders: Map<string, string>): string {
  const placeholder = `__sdk_method_docs_${placeholders.size}__`;
  placeholders.set(placeholder, name);
  return placeholder;
}

function endpointTemplate(pathname: string, placeholders: Map<string, string>): string {
  let endpoint = pathname;
  for (const [placeholder, name] of placeholders) {
    endpoint = endpoint.split(placeholder).join(`{${name}}`);
  }
  return endpoint;
}

function describeResponse(checker: ts.TypeChecker, returnType: ts.Type): string {
  const awaited = checker.getAwaitedType(returnType) ?? returnType;
  if (checker.isArrayType(awaited)) {
    const element = checker.getTypeArguments(awaited as ts.TypeReference)[0];
    if (element) {
      return `Array<${describeObjectShape(checker, element) ?? checker.typeToString(element)}>`;
    }
  }
  return describeObjectShape(checker, awaited) ?? checker.typeToString(awaited);
}

// Expands object types declared in the client one level deep; other types keep their names.
function describeObjectShape(checker: ts.TypeChecker, type: ts.Type): string | undefined {
  const declaration = (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0];
  if (!declaration?.getSourceFile().fileName.startsWith(CLIENT_SOURCE_DIR)) {
    return undefined;
  }
  const properties = objectProperties(checker, type);
  if (properties.length === 0) return undefined;
  return `{ ${properties
    .map((property) => `${propertyLabel(property.name)}${property.optional ? '?' : ''}: ${property.type};`)
    .join(' ')} }`;
}

function typeNodeText(node: ts.TypeNode | undefined): string | undefined {
  if (!node) return undefined;
  return collapseWhitespace(
    node
      .getText()
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' '),
  );
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function propertyLabel(name: string): string {
  return /^[A-Za-z_$][\w$.]*$/.test(name) ? name : `'${name}'`;
}

function snakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function fallbackSummary(qualified: string): string {
  const [resource = '', method = ''] = qualified.split('.').slice(-2);
  const words = (name: string) =>
    snakeCase(name)
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return [...words(method), ...words(resource)].join(' ');
}

async function main(): Promise<void> {
  const prettier = await import('prettier');
  const docs = await generateSdkMethodDocs();
  const config = (await prettier.resolveConfig(SDK_METHOD_DOCS_PATH)) ?? {};
  const source = await prettier.format(renderSdkMethodDocsModule(docs), {
    ...config,
    filepath: SDK_METHOD_DOCS_PATH,
  });
  fs.writeFileSync(SDK_METHOD_DOCS_PATH, source);
  console.log(`Wrote ${docs.length} client methods to ${path.relative(ROOT, SDK_METHOD_DOCS_PATH)}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
