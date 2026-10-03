import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { streamableHTTPApp } from '../../packages/mcp-server/src/http';
import { configureLogger } from '../../packages/mcp-server/src/logger';

describe('ChatGPT connector transport', () => {
  let server: http.Server;
  let authorizationServer: http.Server;
  let baseURL: string;
  let authorized = true;
  let exchanges: Array<{ access_token: string; resource: string }> = [];

  const previousAppFlag = process.env['SANKA_MCP_FLOW_APP_ENABLED'];
  beforeAll(async () => {
    process.env['SANKA_MCP_FLOW_APP_ENABLED'] = '1';
    configureLogger({ level: 'error', pretty: false });
    authorizationServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        exchanges.push(payload);
        res.setHeader('Content-Type', 'application/json');
        if (
          req.url !== '/oauth/internal/chatgpt-token' ||
          req.headers['x-sanka-mcp-token-exchange-secret'] !== 'internal-test-secret' ||
          payload.access_token !== 'sccat_test-credential' ||
          !authorized
        ) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'invalid_token' }));
          return;
        }
        res.end(
          JSON.stringify({
            access_token: 'soat_internal-api-credential',
            scope: 'mcp:access',
            expires_in: 300,
            workspace_id: 'workspace-pinned',
            workspace_code: '10101010',
            workspace_name: 'Test',
          }),
        );
      });
    });
    await new Promise<void>((resolve) => authorizationServer.listen(0, '127.0.0.1', resolve));
    const authURL = `http://127.0.0.1:${(authorizationServer.address() as AddressInfo).port}`;
    server = streamableHTTPApp({
      mcpOptions: {
        chatgptConnectorEnabled: true,
        chatgptConnectorIssuer: 'https://api.example.test/oauth/chatgpt',
        chatgptConnectorResource: 'https://mcp.example.test/chatgpt',
        internalAuthorizationServerUrl: authURL,
        tokenExchangeSharedSecret: 'internal-test-secret',
      },
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (previousAppFlag === undefined) delete process.env['SANKA_MCP_FLOW_APP_ENABLED'];
    else process.env['SANKA_MCP_FLOW_APP_ENABLED'] = previousAppFlag;
    await Promise.all(
      [server, authorizationServer].map(
        (item) =>
          new Promise<void>((resolve) => {
            item.close(() => resolve());
            item.closeAllConnections();
          }),
      ),
    );
  });

  beforeEach(() => {
    authorized = true;
    exchanges = [];
  });

  const call = (path: string, bearer?: string, params?: { name: string; arguments: object }) =>
    fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: params ? 'tools/call' : 'tools/list', params }),
    });

  it('advertises OAuth only on the explicit connector path', async () => {
    const metadata = await fetch(`${baseURL}/.well-known/oauth-protected-resource/chatgpt`);
    expect(await metadata.json()).toMatchObject({
      resource: 'https://mcp.example.test/chatgpt',
      authorization_servers: ['https://api.example.test/oauth/chatgpt'],
      scopes_supported: ['mcp:access'],
    });
    const native = await call('/chatgpt');
    expect(native.status).toBe(401);
    expect(native.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource/chatgpt');
    const legacy = await call('/mcp', 'sccat_test-credential');
    expect(legacy.status).toBe(401);
    expect(legacy.headers.get('www-authenticate')).toBeNull();
    expect(exchanges).toEqual([]);
  });

  it('exchanges each native credential and stops after revocation', async () => {
    const response = await call('/chatgpt', 'sccat_test-credential');
    expect(response.status).toBe(200);
    const event = (await response.text()).split('\n').find((line) => line.startsWith('data: '))!;
    const tools = JSON.parse(event.slice(6)).result.tools;
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect([
        'open_flow_workspace',
        'get_flow_invoice',
        'preview_flow_invoice',
        'start_flow_invoice',
        'get_flow_invoice_attempt',
        'get_workflow_run',
      ]).toContain(tool.name);
      expect(tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
    }
    expect(exchanges).toEqual([
      { access_token: 'sccat_test-credential', resource: 'https://mcp.example.test/chatgpt' },
    ]);
    authorized = false;
    const revoked = await call('/chatgpt', 'sccat_test-credential');
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get('www-authenticate')).toContain('Bearer');
    expect(exchanges).toHaveLength(2);
  });

  it.each(['auth_status', 'connect_sanka', 'set_current_workspace', 'start_workflow'])(
    'rejects unadvertised tool %s on the connector path',
    async (name) => {
      const response = await call('/chatgpt', 'sccat_test-credential', { name, arguments: {} });
      const event = (await response.text()).split('\n').find((line) => line.startsWith('data: '))!;
      expect(JSON.parse(event.slice(6)).error.message).toContain(`Unknown tool: ${name}`);
    },
  );
});
