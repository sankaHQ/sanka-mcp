import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { migrationReadTools, startMigrationPlanTool } from '../../packages/mcp-server/src/migration-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const args = { workspace_id: workspace, migration_id: 'migration-1' };
const queued = { data: { id: 'migration-1', status: 'planning' }, ctx_id: 'trace' };
const context = () =>
  ({
    client: { post: jest.fn().mockResolvedValue(queued), get: jest.fn() },
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

describe('migration planning', () => {
  beforeAll(() => configureLogger({ level: 'error', pretty: false }));

  it('registers planning as a stateful tool and retains the existing plan reader', () => {
    expect(startMigrationPlanTool.metadata).toMatchObject({ operation: 'write', httpMethod: 'POST' });
    expect(startMigrationPlanTool.tool.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
    expect(startMigrationPlanTool.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
    for (const profile of ['full', 'hosted'] as const) {
      const names = selectTools(undefined, profile).map((tool) => tool.tool.name);
      expect(names.filter((name) => name === 'start_migration_plan')).toHaveLength(1);
      expect(names.filter((name) => name === 'get_migration_plan')).toHaveLength(1);
      expect(names).not.toContain('start_migration_scan');
    }
    expect(
      migrationReadTools.find((tool) => tool.tool.name === 'get_migration_plan')!.tool.description,
    ).toEqual(expect.stringContaining('FERRY_DESTINATION_IDENTITY_REQUIRED'));
    expect(
      migrationReadTools.find((tool) => tool.tool.name === 'get_migration_plan')!.tool.description,
    ).toEqual(expect.stringContaining('quarantine_properties_missing'));
    expect(startMigrationPlanTool.tool.description).toEqual(expect.stringContaining('blocked plan'));
  });

  it.each([{}, { sample_size: 1 }, { sample_size: 25, force: true }, { force: false }])(
    'forwards only planning fields as body, leaving defaults to the API: %p',
    async (options) => {
      const reqContext = context();
      const result = await startMigrationPlanTool.handler({ reqContext, args: { ...args, ...options } });
      expect(reqContext.client.post).toHaveBeenCalledWith('/api/v2/migrate/migrations/migration-1/plan', {
        query: { workspace_id: workspace },
        body: options,
        maxRetries: 0,
      });
      expect(reqContext.client.get).not.toHaveBeenCalled();
      expect(result.structuredContent).toEqual({ ...queued, workspace_id: workspace });
      expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(queued);
    },
  );

  it.each([
    undefined,
    {},
    { migration_id: 'migration-1' },
    { workspace_id: workspace },
    { ...args, workspace_id: otherWorkspace },
    { ...args, workspace_id: 'current' },
    { ...args, migration_id: '../apply' },
    { ...args, migration_id: 'id?force=true' },
    { ...args, sample_size: 0 },
    { ...args, sample_size: 1.5 },
    { ...args, sample_size: '10' },
    { ...args, sample_size: null },
    { ...args, force: 'true' },
    { ...args, force: null },
    { ...args, plan_hash: 'not-apply' },
    { ...args, workspace_code: 'alternate' },
    { ...args, destination_id: 'changed' },
    { ...args, source_id: 'changed' },
  ])('rejects invalid scope, path or planning arguments without dispatch: %p', async (invalidArgs) => {
    const reqContext = context();
    expect((await startMigrationPlanTool.handler({ reqContext, args: invalidArgs })).isError).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });

  it('fails closed when authentication is missing', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    expect((await startMigrationPlanTool.handler({ reqContext, args })).isError).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });

  it('still pins the explicit workspace when optional session metadata is absent', async () => {
    const reqContext = context();
    delete reqContext.auth!.oauth.workspace_id;
    await startMigrationPlanTool.handler({ reqContext, args: { ...args, workspace_id: otherWorkspace } });
    expect(reqContext.client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: { workspace_id: otherWorkspace } }),
    );
  });

  it('preserves an already-planned response and does not claim a new scan was started', async () => {
    const reqContext = context();
    const payload = { data: { id: 'migration-1', status: 'planned' }, ctx_id: 'dedupe' };
    (reqContext.client.post as jest.Mock).mockResolvedValue(payload);
    const result = await startMigrationPlanTool.handler({ reqContext, args });
    expect(result.structuredContent).toEqual({ ...payload, workspace_id: workspace });
  });

  it.each([
    [401, 'INVALID_AUTHENTICATION'],
    [403, 'PERMISSION_DENIED'],
    [404, 'NOT_FOUND'],
    [409, 'FERRY_MIGRATION_STATE_INVALID'],
    [429, 'RATE_LIMITED'],
    [503, 'FERRY_PLAN_PIPELINE_SUBMIT_FAILED'],
  ])('preserves API error %s without a fallback mutation', async (status, code) => {
    const reqContext = context();
    (reqContext.client.post as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Planning rejected'), {
        status,
        error: { code, message: 'Planning rejected', ctx_id: 'trace' },
      }),
    );
    const result = await startMigrationPlanTool.handler({ reqContext, args });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { code, status_code: status, ctx_id: 'trace' },
    });
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });

  it.each([202, 503])(
    'uses authenticated SDK POST with explicit scope and no retries for HTTP %s',
    async (status) => {
      const payload = status === 202 ? queued : { error: { message: 'Unavailable' } };
      const fetchMock = jest.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify(payload), {
            status,
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
      const result = await startMigrationPlanTool.handler({
        reqContext,
        args: { ...args, sample_size: 10, force: true },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url.toString()).toBe(
        `https://api-v2.example.com/api/v2/migrate/migrations/migration-1/plan?workspace_id=${workspace}`,
      );
      expect(options.method).toBe('POST');
      expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token');
      expect(JSON.parse(options.body)).toEqual({ sample_size: 10, force: true });
      expect(Boolean(result.isError)).toBe(status === 503);
    },
  );

  it('keeps plan retrieval GET-only and preserves the embedded plan hash and mapping keys', async () => {
    const reqContext = context();
    const payload = {
      data: { plan_hash: 'exact-plan-hash', plan: { objectMappings: [{ sourceObject: 'Contact' }] } },
    };
    (reqContext.client.get as jest.Mock).mockResolvedValue(payload);
    const reader = migrationReadTools.find((tool) => tool.tool.name === 'get_migration_plan')!;
    const result = await reader.handler({ reqContext, args });
    expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/migrations/migration-1/plan', {
      query: { workspace_id: workspace },
    });
    expect(reqContext.client.post).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject(payload);
  });

  it('preserves blocked plan safety evidence for review without starting a write', async () => {
    const reqContext = context();
    const payload = {
      data: {
        ready: 0,
        risk_level: 'high',
        plan_hash: 'exact-plan-hash',
        document: { warnings: ['FERRY_DESTINATION_IDENTITY_REQUIRED', 'quarantine_properties_missing'] },
        destinationSafety: {
          status: 'blocked',
          quarantine: { reasonCodes: ['quarantine_properties_missing'] },
        },
      },
    };
    (reqContext.client.get as jest.Mock).mockResolvedValue(payload);
    const reader = migrationReadTools.find((tool) => tool.tool.name === 'get_migration_plan')!;
    const result = await reader.handler({ reqContext, args });
    expect(result.structuredContent).toMatchObject(payload);
    expect(reqContext.client.get).toHaveBeenCalledTimes(1);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });
});
