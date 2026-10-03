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
  beforeAll(() => configureLogger({ level: 'error', pretty: false }));
  afterAll(() => {
    if (priorFlag === undefined) delete process.env['SANKA_MCP_FLOW_APP_ENABLED'];
    else process.env['SANKA_MCP_FLOW_APP_ENABLED'] = priorFlag;
  });

  async function connect(enabled: boolean, scopes = ['auth:read']) {
    process.env['SANKA_MCP_FLOW_APP_ENABLED'] = enabled ? '1' : '0';
    const requests: string[] = [];
    const auth: ResolvedClientAuth = {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        scopes,
        resourceUrl: 'https://mcp.example.test/mcp',
        resourceMetadataUrl: '',
        authorizationServerUrl: '',
      },
    };
    const server = await newMcpServer({ toolProfile: 'hosted' });
    await initMcpServer({
      server,
      toolProfile: 'hosted',
      auth,
      clientOptions: {
        apiKey: 'test-only',
        baseURL: 'https://api.example.test',
        maxRetries: 0,
        fetch: async (input) => {
          requests.push(String(input));
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
        ui: { resourceUri: 'ui://sanka/flow-workspace' },
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
});
