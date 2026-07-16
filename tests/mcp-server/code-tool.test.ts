import { execFileSync } from 'node:child_process';
import {
  clientOptionsForCodeWorker,
  codeWorkerRunFlags,
  codeWorkerSpawnEnv,
} from '../../packages/mcp-server/src/code-tool';
import { buildRunModuleSource } from '../../packages/mcp-server/src/code-tool-worker';

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
    expect(
      codeWorkerRunFlags({
        allowRead: '/srv/sanka-mcp',
        baseURLHostname: 'api.sanka.com',
      }),
    ).toEqual([
      '--node-modules-dir=manual',
      '--allow-read=/srv/sanka-mcp',
      '--allow-net=api.sanka.com',
      '--allow-env=SANKA_API_KEY,SANKA_API_VERSION,SANKA_BASE_URL,SANKA_LOG,SANKA_WORKSPACE_CODE',
    ]);
  });

  it('does not pass application secrets into the worker environment', () => {
    expect(
      codeWorkerSpawnEnv({
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
