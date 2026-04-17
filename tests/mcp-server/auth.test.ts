import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OAuthChallengeError, resolveClientAuth } from '../../packages/mcp-server/src/auth';

describe('resolveClientAuth', () => {
  let authServer: http.Server;
  let authServerBaseUrl: string;
  let introspectionCallCount = 0;

  beforeAll(async () => {
    authServer = http.createServer((req, res) => {
      if (req.url !== '/api/v1/oauth/introspect' || req.method !== 'GET') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      introspectionCallCount += 1;
      const authorization = req.headers.authorization ?? '';

      if (authorization === 'Bearer soat_valid_token') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            data: {
              active: true,
              client_id: 'client-1',
              scope: 'companies:read expenses:write',
              session_id: 'session-1',
              user_id: 'user-1',
              workspace_id: 'workspace-1',
              workspace_name: 'Workspace One',
            },
          }),
        );
        return;
      }

      if (authorization === 'Bearer soat_cache_token') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            data: {
              active: true,
              client_id: 'client-2',
              scope: 'user-scope api-access',
              session_id: 'session-2',
            },
          }),
        );
        return;
      }

      if (authorization === 'Bearer soat_inactive_token') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            data: {
              active: false,
            },
          }),
        );
        return;
      }

      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'invalid_token',
          message: 'OAuth token introspection failed with status 401.',
        }),
      );
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
    if (!authServer) {
      return;
    }

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
    introspectionCallCount = 0;
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

  it('returns none when the request is unauthenticated', async () => {
    const resolved = await resolveClientAuth(
      authRequestContext({
        accept: 'application/json',
      }),
    );

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
    expect(introspectionCallCount).toBe(0);
  });

  it('rejects developer api key headers for MCP access', async () => {
    await expect(
      resolveClientAuth(
        authRequestContext({
          'x-sanka-api-key': 'sk_localapitoken',
        }),
      ),
    ).rejects.toMatchObject<Partial<OAuthChallengeError>>({
      name: 'OAuthChallengeError',
      statusCode: 401,
      message:
        'Sanka MCP accepts only Sanka OAuth access tokens. Developer API tokens are not supported for MCP access.',
    });

    expect(introspectionCallCount).toBe(0);
  });

  it('rejects opaque bearer tokens that are not Sanka OAuth access tokens', async () => {
    await expect(
      resolveClientAuth(
        authRequestContext({
          authorization: 'Bearer sk_live_example',
        }),
      ),
    ).rejects.toMatchObject<Partial<OAuthChallengeError>>({
      name: 'OAuthChallengeError',
      statusCode: 401,
      message: 'Sanka MCP accepts only Sanka OAuth access tokens that start with soat_.',
    });

    expect(introspectionCallCount).toBe(0);
  });

  it('introspects Sanka OAuth access tokens and forwards the same bearer token', async () => {
    const resolved = await resolveClientAuth(
      authRequestContext({
        authorization: 'Bearer soat_valid_token',
      }),
    );

    expect(resolved).toEqual({
      authMode: 'oauth_bearer',
      clientOptions: { apiKey: 'soat_valid_token' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['companies:read', 'expenses:write'],
      },
    });
    expect(introspectionCallCount).toBe(1);
  });

  it('caches successful introspection responses briefly', async () => {
    const requestContext = authRequestContext({
      authorization: 'Bearer soat_cache_token',
    });

    const first = await resolveClientAuth(requestContext);
    const second = await resolveClientAuth(requestContext);

    expect(first).toEqual({
      authMode: 'oauth_bearer',
      clientOptions: { apiKey: 'soat_cache_token' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['user-scope', 'api-access'],
      },
    });
    expect(second).toEqual(first);
    expect(introspectionCallCount).toBe(1);
  });

  it('returns an OAuth challenge for inactive Sanka OAuth access tokens', async () => {
    await expect(
      resolveClientAuth(
        authRequestContext({
          authorization: 'Bearer soat_inactive_token',
        }),
      ),
    ).rejects.toMatchObject<Partial<OAuthChallengeError>>({
      name: 'OAuthChallengeError',
      statusCode: 401,
      message: 'OAuth access token is invalid or inactive.',
    });

    expect(introspectionCallCount).toBe(1);
  });

  it('rejects legacy JWT bearer tokens', async () => {
    await expect(
      resolveClientAuth(
        authRequestContext({
          authorization: 'Bearer header.payload.signature',
        }),
      ),
    ).rejects.toMatchObject<Partial<OAuthChallengeError>>({
      name: 'OAuthChallengeError',
      statusCode: 401,
      message: 'Sanka MCP accepts only Sanka OAuth access tokens that start with soat_.',
    });

    expect(introspectionCallCount).toBe(0);
  });
});
