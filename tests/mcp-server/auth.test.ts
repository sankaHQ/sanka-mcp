import type { KeyObject } from 'node:crypto';
import { generateKeyPairSync, sign } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { OAuthChallengeError, resolveClientAuth } from '../../packages/mcp-server/src/auth';

type JwkKey = Record<string, unknown> & { kid?: string };

describe('resolveClientAuth', () => {
  let authServer: http.Server;
  let authServerBaseUrl: string;
  let exchangeCallCount = 0;
  let signingKey: KeyObject;

  beforeAll(async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    signingKey = privateKey;
    const publicJwk = publicKey.export({ format: 'jwk' }) as JwkKey;

    authServer = http.createServer(async (req, res) => {
      if (req.url === '/oauth/jwks.json') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            keys: [{ ...publicJwk, alg: 'RS256', kid: 'test-key', use: 'sig' }],
          }),
        );
        return;
      }

      if (req.url === '/oauth/internal/token-exchange' && req.method === 'POST') {
        exchangeCallCount += 1;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            access_token: 'internal-exchanged-token',
            expires_in: 240,
            token_type: 'Bearer',
          }),
        );
        return;
      }

      if (req.url === '/oauth/internal/mcp-session-token' && req.method === 'POST') {
        let rawBody = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', () => {
          const payload = JSON.parse(rawBody || '{}') as { session_id?: string };
          if (payload.session_id === 'connected-session') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                access_token: 'mcp-session-internal-token',
                expires_in: 240,
                token_type: 'Bearer',
                scope: 'mcp:access',
              }),
            );
            return;
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'session_not_connected' }));
        });
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
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
    exchangeCallCount = 0;
  });

  const encodeBase64Url = (value: string) => Buffer.from(value).toString('base64url');
  const decodeConnectTokenPayload = (connectUrl: string) => {
    const url = new URL(connectUrl);
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();
    const payload = String(token).split('.', 1)[0]!;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  };

  const buildJwt = async (audience: string) => {
    const now = Math.floor(Date.now() / 1000);
    const encodedHeader = encodeBase64Url(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }));
    const encodedPayload = encodeBase64Url(
      JSON.stringify({
        app_id: 'app-1',
        aud: audience,
        exp: now + 300,
        iat: now,
        iss: authServerBaseUrl,
        scope: 'companies:read',
        sub: 'user-1',
        workspace_id: 'workspace-1',
      }),
    );
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = sign('RSA-SHA256', Buffer.from(signingInput), signingKey).toString('base64url');
    return `${signingInput}.${signature}`;
  };

  it('passes opaque bearer tokens through as api keys', async () => {
    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
      },
      req: {
        headers: {
          authorization: 'Bearer sk_live_example',
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    });

    expect(resolved).toEqual({
      authMode: 'api_key',
      clientOptions: { apiKey: 'sk_live_example' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: [],
      },
    });
    expect(exchangeCallCount).toBe(0);
  });

  it('passes legacy audience JWTs directly to the SDK', async () => {
    const token = await buildJwt('sanka-api');
    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
      },
      req: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    });

    expect(resolved).toEqual({
      authMode: 'legacy_oauth_jwt',
      clientOptions: { apiKey: token },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['companies:read'],
      },
    });
    expect(exchangeCallCount).toBe(0);
  });

  it('exchanges resource audience JWTs and caches the result', async () => {
    const token = await buildJwt('https://mcp.sanka.com/mcp');
    const options = {
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'shared-secret',
      },
      req: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    };

    const first = await resolveClientAuth(options);
    const second = await resolveClientAuth(options);

    expect(first).toEqual({
      authMode: 'resource_oauth_jwt',
      clientOptions: { apiKey: 'internal-exchanged-token' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['companies:read'],
      },
    });
    expect(second).toEqual(first);
    expect(exchangeCallCount).toBe(1);
  });

  it('resolves approved MCP sessions into internal access tokens', async () => {
    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'shared-secret',
      },
      req: {
        headers: {
          'mcp-session-id': 'connected-session',
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    });

    expect(resolved).toEqual({
      authMode: 'mcp_session',
      clientOptions: { apiKey: 'mcp-session-internal-token' },
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        connectUrl: expect.stringContaining('/oauth/mcp/connect?token='),
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: ['mcp:access'],
      },
    });
  });

  it('returns connect metadata when an MCP session exists but is not approved yet', async () => {
    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'shared-secret',
      },
      req: {
        headers: {
          'mcp-session-id': 'unapproved-session',
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    });

    expect(resolved).toEqual({
      authMode: 'none',
      clientOptions: {},
      oauth: {
        authorizationServerUrl: authServerBaseUrl,
        connectUrl: expect.stringContaining('/oauth/mcp/connect?token='),
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: [],
      },
    });
  });

  it('encodes requested reconnect scopes into the MCP connect token', async () => {
    const resolved = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: authServerBaseUrl,
        tokenExchangeSharedSecret: 'shared-secret',
      },
      requestedScopes: ['expenses:write', 'companies:read'],
      req: {
        headers: {
          'mcp-session-id': 'unapproved-session',
        },
      } as any,
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
    });

    const connectPayload = decodeConnectTokenPayload(String(resolved.oauth.connectUrl));
    expect(connectPayload['scp']).toEqual(['companies:read', 'expenses:write', 'mcp:access']);
  });

  it('returns an OAuth challenge for invalid JWTs', async () => {
    await expect(
      resolveClientAuth({
        mcpOptions: {
          authorizationServerUrl: authServerBaseUrl,
        },
        req: {
          headers: {
            authorization: 'Bearer a.b.c',
          },
        } as any,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
      }),
    ).rejects.toMatchObject<Partial<OAuthChallengeError>>({
      name: 'OAuthChallengeError',
      statusCode: 401,
    });

    try {
      await resolveClientAuth({
        mcpOptions: {
          authorizationServerUrl: authServerBaseUrl,
        },
        req: {
          headers: {
            authorization: 'Bearer a.b.c',
          },
        } as any,
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(OAuthChallengeError);
      expect((error as OAuthChallengeError).wwwAuthenticate).toContain('resource_metadata=');
    }
  });
});
