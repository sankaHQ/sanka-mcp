import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { migrationExecutionTools } from '../../packages/mcp-server/src/migration-tools';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const planHash = 'sha256:reviewed-plan';
const key = 'approved-apply-001';
const baseArgs = { workspace_id: workspace, migration_id: 'migration-1', confirm: true };
const response = {
  data: { id: 'migration-1', status: 'applying', plan_hash: planHash, job_id: 'job-1', run_id: 'run-1' },
  meta: { ctx_id: 'trace-1' },
};
const context = (payload = response) =>
  ({
    client: { post: jest.fn().mockResolvedValue(payload), get: jest.fn() },
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
const tool = (action: string) => migrationExecutionTools.find((t) => t.tool.name === `${action}_migration`)!;
const actions = ['apply', 'pause', 'resume', 'cancel'] as const;
const argsFor = (action: string): Record<string, unknown> => ({
  ...baseArgs,
  ...(action === 'apply' || action === 'resume' ? { plan_hash: planHash } : {}),
  ...(action === 'apply' ? { idempotency_key: key } : {}),
});

describe('migration execution controls', () => {
  beforeAll(() => configureLogger({ level: 'error', pretty: false }));
  it('registers only the four stateful lifecycle controls with explicit confirmation', () => {
    expect(migrationExecutionTools).toHaveLength(4);
    for (const action of actions) {
      const entry = tool(action);
      expect(entry.metadata).toMatchObject({ operation: 'write', httpMethod: 'POST' });
      expect(entry.tool.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: action !== 'pause',
      });
      expect(entry.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
      expect(entry.tool.inputSchema.required).toEqual(
        expect.arrayContaining(['workspace_id', 'migration_id', 'confirm']),
      );
      for (const profile of ['full', 'hosted'] as const) {
        expect(
          selectTools(undefined, profile).filter((t) => t.tool.name === `${action}_migration`),
        ).toHaveLength(1);
      }
    }
  });

  it.each(actions)(
    '%s sends only contract fields and reports API status without claiming completion',
    async (action) => {
      const reqContext = context();
      const result = await tool(action).handler({ reqContext, args: argsFor(action) });
      expect(reqContext.client.post).toHaveBeenCalledWith(
        `/api/v2/migrate/migrations/migration-1/${action}`,
        {
          query: { workspace_id: workspace },
          maxRetries: 0,
          ...(action === 'apply' || action === 'resume' ? { body: { plan_hash: planHash } } : {}),
          ...(action === 'apply' ? { headers: { 'Idempotency-Key': key } } : {}),
        },
      );
      expect(reqContext.client.get).not.toHaveBeenCalled();
      expect(result.structuredContent).toMatchObject({
        ...response,
        workspace_id: workspace,
        migration_id: 'migration-1',
        migration_status: 'applying',
        plan_hash: planHash,
        next_tool: 'get_migration',
      });
      if (action === 'apply' || action === 'resume')
        expect(result.structuredContent?.['requested_plan_hash']).toBe(planHash);
      expect(result.content[0]).toMatchObject({ text: expect.stringContaining('Current status: applying') });
      expect(JSON.stringify(result.content)).not.toContain('job-1');
      expect(JSON.stringify(result.content)).not.toContain(planHash);
    },
  );

  it('keeps applying visible after the server normalizes a successful response', async () => {
    const requestArgs = argsFor('apply');
    const result = await tool('apply').handler({ reqContext: context(), args: requestArgs });
    const normalized = normalizeToolCallResult({ mcpTool: tool('apply'), result, args: requestArgs });
    expect(normalized.structuredContent?.['status']).toBe('applying');
    expect(normalized.content[0]).toMatchObject({
      text: expect.stringContaining('apply_migration applying'),
    });
  });

  describe.each(actions)('%s safety gates', (action) => {
    it.each([undefined, false, 'true', 1, null])(
      'does not dispatch without explicit boolean confirmation: %p',
      async (confirm) => {
        const reqContext = context();
        const args = argsFor(action);
        if (confirm === undefined) delete args['confirm'];
        else args['confirm'] = confirm;
        expect((await tool(action).handler({ reqContext, args })).isError).toBe(true);
        expect(reqContext.client.post).not.toHaveBeenCalled();
        expect(reqContext.client.get).not.toHaveBeenCalled();
      },
    );
    it.each([
      { workspace_id: undefined },
      { workspace_id: otherWorkspace },
      { workspace_id: 'current' },
      { migration_id: undefined },
      { migration_id: '../apply' },
      { migration_id: 'run?force=true' },
      { workspace_code: 'alternate' },
      { destination_id: 'replacement' },
      { force: true },
    ])('rejects invalid scope/path or unrecognized arguments: %p', async (invalid) => {
      const reqContext = context();
      expect(
        (await tool(action).handler({ reqContext, args: { ...argsFor(action), ...invalid } })).isError,
      ).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
    });
    it('rejects unauthenticated dispatch', async () => {
      const reqContext = context();
      reqContext.auth!.authMode = 'none';
      expect((await tool(action).handler({ reqContext, args: argsFor(action) })).isError).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
    });
    it('keeps explicit workspace scope when session metadata is absent', async () => {
      const reqContext = context();
      delete reqContext.auth!.oauth.workspace_id;
      await tool(action).handler({ reqContext, args: { ...argsFor(action), workspace_id: otherWorkspace } });
      expect(reqContext.client.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ query: { workspace_id: otherWorkspace } }),
      );
    });
  });

  it.each(['apply', 'resume'])('%s requires a nonempty reviewed plan hash', async (action) => {
    for (const plan_hash of [undefined, null, '', '   ', 'new hash', 123]) {
      const reqContext = context();
      expect(
        (await tool(action).handler({ reqContext, args: { ...argsFor(action), plan_hash } })).isError,
      ).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
    }
  });
  it.each([
    undefined,
    '',
    'short',
    ' '.repeat(8),
    'a'.repeat(201),
    'key\r\ninjected',
    'long key value',
    'nonascii-🔑',
  ])('apply requires a valid stable idempotency key: %p', async (idempotency_key) => {
    const reqContext = context();
    expect(
      (await tool('apply').handler({ reqContext, args: { ...argsFor('apply'), idempotency_key } })).isError,
    ).toBe(true);
    expect(reqContext.client.post).not.toHaveBeenCalled();
  });
  it('forwards approved route restriction and the unchanged key on deliberate identical resubmission', async () => {
    const reqContext = context();
    const args = { ...argsFor('apply'), routes: ['contacts:target-1', 'companies:target-1'] };
    await tool('apply').handler({ reqContext, args });
    await tool('apply').handler({ reqContext, args });
    expect(reqContext.client.post).toHaveBeenCalledTimes(2);
    for (const [, options] of (reqContext.client.post as jest.Mock).mock.calls) {
      expect(options).toEqual({
        query: { workspace_id: workspace },
        body: { plan_hash: planHash, routes: args.routes },
        headers: { 'Idempotency-Key': key },
        maxRetries: 0,
      });
    }
  });
  it.each([[], null, [''], ['  '], ['same', 'same'], Array.from({ length: 101 }, (_, i) => `route-${i}`)])(
    'rejects ambiguous/broadening route selections: %p',
    async (routes) => {
      const reqContext = context();
      expect(
        (await tool('apply').handler({ reqContext, args: { ...argsFor('apply'), routes } })).isError,
      ).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
    },
  );
  it('resume rejects route changes and unsupported idempotency keys', async () => {
    for (const extra of [{ routes: ['different'] }, { idempotency_key: key }]) {
      const reqContext = context();
      expect(
        (await tool('resume').handler({ reqContext, args: { ...argsFor('resume'), ...extra } })).isError,
      ).toBe(true);
      expect(reqContext.client.post).not.toHaveBeenCalled();
    }
  });

  it.each(actions)(
    '%s preserves backend errors and never falls back to apply or replaces a hash',
    async (action) => {
      for (const [status, code] of [
        [401, 'INVALID_AUTHENTICATION'],
        [402, 'PAYMENT_REQUIRED'],
        [403, 'PERMISSION_DENIED'],
        [404, 'NOT_FOUND'],
        [409, 'FERRY_PLAN_HASH_MISMATCH'],
        [409, 'IDEMPOTENCY_CONFLICT'],
        [429, 'RATE_LIMITED'],
        [503, 'UNAVAILABLE'],
      ] as const) {
        const reqContext = context();
        (reqContext.client.post as jest.Mock).mockRejectedValue(
          Object.assign(new Error('Rejected'), {
            status,
            error: { code, message: 'Rejected', ctx_id: 'trace', details: { expected: 'new-hash' } },
          }),
        );
        const result = await tool(action).handler({ reqContext, args: argsFor(action) });
        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            code,
            status_code: status,
            ctx_id: 'trace',
            workspace_id: workspace,
            migration_id: 'migration-1',
          },
        });
        expect(reqContext.client.post).toHaveBeenCalledTimes(1);
        expect(reqContext.client.get).not.toHaveBeenCalled();
      }
    },
  );
  it.each(actions)('%s uses real authenticated SDK transport without automatic retry', async (action) => {
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
    expect((await tool(action).handler({ reqContext, args: argsFor(action) })).isError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://api-v2.example.com/api/v2/migrate/migrations/migration-1/${action}?workspace_id=${workspace}`,
    );
    expect(options.method).toBe('POST');
    const headers = new Headers(options.headers);
    expect(headers.get('authorization')).toBe('Bearer test-token');
    expect(headers.get('idempotency-key')).toBe(action === 'apply' ? key : null);
    expect(options.body ? JSON.parse(options.body) : undefined).toEqual(
      action === 'apply' || action === 'resume' ? { plan_hash: planHash } : undefined,
    );
  });
});
