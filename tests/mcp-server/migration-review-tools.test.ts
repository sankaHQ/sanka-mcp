import { migrationReviewTools } from '../../packages/mcp-server/src/migration-tools';
import { McpRequestContext } from '../../packages/mcp-server/src/types';
const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tools = Object.fromEntries(migrationReviewTools.map((t) => [t.tool.name, t]));
const context = () =>
  ({
    client: {
      get: jest.fn().mockResolvedValue({ data: { status: 'failed', ok: false } }),
      post: jest.fn().mockResolvedValue({
        data: {
          status: 'failed',
          ok: false,
          verification: { checks: { field_sampling: 'not_run' } },
          attestation: { signature: 'original' },
        },
      }),
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
it.each(['review_migration', 'repair_migration'])(
  '%s requires authorization acknowledgement and stable supported idempotency',
  async (name) => {
    const reqContext = context();
    const args = {
      workspace_id: workspace,
      migration_id: 'run-1',
      confirm: true,
      idempotency_key: 'review-key-001',
      ...(name === 'repair_migration' ? { plan_hash: 'reviewed-plan' } : {}),
    };
    for (const bad of [{ confirm: false }, { idempotency_key: undefined }])
      expect((await tools[name]!.handler({ reqContext, args: { ...args, ...bad } })).isError).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
    const result = await tools[name]!.handler({ reqContext, args });
    expect(reqContext.client.post).toHaveBeenCalledWith(
      `/api/v2/migrate/migrations/run-1/${name === 'repair_migration' ? 'repair' : 'review'}`,
      {
        query: { workspace_id: workspace },
        maxRetries: 0,
        headers: { 'Idempotency-Key': 'review-key-001' },
        ...(name === 'repair_migration' ? { body: { plan_hash: 'reviewed-plan' } } : {}),
      },
    );
    if (name === 'review_migration')
      expect(result.structuredContent).toMatchObject({
        ok: false,
        data: {
          attestation: { signature: 'original' },
          verification: { checks: { field_sampling: 'not_run' } },
        },
      });
  },
);
it.each([
  ['get_migration_review', { migration_id: 'run-1' }, '/migrations/run-1/review'],
  ['get_migration_attestation_key', { key_id: 'key-1' }, '/attestation-keys/key-1'],
])('%s reads without paid mutation', async (name, args, path) => {
  const reqContext = context();
  await tools[name as string]!.handler({
    reqContext,
    args: { workspace_id: workspace, ...(args as object) },
  });
  expect(reqContext.client.post).not.toHaveBeenCalled();
  expect(reqContext.client.get).toHaveBeenCalledWith(`/api/v2/migrate${path}`, {
    query: { workspace_id: workspace },
  });
});
