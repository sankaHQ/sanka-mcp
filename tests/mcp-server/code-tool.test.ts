import { execFileSync } from 'node:child_process';
import {
  clientOptionsForCodeWorker,
  codeWorkerRunFlags,
  codeWorkerSpawnEnv,
} from '../../packages/mcp-server/src/code-tool';
import { buildRunModuleSource, getMethodSuggestions } from '../../packages/mcp-server/src/code-tool-worker';

describe('code tool method suggestions', () => {
  it('suggests current SDK methods when a caller misspells a method', () => {
    expect(getMethodSuggestions('client.prospect.companies.creat')[0]).toBe(
      'client.prospect.companies.create',
    );
    expect(getMethodSuggestions('client.public.workspaceMessages.threads.replie')).toContain(
      'client.public.workspaceMessages.threads.reply',
    );
    expect(getMethodSuggestions('client.public.orders.creat')[0]).toBe('client.public.orders.create');
  });
});

describe('code tool worker client options', () => {
  it('preserves V2-only and workspace configuration for execute calls', () => {
    expect(
      clientOptionsForCodeWorker({
        apiKey: 'soat_test',
        apiVersion: 'v2',
        baseURL: 'https://api.example.test',
        workspaceCode: '00001234',
      }),
    ).toEqual({
      apiKey: 'soat_test',
      apiVersion: 'v2',
      baseURL: 'https://api.example.test',
      workspaceCode: '00001234',
      defaultHeaders: {
        'X-Sanka-MCP': 'true',
      },
    });
  });
});

describe('code tool worker sandbox', () => {
  it('does not grant broad environment access', () => {
    const flags = codeWorkerRunFlags({
      allowRead: '/srv/sanka-mcp',
      baseURLHostname: 'api.sanka.com',
    });
    expect(flags.slice(0, 3)).toEqual([
      '--node-modules-dir=manual',
      '--allow-read=/srv/sanka-mcp',
      '--allow-net=api.sanka.com',
    ]);
    expect(flags).toHaveLength(4);
    expect(flags[3]).toMatch(/^--allow-env=[A-Z_]+(?:,[A-Z_]+)*$/);
  });

  it('does not pass application secrets or compiler configuration into the worker environment', () => {
    const envFlag = codeWorkerRunFlags({
      allowRead: '/srv/sanka-mcp',
      baseURLHostname: 'api.sanka.com',
    }).find((flag) => flag.startsWith('--allow-env='))!;
    const allowedNames = envFlag.slice('--allow-env='.length).split(',');
    expect(
      codeWorkerSpawnEnv({
        ...Object.fromEntries(allowedNames.map((name) => [name, 'host-value'])),
        HOME: '/home/sanka',
        PATH: '/usr/bin',
        SANKA_API_KEY: 'secret',
        SENTRY_DSN: 'secret',
      }),
    ).toEqual({ HOME: '/home/sanka', PATH: '/usr/bin' });
  });

  it('does not expose request-scoped values to the generated module', () => {
    const moduleSource = buildRunModuleSource(`async function run(client) {
  return opts.apiKey;
}`);
    const moduleURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const opts = { apiKey: 'top-secret-api-key' };
const loaded = await import(${JSON.stringify(moduleURL)});
try {
  await loaded.default({});
} catch (error) {
  process.stdout.write(error instanceof ReferenceError ? 'isolated' : String(error));
}`,
      ],
      { encoding: 'utf8' },
    );

    expect(output).toBe('isolated');
    expect(moduleSource).not.toContain('top-secret-api-key');
  });

  it('produces an executable module for valid code', () => {
    const moduleSource = buildRunModuleSource('async function run(client) { return client.value * 2; }');
    const moduleURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const loaded = await import(${JSON.stringify(moduleURL)});
process.stdout.write(String(await loaded.default({ value: 21 })));`,
      ],
      { encoding: 'utf8' },
    );

    expect(output).toBe('42');
  });
});
