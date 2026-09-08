import { createHash } from 'node:crypto';
import { developerCloudTools } from '../../packages/mcp-server/src/developer-cloud-tools';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const key = 'approved-cloud-001';
const request = { source_id: runId, source_sha256: 'a'.repeat(64), max_credits: 100 };
const fleet = {
  items: ['one', 'two', 'three'].map((name) => ({
    key: name,
    repository: `team/${name}`,
    revision: 'b'.repeat(40),
    request,
  })),
  max_credits: 300,
  concurrency: 2,
};
const find = (name: string) => developerCloudTools.find((tool) => tool.tool.name === name)!;
const context = (data: Record<string, unknown> = {}) =>
  ({
    client: {
      get: jest.fn().mockResolvedValue({ success: true, data }),
      post: jest.fn().mockResolvedValue({ success: true, data }),
    },
    mcpSessionId: 'synthetic-cloud-test',
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        scopes: ['mcp:access'],
        workspace_id: workspace,
        authorizationServerUrl: 'https://example.test',
      },
    },
  }) as unknown as McpRequestContext;
beforeAll(() => configureLogger({ level: 'error', pretty: false }));

it('registers all eighteen tools without replacing client-evidence tools', () => {
  const tools = selectTools({});
  expect(developerCloudTools).toHaveLength(18);
  for (const tool of developerCloudTools)
    expect(tools.some((item) => item.tool.name === tool.tool.name)).toBe(true);
  expect(tools.some((item) => item.tool.name === 'apply_code_migration')).toBe(true);
});

it.each([
  ['get_developer_cloud_availability', '/cloud-runs/availability', {}],
  ['list_developer_cloud_runs', '/cloud-runs', { limit: 5, cursor: runId }],
  ['get_developer_cloud_run', `/cloud-runs/${runId}`, { run_id: runId }],
  ['list_developer_cloud_events', `/cloud-runs/${runId}/events`, { run_id: runId, cursor: 2, limit: 3 }],
  ['get_developer_cloud_receipt', `/cloud-runs/${runId}/receipt`, { run_id: runId }],
  ['list_developer_cloud_artifacts', `/cloud-runs/${runId}/artifacts`, { run_id: runId }],
  ['list_developer_cloud_certificate_keys', '/cloud-runs/certificate-keys', {}],
  ['get_developer_cloud_certificate', `/cloud-runs/${runId}/certificate`, { run_id: runId }],
  ['list_developer_cloud_fleets', '/cloud-fleets', { limit: 5 }],
  ['get_developer_cloud_fleet', `/cloud-fleets/${runId}`, { fleet_id: runId }],
] as const)('pins read %s to the V2 workspace', async (name, path, args) => {
  const reqContext = context();
  expect(
    (await find(name).handler({ reqContext, args: { ...args, workspace_id: workspace } })).isError,
  ).not.toBe(true);
  const { run_id: _run, fleet_id: _fleet, ...query } = args as Record<string, unknown>;
  expect(reqContext.client.get).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
    query: { ...query, workspace_id: workspace },
  });
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  ['create_developer_cloud_run', '/cloud-runs', request],
  ['create_developer_cloud_fleet', '/cloud-fleets', fleet],
] as const)('preserves cap and idempotency for %s', async (name, path, body) => {
  const reqContext = context({ workspace_id: workspace, id: runId, request: body });
  const result = await find(name).handler({
    reqContext,
    args: { workspace_id: workspace, request: body, idempotency_key: key, confirm: true },
  });
  expect(result.isError).not.toBe(true);
  expect(reqContext.client.post).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
    query: { workspace_id: workspace },
    body,
    headers: { 'Idempotency-Key': key },
    maxRetries: 0,
  });
});

it.each([
  ['cancel_developer_cloud_run', `/cloud-runs/${runId}/cancel`, { run_id: runId }, {}],
  ['cancel_developer_cloud_fleet', `/cloud-fleets/${runId}/cancel`, { fleet_id: runId }, {}],
  [
    'revoke_developer_cloud_certificate',
    `/cloud-runs/${runId}/certificate/revoke`,
    { run_id: runId, request: { reason: 'Candidate withdrawn' } },
    { reason: 'Candidate withdrawn' },
  ],
] as const)('submits only the authorized action %s', async (name, path, args, body) => {
  const reqContext = context();
  expect(
    (await find(name).handler({ reqContext, args: { ...args, workspace_id: workspace, confirm: true } }))
      .isError,
  ).not.toBe(true);
  expect(reqContext.client.post).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
    query: { workspace_id: workspace },
    body,
    maxRetries: 0,
  });
});

it('selective retry preserves new cap, keys and lineage', async () => {
  const body = { item_keys: ['three'], max_credits: 100, concurrency: 1 };
  const reqContext = context({
    id: other,
    workspace_id: workspace,
    retry_of: runId,
    request: { max_credits: 100 },
  });
  expect(
    (
      await find('retry_developer_cloud_fleet').handler({
        reqContext,
        args: {
          workspace_id: workspace,
          fleet_id: runId,
          request: body,
          idempotency_key: key,
          confirm: true,
        },
      })
    ).isError,
  ).not.toBe(true);
  expect(reqContext.client.post).toHaveBeenCalledWith(`/api/v2/migrate/cloud-fleets/${runId}/retry`, {
    query: { workspace_id: workspace },
    body,
    maxRetries: 0,
    headers: { 'Idempotency-Key': key },
  });
});

it.each([
  { max_credits: 0 },
  { max_credits: 1.5 },
  { max_credits: 8001 },
  { source_sha256: 'bad' },
  { secret: 'forbidden' },
])('rejects invalid run before dispatch %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await find('create_developer_cloud_run').handler({
        reqContext,
        args: {
          workspace_id: workspace,
          request: { ...request, ...extra },
          confirm: true,
          idempotency_key: key,
        },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { workspace_id: other },
  { workspace_id: undefined },
  { confirm: false },
  { idempotency_key: undefined },
  { idempotency_key: 'bad\nheader' },
])('requires pinned authorization and stable key %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await find('create_developer_cloud_run').handler({
        reqContext,
        args: { workspace_id: workspace, request, confirm: true, idempotency_key: key, ...extra },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([
  { max_credits: 299 },
  { concurrency: 6 },
  { items: [fleet.items[0], fleet.items[0], fleet.items[1]] },
])('rejects unsafe Fleet selection %p', async (extra) => {
  const reqContext = context();
  expect(
    (
      await find('create_developer_cloud_fleet').handler({
        reqContext,
        args: {
          workspace_id: workspace,
          request: { ...fleet, ...extra },
          confirm: true,
          idempotency_key: key,
        },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).not.toHaveBeenCalled();
});

it.each([{ workspace_id: other }, { request: { ...request, max_credits: 200 } }])(
  'withholds mismatched saved execution %p',
  async (extra) => {
    const reqContext = context({ workspace_id: workspace, request, ...extra });
    expect(
      (
        await find('create_developer_cloud_run').handler({
          reqContext,
          args: { workspace_id: workspace, request, confirm: true, idempotency_key: key },
        })
      ).isError,
    ).toBe(true);
  },
);

it('checks source digest and preserves the declared revision', async () => {
  const bytes = Buffer.from('synthetic ZIP transport fixture; API validates archive');
  const body = {
    archive_base64: bytes.toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    revision: 'b'.repeat(40),
  };
  const reqContext = context({ sha256: body.sha256, revision: body.revision });
  expect(
    (
      await find('upload_developer_cloud_source').handler({
        reqContext,
        args: { workspace_id: workspace, request: body, confirm: true },
      })
    ).isError,
  ).not.toBe(true);
  expect(reqContext.client.post).toHaveBeenCalledTimes(1);
  expect(
    (
      await find('upload_developer_cloud_source').handler({
        reqContext,
        args: { workspace_id: workspace, request: { ...body, sha256: 'c'.repeat(64) }, confirm: true },
      })
    ).isError,
  ).toBe(true);
  expect(reqContext.client.post).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'verifies artifact bytes before returning a download, tampered=%s',
  async (tampered) => {
    const bytes = Buffer.from('synthetic artifact');
    const sha = createHash('sha256').update(bytes).digest('hex');
    const reqContext = context();
    (reqContext.client.get as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce({
        data: { artifacts: [{ name: 'logs.txt', sha256: sha, size_bytes: bytes.length }] },
      })
      .mockReturnValueOnce({
        asResponse: async () => new Response(tampered ? Buffer.from('changed artifact!!') : bytes),
      });
    const result = await find('download_developer_cloud_artifact').handler({
      reqContext,
      args: { workspace_id: workspace, run_id: runId, name: 'logs.txt' },
    });
    expect(result.isError === true).toBe(tampered);
    if (!tampered)
      expect(result.structuredContent).toMatchObject({ sha256: sha, run_id: runId, workspace_id: workspace });
  },
);

it.each([401, 403, 404, 409, 422, 429, 503])(
  'preserves API failure %i without automatic resubmission',
  async (status) => {
    const reqContext = context();
    (reqContext.client.post as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Rejected'), {
        status,
        error: { code: 'CLOUD_REJECTED', message: 'Rejected' },
      }),
    );
    const result = await find('create_developer_cloud_run').handler({
      reqContext,
      args: { workspace_id: workspace, request, confirm: true, idempotency_key: key },
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { workspace_id: workspace, status_code: status, code: 'CLOUD_REJECTED' },
    });
    expect(reqContext.client.post).toHaveBeenCalledTimes(1);
  },
);
