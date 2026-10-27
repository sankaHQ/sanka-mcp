import Sanka from 'sanka-sdk';
import { migrationNativeTools } from '../../packages/mcp-server/src/migration-native-tools';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hash = `sha256:${'a'.repeat(64)}`;
const idempotency_key = 'native-request-123';
const cases = [
  ['get_migration_native_review', 'GET', 'native-review', {}],
  [
    'save_migration_native_review',
    'PUT',
    'native-review',
    {
      expected_binding_hash: hash,
      expected_revision: 0,
      idempotency_key,
      resources: [
        {
          workload: 'chats',
          source_id: '19:thread@thread.v2',
          evidence: 'reviewed',
          owner_source_id: workspace,
        },
      ],
      users: [{ source_id: workspace, destination_id: workspace, evidence: 'reviewed' }],
      source_frozen: true,
      preserve_versions: true,
      preserve_permissions: true,
      acknowledged_limitations: ['source_retained', 'supported_visible_content', 'original_urls_change'],
    },
  ],
  [
    'prepare_migration_native_content',
    'POST',
    'native-prepare',
    {
      expected_binding_hash: hash,
      expected_revision: 1,
      expected_review_hash: hash,
      confirm_source_content_read: true,
      idempotency_key,
    },
  ],
  [
    'recover_migration_native_operation',
    'POST',
    'native-recovery',
    {
      expected_binding_hash: hash,
      operation_id: 'thread_message:opaque',
      expected_operation_revision: '2026-10-27T00:00:00+00:00',
      destination_id: '19:opaque@thread.v2',
      evidence: 'independent readback',
      confirm: true,
      idempotency_key,
    },
  ],
  [
    'recover_migration_native_operation',
    'POST',
    'native-recovery',
    {
      expected_binding_hash: hash,
      operation_id: 'sharepoint_package:opaque',
      expected_operation_revision: '2026-10-27T00:00:00+00:00',
      action: 'resume_staging',
      evidence: 'Reviewed pre-submit checkpoint',
      confirm: true,
      idempotency_key,
    },
  ],
] as const;

function arrange(status = 200) {
  const calls: { method: string; path: string; body: unknown; key: string | null }[] = [];
  const fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      key: new Headers(init?.headers).get('Idempotency-Key'),
    });
    expect(url.searchParams.get('workspace_id')).toBe(workspace);
    return new Response(
      JSON.stringify({
        success: true,
        data: { mode: 'native', status: 'prepared' },
        meta: { ctx_id: 'native-test' },
      }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  });
  const reqContext = {
    client: new Sanka({ apiKey: 'fixture', baseURL: 'https://example.com', maxRetries: 2, fetch }),
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        workspace_id: workspace,
        scopes: ['mcp:access'],
        authorizationServerUrl: 'https://example.com',
      },
    },
  } as unknown as McpRequestContext;
  return { reqContext, calls };
}

beforeAll(() => configureLogger({ level: 'error', pretty: false }));

it.each(cases)('%s preserves the actual pinned HTTP contract', async (name, method, path, body) => {
  const { reqContext, calls } = arrange();
  const result = await migrationNativeTools
    .find((tool) => tool.tool.name === name)!
    .handler({
      reqContext,
      args: { workspace_id: workspace, migration_id: 'run-1', ...body },
    });
  expect(result.isError).toBeFalsy();
  expect(calls).toEqual([
    {
      method,
      path: `/api/v2/migrate/migrations/run-1/${path}`,
      key: method === 'GET' ? null : idempotency_key,
      body:
        method === 'GET' ? null : (
          Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'idempotency_key'))
        ),
    },
  ]);
  expect(result.structuredContent).toMatchObject({
    workspace_id: workspace,
    data: { mode: 'native', status: 'prepared' },
  });
});

it.each(cases.slice(1))(
  '%s never retries an ambiguous provider-facing operation',
  async (name, _method, _path, body) => {
    const { reqContext, calls } = arrange(503);
    const result = await migrationNativeTools
      .find((tool) => tool.tool.name === name)!
      .handler({
        reqContext,
        args: { workspace_id: workspace, migration_id: 'run-1', ...body },
      });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(1);
  },
);

it.each([false, undefined])('recovery with confirm=%s fails before HTTP dispatch', async (confirm) => {
  const { reqContext, calls } = arrange();
  const result = await migrationNativeTools
    .find((tool) => tool.tool.name === 'recover_migration_native_operation')!
    .handler({
      reqContext,
      args: { workspace_id: workspace, migration_id: 'run-1', ...cases[3][3], confirm },
    });
  expect(result.isError).toBe(true);
  expect(calls).toEqual([]);
});
