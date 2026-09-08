import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { migrationSetupTools } from '../../packages/mcp-server/src/migration-setup-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const configHash = 'a'.repeat(64);
const key = 'batch-submit-001';
const source = {
  name: 'Reviewed source',
  programId: 'program-1',
  destination: { type: 'hubspot', connection: 'destination-1' },
  sourceObject: 'contacts',
  identityField: 'id',
  cursorField: 'updated_at',
  tieBreakerField: 'id',
  fields: [
    { key: 'id', required: true },
    { key: 'updated_at', dataType: 'datetime', required: true },
  ],
  writePolicy: 'update_only',
  maxRecords: 100,
  maxBytes: 100000,
  scheduleMetadata: { interval: 'daily' },
  templateRunId: 'template-1',
};
const batch = {
  source_id: 'source-1',
  idempotency_key: key,
  batchId: 'external-001',
  sequence: 1,
  sourceObject: 'contacts',
  cursor: {
    field: 'updated_at',
    value: '2026-09-07T00:00:00Z',
    tieBreakerField: 'id',
    tieBreakerValue: 'record-1',
  },
  records: [{ id: 'record-1', updated_at: '2026-09-07T00:00:00Z' }],
};
const migration = {
  name: 'Reviewed migration',
  source: {
    type: 'salesforce',
    connection: 'source-1',
    options: { objects: ['Contact'], filters: [{ field: 'Active', value: true }] },
  },
  target: { type: 'hubspot', connection: 'destination-1', options: {} },
  strategy: { conflict_policy: 'update_only' },
  verify: { count: true },
};
const writes = [
  ['create_migration', '/migrations', migration],
  [
    'create_program_migration',
    '/programs/program-1/migrations',
    {
      program_id: 'program-1',
      source_endpoint_id: 'src-1',
      destination_endpoint_id: 'dest-1',
      name: 'Program migration',
    },
  ],
  ['create_ingestion_source', '/ingestion-sources', source],
  [
    'activate_ingestion_source',
    '/ingestion-sources/source-1/activate',
    { source_id: 'source-1', expectedConfigHash: configHash },
  ],
  [
    'pause_ingestion_source',
    '/ingestion-sources/source-1/pause',
    { source_id: 'source-1', expectedConfigHash: configHash },
  ],
  ['stage_ingestion_batch', '/ingestion-sources/source-1/batches', batch],
] as const;
const getTool = (name: string) => migrationSetupTools.find((tool) => tool.tool.name === name)!;
const context = (data: Record<string, unknown> = { id: 'resource-1', status: 'created' }) =>
  ({
    client: {
      get: jest.fn().mockResolvedValue({ success: true, data, meta: { ctx_id: 'trace' } }),
      post: jest.fn().mockResolvedValue({ success: true, data, meta: { ctx_id: 'trace' } }),
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
const all = [
  ...writes,
  ['get_ingestion_source', '/ingestion-sources/source-1', { source_id: 'source-1' }] as const,
];
beforeAll(() => configureLogger({ level: 'error', pretty: false }));

it.each([
  { source: undefined },
  { target: undefined },
  { runtime_kind: 'code' },
  { source: { type: 'salesforce', options: null } },
  { target: { type: 'hubspot', credentials: {} } },
])('rejects invalid migration spec shape %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await getTool('create_migration').handler({
        reqContext,
        args: { ...migration, ...extra, workspace_id: workspace, confirm: true },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it('withholds a different returned source ID', async () => {
  const reqContext = context({ id: 'other-source', configHash });
  const result = await getTool('get_ingestion_source').handler({
    reqContext,
    args: { workspace_id: workspace, source_id: 'source-1' },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain('other-source');
});

it('withholds a different returned Program binding', async () => {
  const reqContext = context({ id: 'new-source', programId: 'other-program', configHash });
  const result = await getTool('create_ingestion_source').handler({
    reqContext,
    args: { ...source, workspace_id: workspace, confirm: true },
  });
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ workspace_id: workspace, program_id: source.programId });
  expect(JSON.stringify(result)).not.toContain('other-program');
});

it('preserves the original key, batch ID and payload on explicitly repeated identical submission', async () => {
  const data = {
    id: 'batch-1',
    sourceId: 'source-1',
    batchId: batch.batchId,
    status: 'staged',
    runId: 'run-1',
  };
  const reqContext = context(data);
  const args = { ...batch, workspace_id: workspace, confirm: true };
  const first = await getTool('stage_ingestion_batch').handler({ reqContext, args });
  const repeated = await getTool('stage_ingestion_batch').handler({ reqContext, args });
  expect(first.structuredContent).toEqual(repeated.structuredContent);
  const calls = (reqContext.client.post as jest.Mock).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[1][1].headers).toEqual({ 'Idempotency-Key': key });
});

it('registers existing setup and ingestion tools exactly once in both profiles with accurate metadata', () => {
  expect(migrationSetupTools).toHaveLength(9);
  for (const [name] of all) {
    const tool = getTool(name);
    const readOnly = name === 'get_ingestion_source';
    expect(tool.tool.annotations).toMatchObject({
      readOnlyHint: readOnly,
      destructiveHint: false,
      idempotentHint: readOnly,
    });
    expect(tool.metadata).toMatchObject({
      httpMethod: readOnly ? 'GET' : 'POST',
      operation: readOnly ? 'read' : 'write',
    });
    expect(tool.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
    expect(tool.tool.inputSchema.required).toContain('workspace_id');
    for (const profile of ['full', 'hosted'] as const)
      expect(selectTools(undefined, profile).filter((t) => t.tool.name === name)).toHaveLength(1);
  }
});

describe.each(all)('%s workspace/auth enforcement', (name, _path, params) => {
  it.each([undefined, null, '', '12345', 'current', otherWorkspace])(
    'fails closed for workspace %p',
    async (value) => {
      const reqContext = context();
      const result = await getTool(name).handler({
        reqContext,
        args: {
          ...params,
          ...(name !== 'get_ingestion_source' ? { confirm: true } : {}),
          workspace_id: value,
        },
      });
      expect(result.isError).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
      expect(reqContext.client.get).not.toHaveBeenCalled();
    },
  );
  it('requires authentication before dispatch', async () => {
    const reqContext = context();
    reqContext.auth!.authMode = 'none';
    const result = await getTool(name).handler({
      reqContext,
      args: {
        ...params,
        workspace_id: workspace,
        ...(name !== 'get_ingestion_source' ? { confirm: true } : {}),
      },
    });
    expect(result.isError).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
    expect(reqContext.client.get).not.toHaveBeenCalled();
  });
  it('keeps explicit workspace when optional auth workspace metadata is absent', async () => {
    const reqContext = context();
    delete reqContext.auth!.oauth.workspace_id;
    await getTool(name).handler({
      reqContext,
      args: {
        ...params,
        workspace_id: otherWorkspace,
        ...(name !== 'get_ingestion_source' ? { confirm: true } : {}),
      },
    });
    expect(
      name === 'get_ingestion_source' ? reqContext.client.get : reqContext.client.post,
    ).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: { workspace_id: otherWorkspace } }),
    );
  });
});

describe.each(writes)('%s confirmed submission', (name, path, params) => {
  it.each([undefined, false, 'true', 1])(
    'rejects confirm=%p without performing any operation',
    async (confirm) => {
      const reqContext = context();
      expect(
        (await getTool(name).handler({ reqContext, args: { ...params, workspace_id: workspace, confirm } }))
          .isError,
      ).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
      expect(reqContext.client.get).not.toHaveBeenCalled();
    },
  );
  it('forwards exact contract fields without implicit planning, apply or changing inputs', async () => {
    const reqContext = context();
    const supplied = { ...params, workspace_id: workspace, confirm: true };
    const original = JSON.stringify(supplied);
    await getTool(name).handler({ reqContext, args: supplied });
    const fields = Object.fromEntries(
      Object.entries(params).filter(
        ([field]) => !['source_id', 'program_id', 'idempotency_key'].includes(field),
      ),
    );
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
    expect(reqContext.client.post).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
      query: { workspace_id: workspace },
      body: fields,
      maxRetries: 0,
      ...(name === 'stage_ingestion_batch' ? { headers: { 'Idempotency-Key': key } } : {}),
    });
    expect(reqContext.client.get).not.toHaveBeenCalled();
    expect(JSON.stringify(supplied)).toBe(original);
  });
  it('uses authenticated SDK HTTP and makes one POST attempt even when SDK defaults allow retries', async () => {
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
          args: { ...params, workspace_id: workspace, confirm: true },
        })
      ).isError,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(`https://api-v2.example.com/api/v2/migrate${path}?workspace_id=${workspace}`);
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(options.headers).get('idempotency-key')).toBe(
      name === 'stage_ingestion_batch' ? key : null,
    );
  });
});

it('reads one ingestion source configuration and bindings without a write', async () => {
  const data = {
    id: 'source-1',
    status: 'paused',
    configHash,
    workspaceId: workspace,
    programId: 'program-1',
    destinationChannelId: 'destination-1',
    lastReceivedSequence: 3,
  };
  const reqContext = context(data);
  const result = await getTool('get_ingestion_source').handler({
    reqContext,
    args: { workspace_id: workspace, source_id: 'source-1' },
  });
  expect(reqContext.client.get).toHaveBeenCalledWith('/api/v2/migrate/ingestion-sources/source-1', {
    query: { workspace_id: workspace },
  });
  expect(reqContext.client.post).not.toHaveBeenCalled();
  expect(result.structuredContent).toMatchObject({
    data,
    workspace_id: workspace,
    source_id: 'source-1',
    program_id: 'program-1',
    config_hash: configHash,
    status: 'paused',
  });
});

it('supports optional create idempotency only as a header', async () => {
  const reqContext = context();
  await getTool('create_migration').handler({
    reqContext,
    args: { ...migration, workspace_id: workspace, confirm: true, idempotency_key: key },
  });
  expect(reqContext.client.post).toHaveBeenCalledWith('/api/v2/migrate/migrations', {
    query: { workspace_id: workspace },
    body: migration,
    maxRetries: 0,
    headers: { 'Idempotency-Key': key },
  });
});

it.each(writes.filter(([name]) => !['create_migration', 'stage_ingestion_batch'].includes(name)))(
  '%s rejects unsupported idempotency guarantees',
  async (name, _path, params) => {
    const reqContext = context();
    expect(
      (
        await getTool(name).handler({
          reqContext,
          args: { ...params, workspace_id: workspace, confirm: true, idempotency_key: key },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  },
);

it.each([undefined, '', 'short', 'a'.repeat(201), 'bad\r\nheader'])(
  'requires a valid staging idempotency key: %p',
  async (idempotency_key) => {
    const reqContext = context();
    expect(
      (
        await getTool('stage_ingestion_batch').handler({
          reqContext,
          args: { ...batch, workspace_id: workspace, confirm: true, idempotency_key },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  },
);

it.each(['source_endpoint_id', 'destination_endpoint_id'])(
  'program migration requires pinned %s even though API allows implicit selection',
  async (missing) => {
    const reqContext = context();
    const supplied: Record<string, unknown> = { ...writes[1][2], workspace_id: workspace, confirm: true };
    delete supplied[missing];
    expect((await getTool('create_program_migration').handler({ reqContext, args: supplied })).isError).toBe(
      true,
    );
    expect(reqContext.client.post).not.toHaveBeenCalled();
  },
);

it.each(['activate', 'pause'])('%s requires the exact reviewed 64-hex config hash', async (action) => {
  for (const expectedConfigHash of [undefined, '', 'sha256:' + configHash, 'g'.repeat(64)]) {
    const reqContext = context();
    expect(
      (
        await getTool(`${action}_ingestion_source`).handler({
          reqContext,
          args: { workspace_id: workspace, confirm: true, source_id: 'source-1', expectedConfigHash },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  }
});

it.each([
  { records: [] },
  { records: Array.from({ length: 5001 }, () => ({})) },
  { sequence: 0 },
  { sequence: 1.5 },
  { sequence: Number.MAX_SAFE_INTEGER + 1 },
  { cursor: { ...batch.cursor, tieBreakerValue: undefined } },
  { source_id: '../other' },
  { cursor: { ...batch.cursor, unknown: true } },
  { auto_apply: true },
])('rejects malformed batch envelope %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await getTool('stage_ingestion_batch').handler({
        reqContext,
        args: { ...batch, ...extra, workspace_id: workspace, confirm: true },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { maxRecords: 5001 },
  { maxBytes: 20000001 },
  { writePolicy: 'upsert' },
  { destination: { type: 'salesforce', connection: 'existing' } },
  { destination: { type: 'hubspot', connection: 'existing', password: 'not-a-real-secret' } },
  { fields: [{ key: 'id', dataType: 'object' }] },
  { fields: [] },
])('rejects unsupported ingestion source shape %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await getTool('create_ingestion_source').handler({
        reqContext,
        args: { ...source, ...extra, workspace_id: workspace, confirm: true },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it('forwards Sanka destination configuration without provider credentials', async () => {
  const reqContext = context();
  const destination = { type: 'sanka', object: 'custom-object-1', identityField: 'external_id' };
  await getTool('create_ingestion_source').handler({
    reqContext,
    args: { ...source, destination, workspace_id: workspace, confirm: true },
  });
  expect(reqContext.client.post).toHaveBeenCalledWith(
    '/api/v2/migrate/ingestion-sources',
    expect.objectContaining({ body: { ...source, destination } }),
  );
});

it.each([
  [
    'create_migration',
    {
      ...migration,
      source: { type: 'salesforce', options: { nested: [{ access_token: 'sensitive-fixture' }] } },
    },
  ],
  ['create_ingestion_source', { ...source, scheduleMetadata: { credential: 'sensitive-fixture' } }],
  ['create_ingestion_source', { ...source, fields: [{ key: 'api_key' }] }],
  ['stage_ingestion_batch', { ...batch, records: [{ id: 'record-1', password: 'sensitive-fixture' }] }],
] as const)('%s rejects nested secret fields without echoing values', async (name, params) => {
  const reqContext = context();
  const result = await getTool(name).handler({
    reqContext,
    args: { ...params, workspace_id: workspace, confirm: true },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain('sensitive-fixture');
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects unrepresentable batch record numbers %p without data loss',
  async (value) => {
    const reqContext = context();
    expect(
      (
        await getTool('stage_ingestion_batch').handler({
          reqContext,
          args: { ...batch, records: [{ id: 'record-1', value }], workspace_id: workspace, confirm: true },
        })
      ).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  },
);

it('preserves staged status, run/batch IDs and checkpoint without claiming apply', async () => {
  const data = {
    id: 'batch-1',
    batchId: batch.batchId,
    sourceId: 'source-1',
    workspaceId: workspace,
    runId: 'run-1',
    status: 'staged',
    runStatus: 'ready',
    payloadHash: 'hash-1',
    recordCount: 1,
    checkpoint: { validation: 'not_run', apply: 'not_run' },
  };
  const reqContext = context(data);
  const args = { ...batch, workspace_id: workspace, confirm: true };
  const result = await getTool('stage_ingestion_batch').handler({ reqContext, args });
  const normalized = normalizeToolCallResult({ mcpTool: getTool('stage_ingestion_batch'), result, args });
  expect(normalized.structuredContent).toMatchObject({
    data,
    workspace_id: workspace,
    source_id: 'source-1',
    batch_id: 'batch-1',
    external_batch_id: batch.batchId,
    run_id: 'run-1',
    payload_hash: 'hash-1',
    status: 'staged',
    next_tool: 'get_ingestion_batch',
  });
  expect(JSON.stringify(result.content)).toContain('not evidence of completed transfer');
  expect(normalized.structuredContent).not.toHaveProperty('applied', true);
});

it.each([{ workspaceId: otherWorkspace }, { workspace_id: otherWorkspace }, { sourceId: 'other-source' }])(
  'withholds unexpected API workspace/source binding %p',
  async (extra) => {
    const reqContext = context({ id: 'private-batch', ...extra });
    const result = await getTool('stage_ingestion_batch').handler({
      reqContext,
      args: { ...batch, workspace_id: workspace, confirm: true },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-batch');
    expect(result.structuredContent).toMatchObject({ workspace_id: workspace, source_id: 'source-1' });
  },
);

it.each([401, 403, 404, 409, 413, 422, 429, 503])(
  'preserves API error %i without retrying, activating, planning or applying',
  async (status) => {
    const reqContext = context();
    (reqContext.client.post as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Rejected'), {
        status,
        error: { code: 'FERRY_BATCH_REJECTED', message: 'Rejected', ctx_id: 'trace-error' },
      }),
    );
    const result = await getTool('stage_ingestion_batch').handler({
      reqContext,
      args: { ...batch, workspace_id: workspace, confirm: true },
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        workspace_id: workspace,
        source_id: 'source-1',
        status_code: status,
        code: 'FERRY_BATCH_REJECTED',
      },
    });
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
    expect(reqContext.client.get).not.toHaveBeenCalled();
  },
);
