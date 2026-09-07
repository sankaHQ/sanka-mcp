import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { migrationReadTools, verifyMigrationTool } from '../../packages/mcp-server/src/migration-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const args = { workspace_id: workspace, migration_id: 'migration-1', confirm: true };
const report = {
  data: {
    migration_id: 'migration-1',
    status: 'verified',
    ok: true,
    verified_at: '2026-09-07T00:00:00Z',
    checks: { counts: 'passed', relationships: 'not_run', field_sampling: 'not_run' },
    routes: [{ route_key: 'contacts', migrated: 3, failed: 0, associations_pending: 0, ok: true }],
  },
  meta: { ctx_id: 'trace-1' },
};
const context = (payload = report) =>
  ({
    client: { post: jest.fn().mockResolvedValue(payload), get: jest.fn().mockResolvedValue(payload) },
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

it('registers verification once in each profile, keeping report retrieval read-only', () => {
  configureLogger({ level: 'error', pretty: false });
  expect(verifyMigrationTool.tool.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  });
  expect(verifyMigrationTool.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
  for (const profile of ['full', 'hosted'] as const) {
    const tools = selectTools(undefined, profile);
    expect(tools.filter((tool) => tool.tool.name === 'verify_migration')).toHaveLength(1);
    const reads = tools.filter((tool) => tool.tool.name === 'get_migration_verification');
    expect(reads).toHaveLength(1);
    expect(reads[0]!.tool.annotations?.readOnlyHint).toBe(true);
  }
});

it.each([undefined, 'verify-report-001'])(
  'submits body-free verification with optional stable key %p',
  async (idempotency_key) => {
    const reqContext = context();
    const result = await verifyMigrationTool.handler({
      reqContext,
      args: { ...args, ...(idempotency_key ? { idempotency_key } : {}) },
    });
    expect(reqContext.client.post).toHaveBeenCalledWith('/api/v2/migrate/migrations/migration-1/verify', {
      query: { workspace_id: workspace },
      maxRetries: 0,
      ...(idempotency_key ? { headers: { 'Idempotency-Key': idempotency_key } } : {}),
    });
    expect(reqContext.client.get).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      ...report,
      workspace_id: workspace,
      migration_id: 'migration-1',
      verification_status: 'verified',
      checks: report.data.checks,
      next_tool: 'get_migration_verification',
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('not_run checks have not been verified'),
    });
  },
);

it.each([
  { confirm: undefined },
  { confirm: false },
  { confirm: 'true' },
  { confirm: 1 },
  { workspace_id: undefined },
  { workspace_id: otherWorkspace },
  { workspace_id: 'current' },
  { migration_id: undefined },
  { migration_id: '../apply' },
  { plan_hash: 'unsupported' },
  { routes: ['contacts'] },
  { force: true },
  { idempotency_key: 'short' },
  { idempotency_key: 'a'.repeat(201) },
  { idempotency_key: 'header\rinjection' },
])('fails closed for invalid verification input: %p', async (invalid) => {
  const reqContext = context();
  expect((await verifyMigrationTool.handler({ reqContext, args: { ...args, ...invalid } })).isError).toBe(
    true,
  );
  expect(reqContext.client.post).not.toHaveBeenCalled();
  expect(reqContext.client.get).not.toHaveBeenCalled();
});

it('rejects unauthenticated verification', async () => {
  const reqContext = context();
  reqContext.auth!.authMode = 'none';
  expect((await verifyMigrationTool.handler({ reqContext, args })).isError).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it('does not depend on an active session workspace when explicit scope is available', async () => {
  const reqContext = context();
  delete reqContext.auth!.oauth.workspace_id;
  await verifyMigrationTool.handler({ reqContext, args: { ...args, workspace_id: otherWorkspace } });
  expect(reqContext.client.post).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ query: { workspace_id: otherWorkspace } }),
  );
});

it('keeps failed verification and unrun checks visible after server normalization', async () => {
  const failed = {
    ...report,
    data: {
      ...report.data,
      status: 'failed',
      ok: false,
      checks: { counts: 'failed', relationships: 'not_run', field_sampling: 'not_run' },
    },
  };
  const result = await verifyMigrationTool.handler({ reqContext: context(failed), args });
  const normalized = normalizeToolCallResult({ mcpTool: verifyMigrationTool, result, args });
  expect(normalized.structuredContent).toMatchObject({
    status: 'failed',
    ok: false,
    checks: failed.data.checks,
    data: failed.data,
  });
  expect(normalized.content[0]).toMatchObject({ text: expect.stringContaining('verify_migration failed') });
});

it('preserves verification reads without invoking verification or apply', async () => {
  const reqContext = context();
  const reader = migrationReadTools.find((tool) => tool.tool.name === 'get_migration_verification')!;
  const result = await reader.handler({
    reqContext,
    args: { workspace_id: workspace, migration_id: args.migration_id },
  });
  expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/migrations/migration-1/verification', {
    query: { workspace_id: workspace },
  });
  expect(reqContext.client.post).not.toHaveBeenCalled();
  expect(result.structuredContent).toMatchObject(report);
});

it.each([401, 403, 404, 409, 429, 503])(
  'preserves verification HTTP error %s without fallback',
  async (status) => {
    const reqContext = context();
    (reqContext.client.post as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Not available'), {
        status,
        error: { code: 'FERRY_MIGRATION_STATE_INVALID', ctx_id: 'trace' },
      }),
    );
    const result = await verifyMigrationTool.handler({ reqContext, args });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        status_code: status,
        code: 'FERRY_MIGRATION_STATE_INVALID',
        workspace_id: workspace,
      },
    });
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  },
);

it.each([undefined, 'verify-stable-001'])(
  'uses real authenticated transport without body or automatic retry (%p)',
  async (idempotency_key) => {
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
    const result = await verifyMigrationTool.handler({
      reqContext,
      args: { ...args, ...(idempotency_key ? { idempotency_key } : {}) },
    });
    expect(result.isError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://api-v2.example.com/api/v2/migrate/migrations/migration-1/verify?workspace_id=${workspace}`,
    );
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined();
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(options.headers).get('idempotency-key')).toBe(idempotency_key ?? null);
  },
);
