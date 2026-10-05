import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { initMcpServer, newMcpServer } from '../../packages/mcp-server/src/server';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import type { ResolvedClientAuth } from '../../packages/mcp-server/src/auth';

// The host consumes these metadata fields and resource bytes, so this is a public
// protocol contract, not a source/registration snapshot. No stronger UI host test
// exercises the Sanka dispatcher, scope enforcement, and HTTP response together.
describe('Sanka Flow MCP App protocol', () => {
  const priorFlag = process.env['SANKA_MCP_FLOW_APP_ENABLED'];
  const priorWorkspaceFlag = process.env['SANKA_MCP_FLOW_WORKSPACE_ENABLED'];
  beforeAll(() => configureLogger({ level: 'error', pretty: false }));
  afterAll(() => {
    if (priorFlag === undefined) delete process.env['SANKA_MCP_FLOW_APP_ENABLED'];
    else process.env['SANKA_MCP_FLOW_APP_ENABLED'] = priorFlag;
    if (priorWorkspaceFlag === undefined) delete process.env['SANKA_MCP_FLOW_WORKSPACE_ENABLED'];
    else process.env['SANKA_MCP_FLOW_WORKSPACE_ENABLED'] = priorWorkspaceFlag;
  });

  async function connect(enabled: boolean, scopes = ['auth:read'], workspace = false, native = true) {
    process.env['SANKA_MCP_FLOW_APP_ENABLED'] = enabled ? '1' : '0';
    process.env['SANKA_MCP_FLOW_WORKSPACE_ENABLED'] = workspace ? '1' : '0';
    const requests: string[] = [];
    const network: { url: string; method: string | undefined; body: unknown; headers: Headers }[] = [];
    let consented = false;
    const auth: ResolvedClientAuth = {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        nativeOAuth: workspace && native,
        connectUrl: 'https://app.sanka.com/oauth/mcp/connect?token=test-connect-token',
        scopes,
        resourceUrl: 'https://mcp.example.test/mcp',
        resourceMetadataUrl: '',
        authorizationServerUrl: '',
      },
    };
    const server = await newMcpServer({ toolProfile: 'hosted' });
    await initMcpServer({
      server,
      mcpSessionId: 'flow-app-test-session',
      toolProfile: 'hosted',
      auth,
      clientOptions: {
        apiKey: 'test-only',
        baseURL: 'https://api.example.test',
        maxRetries: 0,
        fetch: async (input, init) => {
          requests.push(String(input));
          network.push({
            url: String(input),
            method: init?.method,
            body: init?.body,
            headers: new Headers(init?.headers),
          });
          if (String(input).includes('/chatgpt-connector/mcp/status'))
            return new Response(
              JSON.stringify({
                data: {
                  workspace_id: 'workspace-a',
                  full_workspace_available: true,
                  workspace_access: consented ? 'full_workspace' : 'invoice_pilot',
                },
              }),
              { headers: { 'content-type': 'application/json' } },
            );
          if (String(input).endsWith('/chatgpt-connector/launch'))
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  ticket: 'scwt_' + 't'.repeat(43),
                  browser_origin: 'https://' + 'b'.repeat(32) + '.flow-chatgpt.sanka.com',
                  expires_in: 60,
                },
              }),
              { headers: { 'content-type': 'application/json' } },
            );
          return new Response(
            JSON.stringify({
              data: {
                workspace_id: 'workspace-a',
                current_workspace: { id: 'workspace-a', name: 'Test workspace', workspace_code: '12345678' },
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        },
      },
    });
    const client = new Client({ name: 'flow-app-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return {
      client,
      requests,
      network,
      approve: () => {
        consented = true;
      },
      close: async () => {
        await client.close();
        await server.close();
      },
    };
  }

  it('serves an entrypoint with empty input, real workspace data, and a self-contained app resource', async () => {
    const session = await connect(true);
    try {
      const { tools } = await session.client.listTools();
      const tool = tools.find((candidate) => candidate.name === 'open_flow_workspace')!;
      expect(tool._meta).toMatchObject({
        ui: { resourceUri: 'ui://sanka/flow-workspace-v5' },
        'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
      });
      const result = await session.client.callTool({ name: tool.name, arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        workspace_id: 'workspace-a',
        workspace_name: 'Test workspace',
      });
      expect(session.requests).toContain('https://api.example.test/api/v2/auth/session');
      const resources = await session.client.listResources();
      const resource = await session.client.readResource({ uri: resources.resources[0]!.uri });
      expect(resource.contents[0]).toMatchObject({
        mimeType: 'text/html;profile=mcp-app',
        text: expect.stringContaining('<title>Sanka Flow</title>'),
      });
      const content = resource.contents[0]!;
      if (!('text' in content)) throw new Error('The Flow app resource must contain HTML text');
      for (const uri of [
        'ui://sanka/flow-workspace',
        'ui://sanka/flow-workspace-v2',
        'ui://sanka/flow-workspace-v3',
        'ui://sanka/flow-workspace-v4',
      ]) {
        const legacy = await session.client.readResource({ uri });
        expect(legacy.contents[0]).toMatchObject({ text: content.text });
      }
      await expect(session.client.readResource({ uri: 'ui://sanka/unknown' })).rejects.toThrow(
        'Unknown resource',
      );
    } finally {
      await session.close();
    }
  });

  it('denies the entrypoint without workspace-read access', async () => {
    const session = await connect(true, ['invoices:read']);
    try {
      const result = await session.client.callTool({ name: 'open_flow_workspace', arguments: {} });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ error: 'insufficient_scope' });
      expect(session.requests.filter((url) => url.endsWith('/auth/session'))).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it('keeps the extension unavailable until explicitly enabled', async () => {
    const session = await connect(false);
    try {
      expect(session.client.getServerCapabilities()?.resources).toBeUndefined();
      await expect(session.client.callTool({ name: 'open_flow_workspace', arguments: {} })).rejects.toThrow(
        'Unknown tool',
      );
    } finally {
      await session.close();
    }
  });

  it('launches a pinned browser session without putting its one-use ticket in model content or audit', async () => {
    const session = await connect(true, ['mcp:access'], true);
    try {
      const result = await session.client.callTool({
        name: 'start_flow_workspace_session',
        arguments: {
          expected_workspace_id: 'workspace-a',
          browser_challenge: 'a'.repeat(64),
          browser_origin: 'https://' + 'b'.repeat(32) + '.flow-chatgpt.sanka.com',
        },
      });
      expect(result.isError).not.toBe(true);
      const request = session.network.find((entry) => entry.url.endsWith('/chatgpt-connector/launch'))!;
      expect(request.method).toBe('POST');
      expect(JSON.parse(String(request.body))).toEqual({
        expected_workspace_id: 'workspace-a',
        browser_challenge: 'a'.repeat(64),
        browser_origin: 'https://' + 'b'.repeat(32) + '.flow-chatgpt.sanka.com',
      });
      expect(request.headers.get('X-Workspace-Code')).toBe('workspace-a');
      expect(result._meta).toMatchObject({ flow_workspace_session: { ticket: 'scwt_' + 't'.repeat(43) } });
      expect(
        JSON.stringify({ content: result.content, structuredContent: result.structuredContent }),
      ).not.toContain('scwt_');
      expect(
        JSON.stringify(session.network.filter((entry) => entry.url.endsWith('/mcp/tool-call-log'))),
      ).not.toContain('scwt_');
    } finally {
      await session.close();
    }
  });

  it('enables the installed /mcp entry after consent and forwards its parent binding on launch', async () => {
    const session = await connect(true, ['mcp:access'], true, false);
    try {
      const before = await session.client.callTool({ name: 'open_flow_workspace', arguments: {} });
      expect(before.structuredContent).toMatchObject({
        full_workspace_available: true,
        workspace_access: 'invoice_pilot',
      });
      const consent = new URL(String(before._meta?.['flow_workspace_consent_url']));
      expect(consent.origin).toBe('https://app.sanka.com');
      expect(consent.pathname).toBe('/oauth/mcp/workspace');
      expect(consent.searchParams.get('expected_workspace_id')).toBe('workspace-a');
      expect(
        JSON.stringify({ content: before.content, structuredContent: before.structuredContent }),
      ).not.toContain('test-connect-token');
      session.approve();
      const after = await session.client.callTool({ name: 'open_flow_workspace', arguments: {} });
      expect(after.structuredContent).toMatchObject({
        full_workspace_available: true,
        workspace_access: 'full_workspace',
      });
      const status = session.network.filter((entry) => entry.url.includes('/chatgpt-connector/mcp/status'));
      expect(status).toHaveLength(2);
      expect(status[0]!.headers.get('X-Sanka-MCP-Session-ID')).toBe('flow-app-test-session');
      const result = await session.client.callTool({
        name: 'start_flow_workspace_session',
        arguments: {
          expected_workspace_id: 'workspace-a',
          browser_challenge: 'a'.repeat(64),
          browser_origin: 'https://' + 'b'.repeat(32) + '.flow-chatgpt.sanka.com',
        },
      });
      expect(result.isError).not.toBe(true);
      const launch = session.network.find((entry) => entry.url.endsWith('/chatgpt-connector/launch'))!;
      expect(launch.headers.get('X-Sanka-MCP-Session-ID')).toBe('flow-app-test-session');
      expect(result._meta).toMatchObject({ flow_workspace_session: { ticket: 'scwt_' + 't'.repeat(43) } });
    } finally {
      await session.close();
    }
  });
});
