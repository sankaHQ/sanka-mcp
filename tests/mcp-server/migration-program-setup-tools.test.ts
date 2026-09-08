import Sanka from 'sanka-sdk';
import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import { configureLogger } from '../../packages/mcp-server/src/logger';
beforeAll(() => configureLogger({ level: 'error', pretty: false }));
import { migrationSetupTools } from '../../packages/mcp-server/src/migration-setup-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const endpoint = {
  id: 'source-1',
  type: 'salesforce',
  connection: 'reviewed-connection',
  objects: ['Contact'],
  options: { filters: [{ active: true }] },
};
const envelope = {
  success: true,
  data: {
    id: 'program-1',
    object: 'program',
    sources: [endpoint],
    destinations: [],
    migration_ids: [],
    status: 'draft',
  },
  meta: { ctx_id: 'trace' },
};
const context = () =>
  ({
    client: {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue(envelope),
      patch: jest.fn().mockResolvedValue(envelope),
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
const cases = [
  ['create_migration_program', 'post', '/programs', { template: 'reviewed-template', sources: [endpoint] }],
  [
    'update_migration_program',
    'patch',
    '/programs/program-1',
    { program_id: 'program-1', description: null, destinations: [] },
  ],
] as const;
const tool = (name: string) => migrationSetupTools.find((item) => item.tool.name === name)!;

describe.each(cases)('%s', (name, method, route, fields) => {
  it('is registered once in both profiles with accurate method and annotations', () => {
    for (const profile of ['full', 'hosted'] as const) {
      expect(selectTools(undefined, profile).filter((item) => item.tool.name === name)).toHaveLength(1);
    }
    expect(tool(name).metadata.httpMethod).toBe(method.toUpperCase());
    expect(tool(name).tool.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: method === 'patch',
    });
    expect(tool(name).tool.inputSchema['additionalProperties']).toBe(false);
  });

  it('forwards exact body, pinned query and no-retry option, preserving returned endpoint IDs', async () => {
    const reqContext = context();
    const result = await tool(name).handler({
      reqContext,
      args: { workspace_id: workspace, confirm: true, ...fields },
    });
    const { program_id: ignored, ...body } = fields as Record<string, unknown>;
    expect(reqContext.client[method]).toHaveBeenCalledWith(`/api/v2/migrate${route}`, {
      query: { workspace_id: workspace },
      body,
      maxRetries: 0,
    });
    expect(reqContext.client.get).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      ...envelope,
      workspace_id: workspace,
      program_id: 'program-1',
      next_tool: 'get_migration_program',
    });
  });

  it.each([undefined, false, 'true'])('rejects missing or invalid confirmation %p', async (confirm) => {
    const reqContext = context();
    expect(
      (await tool(name).handler({ reqContext, args: { ...fields, workspace_id: workspace, confirm } }))
        .isError,
    ).toBe(true);
    expect(reqContext.client[method]).not.toHaveBeenCalled();
  });

  it.each([undefined, 'workspace-code', otherWorkspace])(
    'rejects invalid or mismatched workspace %p',
    async (workspace_id) => {
      const reqContext = context();
      expect(
        (await tool(name).handler({ reqContext, args: { ...fields, confirm: true, workspace_id } })).isError,
      ).toBe(true);
      expect(reqContext.client[method]).not.toHaveBeenCalled();
    },
  );

  it('allows explicit workspace when optional auth binding is absent', async () => {
    const reqContext = context();
    delete reqContext.auth!.oauth.workspace_id;
    await tool(name).handler({ reqContext, args: { ...fields, confirm: true, workspace_id: workspace } });
    expect(reqContext.client[method]).toHaveBeenCalledTimes(1);
  });

  it('requires server authentication even with confirm=true', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    expect(
      (await tool(name).handler({ reqContext, args: { ...fields, confirm: true, workspace_id: workspace } }))
        .isError,
    ).toBe(true);
    expect(reqContext.client[method]).not.toHaveBeenCalled();
  });

  it.each([
    { idempotency_key: 'not-supported' },
    { expected_revision: 1 },
    { plan_hash: 'invented' },
    { sources: null },
    { destinations: [{ ...endpoint, channel_id: 'invented' }] },
    { sources: [{ ...endpoint, options: { nested: [{ api_key: 'never-echo-this' }] } }] },
    { sources: [{ ...endpoint, objects: 'contacts' }] },
    { sources: [{ ...endpoint, objects: Array(201).fill('Contact') }] },
    { sources: [{ ...endpoint, type: ' ' }] },
  ])('rejects unsupported/unsafe arguments %p', async (extra) => {
    const reqContext = context();
    const result = await tool(name).handler({
      reqContext,
      args: { ...fields, confirm: true, workspace_id: workspace, ...extra },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('never-echo-this');
    expect(reqContext.client[method]).not.toHaveBeenCalled();
  });

  it('makes only one actual SDK HTTP attempt after server failure', async () => {
    const reqContext = context();
    const fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    reqContext.client = new Sanka({
      apiKey: 'fixture',
      baseURL: 'https://example.com',
      maxRetries: 2,
      fetch,
    });
    const result = await tool(name).handler({
      reqContext,
      args: { ...fields, confirm: true, workspace_id: workspace },
    });
    expect(result.isError).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({ workspace_id: workspace, status_code: 503 });
  });
});

it('rejects an empty update and preserves omitted fields on a rename', async () => {
  const reqContext = context();
  const args = { workspace_id: workspace, program_id: 'program-1', confirm: true };
  expect((await tool('update_migration_program').handler({ reqContext, args })).isError).toBe(true);
  expect(reqContext.client.patch).not.toHaveBeenCalled();
  await tool('update_migration_program').handler({ reqContext, args: { ...args, name: 'Reviewed rename' } });
  expect(reqContext.client.patch).toHaveBeenCalledWith('/api/v2/migrate/programs/program-1', {
    query: { workspace_id: workspace },
    body: { name: 'Reviewed rename' },
    maxRetries: 0,
  });
});

it.each([{ id: 'different-program' }, { workspace_id: otherWorkspace }])(
  'withholds a mismatched response %p',
  async (extra) => {
    const reqContext = context();
    (reqContext.client.patch as jest.Mock).mockResolvedValue({
      ...envelope,
      data: { ...envelope.data, ...extra },
    });
    const result = await tool('update_migration_program').handler({
      reqContext,
      args: { workspace_id: workspace, program_id: 'program-1', confirm: true, name: 'Reviewed rename' },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).not.toHaveProperty('data');
  },
);

it.each([
  ['Set up a CRM migration program', 'data_migration', 'create_migration_program'],
  ['Migrate a Django repository to FastAPI', 'code_migration_evidence', 'get_code_migration_plan'],
])('routes migration guidance accurately: %s', async (intent, family, recommended) => {
  const result = await getCapabilityGuidanceTool.handler({ reqContext: context(), args: { intent } });
  expect(result.structuredContent).toMatchObject({
    guidance: { intent_family: family, recommended_tools: expect.arrayContaining([recommended]) },
  });
  expect(JSON.stringify(result)).toContain('not proof of approval');
});
