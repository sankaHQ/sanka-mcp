import Sanka from 'sanka-sdk';
import { migrationInspectionTools } from '../../packages/mcp-server/src/migration-inspection-tools';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hash = `sha256:${'a'.repeat(64)}`;
const cases = [
  ['inspect_migration', 'get', 'inspection', {}],
  ['list_migration_source_objects', 'get', 'source-objects', {}],
  [
    'scan_migration',
    'post',
    'scan',
    { expected_binding_hash: hash, confirm: true, object_types: ['Contact'] },
  ],
  ['get_migration_mapping', 'get', 'mapping', {}],
  [
    'save_migration_mapping',
    'put',
    'mapping',
    {
      expected_binding_hash: hash,
      expected_mapping_hash: hash,
      confirm: true,
      fields: [{ sourceField: 'Contact.Id', targetObject: 'contacts', targetField: 'id', identity: true }],
    },
  ],
  [
    'validate_migration_mapping',
    'post',
    'validate',
    {
      expected_binding_hash: hash,
      expected_mapping_hash: hash,
      confirm: true,
      routes: ['route-1'],
      sample_size: 10,
    },
  ],
  ['get_migration_report', 'get', 'reports/transfer', { stage: 'transfer' }],
] as const;
const tool = (name: string) => migrationInspectionTools.find((t) => t.tool.name === name)!;
const envelope = {
  success: true,
  data: {
    migration_id: 'run-1',
    binding_hash: hash,
    mapping_hash: hash,
    fields: [],
    reports: { validate: { checks: [{ status: 'not_run' }] } },
  },
  meta: { ctx_id: 'trace' },
};
const context = () =>
  ({
    client: {
      get: jest.fn().mockResolvedValue(envelope),
      post: jest.fn().mockResolvedValue(envelope),
      put: jest.fn().mockResolvedValue(envelope),
    },
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        workspace_id: workspace,
        scopes: ['mcp:access'],
        authorizationServerUrl: 'https://example.com',
      },
    },
  }) as unknown as McpRequestContext;
beforeAll(() => configureLogger({ level: 'error', pretty: false }));

describe.each(cases)('%s', (name, method, path, extra) => {
  it('registers once in both profiles', () => {
    for (const profile of ['hosted', 'full'] as const)
      expect(selectTools(undefined, profile).filter((t) => t.tool.name === name)).toHaveLength(1);
  });
  it('preserves exact request and response evidence', async () => {
    const reqContext = context();
    const args = { workspace_id: workspace, migration_id: 'run-1', ...extra };
    const result = await tool(name).handler({ reqContext, args });
    const body = Object.fromEntries(
      Object.entries(extra).filter(([key]) => !['confirm', 'stage'].includes(key)),
    );
    expect(reqContext.client[method]).toHaveBeenCalledWith(
      `/api/v2/migrate/migrations/run-1/${path}`,
      method === 'get' ?
        { query: { workspace_id: workspace } }
      : { query: { workspace_id: workspace }, body, maxRetries: 0 },
    );
    expect(result.structuredContent).toMatchObject({ ...envelope, workspace_id: workspace });
  });
  it.each([undefined, 'invalid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])(
    'rejects missing/mismatched workspace %s',
    async (workspace_id) => {
      const reqContext = context();
      expect(
        (await tool(name).handler({ reqContext, args: { ...extra, migration_id: 'run-1', workspace_id } }))
          .isError,
      ).toBe(true);
      expect(reqContext.client[method]).not.toHaveBeenCalled();
    },
  );
  it('rejects absent authentication', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    expect(
      (
        await tool(name).handler({
          reqContext,
          args: { ...extra, migration_id: 'run-1', workspace_id: workspace },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client[method]).not.toHaveBeenCalled();
  });
  it('rejects unsupported idempotency and channel overrides', async () => {
    for (const bad of [{ idempotency_key: 'unsupported' }, { source_channel_id: 'other' }]) {
      const reqContext = context();
      expect(
        (
          await tool(name).handler({
            reqContext,
            args: { ...extra, ...bad, migration_id: 'run-1', workspace_id: workspace },
          })
        ).isError,
      ).toBe(true);
      expect(reqContext.client[method]).not.toHaveBeenCalled();
    }
  });
  if (method !== 'get') {
    it('requires confirmation and reviewed binding hash', async () => {
      for (const bad of [{ confirm: false }, { expected_binding_hash: undefined }]) {
        const reqContext = context();
        expect(
          (
            await tool(name).handler({
              reqContext,
              args: { ...extra, ...bad, migration_id: 'run-1', workspace_id: workspace },
            })
          ).isError,
        ).toBe(true);
        expect(reqContext.client[method]).not.toHaveBeenCalled();
      }
    });
    it('disables actual SDK retries on stateful errors', async () => {
      const reqContext = context();
      const fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 503 }));
      reqContext.client = new Sanka({
        apiKey: 'fixture',
        baseURL: 'https://example.com',
        maxRetries: 2,
        fetch,
      });
      const result = await tool(name).handler({
        reqContext,
        args: { ...extra, migration_id: 'run-1', workspace_id: workspace },
      });
      expect(result.isError).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  }
});

it('publishes typed identity, relationship, filter and value-map fields', () => {
  const schema = tool('save_migration_mapping').tool.inputSchema;
  const text = JSON.stringify(schema);
  for (const field of [
    'sourceField',
    'targetField',
    'identity',
    'mappingKind',
    'associationTypeId',
    'sourceFilter',
    'valueMap',
    'unmappedValuePolicy',
  ])
    expect(text).toContain(field);
});

it.each([{ identity: 'yes' }, { mappingKind: 'unknown' }, { typoTarget: 'lost' }])(
  'rejects invalid mapping fields before dispatch: %p',
  async (extra) => {
    const reqContext = context();
    const result = await tool('save_migration_mapping').handler({
      reqContext,
      args: {
        workspace_id: workspace,
        migration_id: 'run-1',
        expected_binding_hash: hash,
        expected_mapping_hash: hash,
        confirm: true,
        fields: [{ sourceField: 'Contact.Id', targetObject: 'contacts', targetField: 'id', ...extra }],
      },
    });
    expect(result.isError).toBe(true);
    expect(reqContext.client.put).not.toHaveBeenCalled();
  },
);
