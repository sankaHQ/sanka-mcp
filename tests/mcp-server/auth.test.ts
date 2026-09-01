import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  AuthenticationError,
  generateMcpSessionId,
  isServerIssuedMcpSessionId,
  resolveClientAuth,
  updateResolvedClientAuthWorkspace,
} from '../../packages/mcp-server/src/auth';
import { configureLogger } from '../../packages/mcp-server/src/logger';

describe('resolveClientAuth', () => {
  let authServer: http.Server;
  let authServerBaseUrl: string;
  let mcpSessionTokenCallCount = 0;

  beforeAll(async () => {
    configureLogger({ level: 'error', pretty: false });
    authServer = http.createServer((req, res) => {
      if (req.url !== '/oauth/internal/mcp-session-token' || req.method !== 'POST') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      mcpSessionTokenCallCount += 1;
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += String(chunk);
      });
      req.on('end', () => {
        const payload = JSON.parse(rawBody || '{}') as { session_id?: string };
        if (req.headers['x-sanka-mcp-token-exchange-secret'] !== 'exchange-secret') {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'invalid_service_token' }));
          return;
        }
        if (payload.session_id !== 'session-approved' && payload.session_id !== 'session-workspace-cache') {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        const workspaceCacheTest = payload.session_id === 'session-workspace-cache';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            access_token: workspaceCacheTest ? 'soat_session_workspace_token' : 'soat_session_token',
            token_type: 'bearer',
            expires_in: 300,
            scope: 'mcp:access expenses:read',
            ...(workspaceCacheTest ?
              {
                workspace_id: 'workspace-old',
                workspace_code: '9983932',
                workspace_name: 'Old workspace',
              }
            : {}),
          }),
        );
      });
    });

    await new Promise<void>((resolve) => {
      authServer.listen(0, () => {
        const address = authServer.address() as AddressInfo;
        authServerBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      authServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    mcpSessionTokenCallCount = 0;
  });

  const authRequestContext = (
    headers: IncomingMessage['headers'],
  ): Parameters<typeof resolveClientAuth>[0] => ({
    mcpOptions: {
      authorizationServerUrl: authServerBaseUrl,
    },
    req: { headers } as IncomingMessage,
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
  });

  it('returns an unauthenticated Connect Sanka context when no session is approved', async () => {
    const resolved = await resolveClientAuth(authRequestContext({ accept: 'application/json' }));

    expect(resolved).toEqual({
      authMode: 'none',
      clientOptions: {},
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: [],
      },
    });
    expect(mcpSessionTokenCallCount).toBe(0);
  });

  it('returns a signed Connect Sanka URL when a session id and shared secret are available', async () => {
    const resolved = await resolveClientAuth({
      ...authRequestContext({ accept: 'application/json' }),
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-new',
      mcpSessionIdForExchange: 'session-new',
    });

    expect(resolved.authMode).toBe('none');
    expect(resolved.oauth.connectUrl).toContain(`${authServerBaseUrl}/oauth/mcp/connect?token=`);
    expect(resolved.oauth.connectUrlForScopes?.(['expenses:read'])).toContain(
      `${authServerBaseUrl}/oauth/mcp/connect?token=`,
    );
    expect(mcpSessionTokenCallCount).toBe(1);
  });

  it('falls back to Connect Sanka details when session exchange cannot be reached', async () => {
    const realFetch = globalThis.fetch;
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/oauth/internal/mcp-session-token')) {
        throw new Error('network down');
      }
      return realFetch(input, init);
    });

    try {
      const resolved = await resolveClientAuth({
        ...authRequestContext({ accept: 'application/json' }),
        mcpOptions: {
          authorizationServerUrl: authServerBaseUrl,
          tokenExchangeSharedSecret: 'exchange-secret',
        },
        mcpSessionId: 'session-approved',
        mcpSessionIdForExchange: 'session-approved',
      });

      expect(resolved.authMode).toBe('none');
      expect(resolved.oauth.connectUrl).toContain(`${authServerBaseUrl}/oauth/mcp/connect?token=`);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('exchanges an approved MCP session for a short-lived Sanka access token', async () => {
    const resolved = await resolveClientAuth({
      ...authRequestContext({ accept: 'application/json' }),
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-approved',
      mcpSessionIdForExchange: 'session-approved',
    });

    expect(resolved).toMatchObject({
      authMode: 'oauth_bearer',
      clientOptions: { apiKey: 'soat_session_token' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['mcp:access', 'expenses:read'],
      },
    });
    expect(mcpSessionTokenCallCount).toBe(1);
  });

  it('uses the internal server only for MCP session exchange', async () => {
    const resolved = await resolveClientAuth({
      ...authRequestContext({ accept: 'application/json' }),
      resourceUrl: 'https://mcp.sanka.com/mcp/internal-server-test',
      mcpOptions: {
        authorizationServerUrl: 'https://app.sankastaging.com',
        internalAuthorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-approved',
      mcpSessionIdForExchange: 'session-approved',
    });

    expect(resolved.authMode).toBe('oauth_bearer');
    expect(resolved.oauth.authorizationServerUrl).toBe('https://app.sankastaging.com');
    expect(mcpSessionTokenCallCount).toBe(1);
  });

  it('updates cached MCP session workspace identity without exchanging a new token', async () => {
    const requestContext = {
      ...authRequestContext({ accept: 'application/json' }),
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-workspace-cache',
      mcpSessionIdForExchange: 'session-workspace-cache',
    };
    const first = await resolveClientAuth(requestContext);

    updateResolvedClientAuthWorkspace({
      auth: first,
      mcpSessionId: 'session-workspace-cache',
      workspace: {
        workspace_id: 'workspace-new',
        workspace_code: '94639119',
        workspace_name: 'Sanka Test',
      },
    });
    const second = await resolveClientAuth(requestContext);

    expect(second.oauth).toMatchObject({
      workspace_id: 'workspace-new',
      workspace_code: '94639119',
      workspace_name: 'Sanka Test',
    });
    expect(mcpSessionTokenCallCount).toBe(1);
  });

  it('rejects developer API key headers without contacting the upstream API', async () => {
    await expect(
      resolveClientAuth(authRequestContext({ 'x-sanka-api-key': 'sk_localapitoken' })),
    ).rejects.toMatchObject<Partial<AuthenticationError>>({
      name: 'AuthenticationError',
      statusCode: 401,
      message:
        'Direct API key authentication is not supported. Connect Sanka through this MCP session instead.',
    });

    expect(mcpSessionTokenCallCount).toBe(0);
  });

  it.each(['Bearer soat_valid_token', 'Bearer sk_live_example', 'Basic encoded-credential'])(
    'rejects direct Authorization headers without introspection: %s',
    async (authorization) => {
      await expect(resolveClientAuth(authRequestContext({ authorization }))).rejects.toMatchObject<
        Partial<AuthenticationError>
      >({
        name: 'AuthenticationError',
        statusCode: 401,
        message:
          'Direct Authorization header authentication is not supported. Connect Sanka through this MCP session instead.',
      });

      expect(mcpSessionTokenCallCount).toBe(0);
    },
  );
});

describe('MCP session capabilities', () => {
  it('binds server-issued session ids to the protected resource', () => {
    const sessionId = generateMcpSessionId({
      resourceUrl: 'https://mcp.sanka.com/mcp',
      sharedSecret: 'exchange-secret',
    });

    expect(
      isServerIssuedMcpSessionId({
        resourceUrl: 'https://mcp.sanka.com/mcp',
        sessionId,
        sharedSecret: 'exchange-secret',
      }),
    ).toBe(true);
    expect(
      isServerIssuedMcpSessionId({
        resourceUrl: 'https://other.example/mcp',
        sessionId,
        sharedSecret: 'exchange-secret',
      }),
    ).toBe(false);
    expect(
      isServerIssuedMcpSessionId({
        resourceUrl: 'https://mcp.sanka.com/mcp',
        sessionId: `${sessionId.slice(0, -1)}x`,
        sharedSecret: 'exchange-secret',
      }),
    ).toBe(false);
  });
});

describe('upstream session exchange hardening', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends an abort signal with the internal session exchange request', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'soat_signal_probe_token',
          expires_in: 300,
          scope: 'mcp:access',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: 'https://app.example.com',
        internalAuthorizationServerUrl: 'https://api.internal.example.com',
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-signal-probe',
      mcpSessionIdForExchange: 'session-signal-probe',
      req: { headers: {} } as IncomingMessage,
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.example.com/mcp',
    });

    expect(resolved.authMode).toBe('oauth_bearer');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.internal.example.com/oauth/internal/mcp-session-token',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('falls back to an unauthenticated Connect Sanka context on session exchange timeout', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: 'https://app.example.com',
        internalAuthorizationServerUrl: 'https://api.internal.example.com',
        tokenExchangeSharedSecret: 'exchange-secret',
      },
      mcpSessionId: 'session-timeout-probe',
      mcpSessionIdForExchange: 'session-timeout-probe',
      req: { headers: {} } as IncomingMessage,
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.example.com/mcp',
    });

    expect(resolved.authMode).toBe('none');
    expect(resolved.oauth.connectUrl).toContain('https://app.example.com/oauth/mcp/connect?token=');
  });
});
