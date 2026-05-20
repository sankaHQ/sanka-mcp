import { browserUseTool } from '../../packages/mcp-server/src/browser-use-tools';
import { selectTools } from '../../packages/mcp-server/src/server';

const oauthContext = (overrides?: { authMode?: 'none' | 'oauth_bearer'; scopes?: string[] }) => ({
  authMode: overrides?.authMode ?? 'oauth_bearer',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? [],
  },
});

const hubSpotAvatarArgs = (overrides?: Record<string, unknown>) => ({
  workflow: 'demo.hubspot.company_avatar',
  input: {
    portal_id: '51471618',
    browser_profile_id: 'hubspot-demo',
    companies: [
      {
        record_id: '54986820785',
        record_url: 'https://app.hubspot.com/contacts/51471618/record/0-2/54986820785',
        name: '天神ネイルワークス',
        image_url: 'https://example.com/logo.png',
      },
    ],
  },
  ...overrides,
});

describe('browser_use MCP tool', () => {
  const originalWorkerURL = process.env['SANKA_BROWSER_USE_WORKER_URL'];
  const originalWorkerToken = process.env['SANKA_BROWSER_USE_WORKER_TOKEN'];

  beforeEach(() => {
    delete process.env['SANKA_BROWSER_USE_WORKER_URL'];
    delete process.env['SANKA_BROWSER_USE_WORKER_TOKEN'];
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalWorkerURL === undefined) {
      delete process.env['SANKA_BROWSER_USE_WORKER_URL'];
    } else {
      process.env['SANKA_BROWSER_USE_WORKER_URL'] = originalWorkerURL;
    }
    if (originalWorkerToken === undefined) {
      delete process.env['SANKA_BROWSER_USE_WORKER_TOKEN'];
    } else {
      process.env['SANKA_BROWSER_USE_WORKER_TOKEN'] = originalWorkerToken;
    }
  });

  it('advertises oauth security and the browser_use operation id', () => {
    expect(browserUseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(browserUseTool.tool.name).toBe('browser_use');
    expect(browserUseTool.metadata.operationId).toBe('browser_use.run');
    expect(browserUseTool.metadata.resource).toBe('browser_use');
  });

  it('is available in the hosted MCP tool profile', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toContain('browser_use');
  });

  it('returns a reauth challenge when called without authentication', async () => {
    const result = await browserUseTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: hubSpotAvatarArgs(),
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
  });

  it('returns a dry-run plan when the browser worker is not configured', async () => {
    const result = await browserUseTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpSessionId: 'session-1',
        mcpClientInfo: { name: 'codex', version: '1.0.0' },
        toolProfile: 'full',
      },
      args: hubSpotAvatarArgs(),
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      workflow: 'demo.hubspot.company_avatar',
      driver: 'agent_browser',
      dry_run: true,
      confirm: false,
      status: 'planned',
      worker_configured: false,
      worker_run_id: null,
      plan: {
        route: ['browser_use', 'demo', 'hubspot', 'avatar'],
        provider: 'hubspot',
        company_count: 1,
      },
    });
    expect(result.structuredContent?.['warnings']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hs_avatar_filemanager_key is read-only'),
        expect.stringContaining('SANKA_BROWSER_USE_WORKER_URL'),
      ]),
    );
  });

  it('blocks mutation runs unless dry_run=false is explicitly confirmed', async () => {
    const result = await browserUseTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: hubSpotAvatarArgs({ dry_run: false }),
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('confirm=true'),
    });
  });

  it('rejects non-HubSpot record URLs for the HubSpot avatar workflow', async () => {
    const result = await browserUseTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: hubSpotAvatarArgs({
        input: {
          portal_id: '51471618',
          companies: [
            {
              record_url: 'https://example.com/contacts/51471618/record/0-2/54986820785',
              image_url: 'https://example.com/logo.png',
            },
          ],
        },
      }),
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('https://app.hubspot.com'),
    });
  });

  it('dispatches validated workflow payloads to the configured browser worker', async () => {
    process.env['SANKA_BROWSER_USE_WORKER_URL'] = 'https://browser-worker.internal/run';
    process.env['SANKA_BROWSER_USE_WORKER_TOKEN'] = 'worker-token';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'validated',
          worker_run_id: 'worker-run-1',
          result: { checked: 1 },
          warnings: ['worker warning'],
          message: 'Worker validated the HubSpot avatar flow',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const result = await browserUseTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpSessionId: 'session-1',
        mcpClientInfo: { name: 'codex', version: '1.0.0' },
        toolProfile: 'full',
      },
      args: hubSpotAvatarArgs({ reference_id: 'demo-run-1', workspace_id: 'workspace-1' }),
    });

    expect(result.isError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://browser-worker.internal/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer worker-token',
          'Content-Type': 'application/json',
          'X-Sanka-Browser-Use-Workflow': 'demo.hubspot.company_avatar',
          'X-Sanka-MCP-Session-ID': 'session-1',
        }),
      }),
    );
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toMatchObject({
      workflow: 'demo.hubspot.company_avatar',
      driver: 'agent_browser',
      dry_run: true,
      confirm: false,
      workspace_id: 'workspace-1',
      reference_id: 'demo-run-1',
      context: {
        client_name: 'codex',
        client_version: '1.0.0',
        mcp_session_id: 'session-1',
      },
    });
    expect(body.context).not.toHaveProperty('access_token');
    expect(result.structuredContent).toMatchObject({
      status: 'validated',
      worker_configured: true,
      worker_run_id: 'worker-run-1',
      result: { checked: 1 },
    });
  });
});
