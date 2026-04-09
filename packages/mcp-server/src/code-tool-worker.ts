// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import path from 'node:path';
import util from 'node:util';
import Fuse from 'fuse.js';
import ts from 'typescript';
import { WorkerOutput } from './code-tool-types';
import { Sanka, ClientOptions } from 'sanka-sdk';

function getRunFunctionSource(code: string): {
  type: 'declaration' | 'expression';
  client: string | undefined;
  code: string;
} | null {
  const sourceFile = ts.createSourceFile('code.ts', code, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter();

  for (const statement of sourceFile.statements) {
    // Check for top-level function declarations
    if (ts.isFunctionDeclaration(statement)) {
      if (statement.name?.text === 'run') {
        return {
          type: 'declaration',
          client: statement.parameters[0]?.name.getText(),
          code: printer.printNode(ts.EmitHint.Unspecified, statement.body!, sourceFile),
        };
      }
    }

    // Check for variable declarations: const run = () => {} or const run = function() {}
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'run' &&
          // Check if it's initialized with a function
          declaration.initializer &&
          (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer))
        ) {
          return {
            type: 'expression',
            client: declaration.initializer.parameters[0]?.name.getText(),
            code: printer.printNode(ts.EmitHint.Unspecified, declaration.initializer, sourceFile),
          };
        }
      }
    }
  }

  return null;
}

function getTSDiagnostics(code: string): string[] {
  const functionSource = getRunFunctionSource(code)!;
  const codeWithImport = [
    'import { Sanka } from "sanka-sdk";',
    functionSource.type === 'declaration' ?
      `async function run(${functionSource.client}: Sanka)`
    : `const run: (${functionSource.client}: Sanka) => Promise<unknown> =`,
    functionSource.code,
  ].join('\n');
  const sourcePath = path.resolve('code.ts');
  const ast = ts.createSourceFile(sourcePath, codeWithImport, ts.ScriptTarget.Latest, true);
  const options = ts.getDefaultCompilerOptions();
  options.target = ts.ScriptTarget.Latest;
  options.module = ts.ModuleKind.NodeNext;
  options.moduleResolution = ts.ModuleResolutionKind.NodeNext;
  const host = ts.createCompilerHost(options, true);
  const newHost: typeof host = {
    ...host,
    getSourceFile: (...args) => {
      if (path.resolve(args[0]) === sourcePath) {
        return ast;
      }
      return host.getSourceFile(...args);
    },
    readFile: (...args) => {
      if (path.resolve(args[0]) === sourcePath) {
        return codeWithImport;
      }
      return host.readFile(...args);
    },
    fileExists: (...args) => {
      if (path.resolve(args[0]) === sourcePath) {
        return true;
      }
      return host.fileExists(...args);
    },
  };
  const program = ts.createProgram({
    options,
    rootNames: [sourcePath],
    host: newHost,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program, ast);
  return diagnostics.map((d) => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (!d.file || !d.start) return `- ${message}`;
    const { line: lineNumber } = ts.getLineAndCharacterOfPosition(d.file, d.start);
    const line = codeWithImport.split('\n').at(lineNumber)?.trim();
    return line ? `- ${message}\n    ${line}` : `- ${message}`;
  });
}

const fuse = new Fuse(
  [
    'client.enrich.create',
    'client.score.create',
    'client.public.accountMessages.bulkActions',
    'client.public.accountMessages.list',
    'client.public.accountMessages.sync',
    'client.public.accountMessages.threads.archive',
    'client.public.accountMessages.threads.reply',
    'client.public.accountMessages.threads.retrieve',
    'client.public.orders.bulkCreate',
    'client.public.orders.create',
    'client.public.orders.delete',
    'client.public.orders.list',
    'client.public.orders.retrieve',
    'client.public.orders.update',
    'client.public.tasks.create',
    'client.public.tasks.delete',
    'client.public.tasks.list',
    'client.public.tasks.retrieve',
    'client.public.tasks.update',
    'client.public.items.create',
    'client.public.items.delete',
    'client.public.items.list',
    'client.public.items.retrieve',
    'client.public.items.update',
    'client.public.contacts.create',
    'client.public.contacts.delete',
    'client.public.contacts.list',
    'client.public.contacts.retrieve',
    'client.public.contacts.update',
    'client.public.companies.create',
    'client.public.companies.delete',
    'client.public.companies.list',
    'client.public.companies.retrieve',
    'client.public.companies.update',
    'client.public.deals.create',
    'client.public.deals.delete',
    'client.public.deals.list',
    'client.public.deals.listPipelines',
    'client.public.deals.retrieve',
    'client.public.deals.update',
    'client.public.tickets.create',
    'client.public.tickets.delete',
    'client.public.tickets.list',
    'client.public.tickets.listPipelines',
    'client.public.tickets.retrieve',
    'client.public.tickets.update',
    'client.public.tickets.updateStatus',
    'client.public.subscriptions.create',
    'client.public.subscriptions.delete',
    'client.public.subscriptions.list',
    'client.public.subscriptions.retrieve',
    'client.public.subscriptions.update',
    'client.public.estimates.create',
    'client.public.estimates.delete',
    'client.public.estimates.list',
    'client.public.estimates.retrieve',
    'client.public.estimates.update',
    'client.public.invoices.create',
    'client.public.invoices.delete',
    'client.public.invoices.list',
    'client.public.invoices.retrieve',
    'client.public.invoices.update',
    'client.public.payments.create',
    'client.public.payments.delete',
    'client.public.payments.list',
    'client.public.payments.retrieve',
    'client.public.payments.update',
    'client.public.expenses.create',
    'client.public.expenses.delete',
    'client.public.expenses.list',
    'client.public.expenses.retrieve',
    'client.public.expenses.update',
    'client.public.expenses.uploadAttachment',
    'client.public.inventories.create',
    'client.public.inventories.delete',
    'client.public.inventories.list',
    'client.public.inventories.retrieve',
    'client.public.inventories.update',
    'client.public.locations.create',
    'client.public.locations.delete',
    'client.public.locations.list',
    'client.public.locations.retrieve',
    'client.public.locations.update',
    'client.public.inventoryTransactions.create',
    'client.public.inventoryTransactions.delete',
    'client.public.inventoryTransactions.list',
    'client.public.inventoryTransactions.retrieve',
    'client.public.inventoryTransactions.update',
    'client.public.meters.create',
    'client.public.meters.delete',
    'client.public.meters.list',
    'client.public.meters.retrieve',
    'client.public.meters.update',
    'client.public.properties.create',
    'client.public.properties.delete',
    'client.public.properties.list',
    'client.public.properties.retrieve',
    'client.public.properties.update',
    'client.public.purchaseOrders.create',
    'client.public.purchaseOrders.delete',
    'client.public.purchaseOrders.list',
    'client.public.purchaseOrders.retrieve',
    'client.public.purchaseOrders.update',
    'client.public.slips.create',
    'client.public.slips.delete',
    'client.public.slips.list',
    'client.public.slips.retrieve',
    'client.public.slips.update',
    'client.public.bills.create',
    'client.public.bills.delete',
    'client.public.bills.list',
    'client.public.bills.retrieve',
    'client.public.bills.update',
    'client.public.disbursements.create',
    'client.public.disbursements.delete',
    'client.public.disbursements.list',
    'client.public.disbursements.retrieve',
    'client.public.disbursements.update',
    'client.public.reports.create',
    'client.public.reports.delete',
    'client.public.reports.list',
    'client.public.reports.retrieve',
    'client.public.reports.update',
    'client.public.workflows.createOrUpdate',
    'client.public.workflows.list',
    'client.public.workflows.listActions',
    'client.public.workflows.retrieve',
    'client.public.workflows.retrieveRun',
    'client.public.workflows.run',
    'client.public.calendar.bootstrap',
    'client.public.calendar.checkAvailability',
    'client.public.calendar.attendance.cancel',
    'client.public.calendar.attendance.create',
    'client.public.calendar.attendance.reschedule',
    'client.public.auth.getCurrentIdentity',
  ],
  { threshold: 1, shouldSort: true },
);

function getMethodSuggestions(fullyQualifiedMethodName: string): string[] {
  return fuse
    .search(fullyQualifiedMethodName)
    .map(({ item }) => item)
    .slice(0, 5);
}

const proxyToObj = new WeakMap<any, any>();
const objToProxy = new WeakMap<any, any>();

type ClientProxyConfig = {
  path: string[];
  isBelievedBad?: boolean;
};

function makeSdkProxy<T extends object>(obj: T, { path, isBelievedBad = false }: ClientProxyConfig): T {
  let proxy: T = objToProxy.get(obj);

  if (!proxy) {
    proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        const propPath = [...path, String(prop)];
        const value = Reflect.get(target, prop, receiver);

        if (isBelievedBad || (!(prop in target) && value === undefined)) {
          // If we're accessing a path that doesn't exist, it will probably eventually error.
          // Let's proxy it and mark it bad so that we can control the error message.
          // We proxy an empty class so that an invocation or construction attempt is possible.
          return makeSdkProxy(class {}, { path: propPath, isBelievedBad: true });
        }

        if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
          return makeSdkProxy(value, { path: propPath, isBelievedBad });
        }

        return value;
      },

      apply(target, thisArg, args) {
        if (isBelievedBad || typeof target !== 'function') {
          const fullyQualifiedMethodName = path.join('.');
          const suggestions = getMethodSuggestions(fullyQualifiedMethodName);
          throw new Error(
            `${fullyQualifiedMethodName} is not a function. Did you mean: ${suggestions.join(', ')}`,
          );
        }

        return Reflect.apply(target, proxyToObj.get(thisArg) ?? thisArg, args);
      },

      construct(target, args, newTarget) {
        if (isBelievedBad || typeof target !== 'function') {
          const fullyQualifiedMethodName = path.join('.');
          const suggestions = getMethodSuggestions(fullyQualifiedMethodName);
          throw new Error(
            `${fullyQualifiedMethodName} is not a constructor. Did you mean: ${suggestions.join(', ')}`,
          );
        }

        return Reflect.construct(target, args, newTarget);
      },
    });

    objToProxy.set(obj, proxy);
    proxyToObj.set(proxy, obj);
  }

  return proxy;
}

function parseError(code: string, error: unknown): string | undefined {
  if (!(error instanceof Error)) return;
  const message = error.name ? `${error.name}: ${error.message}` : error.message;
  try {
    // Deno uses V8; the first "<anonymous>:LINE:COLUMN" is the top of stack.
    const lineNumber = error.stack?.match(/<anonymous>:([0-9]+):[0-9]+/)?.[1];
    // -1 for the zero-based indexing
    const line =
      lineNumber &&
      code
        .split('\n')
        .at(parseInt(lineNumber, 10) - 1)
        ?.trim();
    return line ? `${message}\n  at line ${lineNumber}\n    ${line}` : message;
  } catch {
    return message;
  }
}

const fetch = async (req: Request): Promise<Response> => {
  const { opts, code } = (await req.json()) as { opts: ClientOptions; code: string };

  const runFunctionSource = code ? getRunFunctionSource(code) : null;
  if (!runFunctionSource) {
    const message =
      code ?
        'The code is missing a top-level `run` function.'
      : 'The code argument is missing. Provide one containing a top-level `run` function.';
    return Response.json(
      {
        is_error: true,
        result: `${message} Write code within this template:\n\n\`\`\`\nasync function run(client) {\n  // Fill this out\n}\n\`\`\``,
        log_lines: [],
        err_lines: [],
      } satisfies WorkerOutput,
      { status: 400, statusText: 'Code execution error' },
    );
  }

  const diagnostics = getTSDiagnostics(code);
  if (diagnostics.length > 0) {
    return Response.json(
      {
        is_error: true,
        result: `The code contains TypeScript diagnostics:\n${diagnostics.join('\n')}`,
        log_lines: [],
        err_lines: [],
      } satisfies WorkerOutput,
      { status: 400, statusText: 'Code execution error' },
    );
  }

  const client = new Sanka({
    ...opts,
  });

  const log_lines: string[] = [];
  const err_lines: string[] = [];
  const console = {
    log: (...args: unknown[]) => {
      log_lines.push(util.format(...args));
    },
    error: (...args: unknown[]) => {
      err_lines.push(util.format(...args));
    },
  };
  try {
    let run_ = async (client: any) => {};
    eval(`${code}\nrun_ = run;`);
    const result = await run_(makeSdkProxy(client, { path: ['client'] }));
    return Response.json({
      is_error: false,
      result,
      log_lines,
      err_lines,
    } satisfies WorkerOutput);
  } catch (e) {
    return Response.json(
      {
        is_error: true,
        result: parseError(code, e),
        log_lines,
        err_lines,
      } satisfies WorkerOutput,
      { status: 400, statusText: 'Code execution error' },
    );
  }
};

export default { fetch };
