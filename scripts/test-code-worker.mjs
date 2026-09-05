import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Sanka } from '../dist/index.mjs';
import { codeTool } from '../packages/mcp-server/dist/code-tool.mjs';
import { configureLogger } from '../packages/mcp-server/dist/logger.mjs';

// Run after scripts/build. Deno is required: missing/broken runtimes must fail.
configureLogger({ level: 'silent' });
const clientOptions = {
  apiKey: 'soat_worker_fixture',
  apiVersion: 'v2',
  baseURL: 'http://127.0.0.1',
  workspaceCode: '00001234',
};
const client = new Sanka(clientOptions);
const execute = (code, sdk = client) =>
  codeTool({ blockedMethods: undefined }).handler({ reqContext: { client: sdk }, args: { code } });
const text = (result) => result.content.map((block) => block.text).join('\n');

test('restricted Deno worker starts and executes TypeScript with captured logs', async () => {
  const result = await execute(`async function run(client) {
    const value: number = 21;
    console.log('value', value);
    console.error('fixture warning');
    return value * 2;
  }`);
  assert.ok(!result.isError, text(result));
  assert.deepEqual(
    result.content.map((block) => block.text),
    ['42', 'value 21', 'Error output:\nfixture warning'],
  );
});

test('arrow functions execute and invalid code keeps useful diagnostics', async () => {
  const arrow = await execute('const run = async (client) => 42;');
  assert.ok(!arrow.isError, text(arrow));
  assert.equal(text(arrow), '42');
  const invalid = await execute(
    'async function run(client) { const value: number = "wrong"; return value; }',
  );
  assert.equal(invalid.isError, true);
  assert.match(text(invalid), /TypeScript diagnostics/);
  const missing = await execute('const value = 42;');
  assert.equal(missing.isError, true);
  assert.match(text(missing), /missing a top-level `run` function/);
});

test('runtime typos receive suggestions from the SDK registry', async () => {
  const result = await execute(
    'async function run(client) { return (client as any).prospect.companies.creat({}); }',
  );
  assert.equal(result.isError, true);
  assert.match(text(result), /is not a function\. Did you mean: client\.prospect\.companies\.create/);
});

test('worker preserves V2 SDK routing, workspace and authentication', async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, headers: req.headers });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ success: true, data: { items: [], total: 0 }, meta: { ctx_id: 'worker-fixture' } }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const sdk = new Sanka({ ...clientOptions, baseURL: `http://127.0.0.1:${server.address().port}` });
    const result = await execute(
      'async function run(client) { return (await client.public.orders.list({ limit: 1 })).total; }',
      sdk,
    );
    assert.ok(!result.isError, text(result));
    assert.equal(text(result), '0');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/v2/orders?limit=1');
    assert.equal(requests[0].headers['x-workspace-code'], '00001234');
    assert.equal(requests[0].headers.authorization, 'Bearer soat_worker_fixture');
    assert.equal(requests[0].headers['x-sanka-mcp'], 'true');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('worker still denies host secrets, outside files, other hosts and subprocesses', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sanka-worker-denied-'));
  const file = path.join(root, 'canary.txt');
  await writeFile(file, 'file-canary');
  const previous = process.env.SANKA_CODE_WORKER_CANARY;
  const previousCompilerConfig = process.env.TSC_WATCHFILE;
  process.env.SANKA_CODE_WORKER_CANARY = 'host-canary';
  process.env.TSC_WATCHFILE = 'host-compiler-canary';
  try {
    const result = await execute(`async function run(client) {
      const attempt = async (action) => {
        try { await action(); return 'unexpected success'; } catch (error) { return String(error); }
      };
      return {
        compilerConfig: (globalThis as any).Deno.env.get('TSC_WATCHFILE') ?? null,
        env: await attempt(() => (globalThis as any).Deno.env.get('SANKA_CODE_WORKER_CANARY')),
        loaderEnv: await attempt(() => (globalThis as any).Deno.env.get('LD_LIBRARY_PATH')),
        file: await attempt(() => (globalThis as any).Deno.readTextFile(${JSON.stringify(file)})),
        net: await attempt(() => fetch('https://blocked.example.invalid')),
        run: await attempt(() => new (globalThis as any).Deno.Command('echo', { args: ['blocked'] }).output()),
      };
    }`);
    assert.ok(!result.isError, text(result));
    const denied = JSON.parse(text(result));
    assert.equal(denied.compilerConfig, null);
    assert.match(denied.env, /Requires env access/);
    assert.match(denied.loaderEnv, /Requires env access/);
    assert.match(denied.file, /Requires read access/);
    assert.match(denied.net, /Requires net access/);
    assert.match(denied.run, /NotCapable: Requires (?:run access|--allow-run permissions)/);
    assert.doesNotMatch(text(result), /host-canary|host-compiler-canary|file-canary|unexpected success/);
  } finally {
    if (previous === undefined) delete process.env.SANKA_CODE_WORKER_CANARY;
    else process.env.SANKA_CODE_WORKER_CANARY = previous;
    if (previousCompilerConfig === undefined) delete process.env.TSC_WATCHFILE;
    else process.env.TSC_WATCHFILE = previousCompilerConfig;
    await rm(root, { recursive: true, force: true });
  }
});

test('user module cannot capture request-local options', async () => {
  const result = await execute('async function run(client) { return eval("opts"); }');
  assert.equal(result.isError, true);
  assert.match(text(result), /opts is not defined/);
});
