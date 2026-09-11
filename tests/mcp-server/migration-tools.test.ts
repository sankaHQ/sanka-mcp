import { configureLogger } from '../../packages/mcp-server/src/logger';
import Sanka from 'sanka-sdk';
import { migrationReadTools } from '../../packages/mcp-server/src/migration-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tool = (name: string) => migrationReadTools.find((entry) => entry.tool.name === name)!;
const context = (get = jest.fn().mockResolvedValue({ data: { items: [] } })) =>
  ({
    client: { get },
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

const routes = [
  ['list_migration_connectors', '/connectors', {}],
  ['list_migration_connections', '/connections', {}],
  ['get_migration_connection', '/connections/connection-1', { connection_id: 'connection-1' }],
  ['list_migration_program_templates', '/program-templates', {}],
  ['list_migration_programs', '/programs', {}],
  ['get_migration_program', '/programs/program-1', { program_id: 'program-1' }],
  ['list_migrations', '/migrations', {}],
  ['get_migration', '/migrations/migration-1', { migration_id: 'migration-1' }],
  ['get_migration_journey', '/migrations/migration-1/journey', { migration_id: 'migration-1' }],
  [
    'get_migration_result',
    '/migrations/migration-1/results/plan',
    { migration_id: 'migration-1', stage: 'plan' },
  ],
  ['get_migration_plan', '/migrations/migration-1/plan', { migration_id: 'migration-1' }],
  ['get_migration_verification', '/migrations/migration-1/verification', { migration_id: 'migration-1' }],
  ['list_ingestion_sources', '/ingestion-sources', {}],
  ['list_ingestion_batches', '/ingestion-sources/source-1/batches', { source_id: 'source-1' }],
  [
    'get_ingestion_batch',
    '/ingestion-sources/source-1/batches/batch-1',
    { source_id: 'source-1', batch_id: 'batch-1' },
  ],
] as const;

describe('read-only migration tools', () => {
  beforeAll(() => configureLogger({ level: 'error', pretty: false }));
  it.each(routes)(
    '%s forwards only the pinned workspace and supported parameters',
    async (name, path, params) => {
      const reqContext = context();
      const result = await tool(name).handler({ reqContext, args: { workspace_id: workspace, ...params } });
      expect(reqContext.client.get).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
        query: { workspace_id: workspace },
      });
      expect(result.structuredContent).toEqual({ data: { items: [] }, workspace_id: workspace });
    },
  );

  it('registers every tool in both profiles with read-only metadata and valid schemas', () => {
    expect(migrationReadTools).toHaveLength(routes.length);
    for (const [name] of routes) {
      const entry = tool(name);
      expect(entry.metadata).toMatchObject({ operation: 'read', httpMethod: 'GET' });
      expect(entry.tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(entry.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
      expect(entry.tool.inputSchema.required).toContain('workspace_id');
      expect(entry.tool.inputSchema['additionalProperties']).toBe(false);
      for (const profile of ['full', 'hosted'] as const) {
        expect(selectTools(undefined, profile).filter((t) => t.tool.name === name)).toHaveLength(1);
      }
    }
  });

  it.each([
    undefined,
    {},
    { workspace_id: '' },
    { workspace_id: 'workspace-code' },
    { workspace_id: otherWorkspace },
  ])('fails closed without valid, matching workspace context: %p', async (args) => {
    const reqContext = context();
    expect((await tool('list_migrations').handler({ reqContext, args })).isError).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });
  it.each(routes.filter(([, , params]) => Object.keys(params).length > 0))(
    '%s rejects missing resource identifiers',
    async (name) => {
      const reqContext = context();
      const result = await tool(name).handler({ reqContext, args: { workspace_id: workspace } });
      expect(result.isError).toBe(true);
      expect(reqContext.client.get).not.toHaveBeenCalled();
    },
  );
  it('forwards ingestion batch limit without accepting unsupported page pagination', async () => {
    const reqContext = context();
    const args = { workspace_id: workspace, source_id: 'source-1', limit: 100 };
    await tool('list_ingestion_batches').handler({ reqContext, args });
    expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/ingestion-sources/source-1/batches', {
      query: { workspace_id: workspace, limit: 100 },
    });
    const result = await tool('list_ingestion_batches').handler({ reqContext, args: { ...args, page: 1 } });
    expect(result.isError).toBe(true);
    expect(reqContext.client.get).toHaveBeenCalledTimes(1);
  });
  it('uses the explicit UUID even without session workspace metadata', async () => {
    const reqContext = context();
    delete reqContext.auth!.oauth.workspace_id;
    await tool('list_migrations').handler({ reqContext, args: { workspace_id: otherWorkspace } });
    expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/migrations', {
      query: { workspace_id: otherWorkspace },
    });
  });
  it('rejects unauthenticated calls before making an API request', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    expect(
      (await tool('list_migrations').handler({ reqContext, args: { workspace_id: workspace } })).isError,
    ).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });
  it.each([
    { page: 0 },
    { limit: 101 },
    { page: 1.5 },
    { limit: '20' },
    { channel_id: 'injected' },
    { workspace_code: 'alternate' },
  ])('rejects unsupported pagination or context: %p', async (extra) => {
    const reqContext = context();
    expect(
      (await tool('list_migrations').handler({ reqContext, args: { workspace_id: workspace, ...extra } }))
        .isError,
    ).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });
  it.each(['../connections', '..', '.', 'id?workspace_id=other', 'id/plan', ''])(
    'rejects unsafe resource IDs: %p',
    async (migration_id) => {
      const reqContext = context();
      expect(
        (await tool('get_migration').handler({ reqContext, args: { workspace_id: workspace, migration_id } }))
          .isError,
      ).toBe(true);
      expect(reqContext.client.get).not.toHaveBeenCalled();
    },
  );
  it('preserves pagination and embedded plan payloads without changing casing or hashes', async () => {
    const payload = {
      data: { plan: { sourceConnector: 'csv', planHash: 'exact-hash' } },
      pagination: { page: 2, has_next: true },
      ctx_id: 'trace',
    };
    const reqContext = context(jest.fn().mockResolvedValue(payload));
    const result = await tool('list_migrations').handler({
      reqContext,
      args: { workspace_id: workspace, page: 2, limit: 25 },
    });
    expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/migrations', {
      query: { workspace_id: workspace, page: 2, limit: 25 },
    });
    expect(result.structuredContent).toMatchObject(payload);
  });
  it('preserves the API journey stages, bounded blockers and absent optional fields', async () => {
    const payload = {
      data: {
        migration_id: 'migration-1',
        current_stage: 'plan',
        stages: [
          { key: 'assessment', state: 'unknown', optional: true },
          {
            key: 'plan',
            state: 'blocked',
            blockers: [
              { code: 'FERRY_DESTINATION_IDENTITY_REQUIRED', message: 'Map a destination identity.' },
            ],
            next_action: { code: 'review_mapping', label: 'Review mapping', url: '/mapping' },
          },
          { key: 'scan_mapping', state: 'not_done', blockers: [] },
          { key: 'transfer_cutover', state: 'not_done' },
        ],
        next_action: { code: 'review_mapping', label: 'Review mapping', url: '/mapping' },
      },
    };
    const reqContext = context(jest.fn().mockResolvedValue(payload));
    const result = await tool('get_migration_journey').handler({
      reqContext,
      args: { workspace_id: workspace, migration_id: 'migration-1' },
    });
    expect(result.structuredContent).toMatchObject(payload);
    expect(result.structuredContent).not.toHaveProperty('data.stages[0].next_action');
    expect(reqContext.client.get).toHaveBeenCalledTimes(1);
  });
  it('forwards version-pinned evidence pagination and preserves unknown, reference and missing link values', async () => {
    const payload = {
      data: {
        workspace_id: workspace,
        migration_id: 'migration-1',
        stage: 'plan',
        result_version: 'v1',
        state: 'blocked',
        total: 200,
        offset: 20,
        next_offset: 40,
        entries: [{ key: 'route', path: '/routes/route', value_type: 'object', value: null, item_count: 5 }],
        text: null,
      },
    };
    const reqContext = context(jest.fn().mockResolvedValue(payload));
    const result = await tool('get_migration_result').handler({
      reqContext,
      args: {
        workspace_id: workspace,
        migration_id: 'migration-1',
        stage: 'plan',
        path: '/routes',
        offset: 20,
        limit: 20,
        expected_result_version: 'v1',
      },
    });
    expect(reqContext.client.get).toHaveBeenCalledWith(
      '/api/v2/migrate/migrations/migration-1/results/plan',
      {
        query: {
          workspace_id: workspace,
          path: '/routes',
          offset: 20,
          limit: 20,
          expected_result_version: 'v1',
        },
      },
    );
    expect(result.structuredContent).toMatchObject(payload);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(payload) }]);
    expect(result.structuredContent).not.toHaveProperty('data.review_url');
    expect(reqContext.client.get).toHaveBeenCalledTimes(1);
  });
  it.each([
    { stage: 'assessment' },
    { stage: 'plan', offset: -1 },
    { stage: 'plan', limit: 101 },
    { stage: 'plan', expected_result_version: '' },
  ])('rejects invalid result arguments %j before calling the API', async (args) => {
    const reqContext = context();
    const result = await tool('get_migration_result').handler({
      reqContext,
      args: {
        workspace_id: workspace,
        migration_id: 'migration-1',
        ...args,
      },
    });
    expect(result.isError).toBe(true);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });
  it('preserves stale evidence conflicts without replacing the pinned result version', async () => {
    const error = Object.assign(new Error('Evidence changed'), {
      status: 409,
      error: { code: 'FERRY_RESULT_STALE', message: 'Evidence changed' },
    });
    const reqContext = context(jest.fn().mockRejectedValue(error));
    const result = await tool('get_migration_result').handler({
      reqContext,
      args: {
        workspace_id: workspace,
        migration_id: 'migration-1',
        stage: 'plan',
        expected_result_version: 'v1',
      },
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { status_code: 409, code: 'FERRY_RESULT_STALE' },
    });
    expect(reqContext.client.get).toHaveBeenCalledTimes(1);
    expect(reqContext.client.get).toHaveBeenCalledWith(
      '/api/v2/migrate/migrations/migration-1/results/plan',
      {
        query: { workspace_id: workspace, expected_result_version: 'v1' },
      },
    );
  });
  it.each([401, 403, 404, 409, 429, 503])(
    'preserves API status %s as an error, without fallback',
    async (status) => {
      const error = Object.assign(new Error('Migration unavailable'), {
        status,
        error: { code: 'FERRY_PLAN_NOT_READY', message: 'Migration unavailable', ctx_id: 'trace' },
      });
      const reqContext = context(jest.fn().mockRejectedValue(error));
      const result = await tool('get_migration_plan').handler({
        reqContext,
        args: { workspace_id: workspace, migration_id: 'migration-1' },
      });
      expect(result).toMatchObject({
        isError: true,
        structuredContent: { status_code: status, code: 'FERRY_PLAN_NOT_READY', ctx_id: 'trace' },
      });
      expect(reqContext.client.get).toHaveBeenCalledTimes(1);
    },
  );
  it('uses the real SDK transport with bearer auth, canonical routing and workspace query', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { items: [] } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const reqContext = context();
    reqContext.client = new Sanka({
      apiKey: 'test-token',
      baseURL: 'https://api-v2.example.com',
      fetch: fetchMock,
    });
    await tool('list_migrations').handler({ reqContext, args: { workspace_id: workspace } });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://api-v2.example.com/api/v2/migrate/migrations?workspace_id=${workspace}`,
    );
    expect(options.method).toBe('GET');
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token');
  });
});
