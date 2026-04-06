import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { streamableHTTPApp } from '../../packages/mcp-server/src/http';
import { configureLogger } from '../../packages/mcp-server/src/logger';

describe('protected resource metadata route', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    configureLogger({ level: 'error', pretty: false });

    const app = streamableHTTPApp({
      mcpOptions: {
        authorizationServerUrl: 'https://app.sanka.com',
        scopesSupported: ['contacts:read', 'companies:read'],
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('serves metadata using the request origin when resourceUrl is unset', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp`,
      authorization_servers: ['https://app.sanka.com'],
      scopes_supported: ['contacts:read', 'companies:read'],
    });
  });

  it('serves the same metadata from the /mcp alias path', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp`,
      authorization_servers: ['https://app.sanka.com'],
      scopes_supported: ['contacts:read', 'companies:read'],
    });
  });

  it('returns an OAuth challenge when a JWT bearer token fails verification', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a.b.c',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description: 'OAuth bearer token verification failed.',
    });
  });

  it('keeps the default /mcp resource metadata on initialize', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a.b.c',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
    );
    expect(response.headers.get('www-authenticate')).not.toContain('/mcp/crm');
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description: 'OAuth bearer token verification failed.',
    });
  });

  it('allows unauthenticated initialize requests so clients do not prompt on startup', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('"protocolVersion"');
    expect(body).toContain('"serverInfo"');
  });

  it('supports stateless follow-up requests after authenticated initialize', async () => {
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer opaque-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });

    expect(initializeResponse.status).toBe(200);
    expect(initializeResponse.headers.get('mcp-session-id')).toBeNull();
    await initializeResponse.text();

    const listResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer opaque-token',
        'Content-Type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(listResponse.status).toBe(200);
    await listResponse.text();

    const streamResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: 'Bearer opaque-token',
        'mcp-protocol-version': '2025-11-25',
      },
    });

    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get('content-type')).toContain('text/event-stream');
    await streamResponse.body?.cancel();
  });

  it('returns the unified toolset for stateless tools/list requests', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-11-25',
        'User-Agent': 'openai-mcp/1.0.0 (ChatGPT)',
        Authorization: 'Bearer opaque-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"name":"auth_status"');
    expect(text).toContain('"name":"list_companies"');
    expect(text).toContain('"name":"execute"');
    expect(text).toContain('"name":"search_docs"');
  });

  it('returns an OAuth challenge for protected CRM tool calls without authentication', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_companies',
          arguments: {
            search: 'OpenAI',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).toContain('scope="companies:read"');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use list_companies.',
    });
  });

  it('returns an OAuth challenge for auth_status when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'auth_status',
          arguments: {},
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).toContain('scope="contacts:read companies:read"');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use auth_status.',
    });
  });
});
