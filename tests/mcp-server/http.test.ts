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

  it('serves CRM metadata from the dedicated CRM alias path', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp/crm`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp/crm`,
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

  it('supports a session-bound GET stream after initialize', async () => {
    const initializeResponse = await fetch(`${baseUrl}/mcp/crm`, {
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

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();
    await initializeResponse.text();

    const streamResponse = await fetch(`${baseUrl}/mcp/crm`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'mcp-protocol-version': '2025-11-25',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
    });

    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get('content-type')).toContain('text/event-stream');
    await streamResponse.body?.cancel();
  });
});
