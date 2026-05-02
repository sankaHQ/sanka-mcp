import { IncomingMessage } from 'node:http';
import { OAuthChallengeError, resolveClientAuth } from '../src/auth';

describe('resolveClientAuth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects developer API tokens for MCP access', async () => {
    await expect(
      resolveClientAuth({
        mcpOptions: {
          authorizationServerUrl: 'https://app.example.com',
        },
        req: {
          headers: {
            authorization: 'Bearer sk_localapitoken',
          },
        } as IncomingMessage,
        resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.example.com/mcp',
      }),
    ).rejects.toBeInstanceOf(OAuthChallengeError);
  });

  it('introspects Sanka OAuth access tokens and forwards the same bearer token', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          active: true,
          client_id: 'client-1',
          scope: 'user-scope api-access',
          session_id: 'session-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          workspace_name: 'Workspace One',
        },
      }),
    } as Response);

    const auth = await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: 'https://app.example.com',
      },
      req: {
        headers: {
          authorization: 'Bearer soat_1234567890abcdef',
        },
      } as IncomingMessage,
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.example.com/mcp',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://app.example.com/api/v1/oauth/introspect', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer soat_1234567890abcdef',
      },
    });
    expect(auth.authMode).toBe('oauth_bearer');
    expect(auth.clientOptions.apiKey).toBe('soat_1234567890abcdef');
    expect(auth.oauth.scopes).toEqual(['user-scope', 'api-access']);
  });

  it('caches successful introspection responses briefly', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          active: true,
          client_id: 'client-1',
          scope: 'user-scope api-access',
          session_id: 'session-1',
        },
      }),
    } as Response);

    await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: 'https://app.example.com',
      },
      req: {
        headers: {
          authorization: 'Bearer soat_cache_token',
        },
      } as IncomingMessage,
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.example.com/mcp',
    });

    await resolveClientAuth({
      mcpOptions: {
        authorizationServerUrl: 'https://app.example.com',
      },
      req: {
        headers: {
          authorization: 'Bearer soat_cache_token',
        },
      } as IncomingMessage,
      resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.example.com/mcp',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects legacy JWT bearer tokens', async () => {
    await expect(
      resolveClientAuth({
        mcpOptions: {
          authorizationServerUrl: 'https://app.example.com',
        },
        req: {
          headers: {
            authorization: 'Bearer header.payload.signature',
          },
        } as IncomingMessage,
        resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.example.com/mcp',
      }),
    ).rejects.toBeInstanceOf(OAuthChallengeError);
  });
});
