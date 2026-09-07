import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { codeMigrationTools } from '../../packages/mcp-server/src/code-migration-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const scanHash = `sha256:${'a'.repeat(64)}`;
const planHash = `sha256:${'b'.repeat(64)}`;
const outputHash = `sha256:${'c'.repeat(64)}`;
const otherHash = `sha256:${'d'.repeat(64)}`;
// Synthetic transport fixtures, never submitted to a real API or represented as real CLI evidence.
const scan = {
  schema_version: 1,
  scan_hash: scanHash,
  source: '/fixture',
  language: 'python',
  framework: 'django-rest-framework',
  routes: [{ path: '/contacts', method: 'GET' }],
};
const plan = {
  schema_version: 1,
  source_scan_hash: scanHash,
  plan_hash: planHash,
  routes: [{ source_view: 'ContactView', automatic: true }],
  default_output: '/fixture/output',
};
const manifest = {
  schema_version: 1,
  generator: 'sanka',
  source_scan_hash: scanHash,
  plan_hash: planHash,
  routes: [{ generated_file: 'routes.py' }],
  generated_at: '2026-09-07T00:00:00Z',
};
const report = {
  scan_hash: scanHash,
  plan_hash: planHash,
  ok: false,
  checks: [
    { name: 'unit-tests', status: 'failed' },
    { name: 'integration', status: 'not_run' },
  ],
};
const getTool = (name: string) => codeMigrationTools.find((tool) => tool.tool.name === name)!;
const context = (data: Record<string, unknown> = { items: [] }) =>
  ({
    client: {
      get: jest.fn().mockResolvedValue({ data, meta: { ctx_id: 'trace' } }),
      post: jest.fn().mockResolvedValue({ data, meta: { ctx_id: 'trace' } }),
    },
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        scopes: ['mcp:access'],
        workspace_id: workspace,
        authorizationServerUrl: 'https://example.com',
      },
    },
  }) as unknown as McpRequestContext;
const reads = [
  ['list_code_projects', '/code-projects', {}],
  ['get_code_project', '/code-projects/project-1', { project_id: 'project-1' }],
  ['list_code_migrations', '/code-migrations', {}],
  ['get_code_migration', '/code-migrations/migration-1', { migration_id: 'migration-1' }],
  ['get_code_migration_scan', '/code-migrations/migration-1/scan', { migration_id: 'migration-1' }],
  ['get_code_migration_plan', '/code-migrations/migration-1/plan', { migration_id: 'migration-1' }],
  [
    'get_code_migration_verification',
    '/code-migrations/migration-1/verification',
    { migration_id: 'migration-1' },
  ],
] as const;
const writes = [
  [
    'create_code_project',
    '/code-projects',
    {
      name: 'Test project',
      repository_url: 'https://github.com/example/project',
      source_revision: 'reviewed-revision',
    },
  ],
  ['create_code_migration', '/code-migrations', { project_id: 'project-1', engine_version: '0.1.0' }],
  [
    'submit_code_migration_scan',
    '/code-migrations/migration-1/scan',
    { migration_id: 'migration-1', artifact: scan },
  ],
  [
    'submit_code_migration_plan',
    '/code-migrations/migration-1/plan',
    { migration_id: 'migration-1', artifact: plan },
  ],
  [
    'apply_code_migration',
    '/code-migrations/migration-1/apply',
    { migration_id: 'migration-1', plan_hash: planHash, manifest, output_hash: outputHash },
  ],
  [
    'verify_code_migration',
    '/code-migrations/migration-1/verify',
    { migration_id: 'migration-1', plan_hash: planHash, report },
  ],
] as const;

beforeAll(() => configureLogger({ level: 'error', pretty: false }));
it('registers all supported code lifecycle tools once in both profiles with accurate metadata', () => {
  expect(codeMigrationTools).toHaveLength(reads.length + writes.length);
  for (const [name] of [...reads, ...writes]) {
    const tool = getTool(name);
    const readOnly = name.startsWith('list_') || name.startsWith('get_');
    expect(tool.metadata).toMatchObject({
      operation: readOnly ? 'read' : 'write',
      httpMethod: readOnly ? 'GET' : 'POST',
    });
    expect(tool.tool.annotations).toMatchObject({
      readOnlyHint: readOnly,
      destructiveHint: false,
      idempotentHint: readOnly,
    });
    expect(tool.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
    expect(tool.tool.inputSchema.required).toContain('workspace_id');
    expect(tool.tool.description).toContain('does not clone, scan, execute, rewrite or deploy');
    for (const profile of ['full', 'hosted'] as const) {
      expect(selectTools(undefined, profile).filter((entry) => entry.tool.name === name)).toHaveLength(1);
    }
  }
  expect(selectTools().map((tool) => tool.tool.name)).not.toContain('start_code_migration_scan');
});

it.each(reads)('%s uses the exact GET endpoint and explicit scope', async (name, path, params) => {
  const reqContext = context();
  const result = await getTool(name).handler({ reqContext, args: { workspace_id: workspace, ...params } });
  expect(reqContext.client.get).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
    query: { workspace_id: workspace },
  });
  expect(reqContext.client.post).not.toHaveBeenCalled();
  expect(result.structuredContent).toMatchObject({ workspace_id: workspace, meta: { ctx_id: 'trace' } });
});

it.each(writes)(
  '%s forwards only contract body fields without modifying evidence',
  async (name, path, params) => {
    const reqContext = context();
    const supplied = { workspace_id: workspace, confirm: true, ...params };
    const original = JSON.stringify(supplied);
    const result = await getTool(name).handler({ reqContext, args: supplied });
    const expectedBody = Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'migration_id'));
    expect(reqContext.client.post).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
      query: { workspace_id: workspace },
      body: expectedBody,
      maxRetries: 0,
    });
    expect(reqContext.client.get).not.toHaveBeenCalled();
    expect(JSON.stringify(supplied)).toBe(original);
    expect(result.structuredContent?.['workspace_id']).toBe(workspace);
  },
);

describe.each([...reads, ...writes])('%s context validation', (name, _path, params) => {
  it.each([undefined, 'current', otherWorkspace])(
    'rejects missing/incorrect workspace %p',
    async (workspace_id) => {
      const reqContext = context();
      const supplied = {
        ...params,
        workspace_id,
        ...(!name.startsWith('get_') && !name.startsWith('list_') ? { confirm: true } : {}),
      };
      expect((await getTool(name).handler({ reqContext, args: supplied })).isError).toBe(true);
      expect(reqContext.client.get).not.toHaveBeenCalled();
      expect(reqContext.client.post).not.toHaveBeenCalled();
    },
  );
  it('rejects unauthenticated calls', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    expect(
      (await getTool(name).handler({ reqContext, args: { workspace_id: workspace, ...params } })).isError,
    ).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });
});

describe.each(writes)('%s write safety', (name, _path, params) => {
  it.each([undefined, false, 'true', 1])('requires explicit boolean confirmation: %p', async (confirm) => {
    const reqContext = context();
    expect(
      (await getTool(name).handler({ reqContext, args: { workspace_id: workspace, confirm, ...params } }))
        .isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });
  it('rejects unsupported idempotency keys rather than inventing replay guarantees', async () => {
    const reqContext = context();
    expect(
      (
        await getTool(name).handler({
          reqContext,
          args: { workspace_id: workspace, confirm: true, ...params, idempotency_key: 'unsupported-key' },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });
  it('still pins explicit scope when optional session metadata is absent', async () => {
    const reqContext = context();
    delete reqContext.auth!.oauth.workspace_id;
    await getTool(name).handler({
      reqContext,
      args: { workspace_id: otherWorkspace, confirm: true, ...params },
    });
    expect(reqContext.client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: { workspace_id: otherWorkspace } }),
    );
  });
  it('uses the real SDK transport without automatic POST retry or shell execution', async () => {
    const fetchMock = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Unavailable' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const reqContext = context();
    reqContext.client = new Sanka({
      apiKey: 'test-token',
      baseURL: 'https://api-v2.example.com',
      fetch: fetchMock,
      maxRetries: 3,
    });
    expect(
      (
        await getTool(name).handler({
          reqContext,
          args: { workspace_id: workspace, confirm: true, ...params },
        })
      ).isError,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://api-v2.example.com/api/v2/migrate${_path}?workspace_id=${workspace}`,
    );
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(options.headers).get('idempotency-key')).toBeNull();
    expect(JSON.parse(options.body)).toEqual(
      Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'migration_id')),
    );
  });
});

it('preserves project filter, pagination and API pagination envelope', async () => {
  const reqContext = context();
  const payload = { data: { migrations: [] }, pagination: { page: 2, total: 30 }, meta: { ctx_id: 'trace' } };
  (reqContext.client.get as jest.Mock).mockResolvedValue(payload);
  const result = await getTool('list_code_migrations').handler({
    reqContext,
    args: { workspace_id: workspace, project_id: 'project-1', page: 2, limit: 10 },
  });
  expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/code-migrations', {
    query: { workspace_id: workspace, project_id: 'project-1', page: 2, limit: 10 },
  });
  expect(result.structuredContent).toMatchObject(payload);
});

it.each([{ page: 0 }, { limit: 101 }, { limit: '10' }, { page: 1.5 }, { workspace_code: 'alternate' }])(
  'rejects invalid pagination and workspace aliases: %p',
  async (extra) => {
    const reqContext = context();
    expect(
      (
        await getTool('list_code_projects').handler({
          reqContext,
          args: { workspace_id: workspace, ...extra },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  },
);

it.each(['../apply', 'id?workspace_id=other', '.', ''])(
  'rejects path injection in resource identifiers: %p',
  async (migration_id) => {
    const reqContext = context();
    expect(
      (
        await getTool('get_code_migration_scan').handler({
          reqContext,
          args: { workspace_id: workspace, migration_id },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  },
);

it.each([
  'http://github.com/example/repo',
  'https://user:password@github.com/example/repo',
  'https://github.com/example/repo?token=secret',
  'https://github.com/example/repo#fragment',
  'not-a-url',
])('does not submit unsafe repository metadata: %p', async (repository_url) => {
  const reqContext = context();
  expect(
    (
      await getTool('create_code_project').handler({
        reqContext,
        args: { workspace_id: workspace, confirm: true, name: 'Test', repository_url },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { engine_version: '' },
  { engine_version: '  ' },
  { engine_version: undefined },
  { execution_mode: 'hosted' },
  { target_framework: 'rails' },
  { project_id: '' },
])('rejects unsupported code migration configuration: %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await getTool('create_code_migration').handler({
        reqContext,
        args: {
          workspace_id: workspace,
          confirm: true,
          project_id: 'project-1',
          engine_version: '0.1',
          ...extra,
        },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { plan_hash: undefined },
  { manifest: undefined },
  { output_hash: undefined },
  { plan_hash: 'guessed' },
  { output_hash: 'guessed' },
  { manifest: {} },
  { manifest: { ...manifest, plan_hash: otherHash } },
  { manifest: { ...manifest, generator: 'unknown' } },
])('cannot submit apply without required reviewed plan/output evidence: %p', async (extra) => {
  const reqContext = context();
  const supplied = {
    workspace_id: workspace,
    confirm: true,
    migration_id: 'migration-1',
    plan_hash: planHash,
    manifest,
    output_hash: outputHash,
    ...extra,
  };
  expect((await getTool('apply_code_migration').handler({ reqContext, args: supplied })).isError).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { report: { ...report, plan_hash: otherHash } },
  { report: { ...report, ok: 'true' } },
  { plan_hash: undefined },
  { report: undefined },
])('rejects unbound or malformed verification evidence: %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await getTool('verify_code_migration').handler({
        reqContext,
        args: {
          workspace_id: workspace,
          confirm: true,
          migration_id: 'migration-1',
          plan_hash: planHash,
          report,
          ...extra,
        },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it('preserves failed/skipped verification evidence without turning it into successful independent verification', async () => {
  const reqContext = context({
    migration_id: 'migration-1',
    artifact_type: 'verification',
    hash: planHash,
    artifact: report,
  });
  const supplied = {
    workspace_id: workspace,
    confirm: true,
    migration_id: 'migration-1',
    plan_hash: planHash,
    report,
  };
  const result = await getTool('verify_code_migration').handler({ reqContext, args: supplied });
  const normalized = normalizeToolCallResult({
    mcpTool: getTool('verify_code_migration'),
    result,
    args: supplied,
  });
  expect(normalized.structuredContent).toMatchObject({
    ok: false,
    status: 'verification_failed',
    verification_ok: false,
    checks: report.checks,
    data: { artifact: report },
  });
  expect(JSON.stringify(normalized.content)).toContain('verification_failed');
  expect(JSON.stringify(normalized.content)).toContain('ok=false');
  expect(JSON.stringify(result.content)).toContain('ok=false');
  expect(JSON.stringify(result.content)).toContain('do not execute code');
});

it('returns IDs from newly created resources without inventing job identifiers', async () => {
  const reqContext = context({
    object: 'code_migration',
    id: 'new-migration',
    project_id: 'project-1',
    status: 'created',
  });
  const result = await getTool('create_code_migration').handler({
    reqContext,
    args: { workspace_id: workspace, confirm: true, project_id: 'project-1', engine_version: '0.1' },
  });
  expect(result.structuredContent).toMatchObject({
    migration_id: 'new-migration',
    project_id: 'project-1',
    status: 'created',
  });
  expect(result.structuredContent).not.toHaveProperty('job_id');
});

it('rejects oversized submissions rather than truncating or editing hashed artifacts', async () => {
  const reqContext = context();
  const result = await getTool('submit_code_migration_scan').handler({
    reqContext,
    args: {
      workspace_id: workspace,
      confirm: true,
      migration_id: 'migration-1',
      artifact: { ...scan, large: 'x'.repeat(5 * 1024 * 1024) },
    },
  });
  expect(result.isError).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 409, 413, 422, 429, 503])(
  'preserves API error %s without replacing hashes or dispatching alternate operations',
  async (status) => {
    const reqContext = context();
    (reqContext.client.post as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Evidence rejected'), {
        status,
        error: {
          code: 'SANKA_CODE_HASH_MISMATCH',
          ctx_id: 'trace',
          details: { expected_plan_hash: otherHash },
        },
      }),
    );
    const result = await getTool('apply_code_migration').handler({
      reqContext,
      args: {
        workspace_id: workspace,
        confirm: true,
        migration_id: 'migration-1',
        plan_hash: planHash,
        manifest,
        output_hash: outputHash,
      },
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        status_code: status,
        code: 'SANKA_CODE_HASH_MISMATCH',
        workspace_id: workspace,
        migration_id: 'migration-1',
      },
    });
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  },
);
